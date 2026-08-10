import Foundation
import FirebaseAuth

/// Real `POST /record-outcomes` client - the practice->mastery feedback loop
/// (see CLAUDE.md's API section: "practice/homework results -> graph events
/// (APPENDS, source=practice)"). This is the piece Phase 2's practice session
/// screen was missing: `QuestionView`'s "Check answer" flow updated local
/// UI state (`checked`/`selectedChoice`) but never told the ML engine
/// anything happened, so a real student's answers here never touched their
/// actual mastery graph. Mirrors `ml/serve.py`'s `RecordOutcomesRequest`/
/// `OutcomeItem` Pydantic models field-for-field (snake_case wire keys -
/// confirmed against the live server source, not guessed; same convention
/// `RouteClient.plotRoute()` already uses for its own POST body).
enum OutcomeError: Error, LocalizedError {
    case notSignedIn
    case server(Int)

    var errorDescription: String? {
        switch self {
        case .notSignedIn: return "Not signed in."
        case .server(let code): return "Progress service returned HTTP \(code)."
        }
    }
}

enum OutcomeClient {
    private static let baseURL = "https://joinmindcraft-mindcraft-ml.hf.space"

    /// Records one answered question. `score` is the raw pass rate the
    /// server's `OutcomeItem.resolved_score()` expects: 1.0 for a correct
    /// answer, 0.0 for incorrect - matches web's `record-outcomes` callers,
    /// which always send a single-question 1.0/0.0 rather than a fractional
    /// session score.
    @discardableResult
    static func recordOutcome(
        conceptId: String,
        questionId: String,
        level: Int,
        selectedChoiceIndex: Int,
        correctIndex: Int
    ) async throws -> Bool {
        guard let user = Auth.auth().currentUser else {
            throw OutcomeError.notSignedIn
        }
        guard let url = URL(string: "\(baseURL)/record-outcomes") else {
            throw OutcomeError.server(0)
        }

        let token = try await user.getIDToken()
        let score = selectedChoiceIndex == correctIndex ? 1.0 : 0.0

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "student_id": user.uid,
            "outcomes": [[
                "concept_id": conceptId,
                "question_id": questionId,
                "level": level,
                "score": score,
                "selected_choice_index": selectedChoiceIndex,
            ]],
        ])

        let (_, response) = try await URLSession.shared.data(for: request)
        guard let http = response as? HTTPURLResponse else {
            throw OutcomeError.server(0)
        }
        guard http.statusCode == 200 else {
            throw OutcomeError.server(http.statusCode)
        }
        return true
    }
}
