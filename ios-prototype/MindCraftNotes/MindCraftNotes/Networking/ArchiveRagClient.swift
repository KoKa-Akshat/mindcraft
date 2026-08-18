import Foundation

/// Native client for `POST /api/archive-rag` - the same endpoint `agent.js`
/// (the web Archive workflow) calls, ported so `JesseCallSession` can run a
/// full call without a WKWebView in the loop at all. Anonymous - the
/// webhook itself is unauthenticated (no student PII required to ask a
/// question about a book), same as the web client.
///
/// Real corpus (`webhook/data/dans-archive-chunks.json`, lexically indexed
/// by `webhook/lib/handlers/archive-rag.ts`): Dan McCreary's actual open
/// textbooks - Calculus, Algebra I, Geometry, Linear Algebra, Biology,
/// Chemistry, Physics, Computer Science, and more, not just the literary/
/// philosophy book concept graphs `BookGraphLoader` covers. Correction
/// (2026-08-18): `JesseCallSession.askJesseWorkDashboard` originally only
/// checked `BookGraphLoader`, which genuinely doesn't cover a topic like
/// "calculus" - but this archive does, and was already live, just not
/// wired into that flow. `hits` was previously decoded away entirely even
/// though the endpoint always returns it - now exposed so a caller can
/// build a real, cited, multi-item table of contents instead of only a
/// single spoken sentence.
enum ArchiveRagClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/archive-rag")!

    struct Hit: Decodable {
        let bookTitle: String
        let pageTitle: String
        let pageUrl: String
    }

    struct Answer {
        let reply: String
        let hits: [Hit]
    }

    private struct ResponseWire: Decodable {
        let reply: String?
        let hits: [Hit]?
    }

    static func ask(message: String, studentWeakness: (conceptId: String, label: String)?) async -> String? {
        await askDetailed(message: message, studentWeakness: studentWeakness)?.reply
    }

    /// Same request/endpoint as `ask(message:studentWeakness:)`, but keeps
    /// the real `hits` (book/page/URL) the endpoint already returns
    /// instead of throwing them away - `ask` stays as the simple, existing
    /// entry point every other call site already uses unchanged.
    static func askDetailed(message: String, studentWeakness: (conceptId: String, label: String)?) async -> Answer? {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = ["message": message]
        if let studentWeakness {
            body["studentWeakness"] = ["conceptId": studentWeakness.conceptId, "label": studentWeakness.label]
        }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(ResponseWire.self, from: data),
            let reply = decoded.reply
        else { return nil }

        return Answer(reply: reply, hits: decoded.hits ?? [])
    }
}
