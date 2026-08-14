import SwiftUI

/// Pre-login "Welcome to MindCraft" screen - brand world first, then a
/// nested Welcome login card (Google / Apple) so sign-in lands on
/// `DeskShellView`'s connection-intel boot slide and then the hub dash.
///
/// Copy discipline: tagline is VERBATIM brand-book copy
/// (`BRAND_BOOK.md:29/154/347`). Voice rules (§8): sentence case, no
/// exclamation marks, no emoji, second person, short declaratives.
enum WelcomeSession {
    private static var seen = false
    static var alreadySeen: Bool { seen }
    static func markSeen() { seen = true }
    /// Called when the student signs out so the polished Welcome screen
    /// (not the older `LoginView`) is the live sign-in surface again.
    static func reset() { seen = false }
}

struct WelcomeView: View {
    /// Password / email fallback → full `LoginView` (AuthGate clears welcome).
    let onSignIn: () -> Void

    @EnvironmentObject private var authService: AuthService

    /// Same constraint as `LoginView.appleSignInEnabled` - capability needs
    /// a paid Apple Developer team. Button still shows for desk-os parity;
    /// tap explains why when disabled.
    private static let appleSignInEnabled = false

    @State private var appeared = false

    /// Shared weighted-ease timing across the entry flow (see
    /// `CoverView.weightedEase`) - matches the brand's `--ease-weight`
    /// curve, fast start / long settle / zero bounce.
    private let weightedEase = Animation.timingCurve(0.2, 0, 0, 1, duration: 0.36)

    var body: some View {
        ZStack {
            WelcomeBackground()
            ScrollView {
                VStack(spacing: 0) {
                    topBar
                    headline
                        .padding(.top, 22)
                    heroCollage
                        .padding(.top, 4)
                    welcomeLoginCard
                        .padding(.top, 28)
                        .padding(.bottom, 40)
                }
                .padding(.horizontal, 24)
                .frame(maxWidth: 720)
                .frame(maxWidth: .infinity)
                .opacity(appeared ? 1 : 0)
                .offset(y: appeared ? 0 : 14)
            }
        }
        .onAppear {
            WelcomeSession.markSeen()
            withAnimation(weightedEase) { appeared = true }
        }
    }

    // MARK: - Headline
    // The screen's one loud statement (Brand Book §9: "the type scale
    // jumps hard... every screen has one loud statement and quiet
    // everything else"). Verbatim brand copy - the company tagline and
    // explainer line, BRAND_BOOK.md §1: "MindCraft — Never work alone. /
    // Office hours from your room." Gives this arrival screen an actual
    // headline moment instead of jumping straight from a small top-bar
    // wordmark to the sign-in card.
    private var headline: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Never work alone.")
                .font(.system(size: 36, weight: .bold, design: .rounded))
                .tracking(-0.6)
                .foregroundColor(Color(welcomeHex: "f5f5f5"))
            Text("Office hours from your room.")
                .font(.system(size: 16, weight: .medium, design: .rounded))
                .foregroundColor(Color(welcomeHex: "f5f5f5").opacity(0.58))
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Top bar

    private var topBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text("The Desk")
                    .font(.system(size: 20, weight: .bold, design: .rounded))
                    .foregroundColor(Color(welcomeHex: "f5f5f5"))
                // Was gold (`f5d348`), then lime - Akshat's call on-device:
                // plain white/chalk reads cleaner as a static wordmark label
                // than an accent color that isn't signaling anything earned.
                Text("by MindCraft")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(welcomeHex: "f5f5f5").opacity(0.68))
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("The Desk by MindCraft")

            Spacer()

            // Password / email path only. Google CTA is on the card below.
            // (Old "Already here? Sign in" dismissed Welcome into LoginView,
            // which hid the lime desk CTA and looked like nothing shipped.)
            Button(action: onSignIn) {
                Text("Use password")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(welcomeHex: "fffdf7").opacity(0.75))
            }
            .buttonStyle(DeskPressStyle())
            .accessibilityIdentifier("welcomeSignInLink")
        }
        .padding(.top, 18)
        .padding(.bottom, 4)
    }

    // MARK: - Hero collage

    private var heroCollage: some View {
        ZStack {
            if let side1 = StoryArtLoader.image(forConcept: "quadratic_equations") {
                heroPlate(side1, size: 132)
                    .rotationEffect(.degrees(-9))
                    .offset(x: -96, y: 12)
            }
            if let side2 = StoryArtLoader.image(forConcept: "right_triangle_geometry") {
                heroPlate(side2, size: 132)
                    .rotationEffect(.degrees(8))
                    .offset(x: 96, y: 20)
            }
            if let main = StoryArtLoader.image(forConcept: "fractions_decimals") {
                heroPlate(main, size: 186)
                    .rotationEffect(.degrees(-1.5))
            }
        }
        .frame(maxWidth: .infinity)
        .frame(height: 240)
        .padding(.top, 12)
    }

    private func heroPlate(_ image: UIImage, size: CGFloat) -> some View {
        Image(uiImage: image)
            .resizable()
            .aspectRatio(contentMode: .fill)
            .frame(width: size, height: size)
            .clipped()
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(Color(welcomeHex: "f5f5f5").opacity(0.14), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.4), radius: 18, x: 0, y: 14)
    }

    // MARK: - Welcome login card
    private var welcomeLoginCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            // Was "Welcome" - now redundant with the headline above the
            // collage, which already carries the arrival greeting. This
            // label's actual job is naming the card ("here's how you get
            // in"), so it says that instead.
            Text("Sign in")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .textCase(.uppercase)
                .tracking(0.8)
                .foregroundColor(Color(welcomeHex: "143a2e").opacity(0.55))

            // Primary CTA - green field, short and pretty.
            Button {
                authService.clearError()
                Task { await authService.signInWithGoogle() }
            } label: {
                HStack(spacing: 10) {
                    GoogleMark(size: 18)
                    Text(authService.isBusy ? "Signing in…" : "Sign in to open your desk")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .lineLimit(1)
                        .minimumScaleFactor(0.85)
                }
                .foregroundColor(Color(welcomeHex: "0c1207"))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(
                            LinearGradient(
                                colors: [
                                    Color(welcomeHex: "c4f547"),
                                    Color(welcomeHex: "9fd60a")
                                ],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .shadow(color: Color(welcomeHex: "c4f547").opacity(0.45), radius: 16, x: 0, y: 6)
                )
            }
            .buttonStyle(DeskPressStyle())
            .disabled(authService.isBusy)
            .opacity(authService.isBusy ? 0.75 : 1)
            .accessibilityIdentifier("welcomeGoogleButton")

            if let message = authService.errorMessage, !message.isEmpty {
                Text(message)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(welcomeHex: "9e2b2b"))
                    .padding(10)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color(welcomeHex: "fff5f1"))
                    .clipShape(RoundedRectangle(cornerRadius: 10, style: .continuous))
            }

            Button {
                authService.clearError()
                if Self.appleSignInEnabled {
                    Task { await authService.signInWithApple() }
                } else {
                    // Honest: capability not on this personal team yet.
                    // Keep the button so the screen matches desk-os visually.
                    authService.errorMessage = "Continue with Apple needs a paid Apple Developer team on this build. Use Google for now."
                }
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "apple.logo")
                        .font(.system(size: 17, weight: .medium))
                    Text(authService.isBusy ? "Signing in…" : "Continue with Apple")
                        .font(.system(size: 15, weight: .semibold, design: .rounded))
                }
                .foregroundColor(Color(welcomeHex: "faf6ef"))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .fill(Color(welcomeHex: "143a2e"))
                )
            }
            .buttonStyle(DeskPressStyle())
            .disabled(authService.isBusy)
            .opacity(authService.isBusy ? 0.7 : 1)
            .accessibilityIdentifier("welcomeAppleButton")

            Button("Use a password instead") {
                onSignIn()
            }
            .buttonStyle(DeskPressStyle())
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(Color(welcomeHex: "247a4d"))
            .padding(.top, 2)
            .accessibilityIdentifier("welcomePasswordLink")
        }
        .padding(22)
        .frame(maxWidth: 420)
        .frame(maxWidth: .infinity)
        .background(
            RoundedRectangle(cornerRadius: 20, style: .continuous)
                .fill(Color(welcomeHex: "faf6ef"))
                .shadow(color: .black.opacity(0.32), radius: 28, x: 0, y: 14)
                .shadow(color: .black.opacity(0.16), radius: 6, x: 0, y: 2)
        )
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("welcomeLoginCard")
    }
}

/// Tactile press feedback shared with the rest of the entry flow (see
/// `CoverView.DeskPressStyle`) - a fast, weighted compress-and-release,
/// no springy overshoot.
private struct DeskPressStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
            .opacity(configuration.isPressed ? 0.9 : 1)
            .animation(.easeOut(duration: 0.12), value: configuration.isPressed)
    }
}

private extension Color {
    init(welcomeHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

private struct WelcomeBackground: View {
    var body: some View {
        ZStack {
            Color(welcomeHex: "080e14")
            RadialGradient(
                colors: [Color(welcomeHex: "1d3a8a").opacity(0.22), .clear],
                center: UnitPoint(x: 0.5, y: 0.15),
                startRadius: 0,
                endRadius: 420
            )
            RadialGradient(
                colors: [Color(welcomeHex: "c4f547").opacity(0.1), .clear],
                center: UnitPoint(x: 0.8, y: 0.05),
                startRadius: 0,
                endRadius: 340
            )
        }
        .ignoresSafeArea()
    }
}
