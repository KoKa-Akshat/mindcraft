import Foundation
import FirebaseAuth

/// One chapter of a Jesse-guided book draft. Mirrors
/// `webhook/lib/handlers/book-agent.ts`'s `BookChapter` field-for-field.
struct BookAgentChapter: Codable, Equatable {
    var title: String
    var body: String
}

/// The book-in-progress `agent.js`'s `ask()` sends and receives on every
/// turn. Mirrors `webhook/lib/handlers/book-agent.ts`'s `BookDraft` exactly
/// - `topic`/`title`/`chapters`, nothing else.
struct BookAgentDraft: Codable, Equatable {
    var topic: String
    var title: String
    var chapters: [BookAgentChapter]

    static let empty = BookAgentDraft(topic: "", title: "", chapters: [])
}

/// Native client for `POST /api/book-agent` - the same stateless endpoint
/// `agent_work/product/desk_os/workflows/book/agent.js`'s `ask()` calls, so
/// `JesseCallSession`'s native call can drive the exact same book-writing
/// loop the web page used to, without a WKWebView in the middle at all.
/// Same self-contained pattern as `ArchiveRagClient` (this app's other
/// native port of a web `agent.js` request/response cycle). Firebase Bearer
/// auth (2026-08-25, was open) - the old web `agent.js` for this workflow
/// is dead (see `BookWorkflowView.swift`), so this native client is the
/// endpoint's only live caller.
enum BookAgentClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/book-agent")!

    struct Reply {
        let reply: String
        let draft: BookAgentDraft
        let readyToPublish: Bool
    }

    private struct ResponseWire: Decodable {
        let reply: String?
        let draft: BookAgentDraft?
        let readyToPublish: Bool?
    }

    /// Mirrors `agent.js`'s `ask()` request/response cycle exactly:
    /// `{ message, draft }` in, `{ reply, draft, readyToPublish }` out.
    static func ask(message: String, draft: BookAgentDraft) async -> Reply? {
        guard let user = Auth.auth().currentUser else { return nil }
        guard let token = try? await user.getIDToken() else { return nil }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "message": message,
            "draft": [
                "topic": draft.topic,
                "title": draft.title,
                "chapters": draft.chapters.map { ["title": $0.title, "body": $0.body] },
            ],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(ResponseWire.self, from: data),
            let reply = decoded.reply
        else { return nil }

        return Reply(reply: reply, draft: decoded.draft ?? draft, readyToPublish: decoded.readyToPublish ?? false)
    }
}
