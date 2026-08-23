import Combine
import Foundation
import Security

/// Student's optional bring-your-own AI key for homework help.
/// The **raw key lives only in the Keychain** — never Firestore, UserDefaults,
/// or logs. The only hosts this type will send the key to are the provider's
/// own REST APIs (`api.groq.com`, `api.anthropic.com`,
/// `generativelanguage.googleapis.com`).
@MainActor
final class StudentAIKeyStore: ObservableObject {
    static let shared = StudentAIKeyStore()

    enum Provider: String, CaseIterable, Identifiable {
        case groq
        case anthropic
        /// Google's Gemini API (2026-08-23) - the provider behind the new
        /// student onboarding flow (`GeminiOnboardingView`): Google offers
        /// Gemini free to students, so this is the key a brand-new student
        /// is guided to create. Same BYOK shape as the other two - a plain
        /// REST API key sent only to Google's own host, never MindCraft's
        /// backend - the only mechanical difference is that Google takes
        /// the key as a `?key=` query parameter instead of an auth header.
        case gemini

        var id: String { rawValue }

        var title: String {
            switch self {
            case .groq: return "Groq"
            case .anthropic: return "Anthropic"
            case .gemini: return "Gemini"
            }
        }

        var host: String {
            switch self {
            case .groq: return "api.groq.com"
            case .anthropic: return "api.anthropic.com"
            case .gemini: return "generativelanguage.googleapis.com"
            }
        }
    }

    enum SolveError: Error {
        case noKey
        case rejected
        case unavailable
    }

    @Published private(set) var hasKey = false
    @Published private(set) var provider: Provider?

    private let service = "com.mindcraft.notes.prototype.studentAIKey"

    private init() {
        refreshPresence()
    }

    func save(provider: Provider, key: String) -> Bool {
        let trimmed = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, let data = trimmed.data(using: .utf8) else { return false }

        let match: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        let updates: [String: Any] = [
            kSecAttrAccount as String: provider.rawValue,
            kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
            kSecValueData as String: data,
        ]
        let updateStatus = SecItemUpdate(match as CFDictionary, updates as CFDictionary)
        let status: OSStatus
        if updateStatus == errSecItemNotFound {
            let add: [String: Any] = [
                kSecClass as String: kSecClassGenericPassword,
                kSecAttrService as String: service,
                kSecAttrAccount as String: provider.rawValue,
                kSecAttrAccessible as String: kSecAttrAccessibleWhenUnlockedThisDeviceOnly,
                kSecValueData as String: data,
            ]
            status = SecItemAdd(add as CFDictionary, nil)
        } else {
            status = updateStatus
        }
        refreshPresence()
        return status == errSecSuccess
    }

    func remove() {
        deleteItem()
        refreshPresence()
    }

    /// Tiny request against the provider's own host. Never logs the key.
    func testConnection() async -> Result<Void, SolveError> {
        await complete(system: Self.tutorSystemPrompt, user: "Reply with the single word: ok")
            .map { _ in () }
    }

    /// Homework answer from the student's key, or an error. Does not fall
    /// back to MindCraft's engine — caller does that only when `hasKey` is false.
    func solveHomework(problemText: String) async -> Result<String, SolveError> {
        await complete(system: Self.tutorSystemPrompt, user: problemText)
    }

    /// Real AI-drafted email reply from the student's own key - the Work
    /// Dashboard's "open my recent email and draft a response" ask used to
    /// fall back to a hardcoded template (`GmailClient.suggestedReply`)
    /// that never read the actual email; this is what makes "draft a
    /// response" mean something real once a key is connected.
    func draftEmailReply(from sender: String, subject: String, snippet: String) async -> Result<String, SolveError> {
        let user = """
        From: \(sender)
        Subject: \(subject)

        \(snippet)

        Write a reply.
        """
        return await complete(system: Self.emailDraftSystemPrompt, user: user)
    }

    /// A real, honest study-plan generation call for Learn Studio's intake
    /// (2026-08-17). Deliberately does NOT claim to browse the live web -
    /// nothing in this app has a real search-API integration (confirmed
    /// tonight: no live web-search capability exists anywhere in the
    /// codebase), so the prompt only draws on the model's own knowledge
    /// plus whatever real bank content is available - claiming "researched
    /// online" when it didn't would be exactly the kind of fake capability
    /// this app has avoided all night. `matchedConceptId` is the honest
    /// part: rather than have the LLM invent unverified practice questions
    /// (no firewall/oracle exists for arbitrary topics the way Blake's
    /// ingredient-first pipeline has for math), it's asked to name a real
    /// concept id from the list actually available in `SampleQuestion.all`
    /// if the topic matches one - `nil` means honestly "no verified
    /// practice bank for this yet," not a fabricated question set.
    func generateStudyPlan(topic: String, level: String, knownConceptIds: [String]) async -> Result<StudyPlan, SolveError> {
        let user = """
        Topic the student wants to study: \(topic)
        Their self-described level: \(level)

        Known concept ids with a REAL, verified practice question bank today: \(knownConceptIds.joined(separator: ", "))

        Respond with ONLY this JSON shape, no other text:
        {"definition": "...", "context": "...", "layout": "full|quick|practiceOnly", "matchedConceptId": "..." or null}

        - definition: one or two plain sentences stating the core idea, no jargon.
        - context: one or two sentences on why this matters / where it fits, second person, warm.
        - layout: "full" if the topic genuinely has a definition, a context, and a worked example worth separating; "quick" if definition and context naturally belong together; "practiceOnly" if the student clearly just wants to practice, not be taught.
        - matchedConceptId: the exact id string from the known list above ONLY if the topic is genuinely that concept - otherwise null. Never invent an id not in that list.
        """
        let result = await complete(system: Self.studyPlanSystemPrompt, user: user)
        switch result {
        case .success(let text):
            guard let plan = StudyPlan.parse(text) else { return .failure(.unavailable) }
            return .success(plan)
        case .failure(let error):
            return .failure(error)
        }
    }

    /// Real generation for the Work Dashboard's conversational "I want to
    /// learn X" flow (2026-08-18) - used only when nothing in the bundled
    /// book archive (`BookGraphLoader`) already matches the topic. Same
    /// honesty rule as `generateStudyPlan`: no live web access, no invented
    /// concept ids outside the known bank, and the chapters are the
    /// model's own knowledge, not a claim of researched material.
    /// `referenceMaterial` (2026-08-18, explicit ask: "he has uploaded a
    /// file, use that as reference") - real content from the student's
    /// own Homework Help upload (already-summarized cards, not raw OCR
    /// text), when they explicitly pointed Jesse at it. When present, the
    /// chapters/definition below are asked to actually reflect that
    /// material, not just the model's own general knowledge of the topic.
    func generateTableOfContents(topic: String, knownConceptIds: [String], referenceMaterial: String? = nil) async -> Result<LessonOutline, SolveError> {
        let referenceBlock = referenceMaterial.map { "\n\nThe student uploaded this material - base the lesson on it, not just your own general knowledge of the topic:\n\($0)" } ?? ""
        let user = """
        Topic the student wants to learn: \(topic)\(referenceBlock)

        Known concept ids with a REAL, verified practice question bank today: \(knownConceptIds.joined(separator: ", "))

        Respond with ONLY this JSON shape, no other text:
        {"definition": "...", "chapters": ["...", "..."], "chapterBodies": ["...", "..."], "question": "..." or null, "matchedConceptId": "..." or null}

        - definition: one or two plain sentences stating the core idea, no jargon.
        - chapters: 4 to 6 short sub-topic titles, in the order a student should learn them.
        - chapterBodies: one real paragraph PER chapter, same order and same length as chapters - this is what the student actually reads for that chapter, not a repeat of definition. Teach the sub-topic, don't just describe it.
        - question: one concrete practice question testing the FIRST chapter, or null if you cannot write one honestly.
        - matchedConceptId: the exact id string from the known list above ONLY if the topic is genuinely that concept - otherwise null. Never invent an id not in that list.
        """
        let result = await complete(system: Self.tableOfContentsSystemPrompt, user: user)
        switch result {
        case .success(let text):
            guard let outline = LessonOutline.parse(text) else { return .failure(.unavailable) }
            return .success(outline)
        case .failure(let error):
            return .failure(error)
        }
    }

    /// Any other real question about the student's own desk data (recent
    /// mail, calendar, binder) - the Work Dashboard's search used to route
    /// everything through the shared backend (`DeskAskClient`), which
    /// silently falls back to a generic "Opening your Gmail box." template
    /// whenever its own LLM call fails, indistinguishable from a real
    /// answer. Answering directly with the student's own key means "tell
    /// me more about this recurring email" actually reads their real
    /// recent mail instead of returning a canned navigation string.
    func answerDeskQuestion(question: String, context: String) async -> Result<String, SolveError> {
        let user = """
        \(context)

        Question: \(question)
        """
        return await complete(system: Self.deskAssistantSystemPrompt, user: user)
    }

    /// General-purpose ask for Design Studio's Ask boxes - one goal per box
    /// (set by whoever built the box), not a fixed persona the way
    /// solveHomework/generateStudyPlan/answerDeskQuestion each are.
    func ask(systemPrompt: String, userPrompt: String) async -> Result<String, SolveError> {
        await complete(system: systemPrompt, user: userPrompt)
    }

    private func complete(system: String, user: String) async -> Result<String, SolveError> {
        let creds = readAllCredentials()
        guard !creds.isEmpty else { return .failure(.noKey) }
        var lastFailure: SolveError = .noKey
        for cred in creds {
            let result: Result<String, SolveError>
            switch cred.provider {
            case .groq:
                result = await groqChat(key: cred.key, system: system, user: user)
            case .anthropic:
                result = await anthropicMessage(key: cred.key, system: system, user: user)
            case .gemini:
                result = await geminiGenerateContent(key: cred.key, system: system, user: user)
            }
            if case .success = result { return result }
            if case .failure(let err) = result { lastFailure = err }
        }
        return .failure(lastFailure)
    }

    private func groqChat(key: String, system: String, user: String) async -> Result<String, SolveError> {
        guard let url = URL(string: "https://api.groq.com/openai/v1/chat/completions"),
              url.host == Provider.groq.host
        else { return .failure(.unavailable) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(key)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "model": "openai/gpt-oss-120b",
            "temperature": 0.2,
            "max_completion_tokens": 1024,
            "reasoning_effort": "low",
            "messages": [
                ["role": "system", "content": system],
                ["role": "user", "content": user],
            ],
        ])
        return await decodeProviderText(request: request) { json in
            let choices = json["choices"] as? [[String: Any]]
            let message = choices?.first?["message"] as? [String: Any]
            return message?["content"] as? String
        }
    }

    private func anthropicMessage(key: String, system: String, user: String) async -> Result<String, SolveError> {
        guard let url = URL(string: "https://api.anthropic.com/v1/messages"),
              url.host == Provider.anthropic.host
        else { return .failure(.unavailable) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue(key, forHTTPHeaderField: "x-api-key")
        request.setValue("2023-06-01", forHTTPHeaderField: "anthropic-version")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "model": "claude-haiku-4-5-20251001",
            "max_tokens": 1024,
            "system": system,
            "messages": [
                ["role": "user", "content": user],
            ],
        ])
        return await decodeProviderText(request: request) { json in
            let blocks = json["content"] as? [[String: Any]]
            return blocks?.first(where: { ($0["type"] as? String) == "text" })?["text"] as? String
        }
    }

    /// Mirrors `groqChat`/`anthropicMessage` exactly - same request/decode
    /// shape, same never-log-the-key rule. Google's REST API authenticates
    /// with the raw key as a `?key=` query parameter (not a bearer header),
    /// so the key rides in the URL - built via URLComponents so it gets
    /// percent-encoded, and the host is still pinned to the provider's own
    /// domain before anything is sent.
    private func geminiGenerateContent(key: String, system: String, user: String) async -> Result<String, SolveError> {
        var components = URLComponents()
        components.scheme = "https"
        components.host = Provider.gemini.host
        components.path = "/v1beta/models/gemini-2.5-flash:generateContent"
        components.queryItems = [URLQueryItem(name: "key", value: key)]
        guard let url = components.url, url.host == Provider.gemini.host
        else { return .failure(.unavailable) }
        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "system_instruction": ["parts": [["text": system]]],
            "contents": [
                ["role": "user", "parts": [["text": user]]],
            ],
            "generationConfig": [
                "temperature": 0.2,
                "maxOutputTokens": 1024,
                // Gemini 2.5 models spend maxOutputTokens on hidden
                // "thinking" first by default - with a 1024 budget that can
                // consume the whole allowance and return zero visible text.
                // Same intent as groqChat's `reasoning_effort: "low"`.
                "thinkingConfig": ["thinkingBudget": 0],
            ],
        ])
        // Google rejects a bad/malformed API key with 400 INVALID_ARGUMENT,
        // not 401 - without this flag a wrong pasted key would read as
        // "could not reach the provider" instead of "key rejected".
        return await decodeProviderText(request: request, badRequestMeansRejected: true) { json in
            let candidates = json["candidates"] as? [[String: Any]]
            let content = candidates?.first?["content"] as? [String: Any]
            let parts = content?["parts"] as? [[String: Any]]
            return parts?.compactMap { $0["text"] as? String }.joined()
        }
    }

    private func decodeProviderText(
        request: URLRequest,
        badRequestMeansRejected: Bool = false,
        extract: ([String: Any]) -> String?
    ) async -> Result<String, SolveError> {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .failure(.unavailable) }
            if http.statusCode == 401 || http.statusCode == 403
                || (badRequestMeansRejected && http.statusCode == 400) {
                return .failure(.rejected)
            }
            guard (200...299).contains(http.statusCode),
                  let json = try JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let text = extract(json)?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !text.isEmpty
            else {
                return .failure(.unavailable)
            }
            return .success(text)
        } catch {
            return .failure(.unavailable)
        }
    }

    private func refreshPresence() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: false,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        if status == errSecSuccess,
           let attrs = out as? [String: Any],
           let account = attrs[kSecAttrAccount as String] as? String,
           let provider = Provider(rawValue: account) {
            hasKey = true
            self.provider = provider
        } else {
            hasKey = false
            provider = nil
        }
    }

    /// Every stored credential, not just one - real bug, found via direct
    /// live feedback 2026-08-21 ("I put both API keys... and it defaulted
    /// back to calculus"): both `readCredentials`'s old single-item query
    /// AND `refreshPresence` used `kSecMatchLimitOne` with no account
    /// filter, so with both a Groq and an Anthropic key saved, whichever
    /// one the Keychain happened to surface first was the ONLY one ever
    /// tried - a student adding a fresh key specifically to fix a rejected
    /// one had no guarantee the new key was even the one read back. `complete()`
    /// below now tries every stored credential in turn.
    private func readAllCredentials() -> [(provider: Provider, key: String)] {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitAll,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess, let items = out as? [[String: Any]] else { return [] }
        return items.compactMap { attrs in
            guard let account = attrs[kSecAttrAccount as String] as? String,
                  let provider = Provider(rawValue: account),
                  let data = attrs[kSecValueData as String] as? Data,
                  let key = String(data: data, encoding: .utf8)?
                    .trimmingCharacters(in: .whitespacesAndNewlines),
                  !key.isEmpty
            else { return nil }
            return (provider, key)
        }
    }

    private func deleteItem() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
        ]
        SecItemDelete(query as CFDictionary)
    }

    private static let tutorSystemPrompt = """
    You are a homework tutor for a high-school student. Solve the problem \
    they paste. Show the steps briefly, then the answer. Do not mention API keys.
    """

    private static let emailDraftSystemPrompt = """
    You are drafting a short, polite reply to an email on behalf of a \
    high-school student. Given the sender, subject, and preview of an email \
    they received, write ONLY the reply body text - a natural greeting, a \
    few sentences that actually respond to what the email says, then a \
    sign-off. No subject line, no "Here is a draft" preamble, no mention of \
    API keys or that you are an AI.
    """

    private static let deskAssistantSystemPrompt = """
    You are a helpful assistant inside a high-school student's desk/\
    dashboard app called The Desk. Answer their question using ONLY the \
    context given below - recent emails, calendar events, and binder \
    items. Be concise and specific (name the actual sender/subject/date \
    when relevant instead of speaking generally). If the context doesn't \
    have enough to answer, say so honestly instead of guessing. Do not \
    mention API keys or that you are an AI.
    """

    private static let studyPlanSystemPrompt = """
    You are Jesse, planning a study session for a high-school student \
    inside The Desk. You do not have live internet access - work from \
    your own knowledge only, and say so honestly in the definition/context \
    text if you are uncertain rather than inventing specifics. Respond \
    with strict JSON only, matching exactly the shape the user message \
    specifies - no markdown fences, no commentary before or after.
    """

    private static let tableOfContentsSystemPrompt = """
    You are Jesse, building a short lesson outline for a high-school \
    student inside The Desk's Work dashboard. You do not have live \
    internet access - work from your own knowledge only. Respond with \
    strict JSON only, matching exactly the shape the user message \
    specifies - no markdown fences, no commentary before or after.
    """
}

/// Parsed via `StudyPlan.parse(_:)`, not a plain `Decodable` conformance -
/// the model sometimes wraps JSON in prose or code fences despite
/// instructions not to, so this extracts the first `{...}` object before
/// decoding rather than failing outright on a technically-invalid response
/// that a human would still recognize as "the JSON, plus noise."
struct StudyPlan: Decodable, Equatable {
    let definition: String
    let context: String
    let layout: String
    let matchedConceptId: String?

    static func parse(_ raw: String) -> StudyPlan? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}"), start < end else { return nil }
        let jsonSlice = raw[start...end]
        guard let data = jsonSlice.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(StudyPlan.self, from: data)
    }
}

/// Parsed the same lenient way as `StudyPlan` - see its own doc comment.
/// Generated fallback for the Work Dashboard's "I want to learn X" flow
/// when no bundled book archive already covers the topic (see
/// `JesseCallSession.askJesseWorkDashboard`).
struct LessonOutline: Decodable, Equatable {
    let definition: String
    let chapters: [String]
    /// Real per-chapter content, same index as `chapters` (2026-08-19,
    /// Study Session/Assignment L - see CURSOR_HANDOFF.md). Optional
    /// because older cached/decoded responses (or a model that ignores
    /// the field) shouldn't fail to parse - `chapterBody(at:)` below falls
    /// back to `definition` when this is absent or short, so a tab always
    /// has SOMETHING real to show, never a blank page.
    let chapterBodies: [String]?
    let question: String?
    let matchedConceptId: String?

    func chapterBody(at index: Int) -> String {
        if let body = chapterBodies?[safe: index], !body.isEmpty { return body }
        return definition
    }

    static func parse(_ raw: String) -> LessonOutline? {
        guard let start = raw.firstIndex(of: "{"), let end = raw.lastIndex(of: "}"), start < end else { return nil }
        let jsonSlice = raw[start...end]
        guard let data = jsonSlice.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(LessonOutline.self, from: data)
    }
}

private extension Array {
    subscript(safe index: Int) -> Element? {
        indices.contains(index) ? self[index] : nil
    }
}
