import Foundation
import FirebaseAuth

/// Real discovery loop client (2026-08-22) — calls the webhook's
/// /api/discover-internships, the first real search behind JobOS's
/// "Apply today" board (previously only an LLM-suggested-tuple stub, never
/// a real web search). Same auth pattern as BookGenerationClient: a real
/// Firebase ID token, required because the endpoint is budget-gated per
/// student. Returns candidates only — nothing is added to JobOSStore here;
/// the caller decides what reaches the board (matches this feature's
/// existing "never silently change the board" discipline).
enum DiscoverInternshipsClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/discover-internships")!

    struct Candidate: Decodable {
        let company: String
        let role: String
        let location: String
        let why: String
        let deadline: String?
        let roleUrl: String
        let verificationStatus: String
    }

    private struct Response: Decodable {
        let status: String
        let candidates: [Candidate]?
        let reason: String?
    }

    enum Result {
        case ok([Candidate])
        case rateLimited(String)
        case unavailable(String)
    }

    static func discover(grade: Int? = nil, program: String? = nil, interests: [String] = [], location: String? = nil) async -> Result {
        guard let token = try? await Auth.auth().currentUser?.getIDToken() else {
            return .unavailable("Sign-in required")
        }
        var body: [String: Any] = ["interests": interests]
        if let grade { body["grade"] = grade }
        if let program { body["program"] = program }
        if let location { body["location"] = location }
        // BYOK (2026-08-25) - moves only the extraction call's cost off
        // MindCraft's account; the daily attempt cap stays active either
        // way since this endpoint's real Search-API cost isn't something
        // a Gemini key can pay for (see the webhook handler's own comment).
        if let key = await StudentAIKeyStore.shared.geminiKeyForServerGeneration() {
            body["studentGeminiKey"] = key
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard let (data, response) = try? await URLSession.shared.data(for: request) else {
            return .unavailable("Discovery service unreachable")
        }
        if let http = response as? HTTPURLResponse, http.statusCode == 429 {
            let reason = (try? JSONDecoder().decode(Response.self, from: data))?.reason
            return .rateLimited(reason ?? "Daily generation limit reached")
        }
        guard let envelope = try? JSONDecoder().decode(Response.self, from: data) else {
            return .unavailable("Discovery service returned an unexpected response")
        }
        return .ok(envelope.candidates ?? [])
    }
}
