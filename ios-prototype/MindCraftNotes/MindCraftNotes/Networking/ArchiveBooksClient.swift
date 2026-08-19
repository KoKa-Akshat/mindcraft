import Foundation

/// `GET /api/archive-books` - real bug fix (2026-08-19, live report: "im not
/// seeing dans books in archuve at all"). Before this, the Archive browser
/// only ever surfaced Dan McCreary's archive through a live search
/// (ArchiveRagClient.askDetailed), since there was no manifest of his full
/// library to browse by title the way the app's own bundled book graphs
/// (BookGraphLoader) already are - a real gap, not a display bug, now
/// closed with a real endpoint over the exact same corpus archive-rag.ts
/// already searches (dans-archive-chunks.json), not a fabricated catalog.
enum ArchiveBooksClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/archive-books")!

    struct Book: Decodable, Identifiable {
        let bookSlug: String
        let bookTitle: String
        var id: String { bookSlug }
    }

    private struct ResponseWire: Decodable {
        let books: [Book]?
    }

    static func list() async -> [Book] {
        var request = URLRequest(url: endpoint)
        request.timeoutInterval = 15
        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(ResponseWire.self, from: data)
        else { return [] }
        return decoded.books ?? []
    }
}
