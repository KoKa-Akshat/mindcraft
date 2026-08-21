import Foundation

/// Native client for `POST /api/get-book` — fetches assembled, gated
/// chapter content (mindcraft-content-engine's book_assembler output,
/// synced to Firestore, see get-book.ts's doc comment for the full
/// pipeline). No auth required: this only ever serves already-gated,
/// already-free content assembled offline, same reasoning get-book.ts
/// documents for skipping verifyToken (unlike GenerateSimClient's
/// equivalent, which spends real money per call and does require it).
enum BookLibraryClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/get-book")!

    private static func post(_ body: [String: Any]) async throws -> Data {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        let (data, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse, http.statusCode == 200 else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? -1
            throw BookLibraryError.badStatus(status)
        }
        return data
    }

    /// Every synced book's summary, alphabetical by title (server-sorted).
    static func listBooks() async throws -> [AssembledBookSummary] {
        let data = try await post([:])
        struct Envelope: Decodable { let books: [AssembledBookSummary] }
        return try JSONDecoder().decode(Envelope.self, from: data).books
    }

    /// The full assembled book — chapters, sections, sim/discussion links.
    static func getBook(subjectId: String) async throws -> AssembledBook {
        let data = try await post(["subjectId": subjectId])
        struct Envelope: Decodable { let book: AssembledBook }
        return try JSONDecoder().decode(Envelope.self, from: data).book
    }
}

enum BookLibraryError: LocalizedError {
    case badStatus(Int)

    var errorDescription: String? {
        switch self {
        case .badStatus(404):
            return "That book hasn't been synced yet."
        case .badStatus(let code):
            return "Couldn't load the library right now (\(code))."
        }
    }
}
