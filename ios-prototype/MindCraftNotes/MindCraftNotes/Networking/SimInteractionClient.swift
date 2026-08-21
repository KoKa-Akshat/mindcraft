import Foundation
import FirebaseAuth

/// One sim's real, on-device engagement signal for one page visit - dwell
/// time + touch count, accumulated in `BookReaderView` and flushed here on
/// close. This is the raw material a future ZPD-aware session report reads
/// (2026-08-21 design discussion: "how they interact with simulations,
/// telling us how to create the feedback reports at the end of every
/// session"). Deliberately NOT fed into `/record-outcomes` (the mastery
/// engine's calibrated outcome/effort model) yet - dwell time and touch
/// count aren't a pass/fail outcome, and guessing a numeric mapping into a
/// carefully-tuned Beta-Binomial model risks quietly corrupting it. This
/// starts as its own honest signal; wiring it into mastery scoring is a
/// separate, real modeling decision for later.
struct SimInteractionRecord: Encodable {
    let subjectId: String
    let conceptId: String
    let simTitle: String?
    let dwellMs: Int
    let touchCount: Int
}

enum SimInteractionClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/log-sim-interaction")!

    /// Fire-and-forget - a dropped telemetry beacon must never block or
    /// interrupt the student's actual reading experience. Detached with
    /// background priority so it survives the caller's view already having
    /// started tearing down (the call site fires this right before
    /// dismissing the reader).
    static func log(_ records: [SimInteractionRecord]) {
        guard !records.isEmpty else { return }
        Task.detached(priority: .background) {
            guard let token = try? await Auth.auth().currentUser?.getIDToken() else { return }
            var request = URLRequest(url: endpoint)
            request.httpMethod = "POST"
            request.timeoutInterval = 15
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.httpBody = try? JSONEncoder().encode(["events": records])
            _ = try? await URLSession.shared.data(for: request)
        }
    }
}
