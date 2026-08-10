import Foundation
import FirebaseCore
import GoogleSignIn

/// One job: call `FirebaseApp.configure()` exactly once, then hand
/// GoogleSignIn the OAuth client ID Firebase just loaded from
/// `GoogleService-Info.plist`. GIDSignIn does not read that file itself,
/// it needs the client ID handed to it explicitly (see
/// NATIVE_APP_BUILD_PLAN.md §9 Agent A).
///
/// Called once from `MindCraftNotesApp.swift`'s `init()`, before any view
/// (in particular `AuthGate`/`AuthService`) touches `Auth.auth()`.
enum FirebaseBootstrap {
    private static var didConfigure = false

    /// True once a real GoogleService-Info.plist (not the Phase 0 empty
    /// placeholder) has been dropped in and configure() actually ran.
    /// AuthService checks this before touching Auth.auth() at all, since
    /// calling any Firebase API without a real configuration crashes hard
    /// (FirebaseApp.configure() itself calls fatalError() internally when
    /// required keys like GOOGLE_APP_ID/API_KEY are missing - this guard
    /// exists specifically so an empty placeholder plist can sit in the
    /// bundle without taking the whole app down on launch).
    private(set) static var isConfigured = false

    static func configure() {
        guard !didConfigure else { return }
        didConfigure = true

        guard hasRealConfig() else {
            print("⚠️ FirebaseBootstrap: GoogleService-Info.plist is still the Phase 0 placeholder (no GOOGLE_APP_ID/API_KEY). Skipping FirebaseApp.configure() so the app can still launch - sign-in will not work until the real Firebase Console values are dropped in. See NATIVE_APP_BUILD_PLAN.md §3.")
            return
        }

        FirebaseApp.configure()
        isConfigured = true

        if let clientID = FirebaseApp.app()?.options.clientID {
            GIDSignIn.sharedInstance.configuration = GIDConfiguration(clientID: clientID)
        }
    }

    /// Reads the bundled plist directly (not via FirebaseOptions, which
    /// only exists after configure() already ran) and checks for the two
    /// fields Firebase's own configure() requires non-empty. This is a
    /// plain file read, not a Firebase API call, so it's always safe to run
    /// before configure().
    private static func hasRealConfig() -> Bool {
        guard
            let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
            let dict = NSDictionary(contentsOfFile: path),
            let appID = dict["GOOGLE_APP_ID"] as? String, !appID.isEmpty,
            let apiKey = dict["API_KEY"] as? String, !apiKey.isEmpty
        else { return false }
        return true
    }
}
