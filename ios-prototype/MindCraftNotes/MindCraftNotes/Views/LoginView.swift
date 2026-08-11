import SwiftUI

// Google button as the primary action, email/password fallback behind a
// "use password instead" toggle - matches Login.tsx's two-mode UI (see
// NATIVE_APP_BUILD_PLAN.md §9 Agent A / §3 nav diagram). AuthGate injects
// the shared AuthService via .environmentObject; on successful sign-in this
// view does nothing else. AuthGate swaps to DashboardView on its own once
// currentUser is non-nil.
struct LoginView: View {
    @EnvironmentObject private var authService: AuthService

    /// Sign in with Apple is fully implemented (`appleButton` below +
    /// `AuthService.signInWithApple()`) but DISABLED: the current signing
    /// team (4YV3SZN6P7) is a free personal team and Apple's portal refuses
    /// the `com.apple.developer.applesignin` capability for personal teams
    /// (verified 2026-08-08 - `xcodebuild -allowProvisioningUpdates` fails
    /// with "Personal development teams … do not support the Sign In with
    /// Apple capability"). Shipping the button without the entitlement
    /// would render a provider that always errors - worse than absent, and
    /// against this repo's no-faked-parity discipline. Flip to `true` once
    /// a paid membership lands (full steps: MindCraftNotes.entitlements).
    private static let appleSignInEnabled = false

    /// Mirrors Login.tsx's `emailMode` state - password fallback is hidden
    /// until the student explicitly asks for it.
    @State private var showEmailMode = false
    /// Mirrors `isSignup`.
    @State private var isSignup = false
    @State private var email = ""
    @State private var password = ""
    @State private var showPassword = false

    private let weightedEase = Animation.timingCurve(0.2, 0, 0, 1, duration: 0.32)

    var body: some View {
        ZStack {
            deskBackground
            ScrollView {
                VStack(spacing: 28) {
                    wordmark
                    card
                }
                .padding(.vertical, 56)
                .padding(.horizontal, 24)
                .frame(maxWidth: 440)
            }
            .frame(maxWidth: .infinity)
        }
        .scrollDismissesKeyboard(.interactively)
    }

    // MARK: - Background - matches the real web Login.module.css (`.page`
    // `#060c09` near-black + `.shell` `#091810` dark forest), not the old
    // lavender "canvas desk" placeholder this view shipped with. Web's
    // Login is deliberately a different, bolder register than the
    // Dashboard's light cream paper - this ports that same contrast rather
    // than reusing DashboardView's DeskColor family.

    private var deskBackground: some View {
        ZStack {
            Color(mcHex: "060c09")
            RadialGradient(
                colors: [Color(mcHex: "c4f547").opacity(0.10), .clear],
                center: UnitPoint(x: 0.12, y: 0.08),
                startRadius: 0,
                endRadius: 480
            )
            RadialGradient(
                colors: [Color(mcHex: "247a4d").opacity(0.22), .clear],
                center: UnitPoint(x: 0.88, y: 0.85),
                startRadius: 0,
                endRadius: 520
            )
        }
        .ignoresSafeArea()
    }

    // MARK: - Product mark — The Desk (company line secondary).

    private var wordmark: some View {
        VStack(spacing: 6) {
            Text("The Desk")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .foregroundStyle(Color(mcHex: "e8f5e0"))
            Text("by MindCraft")
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundStyle(Color(mcHex: "c4f547").opacity(0.9))
                .tracking(0.4)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel("The Desk by MindCraft")
    }

    // MARK: - Card

    private var card: some View {
        VStack(alignment: .leading, spacing: 18) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Welcome")
                    // TODO: swap to Font.mcMono once IBM Plex Mono lands.
                    .font(.system(size: 12, weight: .semibold))
                    .textCase(.uppercase)
                    .tracking(0.6)
                    .foregroundStyle(mcInk.opacity(0.6))
                Text(isSignup ? "Create your account." : "Sign in to open your desk.")
                    // TODO: swap to Font.mcSans once Nunito Sans lands.
                    .font(.system(size: 22, weight: .semibold))
                    .foregroundStyle(mcInk)
            }

            googleButton
            appleButton

            if let message = authService.errorMessage, !message.isEmpty {
                Text(message)
                    .font(.system(size: 13, weight: .medium))
                    .foregroundStyle(Color(red: 0.62, green: 0.17, blue: 0.17))
                    .padding(.vertical, 10)
                    .padding(.horizontal, 12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(red: 1, green: 0.96, blue: 0.945))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            Text("Use this for any Gmail or account you originally created with Google.")
                .font(.system(size: 12))
                .foregroundStyle(mcInk.opacity(0.65))

            if showEmailMode {
                emailSection
                    .transition(.opacity.combined(with: .move(edge: .top)))
            } else {
                Button("Use a password instead") {
                    withAnimation(weightedEase) { showEmailMode = true }
                    authService.clearError()
                }
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(mcLeaf)
                .padding(.top, 2)
            }
        }
        .padding(24)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(mcHex: "faf6ef"))
        )
        .shadow(color: Color.black.opacity(0.35), radius: 28, x: 0, y: 14)
        .animation(weightedEase, value: showEmailMode)
    }

    // MARK: - Google (primary action)

    private var googleButton: some View {
        Button {
            authService.clearError()
            Task { await authService.signInWithGoogle() }
        } label: {
            HStack(spacing: 10) {
                GoogleMark(size: 18)
                Text(authService.isBusy ? "Signing in…" : "Sign in to open your desk")
                    .font(.system(size: 16, weight: .bold))
                    .lineLimit(1)
                    .minimumScaleFactor(0.85)
            }
            .foregroundStyle(mcInk)
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(
                        LinearGradient(
                            colors: [Color(mcHex: "c4f547"), Color(mcHex: "9fd60a")],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .shadow(color: Color(mcHex: "c4f547").opacity(0.45), radius: 16, x: 0, y: 6)
            )
        }
        .buttonStyle(.plain)
        .disabled(authService.isBusy)
        .opacity(authService.isBusy ? 0.75 : 1)
        .accessibilityIdentifier("loginGoogleButton")
    }

    // MARK: - Apple (second provider) - the web Desk OS gate
    // (`agent_work/product/desk_os/index.html` `#authBlock`) shows exactly
    // two providers stacked Google-then-Apple, Apple as the dark filled
    // button (`.auth-apple`: near-black ink fill, paper-cream text) against
    // Google's outlined paper button. Same relationship here on this card:
    // outlined Google above, ink-filled Apple below.

    private var appleButton: some View {
        Button {
            authService.clearError()
            if Self.appleSignInEnabled {
                Task { await authService.signInWithApple() }
            } else {
                authService.errorMessage = "Continue with Apple needs a paid Apple Developer team on this build. Use Google for now."
            }
        } label: {
            HStack(spacing: 10) {
                Image(systemName: "apple.logo")
                    .font(.system(size: 17, weight: .medium))
                    .accessibilityHidden(true)
                Text(authService.isBusy ? "Signing in…" : "Continue with Apple")
                    .font(.system(size: 15, weight: .semibold))
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 13)
        }
        .buttonStyle(.plain)
        .foregroundStyle(Color(mcHex: "faf6ef"))
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(mcInk)
        )
        .disabled(authService.isBusy)
        .opacity(authService.isBusy ? 0.7 : 1)
        .accessibilityIdentifier("loginAppleButton")
    }

    // MARK: - Email / password fallback

    private var emailSection: some View {
        VStack(alignment: .leading, spacing: 14) {
            Divider().overlay(mcInk.opacity(0.15))

            Text("Only use this if you created a MindCraft password. Google accounts do not use this password box.")
                .font(.system(size: 12))
                .foregroundStyle(mcInk.opacity(0.65))

            VStack(alignment: .leading, spacing: 6) {
                Text("Email")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(mcInk.opacity(0.7))
                TextField("you@email.com", text: $email)
                    .textInputAutocapitalization(.never)
                    .autocorrectionDisabled()
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .padding(12)
                    .background(fieldBackground)
            }

            VStack(alignment: .leading, spacing: 6) {
                Text("Password")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(mcInk.opacity(0.7))
                HStack {
                    Group {
                        if showPassword {
                            TextField("Password", text: $password)
                        } else {
                            SecureField("Password", text: $password)
                        }
                    }
                    .textContentType(isSignup ? .newPassword : .password)
                    Button {
                        showPassword.toggle()
                    } label: {
                        Image(systemName: showPassword ? "eye.slash" : "eye")
                            .foregroundStyle(mcInk.opacity(0.55))
                    }
                }
                .padding(12)
                .background(fieldBackground)
            }

            if !isSignup {
                Button("Forgot password?") {
                    Task { await authService.sendPasswordReset(email) }
                }
                .font(.system(size: 12, weight: .semibold))
                .foregroundStyle(mcLeaf)
                .frame(maxWidth: .infinity, alignment: .trailing)
            }

            // Web's `.submitBtn` (Login.module.css:583-598) is a hard-shadow
            // "pressed 3D" button - leaf-green gradient sitting on a solid
            // darker-green ledge, not a soft iOS shadow or plain black fill.
            // Approximated here with a fixed-offset rect behind the label.
            Button {
                authService.clearError()
                Task {
                    if isSignup {
                        await authService.createAccount(email, password)
                    } else {
                        await authService.signInWithEmail(email, password)
                    }
                }
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(mcHex: "17633d"))
                        .offset(y: 5)
                    HStack {
                        Text(authService.isBusy ? "Please wait…" : (isSignup ? "Create account" : "Sign in"))
                        Spacer()
                        Image(systemName: "arrow.right")
                    }
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.vertical, 13)
                    .padding(.horizontal, 16)
                    .background(
                        LinearGradient(
                            colors: [mcLeaf, Color(mcHex: "5fb779")],
                            startPoint: .topLeading, endPoint: .bottomTrailing
                        )
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
            }
            .buttonStyle(.plain)
            .disabled(authService.isBusy)
            .opacity(authService.isBusy ? 0.7 : 1)

            VStack(alignment: .leading, spacing: 4) {
                if isSignup {
                    HStack(spacing: 4) {
                        Text("Have an account?").font(.system(size: 12))
                        Button("Sign in") { isSignup = false; authService.clearError() }
                            .font(.system(size: 12, weight: .semibold))
                    }
                } else {
                    HStack(spacing: 4) {
                        Text("New here?").font(.system(size: 12))
                        Button("Create account") { isSignup = true; authService.clearError() }
                            .font(.system(size: 12, weight: .semibold))
                    }
                }
                Button("Back to Google sign in") {
                    withAnimation(weightedEase) {
                        showEmailMode = false
                        isSignup = false
                    }
                    authService.clearError()
                }
                .font(.system(size: 12, weight: .semibold))
            }
            .foregroundStyle(mcInk.opacity(0.75))
            .tint(mcLeaf)
        }
    }

    private var fieldBackground: some View {
        RoundedRectangle(cornerRadius: 10, style: .continuous)
            .fill(Color(mcHex: "fffaf0").opacity(0.82))
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .stroke(mcInk.opacity(0.15), lineWidth: 1)
            )
    }
}

// MARK: - Local color tokens - ported from the live web palette
// (Login.module.css:2-16, global.css:16-24), not the old lavender
// "canvas desk" placeholder this view previously used. Fileprivate so a
// same-named helper elsewhere in the app (e.g. Agent C's
// ContentsRoadmapView reading STATUS_COLOR hex strings, or DashboardView's
// own `Color(deskHex:)`) cannot collide with this one.

/// `--login-ink` (#143a2e).
private let mcInk = Color(mcHex: "143a2e")
/// `--login-leaf` (#247a4d).
private let mcLeaf = Color(mcHex: "247a4d")

/// Hex (no "#") -> Color, e.g. Color(mcHex: "faf6ef"). Named `mcHex` (not
/// `hex`) so it can't clash with another agent's own `Color(hex:)`
/// convenience init landing in a different file in this same target.
private extension Color {
    init(mcHex hex: String, opacity: Double = 1) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value & 0xFF0000) >> 16) / 255
        let g = Double((value & 0x00FF00) >> 8) / 255
        let b = Double(value & 0x0000FF) / 255
        self.init(red: r, green: g, blue: b, opacity: opacity)
    }
}

/// Approximation of the Google brand mark as a colored ring - avoids
/// hand-transcribing the web app's SVG path data natively (the web side's
/// own history shows that path is easy to get subtly wrong; see git log
/// "Fix malformed Google logo SVG path"). Reads clearly as "Google" via its
/// four brand colors without depending on exact path geometry.
struct GoogleMark: View {
    var size: CGFloat = 18

    private let colors: [Color] = [
        Color(red: 0x42 / 255, green: 0x85 / 255, blue: 0xF4 / 255),
        Color(red: 0x34 / 255, green: 0xA8 / 255, blue: 0x53 / 255),
        Color(red: 0xFB / 255, green: 0xBC / 255, blue: 0x05 / 255),
        Color(red: 0xEA / 255, green: 0x43 / 255, blue: 0x35 / 255),
    ]

    var body: some View {
        ZStack {
            ForEach(0..<4, id: \.self) { index in
                Circle()
                    .trim(from: 0.02, to: 0.22)
                    .stroke(colors[index], style: StrokeStyle(lineWidth: size * 0.24, lineCap: .butt))
                    .rotationEffect(.degrees(Double(index) * 90))
            }
        }
        .frame(width: size, height: size)
        .rotationEffect(.degrees(-90))
        .accessibilityHidden(true)
    }
}

#Preview {
    LoginView()
        .environmentObject(AuthService())
}
