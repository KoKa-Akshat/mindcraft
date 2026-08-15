import Foundation
import FirebaseAuth
import FirebaseFirestore

/// One saved inbox digest, mirrored from the top-level `email_digests`
/// Firestore collection (same shape convention as `binder_items` -
/// `studentId` scopes the query). This is the durable history the
/// dashboard reads from: `GmailDigestClient` only ever holds the LATEST
/// digest in memory, gone on relaunch - this store is what makes "keep
/// these summaries stored for the student" actually true across sessions.
struct EmailDigestRecord: Identifiable, Equatable {
    let id: String
    var headline: String
    var actionItems: [GmailDigestClient.Item]
    var fyi: [GmailDigestClient.Item]
    var messageCount: Int
    var createdAt: Date
}

/// Real-time mirror of a student's digest history, same auth-state-driven
/// listener lifecycle as `BinderStore`/`FirestoreStudentStore`.
@MainActor
final class GmailDigestStore: ObservableObject {
    static let shared = GmailDigestStore()

    @Published private(set) var history: [EmailDigestRecord] = []

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?
    private var currentUid: String?

    private init() {
        guard FirebaseBootstrap.isConfigured else { return }
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.subscribe(to: user)
        }
    }

    deinit {
        listener?.remove()
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    private func subscribe(to user: User?) {
        listener?.remove()
        listener = nil
        history = []
        currentUid = user?.uid
        guard let user else { return }

        listener = db.collection("email_digests")
            .whereField("studentId", isEqualTo: user.uid)
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self, let snapshot else { return }
                self.history = snapshot.documents
                    .compactMap(Self.decode)
                    .sorted { $0.createdAt > $1.createdAt }
            }
    }

    /// Saves a freshly-fetched digest. Fire-and-forget (matches the app's
    /// other stores): a failed write here shouldn't block the student from
    /// seeing the digest they just got, since `GmailDigestClient.digest`
    /// already holds it in memory for this session regardless.
    func save(_ digest: GmailDigestClient.Digest, messageCount: Int) {
        guard let uid = currentUid ?? Auth.auth().currentUser?.uid else { return }
        let payload: [String: Any] = [
            "studentId": uid,
            "headline": digest.headline,
            "actionItems": digest.actionItems.map { ["from": $0.from, "subject": $0.subject, "why": $0.why] },
            "fyi": digest.fyi.map { ["from": $0.from, "subject": $0.subject, "why": $0.why] },
            "messageCount": messageCount,
            "createdAt": FieldValue.serverTimestamp(),
        ]
        db.collection("email_digests").addDocument(data: payload)
    }

    private static func decode(_ doc: QueryDocumentSnapshot) -> EmailDigestRecord? {
        let data = doc.data()
        func items(_ key: String) -> [GmailDigestClient.Item] {
            ((data[key] as? [[String: Any]]) ?? []).map {
                GmailDigestClient.Item(
                    from: $0["from"] as? String ?? "",
                    subject: $0["subject"] as? String ?? "",
                    why: $0["why"] as? String ?? ""
                )
            }
        }
        return EmailDigestRecord(
            id: doc.documentID,
            headline: data["headline"] as? String ?? "",
            actionItems: items("actionItems"),
            fyi: items("fyi"),
            messageCount: data["messageCount"] as? Int ?? 0,
            createdAt: (data["createdAt"] as? Timestamp)?.dateValue() ?? Date()
        )
    }
}
