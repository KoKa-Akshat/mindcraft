import SwiftUI
import MapKit
import CoreLocation

/// **Brick 1** of `DESK_OS_NATIVE_BRIEF.md` - real structural port of the
/// live Desk OS web design (`agent_work/product/desk_os/` in the shared
/// `mindcraft` repo - `index.html`'s `#bootStage`/`#hubStage` markup +
/// `js/bootHub.js`'s `DEFAULTS`/`renderHub()`, read directly before writing
/// this, not guessed), per Akshat's explicit "follow that layout down to
/// the dot" instruction. Two real stages, matching the web's own
/// `showBoot()` → `showHub()` sequence:
///
/// 1. `DeskBootView` - "Your workspace is starting up…" with the real
///    6-icon connection flow (Gmail → Calendar → Moodle → Intel → Binder →
///    ACT) and caption, on the SAME real timing the web uses
///    (`BOOT_DIAGRAM_DELAY_MS`/`BOOT_HUB_DELAY_MS` in `js/actBook.js`:
///    500ms/1600ms - confirmed from source, not guessed).
/// 2. `DeskShellView` (the instance hub) - real nav bar (wordmark,
///    Dashboard tab, user name/email, sign out) and real instance cards
///    matching `renderHub()`'s exact markup: gear icon, kind badge, name,
///    "Open instance" button, running/stopped status dot, an execution-
///    steps count + progress bar, plus a "Create an instance" tile.
///
/// **Honest scope note**: `bootHub.js`'s `DEFAULTS` lists 3 instances
/// (`desk_main`/Field Desk, `act_main`/ACT Field Book, `piano_main`/Piano
/// Field Book). Only ACT Field Book has real native content (this app's own
/// 9-round `DashboardView`). Field Desk and Piano Field Book cards render
/// with the real copy/badges/exec-bar but are honestly non-functional
/// (disabled, not faked as working) until those modules are actually built
/// natively. Flagged here and in `DESK_OS_NATIVE_BRIEF.md`, not hidden.
///
/// **Icon substitution**: the web reference uses custom PNG orb art
/// (`img/orbs/mail.png` etc.) this app doesn't bundle. Using real SF
/// Symbols as faithful stand-ins (documented per-icon below) rather than
/// exporting new art assets, consistent with how this app has substituted
/// SF Symbols for lucide-react icons elsewhere (`DashboardView`'s nav row).
struct DeskShellView: View {
    @EnvironmentObject private var authService: AuthService
    @Environment(\.openURL) private var openURL
    @StateObject private var studentStore = FirestoreStudentStore()
    @StateObject private var goalStore = DeskGoalStore()
    @StateObject private var tutorClient = TutorDirectoryClient()
    @StateObject private var workflowStore = WorkflowMarketStore()
    // App-lifetime Jesse voice session (see JesseCallSession.swift's doc
    // comment) - owned here, not inside whichever screen starts a call, so
    // navigating away from that screen never ends an in-progress call.
    @StateObject private var jesseCall = JesseCallSession()
    @State private var showJesseCallSheet = false
    /// Classic desk boot slide → Field Desk (primary after login).
    @State private var showBoot = true
    @State private var showWorkDesk = false
    @State private var kitchenReady = false
    @State private var showActFieldBook = false
    /// Item-based Field Desk presentation so `opensAct` is not stale-captured
    /// by `fullScreenCover(isPresented:)` (SwiftUI evaluates the content
    /// closure against the prior render's state).
    @State private var fieldDeskRoute: FieldDeskRoute?
    @State private var showTestInstance = false
    @State private var showCheckIn = false
    @State private var showFriends = false
    @State private var showFindTutor = false
    @State private var toastMessage: String?
    @State private var tutorFilter: String = "All"
    @State private var workflowQuery: String = ""
    /// Writable map search (web FindTutor Places parity via CLGeocoder).
    @State private var mapSearchText: String = ""
    @State private var mapSearchOrigin: CLLocationCoordinate2D?
    @State private var mapSearchLabel: String = ""
    @State private var mapSearchError: String?
    @State private var mapLocating = false
    @State private var tutorCamera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 39.0, longitude: -95.0),
            span: MKCoordinateSpan(latitudeDelta: 40, longitudeDelta: 50)
        )
    )
    @StateObject private var locationHelper = HubLocationHelper()
    @StateObject private var customInstances = CustomInstanceStore.shared
    @State private var showManage = false
    @State private var showCreateInstance = false
    @State private var showOpenArchive = false
    @State private var openCustomId: String?
    /// Full hub page (tutors map + workflow market) opened from the work
    /// area's Manage button.
    @State private var showHubPage = false

    var body: some View {
        ZStack {
            // Mount Jesse under the boot so it can load while the slide runs.
            if showWorkDesk || showBoot {
                FieldDeskView(
                    initialActStage: false,
                    onLaunchInstance: { inst in
                        switch inst {
                        case .custom:
                            showWorkDesk = false
                            showBoot = false
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                                launchBoundInstance(inst)
                            }
                        case .actFieldBook, .testCook:
                            break
                        }
                    }
                )
                .environmentObject(studentStore)
                .environmentObject(authService)
                .environmentObject(jesseCall)
                // Keep fully opaque under the boot — near-zero opacity makes WKWebView flash white.
                .allowsHitTesting(!showBoot)
            }

            if showBoot {
                DeskBootView(
                    kitchenReady: kitchenReady,
                    onComplete: {
                        withAnimation(.easeInOut(duration: 0.45)) {
                            showBoot = false
                            showWorkDesk = true
                        }
                    }
                )
                .transition(.opacity)
                .zIndex(20)
            }

            // Sibling of FieldDeskView, not nested inside it - see
            // JesseCallPill's own doc comment for why. Renders above
            // everything else in this ZStack regardless of which Field Desk
            // overlay is currently showing.
            VStack {
                HStack {
                    Spacer()
                    JesseCallPill(call: jesseCall) { showJesseCallSheet = true }
                }
                Spacer()
            }
            .zIndex(90)
            .allowsHitTesting(jesseCall.isActive)
        }
        .sheet(isPresented: $showJesseCallSheet) {
            JesseCallSheetView(
                call: jesseCall,
                onClose: { showJesseCallSheet = false },
                onEnd: {
                    jesseCall.end()
                    showJesseCallSheet = false
                }
            )
        }
        .background(Color(shellHex: "0f1f18").ignoresSafeArea())
        .animation(.easeInOut(duration: 0.45), value: showBoot)
        .onReceive(NotificationCenter.default.publisher(for: .mcKitchenReady)) { _ in
            kitchenReady = true
        }
        .onReceive(NotificationCenter.default.publisher(for: .mcOpenHubFromDesk)) { _ in
            // If Field Desk is up as a cover, dismiss it first — presenting
            // two covers from the same host silently fails.
            if fieldDeskRoute != nil {
                fieldDeskRoute = nil
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.45) {
                    showHubPage = true
                }
            } else {
                showHubPage = true
            }
        }
        .fullScreenCover(isPresented: $showHubPage) {
            ZStack(alignment: .bottom) {
                hub
                Button {
                    showHubPage = false
                } label: {
                    HStack(spacing: 8) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .heavy))
                        Text("Back to desk")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                    }
                    .foregroundColor(Color(shellHex: "f4f7f4"))
                    .padding(.horizontal, 18)
                    .padding(.vertical, 11)
                    .background(Capsule().fill(Color(shellHex: "1f2a22")))
                    .shadow(color: .black.opacity(0.25), radius: 12, y: 5)
                }
                .buttonStyle(.plain)
                .padding(.bottom, 18)
                .accessibilityIdentifier("hubPageBackToDesk")
            }
            // Attached HERE, not on the outer body - callButton (which sets
            // showCheckIn) lives inside this fullScreenCover's content.
            // SwiftUI silently no-ops a .sheet() declared on an ancestor
            // OUTSIDE the currently-presented fullScreenCover's own hosted
            // hierarchy: showCheckIn correctly flipped true (confirmed no
            // crash), but no sheet ever appeared - the real bug behind
            // MasteryCheckInSheet being unreachable, not the callButton
            // action itself (that part was already fixed to call showCheckIn
            // instead of showFriends, restoring web parity with hubCall.js).
            .sheet(isPresented: $showCheckIn) {
                MasteryCheckInSheet(store: goalStore) { message in
                    flashHub(message)
                }
            }
        }
        .onAppear {
            // Start loading Jesse immediately under the boot slide.
            showWorkDesk = true
        }
        .task { await tutorClient.load() }
        .environmentObject(studentStore)
        .fullScreenCover(isPresented: $showActFieldBook) {
            // ACT is its own instance: empty canvas + dash + notes (not Field Desk).
            ActInstanceShellView(onMinimize: { showActFieldBook = false })
                .environmentObject(studentStore)
                .environmentObject(authService)
                .interactiveDismissDisabled(true)
        }
        .fullScreenCover(item: $fieldDeskRoute) { _ in
            FieldDeskView(
                initialActStage: false,
                onLaunchInstance: { inst in
                    // Custom instances still escalate to the hub shell.
                    // ACT opens as the on-desk dash stage (Binder + Home).
                    switch inst {
                    case .custom:
                        fieldDeskRoute = nil
                        DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                            launchBoundInstance(inst)
                        }
                    case .actFieldBook, .testCook:
                        break
                    }
                }
            )
            .environmentObject(studentStore)
            .environmentObject(authService)
            .interactiveDismissDisabled(true)
        }
        .fullScreenCover(isPresented: $showTestInstance) {
            // Round 25: document→cook learning instance (McCreary stack showcase).
            TestInstanceView()
        }
        .fullScreenCover(isPresented: $showOpenArchive) {
            OpenLearningArchiveView(onClose: { showOpenArchive = false })
        }
        .fullScreenCover(isPresented: $showFindTutor) {
            NavigationStack {
                FindTutorView()
                    .toolbar {
                        ToolbarItem(placement: .topBarTrailing) {
                            Button("Close") { showFindTutor = false }
                        }
                    }
            }
        }
        .fullScreenCover(isPresented: $showFriends) {
            FriendsView(onClose: { showFriends = false })
        }
        .sheet(isPresented: $showManage) {
            AccountManageView()
                .environmentObject(authService)
                .environmentObject(studentStore)
        }
        .sheet(isPresented: $showCreateInstance) {
            CreateInstanceStudioView { inst in
                flashHub("Instance ready · \(inst.name)")
            }
        }
        .sheet(item: Binding(
            get: { openCustomId.flatMap { id in customInstances.instances.first { $0.id == id } } },
            set: { openCustomId = $0?.id }
        )) { inst in
            NavigationStack {
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        Text(inst.name)
                            .font(.system(size: 22, weight: .bold, design: .rounded))
                        Text("\(inst.subject) · \(inst.files.count) upload(s)")
                            .foregroundColor(.secondary)
                        if !inst.prompt.isEmpty {
                            Text(inst.prompt)
                                .font(.system(size: 14, weight: .medium, design: .rounded))
                        }
                        ForEach(inst.files, id: \.self) { f in
                            Label(f, systemImage: "doc")
                        }
                        Text("Full interactive pages cook on the web pipeline next - files are bound to this instance.")
                            .font(.system(size: 12, weight: .medium, design: .rounded))
                            .foregroundColor(.secondary)
                    }
                    .padding(20)
                }
                .navigationTitle("Instance")
                .toolbar {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Close") { openCustomId = nil }
                    }
                }
            }
        }
    }

    private func flashHub(_ message: String) {
        toastMessage = message
        Task {
            try? await Task.sleep(nanoseconds: 2_600_000_000)
            if toastMessage == message { toastMessage = nil }
        }
    }

    // MARK: - Instance hub (real port of `js/bootHub.js`'s `renderHub()`)

    private var hub: some View {
        ZStack {
            ShellBackground()
                .allowsHitTesting(false)

            ScrollView {
                VStack(alignment: .leading, spacing: 0) {
                    hubNav
                    // Greeting → straight into instance cards (no mastery /
                    // SET GOAL / “Your instances” label in between).
                    greeting
                        .padding(.top, 4)
                        .padding(.bottom, 16)
                    instanceGrid

                    // Shown directly, no collapse/expand toolbar wrapper -
                    // tutors and workflows are always visible on the hub.
                    plainSectionHeader(title: "Tutors nearby", a11y: "deskHubTutorsNearby")
                        .padding(.top, 22)
                    tutorsNearbySection

                    plainSectionHeader(title: "Workflow market", a11y: "deskHubWorkflowMarket")
                        .padding(.top, 22)
                    workflowMarketSection
                        .padding(.bottom, 12)

                    hubSignOutFooter
                }
                // Pull content left toward the logo / wordmark.
                .padding(.leading, 14)
                .padding(.trailing, 24)
                .padding(.vertical, 20)
            }
            if let toastMessage {
                // Native stand-in for the web's `showToast()` capsule -
                // confirms a saved check-in without blocking anything.
                VStack {
                    Spacer()
                    Text(toastMessage)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(shellHex: "f4f7f4"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(shellHex: "1f2a22")))
                        .padding(.bottom, 28)
                        // On the Text itself (not the wrapping VStack) so
                        // XCUITest finds it as staticTexts["deskToast"].
                        .accessibilityIdentifier("deskToast")
                }
                .transition(.opacity)
            }
        }
        .animation(.easeInOut(duration: 0.2), value: toastMessage)
    }

    /// Real port of `.hub-nav`: **The Desk** wordmark + Settings on the left,
    /// user name/email + sign out on the right. No company logo in app chrome.
    private var hubNav: some View {
        HStack(alignment: .center) {
            HStack(spacing: 12) {
                Text("The Desk")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(ShellColor.ink)
                    .accessibilityIdentifier("deskHubWordmark")
                callButton
            }
            Spacer(minLength: 8)
            HStack(spacing: 10) {
                VStack(alignment: .trailing, spacing: 1) {
                    Text(studentStore.displayName == "there" ? "" : studentStore.displayName)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(ShellColor.ink)
                    if let email = authService.currentUser?.email {
                        Text(email)
                            .font(.system(size: 11, weight: .medium, design: .rounded))
                            .foregroundColor(ShellColor.ink.opacity(0.55))
                    }
                }
                // Next to name → back to Jesse's (Field Desk). Was a bare
                // house glyph - read as "does nothing" in testing even
                // though it's wired correctly, because nothing about it said
                // "Jesse" specifically. A text label fixes the affordance
                // without touching the (already-correct) navigation.
                Button {
                    fieldDeskRoute = .plain
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "house.fill")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Jesse's")
                            .font(.system(size: 13, weight: .bold, design: .rounded))
                    }
                    .foregroundColor(ShellColor.ink)
                    .padding(.horizontal, 14)
                    .frame(height: 40)
                    .background(Capsule().fill(ShellColor.brandGreen.opacity(0.22)))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskHubHome")
                .accessibilityLabel("Back to Jesse's")
            }
        }
        .padding(.bottom, 14)
    }

    /// Sign out, moved off the primary nav row - it shouldn't share visual
    /// weight with "back to Jesse's." Sits under the Workflow Market section,
    /// the last thing on the hub page.
    private var hubSignOutFooter: some View {
        HStack {
            Spacer()
            Button("Sign out") { authService.signOut() }
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(ShellColor.ink.opacity(0.55))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().stroke(ShellColor.ink.opacity(0.2), lineWidth: 1))
                .accessibilityIdentifier("deskShellSignOut")
            Spacer()
        }
        .padding(.top, 26)
    }

    /// Plain section heading, always visible - no collapse/expand toolbar.
    private func plainSectionHeader(title: String, a11y: String) -> some View {
        Text(title)
            .font(.system(size: 17, weight: .bold, design: .rounded))
            .foregroundColor(ShellColor.ink)
            .padding(.bottom, 10)
            .accessibilityIdentifier(a11y)
    }

    private var greeting: some View {
        // `.hub-greet`: `font: italic 400 28px/1.15 var(--serif)`.
        Text("\(timeGreeting()), \(studentStore.displayName == "there" ? "there" : studentStore.displayName).")
            .font(.system(size: 26, design: .serif))
            .italic()
            .foregroundColor(ShellColor.ink)
    }

    /// `.hub-goal` - "SET GOAL" label, instance + goal-type selects, echo.
    /// Behavior mirrors `bootHub.js` exactly: changing the instance select
    /// persists focus (`deskOs.goalFocus`) and repaints; changing the goal
    /// type persists the goal (`deskOs.instanceGoals`) for the focused
    /// instance; the echo reads "name → Goal label".
    private var goalCard: some View {
        VStack(alignment: .leading, spacing: 9) {
            Text("SET GOAL")
                .font(.system(size: 11, weight: .semibold, design: .rounded))
                .tracking(0.9)
                .foregroundColor(Color(shellHex: "9fd6ac"))
            HStack(spacing: 8) {
                goalMenu(
                    title: goalStore.focusedInstance.name,
                    a11yId: "deskGoalInstance"
                ) {
                    ForEach(DeskGoalStore.instanceCatalog) { inst in
                        Button(inst.name) { goalStore.setFocus(inst.id) }
                    }
                }
                goalMenu(
                    title: goalStore.selectedGoal.label,
                    a11yId: "deskGoalType"
                ) {
                    ForEach(goalStore.goalOptionsForFocused) { option in
                        Button(option.label) { goalStore.setGoal(option.id) }
                    }
                }
            }
            Text(goalStore.goalEcho)
                .font(.system(size: 12, weight: .regular, design: .rounded))
                .foregroundColor(ShellColor.ink.opacity(0.55))
                .accessibilityIdentifier("deskGoalEcho")
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .frame(maxWidth: 520, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(ShellColor.cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .stroke(ShellColor.ink.opacity(0.14), lineWidth: 1)
                )
        )
    }

    private func goalMenu<Content: View>(
        title: String, a11yId: String, @ViewBuilder content: () -> Content
    ) -> some View {
        Menu {
            content()
        } label: {
            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .lineLimit(1)
                Image(systemName: "chevron.up.chevron.down")
                    .font(.system(size: 9, weight: .semibold))
                    .opacity(0.6)
            }
            .foregroundColor(ShellColor.ink)
            .padding(.horizontal, 11)
            .padding(.vertical, 9)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(Color(shellHex: "14261c").opacity(0.85))
                    .overlay(
                        RoundedRectangle(cornerRadius: 10, style: .continuous)
                            .stroke(ShellColor.ink.opacity(0.18), lineWidth: 1)
                    )
            )
        }
        .accessibilityIdentifier(a11yId)
    }

    /// `.hub-call` - compact phone next to Manage (mastery strip removed).
    private var callButton: some View {
        Button {
            showCheckIn = true
        } label: {
            Image(systemName: "phone.fill")
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color(shellHex: "c4f547"))
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color(shellHex: "111111")))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskHubCallButton")
        .accessibilityLabel("Call")
    }

    /// `.hub-orb-row` - the rotating wireframe cube (web: a 3D CSS cube,
    /// 6 faces + 3 cross planes, `rotateX(-18deg)` + a 16s full Y turn)
    /// beside "Mastery" + the honest percent. The percent logic is
    /// `masteryForInstance()` ported exactly: a number ONLY when recorded
    /// check-in evidence exists for the focused instance, otherwise an
    /// em-dash - never an invented estimate.
    private var orbRow: some View {
        HStack(spacing: 20) {
            MasteryCubeView()
                .frame(width: 128, height: 128)
            VStack(alignment: .leading, spacing: 4) {
                Text("Mastery")
                    .font(.system(size: 22, weight: .semibold, design: .rounded))
                    .foregroundColor(ShellColor.ink)
                Text(goalStore.masteryPctForFocused.map { "\($0)%" } ?? "\u{2014}")
                    .font(.system(size: 28, weight: goalStore.masteryPctForFocused == nil ? .regular : .medium, design: .rounded))
                    .monospacedDigit()
                    .foregroundColor(
                        goalStore.masteryPctForFocused == nil
                            ? ShellColor.ink.opacity(0.45)
                            : Color(shellHex: "b9e86f")
                    )
                    .accessibilityIdentifier("deskMasteryPct")
            }
            Spacer()
        }
        .padding(.top, 18)
    }

    private func timeGreeting() -> String {
        let hour = Calendar.current.component(.hour, from: Date())
        switch hour {
        case 5..<12: return "good morning"
        case 12..<17: return "good afternoon"
        case 17..<22: return "good evening"
        default: return "good night"
        }
    }

    private func launchBoundInstance(_ inst: DeskBoundInstance) {
        switch inst {
        case .actFieldBook:
            showActFieldBook = true
        case .testCook:
            showTestInstance = true
        case .custom(let id, _, _):
            openCustomId = id
        }
    }

    /// Real port of `renderHub()`'s `hub-card` markup, one card per
    /// `DEFAULTS` entry (`js/bootHub.js`) + the real "Create an instance"
    /// tile at the end.
    private var instanceGrid: some View {
        LazyVGrid(columns: [GridItem(.adaptive(minimum: 240), spacing: 16)], spacing: 16) {
            instanceCard(
                id: "open_archive", name: "Open Learning Archive", badge: "Free · No login",
                systemImage: "books.vertical.fill", accent: Color(shellHex: "c4f547"),
                execUsed: 113, execCap: 113, running: true, isFunctional: true,
                statLabel: "Free intelligent textbooks"
            ) {
                showOpenArchive = true
            }
            .accessibilityIdentifier("deskInstance_openArchive")
            ForEach(customInstances.instances) { inst in
                instanceCard(
                    id: inst.id, name: inst.name, badge: inst.subject,
                    systemImage: "books.vertical.fill", accent: Color(shellHex: "c4f547"),
                    execUsed: inst.files.count, execCap: max(10, inst.files.count),
                    running: true, isFunctional: true
                ) {
                    openCustomId = inst.id
                }
                .accessibilityIdentifier("deskInstance_custom_\(inst.id)")
            }
            createInstanceTile
        }
    }

    private func instanceCard(
        id: String, name: String, badge: String, systemImage: String, accent: Color,
        execUsed: Int, execCap: Int, running: Bool, isFunctional: Bool,
        statLabel: String = "Execution steps",
        action: (() -> Void)? = nil
    ) -> some View {
        let pct = min(1.0, Double(execUsed) / Double(max(1, execCap)))
        return VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "gearshape.fill")
                    .font(.system(size: 13))
                    .foregroundColor(ShellColor.ink.opacity(0.4))
                Spacer()
                Text(badge)
                    .font(.system(size: 10, weight: .bold, design: .rounded))
                    .foregroundColor(accent)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().stroke(accent.opacity(0.5), lineWidth: 1))
            }
            HStack(spacing: 10) {
                Image(systemName: systemImage)
                    .font(.system(size: 20, weight: .medium))
                    .foregroundColor(accent)
                Text(name)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(ShellColor.ink)
            }
            Button(isFunctional ? "Open instance" : "Coming soon") { action?() }
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(isFunctional ? ShellColor.ink : ShellColor.ink.opacity(0.4))
                .padding(.horizontal, 12)
                .padding(.vertical, 6)
                .background(Capsule().fill(isFunctional ? accent.opacity(0.22) : Color.clear))
                .overlay(Capsule().stroke(ShellColor.ink.opacity(isFunctional ? 0 : 0.2), lineWidth: 1))
                .disabled(!isFunctional)
            HStack(spacing: 6) {
                Text(running ? "Running" : "Stopped")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.6))
                Circle()
                    .fill(running ? ShellColor.brandGreen : ShellColor.ink.opacity(0.3))
                    .frame(width: 6, height: 6)
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("\(execUsed.formatted()) / \(execCap.formatted())")
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.8))
                GeometryReader { geo in
                    ZStack(alignment: .leading) {
                        Capsule().fill(ShellColor.ink.opacity(0.12))
                        Capsule().fill(accent).frame(width: max(0, geo.size.width * pct))
                    }
                }
                .frame(height: 4)
                Text(statLabel)
                    .font(.system(size: 10, weight: .medium, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.45))
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(ShellColor.cardFill)
                .overlay(RoundedRectangle(cornerRadius: 16, style: .continuous).stroke(accent.opacity(0.3), lineWidth: 1.5))
        )
    }

    private var createInstanceTile: some View {
        Button { showCreateInstance = true } label: {
            VStack(spacing: 8) {
                Text("+")
                    .font(.system(size: 28, weight: .light))
                Text("Create an instance")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                Text("Upload materials")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.4))
            }
            .foregroundColor(ShellColor.ink.opacity(0.55))
            .frame(maxWidth: .infinity, minHeight: 140)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(ShellColor.ink.opacity(0.2), style: StrokeStyle(lineWidth: 1.5, dash: [6, 4]))
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskHubCreateInstance")
    }

    // MARK: - Tutors nearby (writable map · tutors shuffle by distance)

    /// Tag filter, then distance shuffle when a search/location origin is set
    /// (web `filterTutorsForSearch` - nearest first, within ~250 mi).
    private var filteredTutors: [Tutor] {
        let tagged: [Tutor]
        switch tutorFilter {
        case "Nearby":
            tagged = tutorClient.tutors.filter {
                $0.regionLabel.localizedCaseInsensitiveContains("MN")
                    || $0.regionLabel.localizedCaseInsensitiveContains("St Paul")
                    || $0.regionLabel.localizedCaseInsensitiveContains("Macalester")
            }
        case "Math":
            tagged = tutorClient.tutors.filter {
                $0.subjects.contains(where: {
                    $0.localizedCaseInsensitiveContains("algebra")
                        || $0.localizedCaseInsensitiveContains("calc")
                        || $0.localizedCaseInsensitiveContains("math")
                })
            }
        case "ACT":
            tagged = tutorClient.tutors.filter {
                $0.subjects.contains(where: { $0.localizedCaseInsensitiveContains("ACT") })
            }
        case "College":
            tagged = tutorClient.tutors.filter {
                $0.regionLabel.localizedCaseInsensitiveContains("UNC")
                    || $0.regionLabel.localizedCaseInsensitiveContains("Macalester")
                    || $0.bio.localizedCaseInsensitiveContains("PhD")
                    || $0.bio.localizedCaseInsensitiveContains("Macalester")
            }
        default:
            tagged = tutorClient.tutors
        }
        guard let origin = mapSearchOrigin else { return tagged }
        let ranked = tagged
            .map { (tutor: $0, km: Self.haversineKm(origin, $0.coordinate)) }
            .sorted { $0.km < $1.km }
        guard let nearest = ranked.first else { return [] }
        let nearbyMiles = 250.0
        let also = ranked.dropFirst().filter { $0.km * 0.621371 <= nearbyMiles }
        return [nearest.tutor] + also.map(\.tutor)
    }

    private var tutorsNearbySection: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Find someone near you - map + roster.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.55))
                Spacer()
                Button("Open map") { showFindTutor = true }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(shellHex: "c4f547"))
                    .accessibilityIdentifier("deskHubOpenTutorMap")
            }

            ViewThatFits {
                HStack(alignment: .top, spacing: 14) {
                    hubTutorMap
                        .frame(maxWidth: .infinity)
                        .frame(height: 340)
                    hubTutorList
                        .frame(maxWidth: .infinity)
                        .frame(height: 340)
                }
                VStack(alignment: .leading, spacing: 12) {
                    hubTutorMap.frame(height: 260)
                    hubTutorList.frame(height: 300)
                }
            }
        }
    }

    private var hubTutorMap: some View {
        VStack(spacing: 0) {
            // Writable search row - web Places Autocomplete stand-in.
            HStack(spacing: 8) {
                TextField("Search a city, zip, or address…", text: $mapSearchText)
                    .textFieldStyle(.plain)
                    .foregroundColor(ShellColor.ink)
                    .submitLabel(.search)
                    .onSubmit { runMapSearch() }
                    .accessibilityIdentifier("deskHubMapSearch")
                Button("Search") { runMapSearch() }
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(shellHex: "0c1207"))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 7)
                    .background(Capsule().fill(Color(shellHex: "c4f547")))
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("deskHubMapSearchGo")
                Button {
                    useMyLocationOnMap()
                } label: {
                    Image(systemName: mapLocating ? "location.fill" : "location")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(ShellColor.ink)
                        .padding(8)
                        .background(Circle().fill(ShellColor.cardFill))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskHubMapLocate")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 10)
            .background(Color(shellHex: "0f1f18").opacity(0.92))

            ZStack(alignment: .bottomLeading) {
                Map(position: $tutorCamera, interactionModes: [.pan, .zoom, .pitch]) {
                    ForEach(filteredTutors) { tutor in
                        Annotation(tutor.displayName, coordinate: tutor.coordinate) {
                            VStack(spacing: 2) {
                                Image(systemName: "mappin.circle.fill")
                                    .font(.system(size: 22))
                                    .foregroundColor(Color(shellHex: "c4f547"))
                                Text(tutor.displayName.split(separator: " ").first.map(String.init) ?? tutor.displayName)
                                    .font(.system(size: 9, weight: .bold, design: .rounded))
                                    .foregroundColor(ShellColor.ink)
                                    .padding(.horizontal, 5)
                                    .padding(.vertical, 2)
                                    .background(Capsule().fill(Color.black.opacity(0.55)))
                            }
                        }
                    }
                    if let origin = mapSearchOrigin {
                        Annotation(mapSearchLabel.isEmpty ? "Search" : mapSearchLabel, coordinate: origin) {
                            Image(systemName: "star.circle.fill")
                                .font(.system(size: 26))
                                .foregroundColor(.orange)
                                .shadow(radius: 4)
                        }
                    }
                }
                .mapStyle(.standard(elevation: .realistic))

                if !mapSearchLabel.isEmpty {
                    Text(mapSearchOrigin == nil
                          ? mapSearchLabel
                          : "Sorting tutors near \(mapSearchLabel)")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(ShellColor.ink)
                        .padding(.horizontal, 10)
                        .padding(.vertical, 6)
                        .background(Capsule().fill(Color.black.opacity(0.55)))
                        .padding(10)
                }
            }
            .frame(maxHeight: .infinity)

            if let mapSearchError {
                Text(mapSearchError)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(shellHex: "ff8a80"))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(Color.black.opacity(0.35))
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
        .overlay(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .strokeBorder(ShellColor.ink.opacity(0.14), lineWidth: 1)
        )
        // Keep children (search field / locate) hittable for XCUITest -
        // a parent accessibilityIdentifier alone swallows them.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("deskHubTutorMap")
    }

    private var hubTutorList: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("AVAILABLE TUTORS · \(filteredTutors.count)")
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .tracking(0.6)
                .foregroundColor(ShellColor.ink.opacity(0.55))

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 8) {
                    ForEach(["All", "Nearby", "Math", "ACT", "College"], id: \.self) { tag in
                        Button(tag) { tutorFilter = tag }
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(tutorFilter == tag ? Color(shellHex: "0c1207") : ShellColor.ink)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(
                                Capsule().fill(tutorFilter == tag
                                               ? Color(shellHex: "c4f547")
                                               : ShellColor.cardFill)
                            )
                    }
                }
            }

            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    ForEach(filteredTutors) { tutor in
                        hubTutorRow(tutor)
                    }
                }
            }
            .animation(.easeInOut(duration: 0.25), value: filteredTutors.map(\.id))
        }
        .padding(14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(ShellColor.cardFill)
                .overlay(
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .strokeBorder(ShellColor.ink.opacity(0.12), lineWidth: 1)
                )
        )
    }

    private func hubTutorRow(_ tutor: Tutor) -> some View {
        let miles: String? = {
            guard let origin = mapSearchOrigin else { return nil }
            let mi = Self.haversineKm(origin, tutor.coordinate) * 0.621371
            return String(format: "%.0f mi", mi)
        }()
        return VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(tutor.displayName)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(ShellColor.ink)
                Spacer()
                if let miles {
                    Text(miles)
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(Color(shellHex: "c4f547"))
                }
                Text("ONLINE OVER MEET")
                    .font(.system(size: 9, weight: .bold, design: .rounded))
                    .foregroundColor(Color(shellHex: "c4f547"))
            }
            Text(tutor.regionLabel)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(ShellColor.ink.opacity(0.55))
            Text(tutor.subjects.prefix(4).joined(separator: " · "))
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(ShellColor.ink.opacity(0.75))
                .lineLimit(1)
            Button {
                if let url = URL(string: tutor.calendlyUrl), !tutor.calendlyUrl.isEmpty {
                    openURL(url)
                } else {
                    showFindTutor = true
                }
            } label: {
                Text("BOOK FREE SESSION")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(shellHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 9)
                    .background(RoundedRectangle(cornerRadius: 10).fill(Color(shellHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("deskHubBook_\(tutor.id)")
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(Color(shellHex: "0f1f18").opacity(0.55))
        )
    }

    private func runMapSearch() {
        let q = mapSearchText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !q.isEmpty else { return }
        mapSearchError = nil
        Task {
            do {
                let placemarks = try await CLGeocoder().geocodeAddressString(q)
                guard let loc = placemarks.first?.location?.coordinate else {
                    mapSearchError = "No place found - try a city or zip"
                    return
                }
                applyMapOrigin(loc, label: placemarks.first?.locality
                               ?? placemarks.first?.name
                               ?? q)
            } catch {
                mapSearchError = "Couldn’t find that place"
            }
        }
    }

    private func useMyLocationOnMap() {
        mapLocating = true
        mapSearchError = nil
        locationHelper.requestLocation { result in
            mapLocating = false
            switch result {
            case .success(let coord):
                applyMapOrigin(coord, label: "your current location")
                mapSearchText = "Current location"
            case .failure:
                mapSearchError = "Allow location access and try again"
            }
        }
    }

    private func applyMapOrigin(_ coord: CLLocationCoordinate2D, label: String) {
        mapSearchOrigin = coord
        mapSearchLabel = label
        withAnimation(.easeInOut(duration: 0.35)) {
            tutorCamera = .region(
                MKCoordinateRegion(
                    center: coord,
                    span: MKCoordinateSpan(latitudeDelta: 6, longitudeDelta: 6)
                )
            )
        }
        flashHub("Tutors shuffled near \(label)")
    }

    private static func haversineKm(_ a: CLLocationCoordinate2D, _ b: CLLocationCoordinate2D) -> Double {
        let r = 6371.0
        let dLat = (b.latitude - a.latitude) * .pi / 180
        let dLon = (b.longitude - a.longitude) * .pi / 180
        let lat1 = a.latitude * .pi / 180
        let lat2 = b.latitude * .pi / 180
        let h = sin(dLat / 2) * sin(dLat / 2)
            + cos(lat1) * cos(lat2) * sin(dLon / 2) * sin(dLon / 2)
        return 2 * r * asin(min(1, sqrt(h)))
    }

    // MARK: - Workflow market (coming-soon gray cards)

    private var workflowMarketSection: some View {
        let q = workflowQuery.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let rows = WorkflowMarketStore.catalog.filter { item in
            guard !q.isEmpty else { return true }
            return item.title.lowercased().contains(q)
                || item.tags.joined(separator: " ").lowercased().contains(q)
                || item.blurb.lowercased().contains(q)
        }

        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                Text("Browse loops & role apps - tap a card when they ship.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.55))
                Spacer()
                Text("Coming soon")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.45))
            }

            HStack(spacing: 10) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(ShellColor.ink.opacity(0.45))
                TextField("Apps, roles, study loops…", text: $workflowQuery)
                    .textFieldStyle(.plain)
                    .foregroundColor(ShellColor.ink)
                    .accessibilityIdentifier("deskHubWorkflowSearch")
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Color(shellHex: "111814"))
                    .overlay(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .strokeBorder(ShellColor.ink.opacity(0.12), lineWidth: 1)
                    )
            )

            VStack(spacing: 10) {
                ForEach(rows) { item in
                    workflowCard(item)
                }
            }
        }
        .padding(16)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color(shellHex: "0b1210"))
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(ShellColor.ink.opacity(0.10), lineWidth: 1)
                )
        )
    }

    private func workflowCard(_ item: WorkflowMarketStore.Item) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(ShellColor.ink.opacity(0.55))
                    HStack(spacing: 6) {
                        ForEach(item.tags, id: \.self) { tag in
                            Text(tag)
                                .font(.system(size: 10, weight: .bold, design: .rounded))
                                .foregroundColor(ShellColor.ink.opacity(0.40))
                                .padding(.horizontal, 8)
                                .padding(.vertical, 4)
                                .background(Capsule().fill(ShellColor.ink.opacity(0.08)))
                        }
                    }
                }
                Spacer()
                Text("Soon")
                    .font(.system(size: 12, weight: .heavy, design: .rounded))
                    .foregroundColor(ShellColor.ink.opacity(0.40))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(ShellColor.ink.opacity(0.10)))
                    .accessibilityIdentifier("deskHubWorkflowSoon_\(item.id)")
            }
            Text(item.blurb)
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(ShellColor.ink.opacity(0.38))
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(14)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(Color(shellHex: "14201a").opacity(0.55))
        )
        .opacity(0.72)
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("deskHubWorkflow_\(item.id)")
    }
}

// MARK: - Location helper (hub map “use my location”)

@MainActor
final class HubLocationHelper: NSObject, ObservableObject, CLLocationManagerDelegate {
    private let manager = CLLocationManager()
    private var pending: ((Result<CLLocationCoordinate2D, Error>) -> Void)?

    override init() {
        super.init()
        manager.delegate = self
        manager.desiredAccuracy = kCLLocationAccuracyKilometer
    }

    func requestLocation(completion: @escaping (Result<CLLocationCoordinate2D, Error>) -> Void) {
        pending = completion
        switch manager.authorizationStatus {
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        case .authorizedAlways, .authorizedWhenInUse:
            manager.requestLocation()
        default:
            completion(.failure(NSError(domain: "HubLocation", code: 1)))
            pending = nil
        }
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in
            if manager.authorizationStatus == .authorizedWhenInUse
                || manager.authorizationStatus == .authorizedAlways {
                manager.requestLocation()
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        Task { @MainActor in
            if let c = locations.first?.coordinate {
                pending?(.success(c))
            } else {
                pending?(.failure(NSError(domain: "HubLocation", code: 2)))
            }
            pending = nil
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in
            pending?(.failure(error))
            pending = nil
        }
    }
}

// MARK: - Workflow market store (design PDF page 2 · local install state)

@MainActor
final class WorkflowMarketStore: ObservableObject {
    struct Item: Identifiable, Equatable {
        let id: String
        let title: String
        let tags: [String]
        let price: Int
        let blurb: String
    }

    static let catalog: [Item] = [
        Item(
            id: "application_tracker",
            title: "Macalester Job OS",
            tags: ["Jobs", "Alumni", "Outreach"],
            price: 0,
            blurb: "Campus Job OS. Today queue, application pipeline, LinkedIn/alumni CRM, resume boxes, and Daily Sync (agent mounts later)."
        ),
        Item(
            id: "health_insights",
            title: "Connect health data",
            tags: ["Whoop", "Apple", "Diet"],
            price: 0,
            blurb: "Pull Whoop + Apple Health, track diet and recovery, then run math analysis and unique insight reports on your own data."
        ),
    ]

    private static let key = "deskOs.workflowOwned"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    @Published private(set) var owned: Set<String> = []

    init() {
        if Self.uiTesting {
            owned = []
        } else if let arr = UserDefaults.standard.array(forKey: Self.key) as? [String] {
            owned = Set(arr)
        }
        // Macalester Apply today is available on the Field Desk workflows dock.
        if !owned.contains("application_tracker") {
            owned.insert("application_tracker")
            if !Self.uiTesting {
                UserDefaults.standard.set(Array(owned), forKey: Self.key)
            }
        }
    }

    func isOwned(_ id: String) -> Bool { owned.contains(id) }

    func buy(_ id: String) {
        owned.insert(id)
        guard !Self.uiTesting else { return }
        UserDefaults.standard.set(Array(owned), forKey: Self.key)
    }
}

/// Shared Workflow market sheet used by ACT Dashboard Home pad (`dashPadMarket`).
/// Catalog items are preview-only / grayed until the real pipelines ship.
struct ActWorkflowMarketView: View {
    /// Kept so call sites can keep passing the store when Buy is re-enabled.
    @ObservedObject var store: WorkflowMarketStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("Workflow market")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                Text("Coming soon - these workflows are listed so you can see what’s next. Buy is disabled for now.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(.secondary)
                ForEach(WorkflowMarketStore.catalog) { item in
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text(item.title)
                                .font(.system(size: 16, weight: .bold, design: .rounded))
                                .foregroundColor(.primary.opacity(0.55))
                            Spacer()
                            Text(store.isOwned(item.id) ? "Owned · Soon" : "Soon")
                                .font(.system(size: 12, weight: .heavy, design: .rounded))
                                .foregroundColor(.secondary)
                                .padding(.horizontal, 10)
                                .padding(.vertical, 6)
                                .background(Capsule().fill(Color.primary.opacity(0.08)))
                                .accessibilityIdentifier("actWorkflowSoon_\(item.id)")
                        }
                        Text(item.tags.joined(separator: " · "))
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(.secondary.opacity(0.8))
                        Text(item.blurb)
                            .font(.system(size: 13, weight: .medium, design: .rounded))
                            .foregroundColor(.secondary.opacity(0.75))
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(
                        RoundedRectangle(cornerRadius: 14, style: .continuous)
                            .fill(Color(uiColor: .secondarySystemBackground).opacity(0.7))
                    )
                    .opacity(0.72)
                    .accessibilityIdentifier("actWorkflow_\(item.id)")
                }
            }
            .padding(20)
        }
        .navigationTitle("Market")
        .navigationBarTitleDisplayMode(.inline)
        .accessibilityIdentifier("actWorkflowMarket")
    }
}

// MARK: - Goal / mastery store (port of bootHub.js + hubCall.js persistence)

/// `UserDefaults`-backed port of the web Desk OS's goal + mastery
/// persistence - `js/bootHub.js`'s `GOALS_BY_KIND`/`paintGoalControls()`/
/// `paintMastery()`/`masteryForInstance()` and `js/hubCall.js`'s `save()`.
/// Same key names as the web's localStorage (`deskOs.*`) and the same JSON
/// shapes, the identical approach `StickerStore` already established for
/// `coverStickers.ts`'s keys. Client-side only, exactly like the web - no
/// Firestore collection exists for this on the live product.
final class DeskGoalStore: ObservableObject {
    struct InstanceRef: Identifiable { let id: String; let kind: String; let name: String }
    struct GoalOption: Identifiable { let id: String; let label: String }

    /// Identity fields of `bootHub.js`'s `DEFAULTS` - the instance cards in
    /// the hub grid stay the explicit views Brick 1 shipped (their test
    /// hooks are load-bearing); this catalog only feeds the goal setter and
    /// mastery orb.
    static let instanceCatalog: [InstanceRef] = [
        InstanceRef(id: "desk_main", kind: "desk", name: "The Desk"),
        InstanceRef(id: "act_main", kind: "act", name: "act-fieldbook"),
        InstanceRef(id: "test_main", kind: "test", name: "test-instance"),
    ]

    /// `GOALS_BY_KIND`, verbatim (including the `book` kind cooked Field
    /// Books use on web - unreachable natively until instance creation
    /// exists, carried anyway so the data can't drift).
    static let goalsByKind: [String: [GoalOption]] = [
        "desk": [
            GoalOption(id: "tasks_today", label: "Tasks for today"),
            GoalOption(id: "connect_tools", label: "Connect school tools"),
            GoalOption(id: "mastery_topic", label: "Mastery on a topic"),
            GoalOption(id: "file_notes", label: "File class notes"),
        ],
        "act": [
            GoalOption(id: "mastery_lesson", label: "Mastery to a lesson"),
            GoalOption(id: "practice_set", label: "Finish a practice set"),
            GoalOption(id: "score_target", label: "Hit a score target"),
            GoalOption(id: "review_mistakes", label: "Review mistakes"),
        ],
        "test": [
            GoalOption(id: "finish_graph", label: "Walk the learning graph"),
            GoalOption(id: "play_microsim", label: "Play a MicroSim"),
            GoalOption(id: "quiz_ten", label: "Finish the 10-question quiz"),
            GoalOption(id: "read_chapter", label: "Read a chapter + sim"),
        ],
        "piano": [
            GoalOption(id: "hand_position", label: "Steady hand position"),
            GoalOption(id: "five_finger", label: "Clean five-finger run"),
            GoalOption(id: "learn_motif", label: "Learn a short motif"),
            GoalOption(id: "daily_reps", label: "Daily practice reps"),
        ],
        "book": [
            GoalOption(id: "finish_chapter", label: "Finish a chapter"),
            GoalOption(id: "mastery_topic", label: "Mastery on a topic"),
            GoalOption(id: "review_notes", label: "Review notes"),
        ],
    ]

    private static let goalsKey = "deskOs.instanceGoals"
    private static let focusKey = "deskOs.goalFocus"
    private static let masteryKey = "deskOs.mastery"
    private static let callLogKey = "deskOs.callLog"
    private static let instanceStateKey = "deskOs.instances"

    /// Under `--ui-testing-in-memory` nothing is read from or written to
    /// real UserDefaults - same in-memory semantics the flag gives Core
    /// Data via `PersistenceController`. In-session behavior (check-in →
    /// live mastery repaint) still works through the @Published vars; a
    /// fresh test launch starts clean instead of inheriting a previous
    /// run's check-ins on the real device.
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    struct GoalRecord: Codable { let type: String; let label: String; let at: String }
    /// The state-bearing subset of a web `deskOs.instances` row (the web
    /// stores whole instance objects; natively the catalog is static code,
    /// so only the mutable fields `hubCall.js` writes are persisted).
    struct InstanceState: Codable {
        let id: String
        var masteryPct: Int?
        var masteryNote: String?
        var masteryAt: String?
        var lastCallRole: String?
    }
    private struct MasteryBlob: Codable { let instanceId: String?; let pct: Int?; let sure: Bool; let note: String? }
    private struct CallLogEntry: Codable { let instanceId: String; let role: String; let pct: Int?; let note: String; let at: String }

    @Published private(set) var focusId: String
    @Published private(set) var goals: [String: GoalRecord]
    @Published private(set) var instanceStates: [InstanceState]

    init() {
        let storedFocus = Self.uiTesting ? nil : UserDefaults.standard.string(forKey: Self.focusKey)
        focusId = Self.instanceCatalog.first { $0.id == storedFocus }?.id ?? Self.instanceCatalog[0].id
        goals = Self.decode([String: GoalRecord].self, key: Self.goalsKey) ?? [:]
        instanceStates = Self.decode([InstanceState].self, key: Self.instanceStateKey) ?? []
    }

    var focusedInstance: InstanceRef {
        Self.instanceCatalog.first { $0.id == focusId } ?? Self.instanceCatalog[0]
    }

    var goalOptionsForFocused: [GoalOption] {
        Self.goalsByKind[focusedInstance.kind] ?? Self.goalsByKind["desk"]!
    }

    /// Same pick rule as `paintGoalControls()`: the saved goal for the
    /// focused instance when it's still a valid option, else the first.
    var selectedGoal: GoalOption {
        let options = goalOptionsForFocused
        if let saved = goals[focusId]?.type, let match = options.first(where: { $0.id == saved }) {
            return match
        }
        return options[0]
    }

    var goalEcho: String {
        "\(focusedInstance.name) \u{2192} \(selectedGoal.label)"
    }

    /// `masteryForInstance()` ported exactly - an HONEST estimate: a number
    /// only when recorded check-in evidence exists (instance-state
    /// `masteryPct`, else a matching `deskOs.mastery` blob with
    /// `sure == true`); otherwise nil and the UI shows a dash. Never an
    /// invented number.
    var masteryPctForFocused: Int? {
        if let pct = instanceStates.first(where: { $0.id == focusId })?.masteryPct {
            return max(0, min(100, pct))
        }
        if let blob = Self.decode(MasteryBlob.self, key: Self.masteryKey),
           blob.instanceId == focusId, blob.sure, let pct = blob.pct {
            return max(0, min(100, pct))
        }
        return nil
    }

    func setFocus(_ id: String) {
        guard Self.instanceCatalog.contains(where: { $0.id == id }) else { return }
        focusId = id
        Self.setString(id, key: Self.focusKey)
    }

    /// `persistGoal()`: saves `{type, label, at}` for the focused instance
    /// and re-pins focus, exactly like the web.
    func setGoal(_ typeId: String) {
        let options = goalOptionsForFocused
        let goal = options.first { $0.id == typeId } ?? options[0]
        goals[focusId] = GoalRecord(type: goal.id, label: goal.label, at: Self.isoNow())
        Self.encode(goals, key: Self.goalsKey)
        Self.setString(focusId, key: Self.focusKey)
    }

    /// `hubCall.js`'s `save()`, student branch (native is always the
    /// student's own device - the tutor branch keys off web-side
    /// onboarding state that doesn't exist here): masteryPct/note/at onto
    /// the instance state, a capped 40-entry call log, and the
    /// `deskOs.mastery` `{instanceId, pct, sure: true, note}` blob.
    /// Returns the toast copy, same wording as the web's `onToast`.
    func saveCheckIn(pct: Int, note: String) -> String {
        let clamped = max(0, min(100, pct))
        let now = Self.isoNow()
        var state = instanceStates.first { $0.id == focusId }
            ?? InstanceState(id: focusId, masteryPct: nil, masteryNote: nil, masteryAt: nil, lastCallRole: nil)
        state.masteryPct = clamped
        state.masteryNote = note
        state.masteryAt = now
        state.lastCallRole = "student"
        instanceStates.removeAll { $0.id == focusId }
        instanceStates.append(state)
        Self.encode(instanceStates, key: Self.instanceStateKey)

        var log = Self.decode([CallLogEntry].self, key: Self.callLogKey) ?? []
        log.insert(CallLogEntry(instanceId: focusId, role: "student", pct: clamped, note: note, at: now), at: 0)
        Self.encode(Array(log.prefix(40)), key: Self.callLogKey)

        Self.encode(MasteryBlob(instanceId: focusId, pct: clamped, sure: true, note: note), key: Self.masteryKey)
        return "Check-in saved \u{00B7} \(clamped)% on \(focusedInstance.name)"
    }

    private static func isoNow() -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: Date())
    }

    private static func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard !uiTesting, let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func encode<T: Encodable>(_ value: T, key: String) {
        guard !uiTesting else { return }
        if let data = try? JSONEncoder().encode(value) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }

    private static func setString(_ value: String, key: String) {
        guard !uiTesting else { return }
        UserDefaults.standard.set(value, forKey: key)
    }
}

// MARK: - Mastery cube (port of `.hub-orb-stage`/`.hub-cube`)

/// The web's mastery orb - a 72px wireframe cube (6 translucent faces + 3
/// cross planes) tilted `rotateX(-18deg)`, completing a full Y rotation
/// every 16s over a soft 4.2s-pulse radial glow, in a 128px stage with
/// `perspective: 520px`. SwiftUI has no `preserve-3d` compositing across
/// subviews, so this is a real per-frame perspective projection in a
/// `Canvas` - the same geometry (8 vertices, the web's own size/tilt/
/// period/perspective numbers), not a lookalike. Face/edge colors are the
/// shell's lime family (the web's dark-green-on-light wireframe is
/// invisible on this shell's dark background - same palette adaptation
/// Brick 1 documented for the rest of the hub). Honors Reduce Motion the
/// way the web's `prefers-reduced-motion` rule does: static
/// `rotateY(-28deg)`, no pulse.
private struct MasteryCubeView: View {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    /// XCUITest's wait-for-quiescence never settles while a
    /// `TimelineView(.animation)` redraws every frame - each synthesized
    /// event then eats a 60s "app animations complete notification not
    /// received" stall. Every UI test in this suite launches with
    /// `--ui-testing-in-memory` (see `launchApp()`/`launchDashboardApp()`),
    /// so the cube renders its reduced-motion static pose under test -
    /// same flag convention as `PersistenceController`/`QuestionView`.
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    private var frozen: Bool { reduceMotion || Self.uiTesting }

    var body: some View {
        TimelineView(.animation(minimumInterval: 1.0 / 30.0, paused: frozen)) { timeline in
            Canvas { context, size in
                draw(context: context, size: size, time: timeline.date.timeIntervalSinceReferenceDate)
            }
        }
        .accessibilityHidden(true) // aria-hidden="true" on the web stage
    }

    private func draw(context: GraphicsContext, size: CGSize, time: TimeInterval) {
        let lime = Color(shellHex: "b9e86f")
        let center = CGPoint(x: size.width / 2, y: size.height / 2)

        // `.hub-orb-glow`: opacity 0.65 → 0.95 over a 4.2s ease cycle.
        let pulse = frozen
            ? 0.65
            : 0.65 + 0.30 * (0.5 - 0.5 * cos(2 * .pi * time.truncatingRemainder(dividingBy: 4.2) / 4.2))
        let glowRadius = size.width * 0.36
        var glowContext = context
        glowContext.opacity = pulse
        glowContext.fill(
            Path(ellipseIn: CGRect(
                x: center.x - glowRadius, y: center.y - glowRadius,
                width: glowRadius * 2, height: glowRadius * 2
            )),
            with: .radialGradient(
                Gradient(colors: [lime.opacity(0.20), lime.opacity(0.05), .clear]),
                center: center, startRadius: 0, endRadius: glowRadius
            )
        )

        // Cube - the web's exact numbers: 72px side in a 128px stage,
        // perspective 520px, rotateX(-18deg), 16s per full Y turn.
        let half = 36.0 * (size.width / 128.0)
        let perspective = 520.0
        let ry = frozen
            ? -28.0 * .pi / 180
            : (time.truncatingRemainder(dividingBy: 16) / 16) * 2 * .pi
        let rx = -18.0 * .pi / 180

        // CSS `rotateX(-18deg) rotateY(θ)` applies rotateY to the point
        // first, then rotateX.
        func rotated(_ p: (x: Double, y: Double, z: Double)) -> (x: Double, y: Double, z: Double) {
            let x1 = p.x * cos(ry) + p.z * sin(ry)
            let z1 = -p.x * sin(ry) + p.z * cos(ry)
            let y2 = p.y * cos(rx) - z1 * sin(rx)
            let z2 = p.y * sin(rx) + z1 * cos(rx)
            return (x1, y2, z2)
        }
        func screenPoint(_ r: (x: Double, y: Double, z: Double)) -> CGPoint {
            let scale = perspective / (perspective - r.z)
            return CGPoint(x: center.x + r.x * scale, y: center.y - r.y * scale)
        }

        struct Plane {
            let corners: [(x: Double, y: Double, z: Double)]
            let fill: Color
            let stroke: Color
            let lineWidth: CGFloat
        }

        let h = half
        // 6 faces (`.hub-cube-face`, border 1.25px @ 0.55, fill 0.10 -
        // top lighter 0.07, bottom heavier 0.14) + 3 cross planes
        // (`.hub-cube-cross`, border 1px @ 0.28, fill 0.04).
        let planes: [Plane] = [
            Plane(corners: [(-h, -h, h), (h, -h, h), (h, h, h), (-h, h, h)], fill: lime.opacity(0.10), stroke: lime.opacity(0.55), lineWidth: 1.25),
            Plane(corners: [(-h, -h, -h), (h, -h, -h), (h, h, -h), (-h, h, -h)], fill: lime.opacity(0.10), stroke: lime.opacity(0.55), lineWidth: 1.25),
            Plane(corners: [(h, -h, -h), (h, -h, h), (h, h, h), (h, h, -h)], fill: lime.opacity(0.10), stroke: lime.opacity(0.55), lineWidth: 1.25),
            Plane(corners: [(-h, -h, -h), (-h, -h, h), (-h, h, h), (-h, h, -h)], fill: lime.opacity(0.10), stroke: lime.opacity(0.55), lineWidth: 1.25),
            Plane(corners: [(-h, h, -h), (h, h, -h), (h, h, h), (-h, h, h)], fill: lime.opacity(0.07), stroke: lime.opacity(0.55), lineWidth: 1.25),
            Plane(corners: [(-h, -h, -h), (h, -h, -h), (h, -h, h), (-h, -h, h)], fill: lime.opacity(0.14), stroke: lime.opacity(0.55), lineWidth: 1.25),
            Plane(corners: [(-h, -h, 0), (h, -h, 0), (h, h, 0), (-h, h, 0)], fill: lime.opacity(0.04), stroke: lime.opacity(0.28), lineWidth: 1),
            Plane(corners: [(-h, 0, -h), (h, 0, -h), (h, 0, h), (-h, 0, h)], fill: lime.opacity(0.04), stroke: lime.opacity(0.28), lineWidth: 1),
            Plane(corners: [(0, -h, -h), (0, -h, h), (0, h, h), (0, h, -h)], fill: lime.opacity(0.04), stroke: lime.opacity(0.28), lineWidth: 1),
        ]

        // Painter's algorithm: farthest (lowest rotated z) first.
        let ordered = planes
            .map { plane -> (Plane, [(x: Double, y: Double, z: Double)], Double) in
                let rotatedCorners = plane.corners.map(rotated)
                let avgZ = rotatedCorners.reduce(0.0) { $0 + $1.z } / Double(rotatedCorners.count)
                return (plane, rotatedCorners, avgZ)
            }
            .sorted { $0.2 < $1.2 }

        for (plane, rotatedCorners, _) in ordered {
            var path = Path()
            let points = rotatedCorners.map(screenPoint)
            path.move(to: points[0])
            for point in points.dropFirst() { path.addLine(to: point) }
            path.closeSubpath()
            context.fill(path, with: .color(plane.fill))
            context.stroke(path, with: .color(plane.stroke), lineWidth: plane.lineWidth)
        }
    }
}

// MARK: - Mastery check-in sheet (port of hubCall.js's panel)

/// `js/hubCall.js`'s check-in dialog as a native sheet - on iPad a sheet
/// presents as a centered card, the same centered-modal-over-dim-veil
/// shape `.hub-call-panel` has on web. Colors are the web panel's literal
/// values (white card, `#3d6b4f` kicker/slider accent, `#1f2a22` save
/// pill) - the panel is a light surface on web and stays one here,
/// explicit hex so OS dark mode can't invert it. Student branch only: the
/// web's tutor variant keys off web-side onboarding role state that has
/// no native equivalent.
private struct MasteryCheckInSheet: View {
    @ObservedObject var store: DeskGoalStore
    let onSaved: (String) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var note = ""
    /// Web slider default: `value="40"`.
    @State private var pct: Double = 40

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("MASTERY CHECK-IN")
                    .font(.system(size: 12, weight: .bold))
                    .tracking(0.9)
                    .foregroundColor(Color(shellHex: "3d6b4f"))
                Spacer()
                Button { dismiss() } label: {
                    Text("\u{2212}")
                        .font(.system(size: 16, weight: .semibold))
                        .foregroundColor(Color(shellHex: "333333"))
                        .frame(width: 28, height: 28)
                        .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color(shellHex: "f1f1f3")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskCallClose")
            }

            Text("How solid is \(store.focusedInstance.name) toward your goal?")
                .font(.system(size: 14))
                .foregroundColor(Color(shellHex: "444444"))

            ZStack(alignment: .topLeading) {
                if note.isEmpty {
                    Text("A few sentences \u{00B7} what feels shaky, what clicked\u{2026}")
                        .font(.system(size: 14))
                        .foregroundColor(Color(shellHex: "444444").opacity(0.45))
                        .padding(.top, 14)
                        .padding(.leading, 11)
                }
                TextEditor(text: $note)
                    .font(.system(size: 14))
                    .foregroundColor(Color(shellHex: "1a1a1a"))
                    .scrollContentBackground(.hidden)
                    .padding(6)
                    .frame(minHeight: 84, maxHeight: 120)
                    .onChange(of: note) { _, newValue in
                        // Web textarea `maxlength="220"`.
                        if newValue.count > 220 { note = String(newValue.prefix(220)) }
                    }
                    .accessibilityIdentifier("deskCallNote")
            }
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color.white)
                    .overlay(
                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                            .stroke(Color(shellHex: "e4e4e7"), lineWidth: 1)
                    )
            )

            VStack(alignment: .leading, spacing: 8) {
                Text("Honest estimate")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundColor(Color(shellHex: "555555"))
                HStack(spacing: 12) {
                    Slider(value: $pct, in: 0...100, step: 1)
                        .tint(Color(shellHex: "3d6b4f"))
                        .accessibilityIdentifier("deskCallSlider")
                    Text("\(Int(pct))%")
                        .font(.system(size: 14, weight: .bold))
                        .monospacedDigit()
                        .foregroundColor(Color(shellHex: "1f2a22"))
                        .frame(minWidth: 44, alignment: .trailing)
                }
            }

            HStack(spacing: 8) {
                Spacer()
                Button { dismiss() } label: {
                    Text("Not now")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(Color(shellHex: "555555"))
                        .padding(.horizontal, 14)
                        .padding(.vertical, 10)
                        .background(Capsule().stroke(Color(shellHex: "e4e4e7"), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskCallNotNow")
                Button {
                    let message = store.saveCheckIn(
                        pct: Int(pct),
                        note: note.trimmingCharacters(in: .whitespacesAndNewlines)
                    )
                    dismiss()
                    onSaved(message)
                } label: {
                    Text("Save check-in")
                        .font(.system(size: 13, weight: .semibold))
                        .foregroundColor(.white)
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(shellHex: "1f2a22")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskCallSave")
            }
            .padding(.top, 4)
        }
        .padding(18)
        .frame(maxWidth: 420)
        .presentationBackground(Color.white)
    }
}

/// Classic dark boot — slow tips until Jesse’s kitchen is ready.
private struct DeskBootView: View {
    var kitchenReady: Bool
    let onComplete: () -> Void

    @State private var reveal = false
    @State private var tipIndex = 0
    @State private var pulse = false
    @State private var finished = false
    @State private var appearedAt = Date()
    @State private var glyphPhase = false

    private let askTips = [
        "Ask: build my resume from this week's wins",
        "Ask: wire Binder notes into a practice set",
        "Ask: turn Gmail dues into a study plan",
        "Ask: draft my Macalester apply packet",
        "Ask: connect Intel + Calendar and find my free block",
        "Ask: spin a study playlist from tonight's worksheet",
        "Ask: make a 3-slide pitch from my project notes",
        "Ask: what should I lock in before Friday?",
    ]

    private let deskGlyphs: [(system: String, tint: Color)] = [
        ("books.vertical.fill", Color(shellHex: "c4f547")),
        ("sparkles", Color(shellHex: "c4f547")),
        ("waveform", Color(shellHex: "9ad4ff")),
        ("doc.text.fill", ShellColor.ink),
        ("note.text", Color(shellHex: "f0c674")),
        ("envelope.fill", Color(shellHex: "ff8a80")),
        ("calendar", Color(shellHex: "80cbc4")),
    ]

    var body: some View {
        ZStack {
            ShellBackground()

            VStack(spacing: 0) {
                Spacer(minLength: 72)

                Text("Your workspace is starting up")
                    .font(.system(size: 28, weight: .bold, design: .rounded))
                    .foregroundColor(ShellColor.ink)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 28)

                HStack(spacing: 8) {
                    ForEach(0..<3, id: \.self) { i in
                        Circle()
                            .fill(ShellColor.brandGreen.opacity(pulse || i == tipIndex % 3 ? 1 : 0.35))
                            .frame(width: 8, height: 8)
                    }
                }
                .padding(.top, 14)

                Spacer().frame(height: 28)

                // Ask + logos in one tight card.
                VStack(spacing: 18) {
                    Text(askTips[tipIndex % askTips.count])
                        .font(.system(size: 17, weight: .semibold, design: .rounded))
                        .foregroundColor(ShellColor.ink.opacity(0.85))
                        .multilineTextAlignment(.center)
                        .frame(maxWidth: .infinity)
                        .id(tipIndex)
                        .transition(.opacity)

                    HStack(spacing: 10) {
                        ForEach(Array(deskGlyphs.enumerated()), id: \.offset) { index, glyph in
                            Image(systemName: glyph.system)
                                .font(.system(size: 20, weight: .semibold))
                                .foregroundColor(glyph.tint)
                                .frame(width: 42, height: 42)
                                .background(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .fill(Color(shellHex: "0c1a14").opacity(0.85))
                                )
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                                        .strokeBorder(ShellColor.ink.opacity(0.10), lineWidth: 1)
                                )
                                .offset(y: glyphPhase && index % 2 == 0 ? -3 : (glyphPhase ? 2 : 0))
                                .animation(
                                    .easeInOut(duration: 1.8).repeatForever(autoreverses: true).delay(Double(index) * 0.1),
                                    value: glyphPhase
                                )
                        }
                    }
                }
                .padding(.horizontal, 22)
                .padding(.vertical, 22)
                .frame(maxWidth: 560)
                .background(
                    RoundedRectangle(cornerRadius: 22, style: .continuous)
                        .fill(ShellColor.cardFill)
                        .overlay(
                            RoundedRectangle(cornerRadius: 22, style: .continuous)
                                .strokeBorder(ShellColor.ink.opacity(0.10), lineWidth: 1)
                        )
                )
                .padding(.horizontal, 28)

                Spacer(minLength: 72)
            }
            .opacity(reveal ? 1 : 0)
            .offset(y: reveal ? 0 : 10)
        }
        .onAppear {
            appearedAt = Date()
            withAnimation(.easeOut(duration: 0.7)) { reveal = true }
            withAnimation(.easeInOut(duration: 0.9).repeatForever(autoreverses: true)) {
                pulse = true
            }
            glyphPhase = true
            Timer.scheduledTimer(withTimeInterval: 2.4, repeats: true) { timer in
                if finished {
                    timer.invalidate()
                    return
                }
                withAnimation(.easeInOut(duration: 0.55)) {
                    tipIndex += 1
                }
            }
        }
        .onChange(of: kitchenReady) { _, ready in
            guard ready else { return }
            tryFinishBoot()
        }
        .onAppear {
            DispatchQueue.main.asyncAfter(deadline: .now() + 6.5) {
                tryFinishBoot()
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 14) {
                finishBoot()
            }
        }
    }

    private func tryFinishBoot() {
        let elapsed = Date().timeIntervalSince(appearedAt)
        // Wait until kitchen is ready AND we've shown the slide long enough.
        guard kitchenReady, elapsed >= 6.0 else { return }
        finishBoot()
    }

    private func finishBoot() {
        guard !finished else { return }
        finished = true
        onComplete()
    }
}

/// Presentation payload for Field Desk fullScreenCover.
private enum FieldDeskRoute: String, Identifiable {
    case plain
    /// Kept for older call sites; hub ACT now uses `showActFieldBook`.
    case actStage

    var id: String { rawValue }
    var opensAct: Bool { self == .actStage }
}

private enum ShellColor {
    static let ink = Color(shellHex: "f4efe2")
    static let brandGreen = Color(shellHex: "54b948")
    /// Soft cards on the classic dark green desk shell.
    static let cardFill = Color(shellHex: "14261c").opacity(0.7)
}

extension Color {
    init(shellHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Same real gradient + radial highlight compositing `DashboardView`'s
/// `DeskBackground` uses (build plan §4) - re-declared locally since that
/// struct is `private` to `DashboardView.swift`.
private struct ShellBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(shellHex: "1c3228"), Color(shellHex: "14261c"), Color(shellHex: "0f1f18")],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [Color(shellHex: "b9e86f").opacity(0.14), .clear],
                center: UnitPoint(x: 0.85, y: 0.08),
                startRadius: 0,
                endRadius: 500
            )
            RadialGradient(
                colors: [Color(shellHex: "1d3a8a").opacity(0.22), .clear],
                center: UnitPoint(x: 0.15, y: 0.9),
                startRadius: 0,
                endRadius: 500
            )
        }
        .ignoresSafeArea()
    }
}
