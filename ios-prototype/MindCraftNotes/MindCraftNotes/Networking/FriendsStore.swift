import Foundation
import FirebaseAuth
import FirebaseFirestore

/// One person a student can invite to a study session.
struct Friend: Identifiable, Equatable {
    let id: String
    var name: String
    var email: String
}

/// Real-time mirror of a student's own `users/{uid}/friends` subcollection —
/// a simple personal contact list (owner-only, see firestore.rules), not a
/// mutual friend-request graph. Same auth-state-driven listener lifecycle as
/// BinderStore/FirestoreStudentStore, without that store's offline-pending-
/// write queue — friend-list writes are low-frequency enough that a failed
/// write can just be retried by the user tapping Add again.
@MainActor
final class FriendsStore: ObservableObject {
    @Published private(set) var friends: [Friend] = []

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?
    private var currentUid: String?

    init() {
        // Same guard as FirestoreStudentStore.init() — Auth.auth() crashes
        // without a configured default FirebaseApp.
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
        friends = []
        currentUid = user?.uid
        guard let user else { return }

        listener = db.collection("users").document(user.uid).collection("friends")
            .addSnapshotListener { [weak self] snapshot, _ in
                guard let self, let snapshot else { return }
                self.friends = snapshot.documents.compactMap { doc -> Friend? in
                    let data = doc.data()
                    guard let name = data["name"] as? String, !name.isEmpty else { return nil }
                    return Friend(id: doc.documentID, name: name, email: data["email"] as? String ?? "")
                }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
            }
    }

    func addFriend(name: String, email: String) {
        guard let uid = currentUid else { return }
        let trimmedName = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmedName.isEmpty else { return }
        db.collection("users").document(uid).collection("friends").addDocument(data: [
            "name": trimmedName,
            "email": email.trimmingCharacters(in: .whitespacesAndNewlines),
            "addedAt": FieldValue.serverTimestamp(),
        ])
    }

    func removeFriend(_ id: String) {
        guard let uid = currentUid else { return }
        db.collection("users").document(uid).collection("friends").document(id).delete()
    }
}
