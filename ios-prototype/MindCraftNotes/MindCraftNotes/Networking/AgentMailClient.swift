import Foundation

/// Thin REST client for [AgentMail](https://docs.agentmail.to) - create inbox,
/// list/get messages, send + reply. API key + inbox id persist in UserDefaults
/// for the Field Desk Live Inbox (Round 19).
@MainActor
final class AgentMailClient: ObservableObject {
    static let shared = AgentMailClient()

    private static let apiKeyKey = "deskOs.agentMail.apiKey"
    private static let inboxIdKey = "deskOs.agentMail.inboxId"
    private static let inboxEmailKey = "deskOs.agentMail.inboxEmail"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    private let base = URL(string: "https://api.agentmail.to/v0")!

    @Published var apiKey: String = ""
    @Published var inboxId: String?
    @Published var inboxEmail: String?
    @Published var messages: [AgentMailMessage] = []
    @Published var isBusy = false
    @Published var lastError: String?

    var isConfigured: Bool {
        !apiKey.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    var hasInbox: Bool { inboxId != nil && !(inboxId ?? "").isEmpty }

    init() {
        if Self.uiTesting {
            apiKey = ""
            inboxId = nil
            inboxEmail = nil
            return
        }
        apiKey = UserDefaults.standard.string(forKey: Self.apiKeyKey) ?? ""
        inboxId = UserDefaults.standard.string(forKey: Self.inboxIdKey)
        inboxEmail = UserDefaults.standard.string(forKey: Self.inboxEmailKey)
    }

    func saveApiKey(_ key: String) {
        apiKey = key.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !Self.uiTesting else { return }
        UserDefaults.standard.set(apiKey, forKey: Self.apiKeyKey)
    }

    func clearSession() {
        apiKey = ""
        inboxId = nil
        inboxEmail = nil
        messages = []
        lastError = nil
        guard !Self.uiTesting else { return }
        UserDefaults.standard.removeObject(forKey: Self.apiKeyKey)
        UserDefaults.standard.removeObject(forKey: Self.inboxIdKey)
        UserDefaults.standard.removeObject(forKey: Self.inboxEmailKey)
    }

    // MARK: - Inbox

    func ensureInbox(displayName: String = "The Desk") async {
        if hasInbox {
            await refreshMessages()
            return
        }
        await createInbox(displayName: displayName)
    }

    func createInbox(displayName: String = "The Desk") async {
        guard isConfigured else {
            lastError = "Add an AgentMail API key first (Manage → Mail, or Live Inbox setup)."
            return
        }
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            let data = try await request(
                method: "POST",
                path: "/inboxes",
                body: [
                    "display_name": displayName,
                    "client_id": "mindcraft-field-desk-v1",
                ]
            )
            let decoded = try JSONDecoder().decode(InboxResponse.self, from: data)
            inboxId = decoded.inbox_id
            inboxEmail = decoded.email
            if !Self.uiTesting {
                UserDefaults.standard.set(decoded.inbox_id, forKey: Self.inboxIdKey)
                UserDefaults.standard.set(decoded.email, forKey: Self.inboxEmailKey)
            }
            await refreshMessages()
        } catch {
            lastError = error.localizedDescription
        }
    }

    func listInboxes() async -> [InboxResponse] {
        guard isConfigured else { return [] }
        do {
            let data = try await request(method: "GET", path: "/inboxes")
            let decoded = try JSONDecoder().decode(InboxListResponse.self, from: data)
            return decoded.inboxes ?? []
        } catch {
            lastError = error.localizedDescription
            return []
        }
    }

    func adoptInbox(_ inbox: InboxResponse) {
        inboxId = inbox.inbox_id
        inboxEmail = inbox.email
        if !Self.uiTesting {
            UserDefaults.standard.set(inbox.inbox_id, forKey: Self.inboxIdKey)
            UserDefaults.standard.set(inbox.email, forKey: Self.inboxEmailKey)
        }
    }

    // MARK: - Messages

    func refreshMessages() async {
        guard isConfigured, let inboxId else { return }
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            let data = try await request(
                method: "GET",
                path: "/inboxes/\(inboxId)/messages",
                query: ["limit": "30"]
            )
            let decoded = try JSONDecoder().decode(MessageListResponse.self, from: data)
            messages = decoded.messages ?? []
        } catch {
            lastError = error.localizedDescription
        }
    }

    func getMessage(id: String) async -> AgentMailMessageDetail? {
        guard isConfigured, let inboxId else { return nil }
        do {
            let data = try await request(
                method: "GET",
                path: "/inboxes/\(inboxId)/messages/\(id)"
            )
            return try JSONDecoder().decode(AgentMailMessageDetail.self, from: data)
        } catch {
            lastError = error.localizedDescription
            return nil
        }
    }

    func send(to: String, subject: String, text: String) async -> Bool {
        guard isConfigured, let inboxId else {
            lastError = "No inbox yet"
            return false
        }
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            _ = try await request(
                method: "POST",
                path: "/inboxes/\(inboxId)/messages/send",
                body: [
                    "to": to,
                    "subject": subject,
                    "text": text,
                ]
            )
            await refreshMessages()
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    func reply(messageId: String, text: String) async -> Bool {
        guard isConfigured, let inboxId else { return false }
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            _ = try await request(
                method: "POST",
                path: "/inboxes/\(inboxId)/messages/\(messageId)/reply",
                body: ["text": text]
            )
            await refreshMessages()
            return true
        } catch {
            lastError = error.localizedDescription
            return false
        }
    }

    // MARK: - HTTP

    private func request(
        method: String,
        path: String,
        query: [String: String] = [:],
        body: [String: Any]? = nil
    ) async throws -> Data {
        let trimmed = path.hasPrefix("/") ? String(path.dropFirst()) : path
        guard var components = URLComponents(string: "\(base.absoluteString)/\(trimmed)") else {
            throw AgentMailError.badURL
        }
        if !query.isEmpty {
            components.queryItems = query.map { URLQueryItem(name: $0.key, value: $0.value) }
        }
        guard let url = components.url else {
            throw AgentMailError.badURL
        }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        req.setValue("application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: body)
        }
        let (data, response) = try await URLSession.shared.data(for: req)
        guard let http = response as? HTTPURLResponse else {
            throw AgentMailError.badResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8) ?? "HTTP \(http.statusCode)"
            throw AgentMailError.api("\(http.statusCode): \(msg)")
        }
        return data
    }
}

enum AgentMailError: LocalizedError {
    case badURL, badResponse, api(String)
    var errorDescription: String? {
        switch self {
        case .badURL: return "Bad AgentMail URL"
        case .badResponse: return "Bad AgentMail response"
        case .api(let s): return s
        }
    }
}

// MARK: - Models

struct InboxResponse: Codable, Identifiable {
    var id: String { inbox_id }
    let inbox_id: String
    let email: String
    let display_name: String?
    let pod_id: String?
}

struct InboxListResponse: Codable {
    let inboxes: [InboxResponse]?
    let count: Int?
}

struct MessageListResponse: Codable {
    let messages: [AgentMailMessage]?
    let count: Int?
}

struct AgentMailMessage: Codable, Identifiable, Equatable {
    var id: String { message_id }
    let inbox_id: String?
    let thread_id: String?
    let message_id: String
    let from: String?
    let to: [String]?
    let subject: String?
    let preview: String?
    let timestamp: String?
    let labels: [String]?
}

struct AgentMailMessageDetail: Codable, Identifiable {
    var id: String { message_id }
    let inbox_id: String?
    let thread_id: String?
    let message_id: String
    let from: String?
    let to: [String]?
    let subject: String?
    let preview: String?
    let text: String?
    let html: String?
    let extracted_text: String?
    let extracted_html: String?
    let timestamp: String?
}

/// Local “✨ Suggested reply” engine (Gmail-style) until a mounted AI agent
/// owns drafting. Pattern-matches subject/body for a natural short reply.
enum SuggestedReplyEngine {
    static func suggest(
        from: String?,
        subject: String?,
        body: String?,
        signer: String
    ) -> String {
        // Split into typed steps — the single chained expression made the
        // type-checker time out on CI's x86 runner (same semantics).
        let sender: String = from ?? "there"
        let beforeAngle: Substring = sender.split(separator: "<").first ?? Substring(sender)
        let trimmedName: String = String(beforeAngle).trimmingCharacters(in: .whitespacesAndNewlines)
        let firstWord: Substring? = trimmedName.split(separator: " ").first
        let first: String = firstWord.map(String.init) ?? "there"
        let blob = "\(subject ?? "") \(body ?? "")".lowercased()

        let core: String
        if blob.contains("onboard") || blob.contains("on-boarding") || blob.contains("welcome") {
            core = "So sorry about that! I've just resent the onboarding email your way. Let me know if it still doesn't show up."
        } else if blob.contains("meeting") || blob.contains("schedule") || blob.contains("availability") {
            core = "Thanks for the note - happy to find a time. What windows work for you this week?"
        } else if blob.contains("thanks") || blob.contains("thank you") {
            core = "You're welcome! Glad that helped - shout if anything else comes up."
        } else if blob.contains("?") {
            core = "Thanks for reaching out - looping on this now and will follow up shortly with a clear answer."
        } else {
            core = "Thanks for the email - got it. I'll take a look and get back to you soon."
        }

        return "Hi \(first),\n\n\(core)\n\nBest,\n\(signer)"
    }

    static func summarize(subject: String?, preview: String?, body: String?) -> String {
        let text = (body ?? preview ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let subj = (subject ?? "(no subject)").trimmingCharacters(in: .whitespacesAndNewlines)
        if text.isEmpty {
            return "Summary: \(subj)."
        }
        let clipped = text
            .replacingOccurrences(of: "\n+", with: " ", options: .regularExpression)
            .prefix(160)
        return "Summary: \(subj) - \(clipped)\(text.count > 160 ? "…" : "")"
    }
}
