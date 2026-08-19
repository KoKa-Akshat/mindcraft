import SwiftUI
import GoogleSignIn

@main
struct MindCraftNotesApp: App {
    // Core Data stack lives for the lifetime of the app and is handed down
    // through the environment so any view can read or write drawings.
    let persistenceController = PersistenceController.shared

    init() {
        // Agent A (Auth/Login, NATIVE_APP_BUILD_PLAN.md §9): must run before
        // any view touches Auth.auth() / AuthService.
        FirebaseBootstrap.configure()
    }

    var body: some Scene {
        WindowGroup {
            // Root switched from ContentView() to AuthGate (build plan §3
            // nav diagram). Agent A's one coordinated edit to this shared
            // file. AuthGate is defined below in this same file.
            //
            // Phase 2 test-harness note (discovered, not introduced, by this
            // pass): once AuthGate became the real root, the ORIGINAL 6
            // XCUITests (MindCraftNotesUITests.swift, written against
            // ContentView() as the launch screen. Q1/Q2/Q3 segmented picker,
            // direct QuestionView access) silently stopped being reachable -
            // a real student always lands on LoginView first now, and
            // ContentView's picker UI is not wired into DashboardView's real
            // navigation at all. `--ui-testing-content-view` restores exactly
            // the ContentView() launch surface those tests were written
            // against (CanvasView/GraphView mechanics, still real and still
            // relevant - see build plan §7's reuse verdict for
            // ContentView.swift) without touching the tests' own bodies or
            // assertions. `--ui-testing-skip-auth` is the SEPARATE new hook
            // Phase 2's own new tests use, to reach the real DashboardView
            // (Contents roadmap → chapter drill-down → practice session)
            // without a real signed-in Firebase account (no CI test account
            // credentials exist yet - see NATIVE_APP_BUILD_PLAN.md's Phase 2
            // status write-up for why). Neither flag does anything unless
            // explicitly passed by a test's own `launchArguments` - a normal
            // launch is completely unaffected.
            Group {
                if ProcessInfo.processInfo.arguments.contains("--ui-testing-content-view") {
                    ContentView()
                } else {
                    AuthGate()
                        .environment(\.uiTestingSkipAuth, ProcessInfo.processInfo.arguments.contains("--ui-testing-skip-auth"))
                        // Round 7 final pass: `WelcomeView` had never been
                        // confirmed with a real on-device screenshot all
                        // session (only verified by reading the code) - a
                        // real device can carry a persisted Firebase Auth
                        // Keychain session across app reinstalls from
                        // earlier manual testing, which would make a "fresh
                        // launch" unreliably skip straight to DashboardView
                        // instead of showing Welcome. This flag forces the
                        // Welcome branch deterministically for that one
                        // verification test, same pattern as
                        // `--ui-testing-skip-auth` - a normal launch is
                        // unaffected unless a test explicitly passes it.
                        .environment(\.uiTestingForceWelcome, ProcessInfo.processInfo.arguments.contains("--ui-testing-force-welcome"))
                }
            }
                .environment(\.managedObjectContext, persistenceController.container.viewContext)
                // Global brand tint (2026-08-18, explicit ask: "why is the
                // blue still there... looks jarring"). No AccentColor asset
                // exists anywhere in this app, so every default-styled
                // system control (a TextEditor's cursor/selection, a
                // TextField's cursor, an unstyled Toggle) was silently
                // falling back to Apple's system blue - invisible in a
                // static screenshot of an unfocused field, but real the
                // moment a student actually taps in and types. One root-
                // level tint fixes every occurrence at once instead of
                // hunting down each individual text field.
                .tint(Color(red: 0x24 / 255, green: 0x7a / 255, blue: 0x4d / 255))
                .onOpenURL { url in
                    // Google Sign-In's OAuth callback comes back in via the
                    // REVERSED_CLIENT_ID URL scheme (see Info.plist). GIDSignIn
                    // needs first look at it to complete the in-flight sign-in.
                    GIDSignIn.sharedInstance.handle(url)
                }
        }
    }
}

private struct UITestingSkipAuthKey: EnvironmentKey {
    static let defaultValue = false
}

private struct UITestingForceWelcomeKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// Test-only. See the launch-argument doc comment above.
    var uiTestingSkipAuth: Bool {
        get { self[UITestingSkipAuthKey.self] }
        set { self[UITestingSkipAuthKey.self] = newValue }
    }

    /// Test-only. See the launch-argument doc comment above.
    var uiTestingForceWelcome: Bool {
        get { self[UITestingForceWelcomeKey.self] }
        set { self[UITestingForceWelcomeKey.self] = newValue }
    }
}

/// Thin root view (build plan §3): observes AuthService and switches between
/// LoginView and DashboardView, the same job App.tsx's AuthGuard does on the
/// web side. DashboardView is Agent B's file - referenced by name here; it
/// resolves once Agent B's real implementation lands (currently a
/// `Text("TODO")` placeholder, which still compiles and renders fine).
struct AuthGate: View {
    @StateObject private var authService = AuthService()
    @Environment(\.uiTestingSkipAuth) private var uiTestingSkipAuth
    @Environment(\.uiTestingForceWelcome) private var uiTestingForceWelcome
    // New pre-login "Welcome to MindCraft" screen (round 5, Akshat's own
    // wireframe): shown once per cold launch, ahead of LoginView, so a
    // brand-new student sees the world before being asked to sign in - same
    // once-per-session gate shape as `CoverSession`, just one layer earlier
    // and scoped to "not signed in" instead of "signed in, not opened the
    // notebook yet this session." A student who's already signed in on a
    // warm relaunch skips straight past this (`authService.currentUser`
    // check happens first), same as web never re-showing a marketing page
    // to a returning logged-in user.
    /// Prefer Welcome for every signed-out cold start. Password fallback
    /// still reaches `LoginView` via Welcome's "Use a password instead".
    @State private var showWelcome = true

    var body: some View {
        Group {
            if uiTestingForceWelcome {
                WelcomeView(onSignIn: {})
            } else if authService.currentUser != nil || uiTestingSkipAuth {
                // Brick 1 (DESK_OS_NATIVE_BRIEF.md): the desk/shell screen
                // is now the real post-login entry point, with the
                // 9-round DashboardView reachable as its "ACT Field Book"
                // module (Brick 2) rather than being the direct
                // destination itself.
                DeskShellView()
            } else if showWelcome {
                WelcomeView(onSignIn: { showWelcome = false })
            } else {
                LoginView()
            }
        }
        .environmentObject(authService)
        .onChange(of: authService.currentUser?.uid) { _, uid in
            // Sign-out must bring back the lime Welcome CTA - not the older
            // LoginView the student hit after WelcomeSession was marked seen.
            if uid == nil {
                WelcomeSession.reset()
                showWelcome = true
            }
        }
    }
}
