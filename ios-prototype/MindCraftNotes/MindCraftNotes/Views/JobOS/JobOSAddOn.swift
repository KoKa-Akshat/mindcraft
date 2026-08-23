import Foundation
import FirebaseAuth
import FirebaseFirestore

/// Real-time gate for the Macalester alumni layer (JobOSLinkedInGraph /
/// JobOSReachOutBuilder / the Augeo demo seed) becoming a paid add-on for
/// Mac students specifically (2026-08-22, explicit ask: "I am planning to
/// sell the Macalester database as an add-on cost to Mac students... make
/// sure that's doable"). This is entitlement-AWARE code, not a payment
/// system - real Stripe/StoreKit purchase flow is a separate, later piece
/// of work. Until that exists, `macAlumniAddOn` is a plain Firestore field
/// on `users/{uid}`, same shape as the already-real, already-admin-settable
/// `program`/`stickerPlan` fields (`admin-link.ts`) - settable today via
/// the same Admin-SDK path, swappable for a real Stripe webhook later
/// without touching any of the feature code that reads this gate.
@MainActor
final class JobOSAddOnStore: ObservableObject {
    static let shared = JobOSAddOnStore()

    @Published private(set) var hasMacAlumniAddOn = false

    private let db = Firestore.firestore()
    private var listener: ListenerRegistration?
    private var authStateHandle: NSObjectProtocol?

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
        hasMacAlumniAddOn = false
        guard let user else { return }
        listener = db.collection("users").document(user.uid).addSnapshotListener { [weak self] snapshot, _ in
            guard let self else { return }
            self.hasMacAlumniAddOn = (snapshot?.data()?["macAlumniAddOn"] as? Bool) ?? false
        }
    }
}
