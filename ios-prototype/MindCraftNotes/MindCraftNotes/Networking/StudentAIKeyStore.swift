import Combine
import Foundation
import Security

/// Student's optional bring-your-own AI key for homework help.
/// The **raw key lives only in the Keychain** — never Firestore, UserDefaults,
/// or logs. The only hosts this type will send the key to are the provider's
/// own REST APIs (`api.groq.com`, `api.anthropic.com`).
@MainActor
final class StudentAIKeyStore: ObservableObject {
    static let shared = StudentAIKeyStore()

    enum Provider: String, CaseIterable, Identifiable {
        case groq
        case anthropic

        var id: String { rawValue }

        var title: String {
            switch self {
            case .groq: return "Groq"
            case .anthropic: return "Anthropic"
            }
        }

        var host: String {
            switch self {
            case .groq: return "api.groq.com"
            case .anthropic: return "api.anthropic.com"
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

    private func complete(system: String, user: String) async -> Result<String, SolveError> {
        guard let creds = readCredentials() else { return .failure(.noKey) }
        switch creds.provider {
        case .groq:
            return await groqChat(key: creds.key, system: system, user: user)
        case .anthropic:
            return await anthropicMessage(key: creds.key, system: system, user: user)
        }
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

    private func decodeProviderText(
        request: URLRequest,
        extract: ([String: Any]) -> String?
    ) async -> Result<String, SolveError> {
        do {
            let (data, response) = try await URLSession.shared.data(for: request)
            guard let http = response as? HTTPURLResponse else { return .failure(.unavailable) }
            if http.statusCode == 401 || http.statusCode == 403 {
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

    private func readCredentials() -> (provider: Provider, key: String)? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecMatchLimit as String: kSecMatchLimitOne,
            kSecReturnAttributes as String: true,
            kSecReturnData as String: true,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        guard status == errSecSuccess,
              let attrs = out as? [String: Any],
              let account = attrs[kSecAttrAccount as String] as? String,
              let provider = Provider(rawValue: account),
              let data = attrs[kSecValueData as String] as? Data,
              let key = String(data: data, encoding: .utf8)?
                .trimmingCharacters(in: .whitespacesAndNewlines),
              !key.isEmpty
        else { return nil }
        return (provider, key)
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
}
