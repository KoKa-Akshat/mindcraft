import SwiftUI

/// Guided "get your free Gemini key" onboarding (2026-08-23) - shown once,
/// as the LAST gate in `AuthGate`'s onboarding sequence (after grade/goals,
/// before `DeskShellView`), and ONLY to a student with no BYOK key saved
/// yet (`StudentAIKeyStore.shared.hasKey == false`). Google offers Gemini
/// free to students, which is what lets MindCraft's AI features run on the
/// student's own free quota instead of a shared platform key.
///
/// Deliberately NOT a form-dump: three large, friendly screens (why → how
/// to get the key → paste it in), in the Work dashboard's own visual
/// language (warm cream `fff8e9`, forest ink `143a2e`, lime `c4f547`,
/// `.mcContent` editorial serif for headlines / `.mcChrome` for chrome -
/// same palette + type roles as `DeskGridDashboardView`, not a new one).
///
/// Never blocks: every step carries "Skip for now" (the key card in
/// Settings, `AccountManageView`, does the same job later), and finishing
/// OR skipping marks `GeminiOnboardingPreference.hasSeen` so nobody is
/// shown this twice. The paste step reuses `StudentAIKeyStore`'s existing
/// `save` + `testConnection` flow verbatim - the key goes to the Keychain
/// and Google's own host, nowhere else.
struct GeminiOnboardingView: View {
    var onDone: () -> Void

    private enum Step: Int, CaseIterable {
        case welcome = 0
        case getKey = 1
        case pasteKey = 2
        case connected = 3
    }

    private enum ConnectPhase: Equatable {
        case idle
        case connecting
        case failed(String)
    }

    @ObservedObject private var aiKeys = StudentAIKeyStore.shared
    @ObservedObject private var drive = DriveClient.shared
    @State private var step: Step = .welcome
    @State private var keyDraft = ""
    @State private var connectPhase: ConnectPhase = .idle
    @FocusState private var keyFieldFocused: Bool

    private let cream = Color(onbHex: "fff8e9")
    private let ink = Color(onbHex: "143a2e")
    private let green = Color(onbHex: "247a4d")
    private let lime = Color(onbHex: "c4f547")
    private let limeInk = Color(onbHex: "0c1207")
    private let paper = Color(onbHex: "faf6ea")
    private let muted = Color(onbHex: "8a8478")

    var body: some View {
        ZStack {
            cream.ignoresSafeArea()

            VStack(spacing: 0) {
                ScrollViewReader { proxy in
                    ScrollView {
                        Group {
                            switch step {
                            case .welcome: welcomeStep
                            case .getKey: getKeyStep
                            case .pasteKey: pasteKeyStep
                            case .connected: connectedStep
                            }
                        }
                        .frame(maxWidth: 560)
                        .frame(maxWidth: .infinity)
                        .padding(.horizontal, 32)
                        .padding(.top, 48)
                        .padding(.bottom, 24)
                        Color.clear.frame(height: 1).id("bottom")
                    }
                    .onAppear {
                        // Verification-only hook, same shape as this file's
                        // other `--ui-testing-*` flags - no tap automation
                        // exists on this device (see IOS_SESSION_HANDOFF.md)
                        // so a screenshot can't otherwise reach the fold.
                        if ProcessInfo.processInfo.arguments.contains("--ui-testing-gemini-scroll-bottom") {
                            DispatchQueue.main.asyncAfter(deadline: .now() + 1.2) {
                                withAnimation(nil) { proxy.scrollTo("bottom", anchor: .bottom) }
                            }
                        }
                    }
                }

                footer
            }
        }
        .animation(.easeInOut(duration: 0.25), value: step)
        .onAppear {
            // Same on-device-verification-without-tap-automation pattern
            // as StudyCompanionView's `--ui-testing-gurukul-script`
            // (this device has no WebDriverAgent, see IOS_SESSION_HANDOFF.md)
            // - jumps straight to a step so a screenshot can confirm it.
            let args = ProcessInfo.processInfo.arguments
            if args.contains("--ui-testing-gemini-getkey") { step = .getKey }
            if args.contains("--ui-testing-gemini-connected") { step = .connected }
        }
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            // Invisible marker so XCUITest can assert "this screen exists"
            // without an identifier on the container clobbering children
            // (the proven pattern from FieldDeskView's identifier bugs).
            Text(verbatim: "gemini-onboarding").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("geminiOnboardingRoot")
                .allowsHitTesting(false)
        }
    }

    // MARK: - Step 1 · why

    private var welcomeStep: some View {
        VStack(alignment: .leading, spacing: 22) {
            stepBadge("WELCOME TO THE DESK", index: 1)

            Text("Your Desk runs on a free key that's yours.")
                .font(.mcContent(size: 34, weight: .semibold))
                .foregroundColor(ink)
                .fixedSize(horizontal: false, vertical: true)

            Text("Google gives everyone a free Gemini key at aistudio.google.com - no card, no age check. MindCraft uses that key - your key - for homework help, study plans, and Jesse's answers. That's what keeps The Desk free, and it means your questions run on your own account, not through ours.")
                .font(.mcContent(size: 17))
                .foregroundColor(ink.opacity(0.75))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            VStack(alignment: .leading, spacing: 12) {
                perkRow(icon: "key.fill", text: "Free for everyone - Google's own offer, about two minutes to claim.")
                perkRow(icon: "lock.fill", text: "Saved only in this device's Keychain. Used directly for most features, and once per job to run your sim generations on your own quota.")
                perkRow(icon: "sparkles", text: "It unlocks homework help, study plans, and desk questions.")
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(paper)
                    .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(ink.opacity(0.1), lineWidth: 1))
            )

            primaryButton("Let's get my key", a11y: "geminiOnboardingNext") {
                step = .getKey
            }
        }
    }

    // MARK: - Step 2 · how to get the key

    private var getKeyStep: some View {
        VStack(alignment: .leading, spacing: 22) {
            stepBadge("GET YOUR FREE KEY", index: 2)

            // 2026-08-25, explicit ask: "not too many words you know nice
            // neat" + "just say Three simple steps to get your free API
            // key" - was a subcaption-heavy screen (3 full-paragraph
            // numberedStep cards). Verified 2026-08-23 (kept, still true):
            // Google AI Studio's standalone key (aistudio.google.com/apikey)
            // has no age or enrollment gate - that's still the right target,
            // this change is presentation only.
            Text("Three simple steps to get your free API key.")
                .font(.mcContent(size: 30, weight: .semibold))
                .foregroundColor(ink)
                .fixedSize(horizontal: false, vertical: true)

            // Annotated mockup, not a screenshot (none exists to bundle) -
            // same "illustrated, not photographic" style as the rest of
            // this onboarding. Shows the two taps the student can't miss:
            // the key icon, then Create API key.
            aiStudioVisual

            VStack(alignment: .leading, spacing: 10) {
                bulletLine("Sign in with any Google account - no school email or age check")
                bulletLine("Copy the key that appears (starts with \u{201C}AIza\u{201D})")
            }

            // College-track students (18+, actively enrolled) can ALSO
            // claim Google's separate "AI Pro free for a year" offer for
            // higher usage limits - shown as a bonus, not the main path,
            // since most students here don't qualify for it.
            Text("Already in college? Search \u{201C}Google AI Pro student offer\u{201D} for a free year of higher limits on top of this.")
                .font(.mcChrome(size: 12, weight: .medium))
                .foregroundColor(ink.opacity(0.5))
                .fixedSize(horizontal: false, vertical: true)

            primaryButton("I have my key", a11y: "geminiOnboardingHaveKey") {
                step = .pasteKey
            }

            Button {
                step = .welcome
            } label: {
                Text("Back")
                    .font(.mcChrome(size: 14, weight: .semibold))
                    .foregroundColor(ink.opacity(0.55))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("geminiOnboardingBack")
        }
    }

    // MARK: - Step 3 · paste + connect

    private var pasteKeyStep: some View {
        VStack(alignment: .leading, spacing: 22) {
            stepBadge("CONNECT IT", index: 3)

            Text("Paste your key.")
                .font(.mcContent(size: 32, weight: .semibold))
                .foregroundColor(ink)

            Text("It's saved to this iPad's Keychain. Most features send it straight to Google; sim generation sends it once per job to run on your own quota - never stored on our servers.")
                .font(.mcContent(size: 16))
                .foregroundColor(ink.opacity(0.7))
                .lineSpacing(3)
                .fixedSize(horizontal: false, vertical: true)

            SecureField("AIza\u{2026}", text: $keyDraft)
                .font(.mcChrome(size: 16))
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .focused($keyFieldFocused)
                .padding(16)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.white)
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(keyFieldFocused ? green : ink.opacity(0.18), lineWidth: keyFieldFocused ? 2 : 1)
                        )
                )
                .accessibilityIdentifier("geminiOnboardingKeyField")

            switch connectPhase {
            case .idle:
                EmptyView()
            case .connecting:
                HStack(spacing: 10) {
                    ProgressView().tint(green)
                    Text("Checking your key with Google\u{2026}")
                        .font(.mcChrome(size: 14, weight: .semibold))
                        .foregroundColor(green)
                }
                .accessibilityIdentifier("geminiOnboardingConnecting")
            case .failed(let message):
                Text(message)
                    .font(.mcChrome(size: 14, weight: .semibold))
                    .foregroundColor(Color(onbHex: "b0473f"))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("geminiOnboardingError")
            }

            primaryButton(connectPhase == .connecting ? "Connecting\u{2026}" : "Connect",
                          a11y: "geminiOnboardingConnect",
                          disabled: keyDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                              || connectPhase == .connecting) {
                Task { await connect() }
            }

            Button {
                step = .getKey
            } label: {
                Text("Back to the steps")
                    .font(.mcChrome(size: 14, weight: .semibold))
                    .foregroundColor(ink.opacity(0.55))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("geminiOnboardingBackToSteps")
        }
    }

    // MARK: - Step 4 · connected

    private var connectedStep: some View {
        VStack(alignment: .leading, spacing: 22) {
            HStack(spacing: 10) {
                Image(systemName: "checkmark.seal.fill")
                    .font(.system(size: 24))
                    .foregroundColor(green)
                Text("CONNECTED")
                    .font(.mcChrome(size: 12, weight: .heavy))
                    .tracking(1.4)
                    .foregroundColor(green)
            }

            Text("You're all set.")
                .font(.mcContent(size: 34, weight: .semibold))
                .foregroundColor(ink)

            Text("Your Gemini key works. Homework help, study plans, and Jesse's desk answers now run on your own free student quota.")
                .font(.mcContent(size: 17))
                .foregroundColor(ink.opacity(0.75))
                .lineSpacing(4)
                .fixedSize(horizontal: false, vertical: true)

            // Real wire-up (2026-08-25, explicit ask: "why cant i conenct
            // to my gdrive yet... i should be able to create a folder
            // there and evreythign student related happens there"). Was a
            // permanently-disabled "SOON" row. `connectAndReadFolder()`
            // requests the `driveFile` scope and now auto-creates "The
            // Desk" folder if it's missing (see DriveClient.readDeskFolder)
            // instead of dead-ending on "create a folder yourself first" -
            // that manual-precreation requirement was the actual reason
            // this never worked for a fresh student.
            Button {
                Task { _ = await drive.connectAndReadFolder() }
            } label: {
                HStack(spacing: 12) {
                    Image(systemName: drive.isConnected ? "checkmark.circle.fill" : "folder.badge.plus")
                        .font(.system(size: 18))
                        .foregroundColor(drive.isConnected ? green : ink.opacity(0.7))
                    VStack(alignment: .leading, spacing: 2) {
                        Text(drive.isConnected ? "Drive folder connected" : "Connect your Drive folder")
                            .font(.mcChrome(size: 15, weight: .bold))
                            .foregroundColor(ink)
                        Text(driveSubtitle)
                            .font(.mcChrome(size: 12, weight: .medium))
                            .foregroundColor(drive.lastError != nil ? Color(onbHex: "b0473f") : muted)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    Spacer(minLength: 8)
                    if drive.isBusy {
                        ProgressView().tint(green)
                    } else if !drive.isConnected {
                        Text("CONNECT")
                            .font(.mcChrome(size: 10, weight: .heavy))
                            .tracking(1)
                            .foregroundColor(limeInk)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 4)
                            .background(Capsule().fill(lime))
                    }
                }
                .padding(16)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(paper)
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(drive.isConnected ? green.opacity(0.35) : ink.opacity(0.12), style: StrokeStyle(lineWidth: 1, dash: drive.isConnected ? [] : [5, 4]))
                        )
                )
            }
            .buttonStyle(.plain)
            .disabled(drive.isBusy || drive.isConnected)
            .accessibilityIdentifier("geminiOnboardingDriveConnect")

            // Same #if DEBUG admin-link pattern GmailWorkflowBoxView already
            // uses for its own "enable the API" 403 (`enableApiURL`) - that
            // property existed on DriveClient too but nothing ever surfaced
            // it, so a 403 here previously read as a dead end with no next
            // step besides finding Cloud Console by hand.
            #if DEBUG
            if let url = drive.enableApiURL {
                Link(destination: url) {
                    Text("Admin: enable Drive API \u{2192}")
                        .font(.mcChrome(size: 12, weight: .bold))
                        .foregroundColor(green)
                        .underline()
                }
                .accessibilityIdentifier("geminiOnboardingDriveEnableApiLink")
            }
            #endif

            primaryButton("Enter The Desk", a11y: "geminiOnboardingEnter") {
                finish()
            }
        }
    }

    // MARK: - Shared pieces

    private var footer: some View {
        HStack {
            // Progress dots - which of the 3 pre-success screens you're on.
            if step != .connected {
                HStack(spacing: 6) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(i == step.rawValue ? green : ink.opacity(0.15))
                            .frame(width: 7, height: 7)
                    }
                }
            }
            Spacer()
            if step != .connected {
                Button {
                    finish()
                } label: {
                    Text("Skip for now - set up later in Settings")
                        .font(.mcChrome(size: 13, weight: .semibold))
                        .foregroundColor(ink.opacity(0.45))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("geminiOnboardingSkip")
            }
        }
        .padding(.horizontal, 32)
        .padding(.vertical, 18)
    }

    private func stepBadge(_ label: String, index: Int) -> some View {
        HStack(spacing: 10) {
            Text("\(index)")
                .font(.mcChrome(size: 13, weight: .heavy))
                .foregroundColor(limeInk)
                .frame(width: 26, height: 26)
                .background(Circle().fill(lime))
            Text(label)
                .font(.mcChrome(size: 12, weight: .heavy))
                .tracking(1.4)
                .foregroundColor(green)
        }
    }

    private func perkRow(icon: String, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(green)
                .frame(width: 22)
            Text(text)
                .font(.mcChrome(size: 14, weight: .medium))
                .foregroundColor(ink.opacity(0.8))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Native mockup of the two taps that get a student their key (no real
    /// screenshot exists to bundle, and a hand-drawn illustration matches
    /// this onboarding's existing "illustrated, not photographic" style
    /// better than a raster screenshot would anyway). Panel 1 = AI Studio's
    /// toolbar, key icon called out bottom-left; panel 2 = the dialog that
    /// opens, "Create API key" called out top-right - exactly the two
    /// landmarks from the student's own screenshot (2026-08-25 ask).
    private var aiStudioVisual: some View {
        VStack(alignment: .leading, spacing: 16) {
            mockupPanel(caption: "Tap the key icon, bottom left") {
                VStack(alignment: .leading, spacing: 0) {
                    HStack(spacing: 10) {
                        Image(systemName: "magnifyingglass").foregroundColor(muted)
                        Image(systemName: "bell").foregroundColor(muted)
                        Image(systemName: "gearshape").foregroundColor(muted)
                        Spacer()
                    }
                    .font(.system(size: 14))
                    Spacer(minLength: 30)
                    HStack {
                        ZStack {
                            Circle().stroke(lime, lineWidth: 2).frame(width: 40, height: 40)
                            Circle().fill(lime).frame(width: 30, height: 30)
                            Image(systemName: "key.fill")
                                .font(.system(size: 13, weight: .bold))
                                .foregroundColor(limeInk)
                        }
                        calloutBadge("1")
                        Spacer()
                    }
                }
            }
            mockupPanel(caption: "Then Create API key, top right") {
                HStack {
                    calloutBadge("2")
                    Spacer()
                    ZStack {
                        Capsule().stroke(lime, lineWidth: 2).padding(-3)
                        Text("Create API key")
                            .font(.mcChrome(size: 13, weight: .bold))
                            .foregroundColor(limeInk)
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(lime))
                    }
                }
            }
        }
    }

    /// One "browser chrome" mockup frame - two stacked instances make up
    /// `aiStudioVisual` (the toolbar tap, then the dialog that opens).
    private func mockupPanel<Content: View>(caption: String, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            VStack(spacing: 0) {
                HStack(spacing: 6) {
                    ForEach(0..<3, id: \.self) { _ in
                        Circle().fill(ink.opacity(0.12)).frame(width: 7, height: 7)
                    }
                    Spacer()
                    Text("aistudio.google.com")
                        .font(.mcChrome(size: 11, weight: .semibold))
                        .foregroundColor(ink.opacity(0.4))
                    Spacer()
                    Color.clear.frame(width: 21)
                }
                .padding(.horizontal, 14)
                .padding(.vertical, 10)
                .background(ink.opacity(0.04))

                content()
                    .padding(14)
            }
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color.white)
                    .overlay(RoundedRectangle(cornerRadius: 14, style: .continuous).stroke(ink.opacity(0.1), lineWidth: 1))
            )
            Text(caption)
                .font(.mcChrome(size: 12, weight: .bold))
                .foregroundColor(green)
        }
    }

    private func calloutBadge(_ n: String) -> some View {
        Text(n)
            .font(.mcChrome(size: 11, weight: .heavy))
            .foregroundColor(green)
            .frame(width: 20, height: 20)
            .background(Circle().fill(green.opacity(0.12)))
    }

    private func bulletLine(_ text: String) -> some View {
        HStack(alignment: .top, spacing: 8) {
            Circle().fill(green).frame(width: 5, height: 5).padding(.top, 7)
            Text(text)
                .font(.mcChrome(size: 14, weight: .medium))
                .foregroundColor(ink.opacity(0.7))
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private func primaryButton(_ label: String, a11y: String, disabled: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(label)
                .font(.mcChrome(size: 17, weight: .bold))
                .foregroundColor(limeInk)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(lime.opacity(disabled ? 0.4 : 1))
                )
        }
        .buttonStyle(.plain)
        .disabled(disabled)
        .accessibilityIdentifier(a11y)
    }

    // MARK: - Actions

    private func connect() async {
        keyFieldFocused = false
        connectPhase = .connecting
        guard aiKeys.save(provider: .gemini, key: keyDraft) else {
            connectPhase = .failed("Couldn't save that key - check it and try again.")
            return
        }
        switch await aiKeys.testConnection() {
        case .success:
            keyDraft = ""
            connectPhase = .idle
            step = .connected
        case .failure(.rejected), .failure(.noKey):
            // Don't leave a dead key behind looking "connected" - only
            // key-less students ever reach this flow (AuthGate's hasKey
            // gate), so remove() can't wipe some other provider's key.
            aiKeys.remove()
            connectPhase = .failed("Google didn't accept that key. Re-copy it from AI Studio and paste again.")
        case .failure(.unavailable):
            // Keep the saved key - it may be fine; the network wasn't.
            connectPhase = .failed("Couldn't reach Google right now - check your connection and tap Connect again.")
        }
    }

    private var driveSubtitle: String {
        if let error = drive.lastError { return error }
        if drive.isConnected { return "Everything student-related saves to \u{201C}\(drive.folderName ?? "The Desk")\u{201D}." }
        if drive.isBusy { return "Connecting\u{2026}" }
        return "Creates a folder in your Drive - class notes and sims save there."
    }

    private func finish() {
        GeminiOnboardingPreference.hasSeen = true
        onDone()
    }
}

/// UserDefaults-backed "have we shown this once" gate, same shape as
/// `StudentGradeGoalsPreference`/`AIDisclosurePreference`. Only whether the
/// SCREEN was shown lives here - the key itself is Keychain-only
/// (`StudentAIKeyStore`). Defaults to false, so an existing student without
/// a key sees this once on their next launch (skippable in one tap);
/// a student who already saved any BYOK key never sees it at all
/// (AuthGate also checks `StudentAIKeyStore.shared.hasKey`).
enum GeminiOnboardingPreference {
    private static let seenKey = "hasSeenGeminiOnboarding"

    static var hasSeen: Bool {
        get { UserDefaults.standard.bool(forKey: seenKey) }
        set { UserDefaults.standard.set(newValue, forKey: seenKey) }
    }
}

private extension Color {
    init(onbHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
