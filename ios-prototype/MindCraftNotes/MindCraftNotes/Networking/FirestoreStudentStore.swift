import Foundation
import FirebaseAuth
import FirebaseFirestore

/// Real-time mirror of `users/{uid}`, matching
/// `app/src/hooks/useStudentData.ts`'s user-doc subscription (build plan §5
/// Read 1 / §9 Agent B item 1).
///
/// Deliberately independent of `AuthService`: it drives its own Firebase Auth
/// state listener and only ever calls straight into the `FirebaseAuth` SDK
/// (`Auth.auth()...`) rather than depending on Agent A's `AuthService` type,
/// so this file compiles and works correctly on its own regardless of
/// whether `AuthService.swift` has landed for real yet (see the build plan's
/// "reference Auth.auth().currentUser directly ... to unblock yourself"
/// guidance). `DashboardView` only needs `FirestoreStudentStore()` - no
/// externally-supplied uid required.
@MainActor
final class FirestoreStudentStore: ObservableObject {
    /// 3-tier fallback per the build plan: Firestore field → Firebase Auth
    /// displayName → email-prefix → "there". Defaults to "there" until the
    /// first snapshot (or auth state) resolves.
    @Published private(set) var displayName: String = "there"

    /// `users/{uid}.role`. Not read from `useStudentData.ts`'s returned
    /// shape (that hook doesn't surface it), but the field itself is written
    /// by both the web create-on-first-snapshot effect and this port of it -
    /// Phase 1 just needs this to be non-blocking, per §5.
    @Published private(set) var role: String?

    private let db = Firestore.firestore()
    private var userDocListener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?

    init() {
        // Same guard as AuthService.init() and for the same reason:
        // Auth.auth() crashes without a configured default FirebaseApp, and
        // FirebaseBootstrap deliberately skips configure() when
        // GoogleService-Info.plist is still the Phase 0 placeholder. In
        // practice AuthGate never reaches DashboardView (so never
        // instantiates this type) in that state, but this file is
        // deliberately independent of AuthService, so it guards itself too
        // rather than relying on that.
        guard FirebaseBootstrap.isConfigured else { return }
        // Firebase invokes this immediately (synchronously scheduled onto
        // the main thread) with whatever the current auth state already is,
        // and again on every subsequent sign-in/sign-out - this single
        // listener both bootstraps and maintains the Firestore subscription
        // for whichever uid is signed in, tearing it down cleanly on sign-out.
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.subscribe(to: user)
        }
    }

    deinit {
        userDocListener?.remove()
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    private func subscribe(to user: User?) {
        userDocListener?.remove()
        userDocListener = nil

        guard let user else {
            displayName = "there"
            role = nil
            return
        }

        // Show the Auth-derived name immediately; the snapshot listener
        // below overrides it with the Firestore field once/if that arrives.
        displayName = Self.fallbackName(for: user)

        let ref = db.collection("users").document(user.uid)
        userDocListener = ref.addSnapshotListener { [weak self] snapshot, error in
            guard let self else { return }

            guard let snapshot, snapshot.exists else {
                // Brand-new account: no user doc yet. Per build plan §5,
                // port useStudentData.ts's create-on-first-snapshot effect
                // (setDoc with role/streak/practiceCount/timestamps) rather
                // than leaving the student stuck on a missing doc. Skip this
                // if the listener actually errored (e.g. permission denied)
                // rather than a genuine "doesn't exist yet" - retrying a
                // write into a permission error would just loop.
                if error == nil {
                    self.createUserDocIfNeeded(for: user, at: ref)
                }
                return
            }

            let data = snapshot.data() ?? [:]
            let firestoreName = (data["displayName"] as? String).flatMap { $0.isEmpty ? nil : $0 }
            self.displayName = firestoreName ?? Self.fallbackName(for: user)
            self.role = data["role"] as? String
        }
    }

    /// Ported from `useStudentData.ts`'s first-sign-in `setDoc` block: same
    /// field set (`role: 'student'`, `streak: 0`, `practiceCount: 0`,
    /// `createdAt`/`lastActive: serverTimestamp()`). `merge: true` so this
    /// can never clobber a doc that appears between the existence check and
    /// the write landing (e.g. a concurrent web sign-in racing this call).
    private func createUserDocIfNeeded(for user: User, at ref: DocumentReference) {
        var payload: [String: Any] = [
            "uid": user.uid,
            "displayName": Self.fallbackName(for: user),
            "role": "student",
            "streak": 0,
            "practiceCount": 0,
            "createdAt": FieldValue.serverTimestamp(),
            "lastActive": FieldValue.serverTimestamp(),
        ]
        if let email = user.email {
            payload["email"] = email
        }
        ref.setData(payload, merge: true)
    }

    /// Persist a chosen display name onto `users/{uid}` (+ Auth profile when
    /// available). Used by hub Manage → username.
    func updateDisplayName(_ name: String) async {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else { return }
        displayName = trimmed
        guard FirebaseBootstrap.isConfigured, let user = Auth.auth().currentUser else { return }
        let change = user.createProfileChangeRequest()
        change.displayName = trimmed
        try? await change.commitChanges()
        try? await db.collection("users").document(user.uid).setData([
            "displayName": trimmed,
            "lastActive": FieldValue.serverTimestamp(),
        ], merge: true)
    }

    /// The two non-Firestore tiers of the 3-tier fallback: Firebase Auth
    /// `displayName` (first space-separated token), then the email-prefix
    /// (text before `@`, then before the first `.`), then "there" - ported
    /// verbatim from `useStudentData.ts`'s `firstName()`.
    private static func fallbackName(for user: User) -> String {
        if let name = user.displayName, !name.isEmpty {
            return name.split(separator: " ").first.map(String.init) ?? name
        }
        if let email = user.email, !email.isEmpty {
            let prefix = email.split(separator: "@").first.map(String.init) ?? email
            return prefix.split(separator: ".").first.map(String.init) ?? prefix
        }
        return "there"
    }
}
