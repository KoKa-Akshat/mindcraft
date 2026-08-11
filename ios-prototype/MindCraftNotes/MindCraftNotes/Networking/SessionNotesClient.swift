import Foundation
import FirebaseAuth
import FirebaseFirestore

/// One published tutor session summary or completed homework summary, ported
/// from `DashboardNotesPanel.tsx`'s `Session` interface (build plan §5-style
/// read). Both sources merge into one list here since the web panel shows
/// them together, newest first.
struct SessionNote: Identifiable {
    let id: String
    let subject: String
    let tutorName: String
    let date: String
    let bullets: [String]
}

/// Real-time mirror of the two Firestore collections `DashboardNotesPanel.tsx`
/// reads - `sessions` (published tutor session summaries, keyed by student
/// email) and `homework_sessions` (completed homework summaries, keyed by
/// student uid). Same field names, same "published"/"completed" gating, so a
/// note that shows up on the web Notes tab shows up here too.
///
/// Deliberately independent of `FirestoreStudentStore` (same reasoning as
/// that file's own doc comment): drives its own Auth state listener so it
/// works standalone regardless of what else has loaded.
@MainActor
final class SessionNotesClient: ObservableObject {
    @Published private(set) var notes: [SessionNote] = []
    /// Real bookmarked questions - `users/{uid}.bookmarkedQuestions`, same
    /// field `dashboardPersonalization.ts` reads, resolved to their actual
    /// question text via `QuestionBankLoader`.
    @Published private(set) var bookmarkedQuestions: [SampleQuestion] = []

    private let db = Firestore.firestore()
    private var sessionsListener: ListenerRegistration?
    private var homeworkListener: ListenerRegistration?
    private var userDocListener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?

    private var sessionNotes: [SessionNote] = [] { didSet { recombine() } }
    private var homeworkNotes: [SessionNote] = [] { didSet { recombine() } }

    init() {
        guard FirebaseBootstrap.isConfigured else { return }
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.subscribe(to: user)
        }
    }

    deinit {
        sessionsListener?.remove()
        homeworkListener?.remove()
        userDocListener?.remove()
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    private func subscribe(to user: User?) {
        sessionsListener?.remove()
        homeworkListener?.remove()
        userDocListener?.remove()
        sessionsListener = nil
        homeworkListener = nil
        userDocListener = nil
        sessionNotes = []
        homeworkNotes = []
        bookmarkedQuestions = []

        guard let user else { return }

        userDocListener = db.collection("users").document(user.uid)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self else { return }
                let ids = snapshot?.data()?["bookmarkedQuestions"] as? [String] ?? []
                self.bookmarkedQuestions = ids.compactMap { QuestionBankLoader.question(byId: $0) }
            }

        if let email = user.email {
            sessionsListener = db.collection("sessions")
                .whereField("studentEmail", isEqualTo: email)
                .addSnapshotListener { [weak self] snapshot, _ in
                    guard let self, let snapshot else { return }
                    self.sessionNotes = snapshot.documents.compactMap { doc in
                        let data = doc.data()
                        guard let summary = data["summary"] as? [String: Any],
                              summary["published"] as? Bool == true else { return nil }
                        return SessionNote(
                            id: doc.documentID,
                            subject: data["subject"] as? String ?? "General",
                            tutorName: data["tutorName"] as? String ?? "Tutor",
                            date: summary["date"] as? String ?? "",
                            bullets: summary["bullets"] as? [String] ?? []
                        )
                    }
                }
        }

        homeworkListener = db.collection("homework_sessions")
            .whereField("studentId", isEqualTo: user.uid)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self, let snapshot else { return }
                self.homeworkNotes = snapshot.documents.compactMap { doc in
                    let data = doc.data()
                    guard data["status"] as? String == "completed",
                          let summary = data["summary"] as? [String: Any] else { return nil }
                    return SessionNote(
                        id: "hw-\(doc.documentID)",
                        subject: "Homework",
                        tutorName: "you",
                        date: summary["date"] as? String ?? "",
                        bullets: summary["bullets"] as? [String] ?? []
                    )
                }
            }
    }

    private func recombine() {
        // Newest first by date string - same simple sort the web side's
        // Firestore query order implicitly relies on for ISO-ish date
        // strings; real ordering, no fabricated timestamps.
        notes = (sessionNotes + homeworkNotes).sorted { $0.date > $1.date }
    }
}
