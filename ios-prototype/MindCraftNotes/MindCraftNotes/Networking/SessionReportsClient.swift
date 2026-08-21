import Foundation
import FirebaseAuth

/// A single stored report - see generate-session-report.ts for how it's
/// written. `createdAt`/`context` are optional in spirit but always
/// present in practice; kept non-optional here since every real write path
/// sets them.
struct SessionReport: Decodable, Identifiable, Equatable {
    let id: String
    let report: String
    let context: String?
    let simEventCount: Int
    let topWeaknesses: [String]
    let createdAt: String
}

/// The read half of the ZPD/session-report design - generate-session-report.ts
/// writes automatically at call end; this fetches them back for the new
/// SessionReportsView. Real auth (Firebase ID token) since these are one
/// student's own data.
enum SessionReportsClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/get-session-reports")!

    static func fetchRecent(limit: Int = 20) async -> [SessionReport] {
        guard let token = try? await Auth.auth().currentUser?.getIDToken() else { return [] }
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: ["limit": limit])

        guard let (data, _) = try? await URLSession.shared.data(for: request) else { return [] }
        struct Envelope: Decodable { let reports: [SessionReport] }
        return (try? JSONDecoder().decode(Envelope.self, from: data))?.reports ?? []
    }
}
