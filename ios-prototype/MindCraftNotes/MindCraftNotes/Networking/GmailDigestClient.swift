import Foundation

/// Calls `/api/gmail-digest` (webhook) with a batch of already-fetched
/// `GmailClient.Message` previews and gets back a short AI triage: what
/// needs a reply/has a deadline (`actionItems`) versus what's routine
/// (`fyi`). The webhook never touches Gmail itself - it only ever sees
/// from/subject/snippet/date the student already pulled via their own
/// OAuth (`GmailClient.fetchInbox`). Stateless on the server side, same as
/// `resume-agent`/`book-agent` - persisting the result is a separate,
/// native-side Firestore write (`GmailDigestStore`), not this client's job.
@MainActor
final class GmailDigestClient: ObservableObject {
    static let shared = GmailDigestClient()

    struct Item: Identifiable, Equatable {
        let id = UUID()
        var from: String
        var subject: String
        var why: String
    }

    struct Digest: Equatable {
        var headline: String
        var actionItems: [Item]
        var fyi: [Item]
        var fallback: Bool
    }

    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/gmail-digest")!

    @Published private(set) var digest: Digest?
    @Published private(set) var isBusy = false
    @Published var lastError: String?

    private static let cacheKey = "deskOs.lastGmailDigest.v1"

    private init() {
        if !ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory") {
            digest = Self.loadCache()
        }
    }

    func summarize(_ messages: [GmailClient.Message]) async {
        guard !messages.isEmpty else { return }
        lastError = nil
        isBusy = true
        defer { isBusy = false }

        let payload: [String: Any] = [
            "messages": messages.prefix(20).map { m in
                [
                    "from": m.from,
                    "subject": m.subject,
                    "snippet": m.snippet,
                    "dateLabel": m.dateLabel,
                ]
            },
        ]

        do {
            var req = URLRequest(url: Self.endpoint)
            req.httpMethod = "POST"
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try JSONSerialization.data(withJSONObject: payload)
            let (data, resp) = try await URLSession.shared.data(for: req)
            guard let http = resp as? HTTPURLResponse, (200...299).contains(http.statusCode) else {
                lastError = "Couldn't summarize your inbox right now."
                return
            }
            guard let json = try JSONSerialization.jsonObject(with: data) as? [String: Any] else {
                lastError = "Couldn't read the summary."
                return
            }
            digest = Self.parse(json)
            if let digest { Self.saveCache(digest) }
        } catch {
            lastError = "Couldn't reach the summary service. Check your connection."
        }
    }

    private struct CachedDigest: Codable {
        var headline: String
        var actionItems: [CachedItem]
        var fyi: [CachedItem]
        var fallback: Bool
    }

    private struct CachedItem: Codable {
        var from: String
        var subject: String
        var why: String
    }

    private static func loadCache() -> Digest? {
        guard let data = UserDefaults.standard.data(forKey: cacheKey),
              let cached = try? JSONDecoder().decode(CachedDigest.self, from: data)
        else { return nil }
        return Digest(
            headline: cached.headline,
            actionItems: cached.actionItems.map { Item(from: $0.from, subject: $0.subject, why: $0.why) },
            fyi: cached.fyi.map { Item(from: $0.from, subject: $0.subject, why: $0.why) },
            fallback: cached.fallback
        )
    }

    private static func saveCache(_ digest: Digest) {
        let cached = CachedDigest(
            headline: digest.headline,
            actionItems: digest.actionItems.map { CachedItem(from: $0.from, subject: $0.subject, why: $0.why) },
            fyi: digest.fyi.map { CachedItem(from: $0.from, subject: $0.subject, why: $0.why) },
            fallback: digest.fallback
        )
        if let data = try? JSONEncoder().encode(cached) {
            UserDefaults.standard.set(data, forKey: cacheKey)
        }
    }

    private static func parse(_ json: [String: Any]) -> Digest {
        func items(_ key: String) -> [Item] {
            ((json[key] as? [[String: Any]]) ?? []).map {
                Item(
                    from: $0["from"] as? String ?? "",
                    subject: $0["subject"] as? String ?? "",
                    why: $0["why"] as? String ?? ""
                )
            }
        }
        return Digest(
            headline: json["headline"] as? String ?? "",
            actionItems: items("actionItems"),
            fyi: items("fyi"),
            fallback: json["fallback"] as? Bool ?? false
        )
    }
}
