import Foundation
import AuthenticationServices
import CryptoKit
import FirebaseAuth
import GoogleSignIn
#if canImport(UIKit)
import UIKit
#endif

/// Native mirror of `Login.tsx`'s sign-in surface (see
/// NATIVE_APP_BUILD_PLAN.md §9 Agent A) - same Firebase Auth project
/// (`mindcraft-93858`), same account, same session semantics as the web app.
/// `AuthGate` (in `MindCraftNotesApp.swift`) reads `currentUser` to switch
/// between `LoginView` and `DashboardView`, the same job `App.tsx`'s
/// `AuthGuard` does on the web side.
@MainActor
final class AuthService: ObservableObject {
    /// Mirrors Firebase's own state - nil means signed out. `AuthGate`
    /// switches on this exactly like `AuthGuard` switches on
    /// `auth.currentUser` on the web.
    @Published private(set) var currentUser: User?

    /// Calm, specific copy for the currently-failing action - ported in
    /// spirit from `Login.tsx`'s `friendlyError()`. `LoginView` renders this
    /// directly; it is cleared at the start of every new attempt.
    @Published var errorMessage: String?

    /// True while an auth call is in flight - `LoginView` disables buttons
    /// and swaps in "Signing in…"/"Please wait…" copy, matching the web's
    /// `loading` state.
    @Published private(set) var isBusy = false

    private var authStateHandle: AuthStateDidChangeListenerHandle?

    init() {
        // Auth.auth() crashes hard if FirebaseApp.configure() never ran
        // (no default app to attach to). FirebaseBootstrap deliberately
        // skips configure() when GoogleService-Info.plist is still the
        // Phase 0 placeholder, so this guard is required, not defensive
        // paranoia. Until the real plist lands, the app stays on LoginView
        // with sign-in disabled instead of crashing on launch.
        guard FirebaseBootstrap.isConfigured else {
            errorMessage = "Firebase isn't configured yet on this build (placeholder GoogleService-Info.plist) - sign-in is disabled until that's set up. See NATIVE_APP_BUILD_PLAN.md §3."
            return
        }
        currentUser = Auth.auth().currentUser
        authStateHandle = Auth.auth().addStateDidChangeListener { [weak self] _, user in
            self?.currentUser = user
        }
        // Keep Google session warm across launches/updates so Gmail + login
        // do not force a fresh chooser every install.
        Self.restoreGoogleSessionIfNeeded()
    }

    /// Restores GIDSignIn from the device keychain when Firebase already has a user.
    private static func restoreGoogleSessionIfNeeded() {
        GIDSignIn.sharedInstance.restorePreviousSignIn { user, _ in
            // Best-effort. Firebase Auth remains the source of truth for app gate.
            // A restored Google user keeps GmailClient scopes available without re-prompt.
            _ = user
        }
    }

    deinit {
        if let authStateHandle {
            Auth.auth().removeStateDidChangeListener(authStateHandle)
        }
    }

    // MARK: - Google (primary path, mirrors Login.tsx's handleGoogle())

    /// Native sign-in has no popup/redirect distinction (that split in
    /// `Login.tsx` exists only to work around browser/ITP quirks) - one
    /// path: present the Google account chooser, then exchange the result
    /// for a Firebase credential.
    func signInWithGoogle() async {
        errorMessage = nil
        guard requireConfigured() else { return }
        guard let presenter = Self.topViewController() else {
            errorMessage = "Sign-in could not open. Please try again."
            return
        }

        isBusy = true
        defer { isBusy = false }

        do {
            let result = try await Self.presentGoogleSignIn(from: presenter)
            guard let idToken = result.user.idToken?.tokenString else {
                errorMessage = "Sign-in failed (missing Google token). Please try again."
                return
            }
            let credential = GoogleAuthProvider.credential(
                withIDToken: idToken,
                accessToken: result.user.accessToken.tokenString
            )
            _ = try await Auth.auth().signIn(with: credential)
        } catch is CancellationError {
            // User dismissed the Google sheet - same as the web's silent
            // 'auth/popup-closed-by-user' (friendlyError() returns '' for it).
        } catch {
            let nsError = error as NSError
            // GIDSignIn reports a user-cancelled sheet as its own error
            // domain/code (kGIDSignInErrorDomain / kGIDSignInErrorCodeCanceled
            // = -5), not a Firebase AuthErrorCode - treat it the same silent
            // way `friendlyError()` treats 'auth/popup-closed-by-user'.
            // Compared as raw domain/code (not the bridged Swift error type)
            // so this doesn't depend on exactly how NS_ERROR_ENUM bridges.
            if nsError.domain == "com.google.GIDSignIn", nsError.code == -5 {
                return
            }
            errorMessage = Self.friendlyError(error)
        }
    }

    /// Wraps GoogleSignIn's completion-based API (this project links only
    /// the `GoogleSignIn` product, not `GoogleSignInSwift`'s async sugar -
    /// see NATIVE_APP_BUILD_PLAN.md Phase 0 notes) in a Swift continuation.
    private static func presentGoogleSignIn(from presenter: UIViewController) async throws -> GIDSignInResult {
        try await withCheckedThrowingContinuation { continuation in
            GIDSignIn.sharedInstance.signIn(withPresenting: presenter) { result, error in
                if let error {
                    continuation.resume(throwing: error)
                } else if let result {
                    continuation.resume(returning: result)
                } else {
                    continuation.resume(throwing: AuthServiceError.noResult)
                }
            }
        }
    }

    private static func topViewController() -> UIViewController? {
        #if canImport(UIKit)
        let scenes = UIApplication.shared.connectedScenes
        guard let windowScene = (scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene)
            ?? (scenes.first as? UIWindowScene) else { return nil }
        guard let root = windowScene.windows.first(where: \.isKeyWindow)?.rootViewController
            ?? windowScene.windows.first?.rootViewController else { return nil }
        var top = root
        while let presented = top.presentedViewController {
            top = presented
        }
        return top
        #else
        return nil
        #endif
    }

    // MARK: - Apple (second provider, mirrors the web Desk OS gate's
    // `#authApple` - `agent_work/product/desk_os/index.html`'s auth block
    // shows exactly two providers, Google and Apple; this is the native
    // half of that parity, per DESK_OS_NATIVE_BRIEF.md's open item 2).

    /// Sign in with Apple → Firebase. Standard nonce-hardened flow: a
    /// random nonce goes to Apple as its SHA256 digest, the raw value goes
    /// to Firebase with Apple's identity token so Firebase can verify the
    /// token was minted for THIS request (replay protection. Firebase
    /// rejects the credential if the hashes don't match).
    func signInWithApple() async {
        errorMessage = nil
        guard requireConfigured() else { return }

        isBusy = true
        defer { isBusy = false }

        do {
            let rawNonce = Self.randomNonceString()
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = Self.sha256(rawNonce)

            let authorization = try await AppleSignInPresenter.shared.perform(request: request)
            guard
                let appleCredential = authorization.credential as? ASAuthorizationAppleIDCredential,
                let tokenData = appleCredential.identityToken,
                let idToken = String(data: tokenData, encoding: .utf8)
            else {
                errorMessage = "Sign-in failed (missing Apple token). Please try again."
                return
            }
            // `appleCredential(withIDToken:rawNonce:fullName:)` (not the
            // generic OAuth variant) so Firebase captures the full name
            // Apple only ever provides on the FIRST authorization.
            let firebaseCredential = OAuthProvider.appleCredential(
                withIDToken: idToken,
                rawNonce: rawNonce,
                fullName: appleCredential.fullName
            )
            _ = try await Auth.auth().signIn(with: firebaseCredential)
        } catch let error as ASAuthorizationError where error.code == .canceled {
            // User dismissed the Apple sheet - same silent treatment as a
            // cancelled Google sheet / web's 'auth/popup-closed-by-user'.
        } catch {
            errorMessage = Self.friendlyError(error)
        }
    }

    /// 32 random bytes mapped onto an unambiguous charset - the standard
    /// Firebase-documented nonce shape for Sign in with Apple.
    private static func randomNonceString(length: Int = 32) -> String {
        let charset = Array("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._")
        var bytes = [UInt8](repeating: 0, count: length)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        if status != errSecSuccess {
            // SecRandomCopyBytes failing is effectively unheard of; fall
            // back to SystemRandomNumberGenerator rather than crashing a
            // sign-in attempt.
            bytes = (0..<length).map { _ in UInt8.random(in: 0...255) }
        }
        return String(bytes.map { charset[Int($0) % charset.count] })
    }

    private static func sha256(_ input: String) -> String {
        SHA256.hash(data: Data(input.utf8))
            .map { String(format: "%02x", $0) }
            .joined()
    }

    // MARK: - Email / password (fallback path, mirrors handleEmailSubmit())

    func signInWithEmail(_ email: String, _ password: String) async {
        errorMessage = nil
        guard requireConfigured() else { return }
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please fill in all fields."
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            _ = try await Auth.auth().signIn(withEmail: email, password: password)
        } catch {
            errorMessage = Self.friendlyError(error)
        }
    }

    func createAccount(_ email: String, _ password: String) async {
        errorMessage = nil
        guard requireConfigured() else { return }
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "Please fill in all fields."
            return
        }
        isBusy = true
        defer { isBusy = false }
        do {
            _ = try await Auth.auth().createUser(withEmail: email, password: password)
        } catch {
            errorMessage = Self.friendlyError(error)
        }
    }

    /// Mirrors `handleForgot()`. Not one of the four methods §9 names
    /// explicitly, but it is part of `Login.tsx`'s real sign-in surface and
    /// costs nothing extra to keep at parity.
    func sendPasswordReset(_ email: String) async {
        errorMessage = nil
        guard requireConfigured() else { return }
        guard !email.isEmpty else {
            errorMessage = "Enter your email address first."
            return
        }
        do {
            try await Auth.auth().sendPasswordReset(withEmail: email)
            errorMessage = "Password reset email sent to \(email)."
        } catch {
            errorMessage = Self.friendlyError(error)
        }
    }

    func signOut() {
        guard requireConfigured() else { return }
        do {
            try Auth.auth().signOut()
            GIDSignIn.sharedInstance.signOut()
            errorMessage = nil
        } catch {
            errorMessage = Self.friendlyError(error)
        }
    }

    func clearError() {
        errorMessage = nil
    }

    /// Every method below that touches Auth.auth() checks this first -
    /// same reasoning as init()'s guard above.
    private func requireConfigured() -> Bool {
        guard FirebaseBootstrap.isConfigured else {
            errorMessage = "Firebase isn't configured yet on this build. Sign-in is disabled until a real GoogleService-Info.plist is added - see NATIVE_APP_BUILD_PLAN.md §3."
            return false
        }
        return true
    }

    // MARK: - Error copy - ported in tone from Login.tsx's friendlyError()
    // (calm, specific, never a raw Firebase string; same fallback shape).

    private static func friendlyError(_ error: Error) -> String {
        let nsError = error as NSError
        guard nsError.domain == AuthErrorDomain, let code = AuthErrorCode(rawValue: nsError.code) else {
            return "Sign-in failed. Please try again."
        }
        switch code {
        case .userNotFound:
            return "No account found with that email."
        case .wrongPassword, .invalidCredential:
            return "That password did not match a password account. If this is your Google email, continue with Google above."
        case .accountExistsWithDifferentCredential:
            return "This email is already linked to Google. Continue with Google above."
        case .emailAlreadyInUse:
            return "That email already has an account. If you used Google before, continue with Google above."
        case .weakPassword:
            return "Password must be at least 6 characters."
        case .invalidEmail:
            return "Please enter a valid email address."
        case .tooManyRequests:
            return "Too many attempts. Please wait a moment."
        case .operationNotAllowed:
            // Surfaced if a provider (e.g. Apple) isn't enabled in the
            // Firebase console yet - honest, actionable copy instead of a
            // bare code, since this is an ops step no app change can fix.
            return "This sign-in method isn't enabled for MindCraft yet. Please use Google or email for now."
        case .networkError:
            return "Network error. Check your connection."
        default:
            return "Sign-in failed (\(nsError.code)). Please try again."
        }
    }
}

private enum AuthServiceError: Error {
    case noResult
}

/// Wraps `ASAuthorizationController`'s delegate-based flow in a checked
/// continuation, the same shape `presentGoogleSignIn` gives GIDSignIn's
/// completion API. A long-lived shared instance (not a local) because the
/// controller only holds its delegate weakly - a locally-scoped delegate
/// would deallocate before Apple's sheet returns.
private final class AppleSignInPresenter: NSObject, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    static let shared = AppleSignInPresenter()

    private var continuation: CheckedContinuation<ASAuthorization, Error>?

    func perform(request: ASAuthorizationAppleIDRequest) async throws -> ASAuthorization {
        try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        continuation?.resume(returning: authorization)
        continuation = nil
    }

    func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        continuation?.resume(throwing: error)
        continuation = nil
    }

    func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        #if canImport(UIKit)
        let scenes = UIApplication.shared.connectedScenes
        let windowScene = (scenes.first { $0.activationState == .foregroundActive } as? UIWindowScene)
            ?? (scenes.first as? UIWindowScene)
        return windowScene?.windows.first(where: \.isKeyWindow)
            ?? windowScene?.windows.first
            ?? ASPresentationAnchor()
        #else
        return ASPresentationAnchor()
        #endif
    }
}
