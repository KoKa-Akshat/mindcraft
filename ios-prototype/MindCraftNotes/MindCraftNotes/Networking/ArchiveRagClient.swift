import Foundation

/// Native client for `POST /api/archive-rag` - the same endpoint `agent.js`
/// (the web Archive workflow) calls, ported so `JesseCallSession` can run a
/// full call without a WKWebView in the loop at all. Anonymous - the
/// webhook itself is unauthenticated (no student PII required to ask a
/// question about a book), same as the web client.
enum ArchiveRagClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/archive-rag")!

    private struct ResponseWire: Decodable {
        let reply: String?
    }

    static func ask(message: String, studentWeakness: (conceptId: String, label: String)?) async -> String? {
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
            let decoded = try? JSONDecoder().decode(ResponseWire.self, from: data)
        else { return nil }

        return decoded.reply
    }
}
