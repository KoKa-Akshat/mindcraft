import Foundation
import FirebaseAuth

/// What Jesse has learned about why the student is practicing English -
/// round-tripped every turn, same lightweight-state pattern as
/// `ResumeAgentDraft`/`BookAgentDraft` but far smaller since this feature
/// builds no document, just a conversation. Mirrors
/// `webhook/lib/handlers/english-practice.ts`'s `PracticeGoal` exactly.
struct EnglishPracticeGoal: Codable, Equatable {
    var goal: String
    var deadline: String

    static let empty = EnglishPracticeGoal(goal: "", deadline: "")
}

/// One turn of the conversation, sent back as context on every call - same
/// `recentTurns` shape `webhook/lib/handlers/english-practice.ts` expects.
struct EnglishPracticeTurn: Codable {
    var speaker: String
    var text: String
}

/// Native client for `POST /api/english-practice` - a live spoken
/// conversation with Jesse for a student practicing English, not a
/// generated-content feature (see the webhook handler's own doc comment
/// for the explicit scope boundary: this shapes conversation tone only, it
/// does not trigger any content/curriculum generation). Same
/// self-contained request/reply pattern as `ResumeAgentClient`.
enum EnglishPracticeClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/english-practice")!

    struct Reply {
        let reply: String
        let state: EnglishPracticeGoal
    }

    private struct ResponseWire: Decodable {
        let reply: String?
        let state: EnglishPracticeGoal?
    }

    static func ask(message: String, recentTurns: [EnglishPracticeTurn], state: EnglishPracticeGoal) async -> Reply? {
        guard let user = Auth.auth().currentUser else { return nil }
        guard let token = try? await user.getIDToken() else { return nil }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 25
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body: [String: Any] = [
            "message": message,
            "recentTurns": recentTurns.map { ["speaker": $0.speaker, "text": $0.text] },
            "state": ["goal": state.goal, "deadline": state.deadline],
        ]
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(ResponseWire.self, from: data),
            let reply = decoded.reply
        else { return nil }

        return Reply(reply: reply, state: decoded.state ?? state)
    }
}
