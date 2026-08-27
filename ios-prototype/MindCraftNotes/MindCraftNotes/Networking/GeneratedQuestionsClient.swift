import Foundation
import FirebaseAuth

/// Mirrors `webhook/api/generate-questions.ts`'s `GeneratedQuestion` shape -
/// deliberately NOT `SampleQuestion` (the static-bank model `QuestionView`
/// renders), which never modeled hints/microLesson/trapChoice/visuals. Kept
/// as its own type so the static-bank flow (`PracticeSessionView`,
/// `WeeklyReviewWalkthroughView`) stays completely untouched.
struct GeneratedQuestionWire: Decodable, Identifiable, Equatable {
    let id: String
    let conceptId: String
    let level: Int
    let question: String
    let choices: [String]
    let correctIndex: Int
    let explanation: String
    let hints: [String]
    let microLesson: String
    let trapChoiceIndex: Int?
    let trapReasoning: String?
    let examTag: String?
    let questionFormat: String?
    let methodMarks: String?
    let visualType: String?
    let visualData: String?

    enum CodingKeys: String, CodingKey {
        case id, conceptId, level, question, choices, correctIndex, explanation, hints, microLesson
        case trapChoiceIndex, trapReasoning, examTag, questionFormat, methodMarks
        case visualType = "visual_type"
        case visualData = "visual_data"
    }
}

/// First iOS caller of `/api/generate-questions` (2026-08-27) - the web app
/// was the only client before this; iOS has only ever shown the static
/// bundled bank (`QuestionBankLoader`). Same Firebase Bearer auth pattern as
/// `DeskAskClient` - the endpoint was unauthenticated before this session,
/// closed alongside adding this first real native caller.
enum GeneratedQuestionsClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/generate-questions")!

    private struct Envelope: Decodable {
        let questions: [GeneratedQuestionWire]?
        let error: String?
    }

    /// Fires `count: 1` first, then `count: total - 1` - two calls instead
    /// of one, so a first question is ready in one short generation rather
    /// than waiting on the full batch. `onFirst` fires the moment the first
    /// question lands (on the main actor, safe to update `@Published`
    /// state directly); the return value is the full set once the second
    /// call also completes, or just the first question if the second call
    /// fails, or nil if even the first call fails.
    static func requestProgressive(
        conceptId: String,
        level: Int,
        examType: String? = nil,
        total: Int = 8,
        bridgeFrom: String? = nil,
        onFirst: @escaping ([GeneratedQuestionWire]) -> Void
    ) async -> [GeneratedQuestionWire]? {
        guard total > 0 else { return [] }
        guard let first = await request(conceptId: conceptId, level: level, examType: examType, count: 1, bridgeFrom: bridgeFrom) else {
            return nil
        }
        await MainActor.run { onFirst(first) }
        guard total > 1 else { return first }
        guard let rest = await request(conceptId: conceptId, level: level, examType: examType, count: total - 1, bridgeFrom: bridgeFrom) else {
            return first
        }
        return first + rest
    }

    private static func request(
        conceptId: String, level: Int, examType: String?, count: Int, bridgeFrom: String?
    ) async -> [GeneratedQuestionWire]? {
        guard let user = Auth.auth().currentUser else { return nil }
        guard let token = try? await user.getIDToken() else { return nil }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 30
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        var body: [String: Any] = ["conceptId": conceptId, "level": level, "count": count]
        if let examType { body["examType"] = examType }
        if let bridgeFrom { body["bridgeFrom"] = bridgeFrom }
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)

        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let envelope = try? JSONDecoder().decode(Envelope.self, from: data)
        else { return nil }

        return envelope.questions
    }
}
