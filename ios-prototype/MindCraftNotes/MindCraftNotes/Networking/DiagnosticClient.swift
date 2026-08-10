import Foundation
import FirebaseAuth
import FirebaseFirestore

/// Real gap-scan / "identification" flow - ported from
/// `Diagnostic.tsx`/`diagnosticSeed.ts`/`practiceState.ts`: rate each concept
/// hard/kinda/easy, POST to the SAME `/seed-assessment` ML endpoint the web
/// diagnostic calls (seeds the knowledge graph so `/recommend` and the
/// Contents roadmap can read real per-concept confidence before any real
/// practice exists), then write the SAME Firestore fields
/// (`diagnosticCompleted: true`, `diagnostic: {...}`) `markDiagnosticComplete`
/// writes - so a student who takes this native gap-scan is recognized as
/// diagnosed on web too, and vice versa (`isDiagnosticComplete`'s
/// `diagnosticCompleted || diagnosticCompletedAt` check reads either).
enum Confidence: String {
    case hard, kinda, easy
}

enum DiagnosticClient {
    private static let baseURL = "https://joinmindcraft-mindcraft-ml.hf.space"

    /// Mirrors `isDiagnosticComplete()`: tutors/admins are exempt, and either
    /// legacy field satisfies it.
    static func isComplete() async -> Bool {
        guard let uid = Auth.auth().currentUser?.uid else { return true }
        let db = Firestore.firestore()
        guard let snapshot = try? await db.collection("users").document(uid).getDocument(),
              let data = snapshot.data() else { return false }
        if let role = data["role"] as? String, role == "tutor" || role == "admin" { return true }
        if data["diagnosticCompleted"] as? Bool == true { return true }
        if data["diagnosticCompletedAt"] != nil { return true }
        return false
    }

    /// Submits real per-concept confidence - same `/seed-assessment` POST
    /// body (`student_id`, `assessment: {conceptId: 'hard'|'kinda'|'easy'}`)
    /// and same Firestore write shape as the web diagnostic. `exam` is
    /// always "ACT" here since native only bundles the ACT TOC currently.
    static func submit(confidence: [String: Confidence]) async {
        guard let user = Auth.auth().currentUser else { return }

        if let token = try? await user.getIDToken(),
           let url = URL(string: "\(baseURL)/seed-assessment") {
            var request = URLRequest(url: url)
            request.httpMethod = "POST"
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
            let assessment = confidence.mapValues { $0.rawValue }
            request.httpBody = try? JSONSerialization.data(withJSONObject: [
                "student_id": user.uid,
                "assessment": assessment,
            ])
            _ = try? await URLSession.shared.data(for: request)
        }

        let db = Firestore.firestore()
        try? await db.collection("users").document(user.uid).setData([
            "diagnosticCompleted": true,
            "diagnostic": [
                "exam": "ACT",
                "confidenceMap": confidence.mapValues { $0.rawValue },
                "excludedConcepts": [String](),
            ],
        ], merge: true)
    }
}
