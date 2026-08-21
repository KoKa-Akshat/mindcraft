import Foundation
import FirebaseAuth

/// Fires `POST /api/generate-session-report` at the end of a Work
/// Dashboard call - the other half of the 2026-08-21 ZPD/telemetry design.
/// The server reads the transcript passed here plus this student's own
/// recent `sim_interactions` (SimInteractionClient) and current mastery
/// weak points, and writes a short parent/teacher-readable report to
/// Firestore. Fire-and-forget, same reasoning as SimInteractionClient: a
/// student's own session flow must never wait on or be interrupted by
/// report generation - there is deliberately no UI for this yet on the
/// student side, a parent/teacher-facing surface is future work.
enum SessionReportClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/generate-session-report")!

    static func generate(transcript: [JesseCallTurn], context: String?) {
        guard !transcript.isEmpty else { return }
        Task.detached(priority: .background) {
            guard let token = try? await Auth.auth().currentUser?.getIDToken() else { return }
            let turns = transcript.map { ["speaker": $0.speaker, "text": $0.text] }
            var body: [String: Any] = ["transcript": turns]
            if let context { body["context"] = context }

            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.timeoutInterval = 30
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.httpBody = try? JSONSerialization.data(withJSONObject: body)
            _ = try? await URLSession.shared.data(for: request)
        }
    }
}
