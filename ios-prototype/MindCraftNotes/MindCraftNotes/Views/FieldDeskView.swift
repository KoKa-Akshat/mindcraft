import SwiftUI
import UIKit
import UniformTypeIdentifiers
import PhotosUI

private enum ShrineBeatPhase: Equatable {
    case idle
    case captions
    case starting
}

/// **Round 28. Field Desk cards + ACT stage.**
/// Tap card → shine → drag whole card → bottom-right resize. Canvas-only
/// pinch. Binder is the centerpiece. Connect toggles disconnect. ACT opens
/// as a padded min/max stage on this same desk with the shared bottom dock.
struct FieldDeskView: View {
    /// Legacy. ACT is its own instance now; stage path kept off by default.
    var initialActStage: Bool
    var onOpenAct: (() -> Void)?
    /// Binder launches ACT on-desk (plus custom instances via hub).
    var onLaunchInstance: ((DeskBoundInstance) -> Void)?

    @Environment(\.dismiss) private var dismiss
    @EnvironmentObject private var studentStore: FirestoreStudentStore
    @EnvironmentObject private var authService: AuthService
    @StateObject private var store = FieldDeskStore()
    @ObservedObject private var customInstances = CustomInstanceStore.shared

    @State private var showAddPanel = false
    @State private var showAddToBinderForm = false
    @State private var showBlankPage = false
    /// Panels opened from kitchen signs (Wake Jesse / Connect / Projects).
    @State private var showIntelPanel = false
    @State private var showConnectPanel = false
    /// Binder card — only when Projects / work desk is open.
    @State private var showBinderPanel = false
    /// Classic work desk (original cream cards on dark desk) vs Jesse kitchen.
    @State private var workMode = false
    /// Native Projects menu (Binder / Intel / … + Go Back) — not the vending cat screen.
    @State private var showProjectsPanel = false
    /// Projects screen — Malevolent Shrine project card; tap → work area.
    @State private var showProjectsScreen = false
    /// Shrine → Gen-Z captions → workspace starting → work desk.
    @State private var shrineBeatPhase: ShrineBeatPhase = .idle
    @State private var shrineCaption = ""
    /// Standalone Desk (deskweb) — entered via the polka vending screen.
    @State private var showStandaloneDesk = false
    /// Spatial Create studio (desk-os/studio) — entered via polka from Create.
    @State private var showCreateStudio = false
    /// 0 = clear, 1 = solid white polka sheet covering the screen.
    @State private var polkaProgress: CGFloat = 0
    /// Widgets placed on the work desk via `+`.
    @State private var placedWidgets: Set<PlaceableWidget> = []
    /// Kitchen audio is off until the top-right volume control is tapped.
    @State private var kitchenSoundOn = false
    @State private var kitchenWebReady = true
    @State private var showManage = false
    /// Bars start hidden — swipe down for top, swipe up for bottom.
    @State private var showTopChrome = false
    @State private var showBottomChrome = false
    @State private var chromeHideToken = UUID()
    @State private var showFindTutor = false
    @State private var showWorkflowLibrary = false
    @State private var showApplyToday = false
    @State private var showGmailBox = false
    @State private var gmailStartReconnect = false
    @State private var gmailOpenTopReply = false
    @State private var showActFieldBook = false
    @State private var showDocCook = false
    @StateObject private var workflowMarket = WorkflowMarketStore()
    @State private var showImporter = false
    @State private var photoItem: PhotosPickerItem?
    @State private var manualTitle = ""
    @State private var manualCourse = "Inbox"
    @State private var manualBody = ""
    @State private var toast: String?
    @State private var memoDraft = ""
    @State private var binderOpen = true
    @State private var activeTool: RailTool?
    @State private var askText = ""
    @State private var askBusy = false
    @State private var activeGuideId: String?
    @State private var openEntry: FieldDeskStore.FiledItem?

    @State private var scale: CGFloat = 1
    @State private var pan = CGSize.zero

    /// Per-card layout (drag + resize).
    @State private var cardOffsets: [DeskCardID: CGSize] = [:]
    @State private var cardDrag: [DeskCardID: CGSize] = [:]
    @State private var cardSizes: [DeskCardID: CGSize] = [:]
    @State private var focusedCard: DeskCardID?
    @State private var resizeStart: CGSize?
    /// While the corner grip is dragging, the whole-card move gesture must
    /// stand down — both are simultaneous on the same touch.
    @State private var resizingCard: DeskCardID?
    @State private var focusPulse = false

    /// ACT stage hosted on this desk (shared wallpaper + dock).
    @State private var showActStage: Bool
    @State private var actStageMaximized: Bool
    /// Resizable stage frame (maximized). Pad around it stays pannable.
    @State private var actStageSize = CGSize(width: 1000, height: 660)
    @State private var actStageResizeOrigin: CGSize?

    init(
        initialActStage: Bool = false,
        onOpenAct: (() -> Void)? = nil,
        onLaunchInstance: ((DeskBoundInstance) -> Void)? = nil
    ) {
        self.initialActStage = initialActStage
        self.onOpenAct = onOpenAct
        self.onLaunchInstance = onLaunchInstance
        _showActStage = State(initialValue: initialActStage)
        _actStageMaximized = State(initialValue: true)
    }

    private enum RailTool: String, Identifiable {
        case record, mail, calendar, search
        var id: String { rawValue }
    }

    private enum DeskCardID: String, Hashable, CaseIterable {
        case connect, intel, binder, memo, calendar, gmail, notes, gdoc, slides
    }

    private enum PlaceableWidget: String, Hashable, CaseIterable {
        case binder, calendar, memo, connect, gmail, intel, notes, gdoc, slides
    }

    /// Until tools are linked, Connect stays on-canvas. After that, place via `+`.
    private var connectorsLiveInPlus: Bool {
        store.allConnectorsLinked
    }

    private let worldW: CGFloat = 2400
    private let worldH: CGFloat = 1600

    private var defaultSizes: [DeskCardID: CGSize] {
        [
            .memo: CGSize(width: 220, height: 120),
            .calendar: CGSize(width: 260, height: 220),
            .connect: CGSize(width: 340, height: 300),
            .binder: CGSize(width: 300, height: 380),
            .intel: CGSize(width: 340, height: 220),
            .gmail: CGSize(width: 260, height: 200),
            .notes: CGSize(width: 260, height: 200),
            .gdoc: CGSize(width: 260, height: 230),
            .slides: CGSize(width: 320, height: 214),
        ]
    }

    /// Original work-desk scatter (marketing / Field Desk cards).
    private func deskPoints(for viewport: CGSize) -> [DeskCardID: CGPoint] {
        let right = max(24, viewport.width - 360)
        let midX = max(260, min(viewport.width * 0.38, viewport.width - 480))
        return [
            .binder: CGPoint(x: 24, y: 70),
            .memo: CGPoint(x: midX, y: 64),
            .connect: CGPoint(x: right, y: 70),
            .calendar: CGPoint(x: midX + 40, y: max(220, viewport.height * 0.38)),
            .intel: CGPoint(x: 24, y: max(420, viewport.height - 280)),
            .gmail: CGPoint(x: right, y: max(360, viewport.height - 320)),
            .notes: CGPoint(x: midX, y: max(400, viewport.height - 260)),
            .gdoc: CGPoint(x: midX + 90, y: 110),
            .slides: CGPoint(x: max(260, midX - 60), y: max(250, viewport.height * 0.42)),
        ]
    }

    /// Switch to classic work desk — empty canvas; place cards from `+`.
    private func enterWorkMode(flashMessage: String = "Work desk · add from +") {
        workMode = true
        showIntelPanel = false
        showConnectPanel = false
        showBinderPanel = false
        binderOpen = true
        showBlankPage = false
        showGmailBox = false
        showActFieldBook = false
        showActStage = false
        actStageMaximized = false
        focusedCard = nil
        placedWidgets.removeAll()
        cardOffsets = [:]
        cardDrag = [:]
        flash(flashMessage)
    }

    /// Back to Jesse’s — empty kitchen, no floating cards.
    private func clearDeskCards(flashMessage: String? = nil) {
        workMode = false
        showProjectsPanel = false
        showBinderPanel = false
        showIntelPanel = false
        showConnectPanel = false
        showBlankPage = false
        showGmailBox = false
        showApplyToday = false
        showActFieldBook = false
        showActStage = false
        actStageMaximized = false
        focusedCard = nil
        placedWidgets.removeAll()
        if let flashMessage { flash(flashMessage) }
    }

    private func placeWidget(_ widget: PlaceableWidget) {
        placedWidgets.insert(widget)
        switch widget {
        case .binder:
            showBinderPanel = true
            binderOpen = true
            focusedCard = .binder
        case .calendar:
            focusedCard = .calendar
        case .memo:
            focusedCard = .memo
        case .connect:
            showConnectPanel = true
            focusedCard = .connect
        case .gmail:
            focusedCard = .gmail
        case .intel:
            showIntelPanel = true
            focusedCard = .intel
        case .notes:
            focusedCard = .notes
        case .gdoc:
            focusedCard = .gdoc
        case .slides:
            focusedCard = .slides
        }
        showAddPanel = false
        flash("Placed · \(widget.rawValue)")
    }

    /// Full-screen sheets that hide logo + mode toggle too.
    private var deskOverlayChromeBlocked: Bool {
        showActFieldBook
            || showGmailBox
            || showApplyToday
            || (showActStage && actStageMaximized)
            || showManage
            || showProjectsPanel
            || showProjectsScreen
            || showWorkflowLibrary
    }

    /// Jesse kitchen Ask/dock only — Work/Create own their own prompt bars.
    private var floatDockBlocked: Bool {
        deskOverlayChromeBlocked || showStandaloneDesk || showCreateStudio
    }

    private enum ModeToggleKind {
        case jessesCreate
        case jessesWork
        case createWork
    }

    private var modeToggleKind: ModeToggleKind {
        if showStandaloneDesk { return .jessesCreate }
        if showCreateStudio { return .jessesWork }
        return .createWork
    }

    /// Floating cards on Jesse’s (or minimized ACT chip).
    private var deskChromeLive: Bool {
        showBinderPanel
            || showIntelPanel
            || showConnectPanel
            || !placedWidgets.isEmpty
            || (showActStage && !actStageMaximized)
    }

    /// Original dark swirling desk void (work mode background).
    private var workDeskBackground: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.03, green: 0.06, blue: 0.14),
                    Color(red: 0.06, green: 0.10, blue: 0.22),
                    Color(red: 0.02, green: 0.03, blue: 0.08),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            RadialGradient(
                colors: [
                    Color(red: 0.15, green: 0.35, blue: 0.70).opacity(0.45),
                    Color(red: 0.08, green: 0.16, blue: 0.40).opacity(0.20),
                    .clear,
                ],
                center: UnitPoint(x: 0.7, y: 0.35),
                startRadius: 20,
                endRadius: 520
            )
            RadialGradient(
                colors: [
                    Color(red: 0.25, green: 0.45, blue: 0.85).opacity(0.22),
                    .clear,
                ],
                center: UnitPoint(x: 0.25, y: 0.75),
                startRadius: 10,
                endRadius: 380
            )
        }
        .ignoresSafeArea()
        .allowsHitTesting(false)
    }

    private var uiTesting: Bool {
        ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")
            || ProcessInfo.processInfo.arguments.contains("--ui-testing-skip-auth")
    }

    private func scheduleChromeHide() {
        // Keep chrome pinned under UI tests so dock/bindings stay hittable.
        guard !uiTesting, !deskOverlayChromeBlocked else { return }
        let token = UUID()
        chromeHideToken = token
        DispatchQueue.main.asyncAfter(deadline: .now() + 5) {
            guard chromeHideToken == token, !deskOverlayChromeBlocked else { return }
            withAnimation(.easeInOut(duration: 0.25)) {
                showTopChrome = false
                showBottomChrome = false
            }
        }
    }

    private func revealTopChrome() {
        withAnimation(.easeInOut(duration: 0.2)) { showTopChrome = true }
        scheduleChromeHide()
    }

    private func revealBottomChrome() {
        withAnimation(.easeInOut(duration: 0.2)) { showBottomChrome = true }
        scheduleChromeHide()
    }

    var body: some View {
        GeometryReader { proxy in
            let viewport = proxy.size
            ZStack {
                // Jesse’s kitchen is the desk — Projects drops cards onto this screen.
                Color(fdHex: "050a08")
                    .ignoresSafeArea()
                    .allowsHitTesting(false)
                    .zIndex(0)

                if !showActStage || !actStageMaximized {
                    JesseKitchenBackgroundView(soundEnabled: kitchenSoundOn) { action in
                        handleKitchenAction(action)
                    }
                    .ignoresSafeArea()
                    .zIndex(1)
                    .accessibilityIdentifier("fieldDeskJessePortal")
                }

                // PassThrough claims only the exact card rects; empty space → Jesse.
                if deskChromeLive {
                    PassThroughOverlay(solidRects: activeCardRects(viewport: viewport)) {
                        deskCardsLayer(viewport: viewport)
                            .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
                    }
                    .frame(width: viewport.width, height: viewport.height)
                    .zIndex(20)
                }

                if showActStage && actStageMaximized {
                    actStageMaximizedLayer(viewport: viewport)
                        .zIndex(30)
                }

                // ACT Field Book (dash + notes) as an in-desk popup — not a new tab.
                if showActFieldBook {
                    ActInstanceShellView(onMinimize: {
                        withAnimation(.easeInOut(duration: 0.2)) {
                            showActFieldBook = false
                            showBinderPanel = true
                            binderOpen = true
                        }
                    })
                    .environmentObject(studentStore)
                    .environmentObject(authService)
                    .transition(.opacity)
                    .zIndex(65)
                    .accessibilityIdentifier("fieldDeskActNotesPopup")
                }

                if showApplyToday {
                    JobOSShellView(onClose: { showApplyToday = false })
                        .transition(.opacity)
                        // Above Work/Create web surfaces so workflows use the big area.
                        .zIndex(90)
                        .accessibilityIdentifier("fieldDeskApplyTodayOverlay")
                }

                if showGmailBox {
                    GmailWorkflowBoxView(
                        onClose: {
                            showGmailBox = false
                            gmailStartReconnect = false
                            gmailOpenTopReply = false
                        },
                        onConnected: { calendarToo in
                            _ = store.markConnected("gmail")
                            if calendarToo {
                                _ = store.markConnected("gcal")
                                Task { await refreshDeskCalendar() }
                            }
                            gmailStartReconnect = false
                            if store.allConnectorsLinked {
                                flash("All linked · add Calendar · Connect · Memo from +")
                            } else {
                                flash(calendarToo ? "Connected · Gmail + Calendar" : "Connected · Gmail")
                            }
                        },
                        onDisconnected: {
                            _ = store.disconnect("gmail")
                        },
                        onInboxLoaded: { msgs in
                            for msg in msgs.prefix(5).reversed() {
                                let line = "Mail · \(msg.from): \(msg.subject)"
                                if !store.intelLines.contains(line) {
                                    store.prependIntel(line)
                                }
                            }
                        },
                        startInReconnect: gmailStartReconnect,
                        startWithTopReply: gmailOpenTopReply
                    )
                    .transition(.opacity)
                    .zIndex(56)
                    .accessibilityIdentifier("fieldDeskGmailOverlay")
                }

                if showProjectsPanel {
                    ZStack {
                        Color.black.opacity(0.55)
                            .ignoresSafeArea()
                            .onTapGesture { closeProjectsPanel() }
                        projectsToolsPanel
                            .frame(maxWidth: min(520, viewport.width - 48))
                            .padding(20)
                    }
                    .zIndex(70)
                    .transition(.opacity)
                    .accessibilityIdentifier("fieldDeskProjectsPanel")
                }

                // Projects screen — the Malevolent Shrine project, neatly on
                // a white void. Tapping the shrine enters the work area.
                if showProjectsScreen {
                    projectsScreen
                        .zIndex(83)
                        .transition(.opacity)
                }

                // Standalone Desk — full separation from the kitchen.
                if showStandaloneDesk {
                    StandaloneDeskView(
                        onBackToKitchen: { closeStandaloneDesk() },
                        onManage: { openManageHubFromDesk() },
                        onOpenAct: {
                            closeStandaloneDesk()
                            DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
                                openActDashOnDesk()
                            }
                        },
                        onWorkflows: {
                            showWorkflowLibrary = true
                        },
                        onSound: { on in
                            kitchenSoundOn = on
                        }
                    )
                    .zIndex(85)
                }

                // Spatial Create — same polka doorway, cream orbital board.
                if showCreateStudio {
                    CreateStudioView(onClose: { closeCreateStudio() })
                        .zIndex(86)
                        .transition(.opacity)
                }

                // Polka doorway sheet rides above both worlds while crossing.
                if polkaProgress > 0.001 {
                    PolkaTransitionOverlay(progress: polkaProgress)
                        .zIndex(95)
                }

                if showAddPanel {
                    Color.black.opacity(0.45).onTapGesture { showAddPanel = false }
                    addPanel.frame(maxWidth: min(440, viewport.width - 80))
                }

                if let guideId = activeGuideId, let connector = store.connector(id: guideId) {
                    ZStack {
                        Color.black.opacity(0.45).onTapGesture { activeGuideId = nil }
                        connectGuide(connector)
                            .frame(maxWidth: min(480, viewport.width - 64))
                            .padding(20)
                    }
                    .zIndex(60)
                }

                if let toast {
                    VStack {
                        Spacer()
                        Text(toast)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(fdHex: "f4f7f4"))
                            .padding(.horizontal, 16).padding(.vertical, 10)
                            .background(Capsule().fill(Color(fdHex: "1f2a22")))
                            .padding(.bottom, 100)
                            .accessibilityIdentifier("fieldDeskToast")
                    }
                    .zIndex(40)
                    .allowsHitTesting(false)
                }

                Text(verbatim: "desk-window")
                    .font(.system(size: 1)).foregroundColor(.clear)
                    .accessibilityIdentifier("fieldDeskWindow")
                    .allowsHitTesting(false)
                    .frame(width: 1, height: 1).position(x: 4, y: 4)

                Text(verbatim: String(format: "%.0f,%.0f", pan.width, pan.height))
                    .font(.system(size: 1)).foregroundColor(.clear)
                    .accessibilityIdentifier("fieldDeskPanOffset")
                    .accessibilityValue(String(format: "%.0f,%.0f", pan.width, pan.height))
                    .allowsHitTesting(false)
                    .frame(width: 1, height: 1).position(x: 8, y: 8)
            }
            .frame(width: viewport.width, height: viewport.height)
            // Call/name stay top; Ask + dock live at the BOTTOM now (Akshat:
            // scroll up → search appears at the bottom of the page, not top).
            .overlay(alignment: .top) {
                if !floatDockBlocked {
                    VStack(spacing: 0) {
                        if showTopChrome {
                            topChrome
                                .transition(.move(edge: .top).combined(with: .opacity))
                        }
                        // Thin top edge — swipe down also reveals the chrome.
                        Color.clear
                            .frame(height: showTopChrome ? 8 : 22)
                            .frame(maxWidth: .infinity)
                            .contentShape(Rectangle())
                            .gesture(
                                DragGesture(minimumDistance: 6)
                                    .onChanged { value in
                                        if value.translation.height > 12 { revealTopChrome() }
                                        if value.translation.height < -12 {
                                            withAnimation(.easeInOut(duration: 0.2)) { showTopChrome = false }
                                        }
                                    }
                            )
                    }
                    .animation(.easeInOut(duration: 0.22), value: showTopChrome)
                }
            }
            .overlay(alignment: .bottom) {
                if !floatDockBlocked {
                    VStack(spacing: 0) {
                        if showTopChrome {
                            combinedAskAndDock
                                .padding(.horizontal, 12)
                                .padding(.top, 8)
                                .padding(.bottom, 4)
                                .transition(.move(edge: .bottom).combined(with: .opacity))
                        }
                        // Bottom edge — swipe up reveals Ask down here.
                        Color.clear
                            .frame(height: showTopChrome ? 8 : 18)
                            .frame(maxWidth: .infinity)
                            .contentShape(Rectangle())
                            .gesture(
                                DragGesture(minimumDistance: 6)
                                    .onChanged { value in
                                        if value.translation.height < -12 { revealTopChrome() }
                                        if value.translation.height > 12 {
                                            withAnimation(.easeInOut(duration: 0.2)) { showTopChrome = false }
                                        }
                                    }
                            )
                    }
                    .animation(.easeInOut(duration: 0.22), value: showTopChrome)
                }
            }
            // Top-left MindCraft mark → Manage (replaces Manage pill).
            .overlay(alignment: .topLeading) {
                if !deskOverlayChromeBlocked {
                    Button {
                        openManageFromChrome()
                    } label: {
                        HStack(spacing: 8) {
                            if let item = StickerCatalog.item(id: "raccoon"),
                               let raccoon = StickerCatalog.image(for: item) {
                                Image(uiImage: raccoon)
                                    .resizable()
                                    .scaledToFill()
                                    .frame(width: 28, height: 28)
                                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))
                            } else {
                                Text("MC")
                                    .font(.system(size: 11, weight: .black, design: .rounded))
                                    .foregroundColor(Color(fdHex: "0c1207"))
                                    .frame(width: 28, height: 28)
                                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(fdHex: "c4f547")))
                            }
                            Text("MindCraft")
                                .font(.system(size: 13, weight: .heavy, design: .rounded))
                                .foregroundColor(Color(fdHex: "143a2e"))
                        }
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(
                            Capsule()
                                .fill(Color.white.opacity(0.96))
                                .shadow(color: .black.opacity(0.16), radius: 8, y: 3)
                        )
                    }
                    .buttonStyle(.plain)
                    .padding(.top, 12)
                    .padding(.leading, 16)
                    .zIndex(80)
                    .accessibilityIdentifier("fieldDeskLogoManage")
                    .accessibilityLabel("MindCraft · Manage")
                }
            }
            // Top-right: mode toggle (Create/Work or Jesse's pair) · Sign out.
            .overlay(alignment: .topTrailing) {
                if !deskOverlayChromeBlocked {
                    HStack(spacing: 10) {
                        modeToggleBar

                        Button {
                            authService.signOut()
                        } label: {
                            Image(systemName: "rectangle.portrait.and.arrow.right")
                                .font(.system(size: 14, weight: .bold))
                                .foregroundColor(Color(fdHex: "143a2e"))
                                .frame(width: 40, height: 40)
                                .background(
                                    Circle()
                                        .fill(Color.white.opacity(0.94))
                                        .shadow(color: .black.opacity(0.18), radius: 8, y: 3)
                                )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("fieldDeskSignOutButton")
                        .accessibilityLabel("Sign out")
                    }
                    .padding(.top, 12)
                    .padding(.trailing, 16)
                    .zIndex(80)
                }
            }
        }
        .background(Color(fdHex: "080e14"))
        .ignoresSafeArea()
        .ignoresSafeArea(.keyboard)
        .statusBarHidden(true)
        .animation(.easeInOut(duration: 0.2), value: showAddPanel)
        .animation(.easeInOut(duration: 0.2), value: activeGuideId)
        .animation(.easeInOut(duration: 0.25), value: workMode)
        .onAppear {
            // Land in Jesse’s empty — work desk starts blank; place from +.
            clearDeskCards()
            cardOffsets = [:]
            cardDrag = [:]
            cardSizes = [:]
            showTopChrome = false
            showBottomChrome = false
            wireUITesting()
            kitchenWebReady = true
            withAnimation(.easeInOut(duration: 1.1).repeatForever(autoreverses: true)) {
                focusPulse = true
            }
            // Drop legacy demo calendar rows once so the card starts from real data.
            let sampleWipeKey = "deskOs.calendarSampleWipe.v1"
            if !UserDefaults.standard.bool(forKey: sampleWipeKey) {
                let sampleIds: Set<String> = ["e1", "e2", "e3", "e4", "e5"]
                if store.events.allSatisfy({ sampleIds.contains($0.id) }) {
                    store.replaceEvents([])
                }
                UserDefaults.standard.set(true, forKey: sampleWipeKey)
            }
            Task { await refreshDeskCalendar() }
            // One-shot rewire: put Gmail back on Connect for a clean reconnect test.
            let rewireKey = "deskOs.gmailRewire.v2"
            if !UserDefaults.standard.bool(forKey: rewireKey) {
                _ = store.disconnect("gmail")
                GmailClient.shared.disconnectForReconnect()
                UserDefaults.standard.set(true, forKey: rewireKey)
            }
        }
        .sheet(item: $activeTool) { tool in toolSheet(tool) }
        .sheet(item: $openEntry) { item in entryStudio(item) }
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
        .fullScreenCover(isPresented: $showWorkflowLibrary) {
            WorkflowLibraryView(market: workflowMarket) {
                showWorkflowLibrary = false
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
                    showApplyToday = true
                }
            }
        }
        .sheet(isPresented: $showManage) {
            AccountManageView()
                .environmentObject(studentStore)
                .environmentObject(authService)
        }
        .fullScreenCover(isPresented: $showDocCook) {
            TestInstanceView()
        }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: [.item, .image, .pdf, .plainText],
            allowsMultipleSelection: false
        ) { result in
            if case .success(let urls) = result, let url = urls.first {
                let accessed = url.startAccessingSecurityScopedResource()
                defer { if accessed { url.stopAccessingSecurityScopedResource() } }
                store.fileDrop(sourceName: url.lastPathComponent)
                binderOpen = true
                flash("Filed · \(url.lastPathComponent)")
            }
        }
        .onChange(of: photoItem) { _, item in
            guard let item else { return }
            Task {
                if let name = try? await item.loadTransferable(type: FieldDeskFilename.self) {
                    store.fileDrop(sourceName: name.value)
                    flash("Filed · \(name.value)")
                } else {
                    store.fileDrop(sourceName: "photo-\(Int(Date().timeIntervalSince1970)).jpg")
                    flash("Filed · photo")
                }
                binderOpen = true
                photoItem = nil
            }
        }
    }

    // MARK: - Chrome

    private var deskChromeName: String? {
        let name = studentStore.displayName.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !name.isEmpty, name != "there" else { return nil }
        return name
    }

    /// Binder + house both open ACT dash on this desk (not hub, not Doc→Cook).
    private func openActDashOnDesk() {
        withAnimation(.easeInOut(duration: 0.22)) {
            showActStage = true
            actStageMaximized = true
        }
    }

    private var topChrome: some View {
        // Call · (name at end) — logo / Home / desk pill retired per Akshat.
        HStack(spacing: 10) {
            Button {
                showFindTutor = true
            } label: {
                Image(systemName: "phone.fill")
                    .font(.system(size: 14, weight: .medium))
                    .foregroundColor(Color(fdHex: "c4f547"))
                    .frame(width: 34, height: 34)
                    .background(Circle().fill(Color(fdHex: "111111")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskCallButton")
            .accessibilityLabel("Call")

            Spacer(minLength: 8)
                .allowsHitTesting(false)

            if let deskChromeName {
                Text(deskChromeName)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(.white.opacity(0.78))
                    .lineLimit(1)
                    .padding(.trailing, 2)
            }

            Text(verbatim: "")
                .accessibilityIdentifier("fieldDeskClose")
                .frame(width: 0, height: 0)
                .allowsHitTesting(false)
        }
        .padding(.horizontal, 16)
        // Leave room for pinned Create / sign out / volume on the trailing edge.
        .padding(.trailing, 148)
        .padding(.top, 10)
        .padding(.bottom, 2)
        .background(
            LinearGradient(
                colors: [Color.black.opacity(0.55), Color.black.opacity(0.0)],
                startPoint: .top,
                endPoint: .bottom
            )
            .allowsHitTesting(false)
        )
    }

    // MARK: - Desk cards on Jesse’s (individual hit targets)

    /// Exact frames of every visible card — the ONLY places the overlay
    /// claims touches. Must stay in sync with `deskCardsLayer` layout.
    private func activeCardRects(viewport: CGSize) -> [CGRect] {
        let points = deskPoints(for: viewport)
        var rects: [CGRect] = []
        func add(_ id: DeskCardID) {
            let size = cardSizes[id] ?? defaultSizes[id] ?? CGSize(width: 200, height: 160)
            let base = points[id] ?? .zero
            let settled = cardOffsets[id] ?? .zero
            let live = cardDrag[id] ?? .zero
            rects.append(
                CGRect(
                    x: base.x + settled.width + live.width,
                    y: base.y + settled.height + live.height,
                    width: size.width,
                    height: size.height
                )
                // Cover the title capsule above and the resize grip edge.
                .insetBy(dx: -14, dy: -16)
            )
        }
        if placedWidgets.contains(.binder) || showBinderPanel { add(.binder) }
        if placedWidgets.contains(.gmail) { add(.gmail) }
        if placedWidgets.contains(.calendar) { add(.calendar) }
        if placedWidgets.contains(.notes) { add(.notes) }
        if placedWidgets.contains(.memo) { add(.memo) }
        if placedWidgets.contains(.gdoc) { add(.gdoc) }
        if placedWidgets.contains(.slides) { add(.slides) }
        if placedWidgets.contains(.intel) || showIntelPanel { add(.intel) }
        if placedWidgets.contains(.connect) || showConnectPanel { add(.connect) }
        if showActStage && !actStageMaximized {
            rects.append(CGRect(x: 1100, y: 160, width: 220, height: 110).insetBy(dx: -12, dy: -12))
        }
        return rects
    }

    /// Cards laid out top-leading + offset (not `.position`) so hit bounds match the card.
    @ViewBuilder
    private func deskCardsLayer(viewport: CGSize) -> some View {
        let points = deskPoints(for: viewport)

        ZStack(alignment: .topLeading) {
            if placedWidgets.contains(.binder) || showBinderPanel {
                movableBook(.binder, points: points, showClose: true) { binderBody }
                    .zIndex(focusedCard == .binder ? 21 : 11)
            }
            if placedWidgets.contains(.gmail) {
                movableCard(.gmail, margin: true, points: points, showClose: true, title: "Gmail") {
                    gmailCardBody
                }
                .zIndex(focusedCard == .gmail ? 21 : 11)
            }
            if placedWidgets.contains(.calendar) {
                movableCard(.calendar, margin: true, points: points, showClose: true, title: "Calendar") {
                    calendarBody
                }
                .zIndex(focusedCard == .calendar ? 21 : 11)
            }
            if placedWidgets.contains(.notes) {
                movableCard(.notes, margin: true, points: points, showClose: true, title: "Transcribe Notes") {
                    notesCardBody
                }
                .zIndex(focusedCard == .notes ? 21 : 11)
            }
            if placedWidgets.contains(.memo) {
                movableCard(.memo, margin: true, points: points, showClose: true, title: "Memo") {
                    memoBody
                }
                .zIndex(focusedCard == .memo ? 21 : 11)
            }
            if placedWidgets.contains(.intel) || showIntelPanel {
                movableCard(.intel, margin: true, points: points, showClose: true, title: "Intel") {
                    intelBody
                }
                .zIndex(focusedCard == .intel ? 21 : 11)
            }
            if placedWidgets.contains(.connect) || showConnectPanel {
                movableCard(.connect, margin: false, points: points, showClose: true, title: "Connect") {
                    connectBody
                }
                .zIndex(focusedCard == .connect ? 21 : 11)
            }
            if placedWidgets.contains(.gdoc) {
                movableCard(.gdoc, margin: true, points: points, showClose: true, title: "Gdoc") {
                    gdocCardBody
                }
                .zIndex(focusedCard == .gdoc ? 21 : 11)
            }
            if placedWidgets.contains(.slides) {
                movableCard(.slides, margin: false, points: points, showClose: true, title: "Presentation") {
                    slidesCardBody
                }
                .zIndex(focusedCard == .slides ? 21 : 11)
            }
            if showActStage && !actStageMaximized {
                minimizedActChip
                    .zIndex(12)
            }
        }
        .frame(width: viewport.width, height: viewport.height, alignment: .topLeading)
    }

    /// Whiteboard Gdoc — scribble / type on the kitchen placeable.
    private var gdocCardBody: some View {
        DeskWhiteboardCard()
    }

    /// Real presentation placeable — title + body + slide paging.
    private var slidesCardBody: some View {
        DeskPresentationCard()
    }

    private func pageBoxLauncher(
        title: String,
        subtitle: String,
        system: String,
        x: CGFloat,
        y: CGFloat,
        action: @escaping () -> Void
    ) -> some View {
        let boxW: CGFloat = 220
        let boxH: CGFloat = 54
        return Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: system)
                    .font(.system(size: 14, weight: .bold))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .frame(width: 28, height: 28)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color(fdHex: "c4f547")))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(fdHex: "1c1a17"))
                    Text(subtitle)
                        .font(.system(size: 10, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(fdHex: "8a8478"))
                }
                Spacer(minLength: 0)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 10)
            .frame(width: boxW, height: boxH, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(fdHex: "fbf8f3"))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.55), lineWidth: 1)
            )
            .shadow(color: .black.opacity(0.28), radius: 10, y: 6)
        }
        .buttonStyle(.plain)
        // `.position` keeps hit targets aligned with the drawn box (offset does not).
        .frame(width: boxW, height: boxH)
        .position(x: x + boxW / 2, y: y + boxH / 2)
    }

    /// Projects screen: The Malevolent Shrine → Gen-Z lines → workspace starting → desk.
    private var projectsScreen: some View {
        ZStack(alignment: .topLeading) {
            MalevolentShrineStage(
                showTitle: true,
                title: "The Malevolent Shrine",
                subtitle: shrineCaption,
                onShrineTap: shrineBeatPhase == .idle ? { startShrineEntranceBeat() } : nil,
                centerOnly: true
            )

            if shrineBeatPhase == .idle {
                Button {
                    closeProjectsScreen()
                } label: {
                    HStack(spacing: 7) {
                        Image(systemName: "chevron.left")
                            .font(.system(size: 12, weight: .heavy))
                        Text("Jesse's")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                    }
                    .foregroundColor(Color(fdHex: "143a2e"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(
                        Capsule()
                            .fill(Color.white.opacity(0.95))
                            .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
                    )
                    .overlay(Capsule().strokeBorder(Color(fdHex: "143a2e").opacity(0.14), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .padding(.top, 14)
                .padding(.leading, 16)
                .accessibilityIdentifier("fieldDeskProjectsBack")
            }
        }
        .accessibilityIdentifier("fieldDeskProjectsScreen")
    }

    private static let shrineBeatLines = [
        "Where legends get made",
        "Main character energy only",
        "Build loud. Stay curious.",
    ]

    private func startShrineEntranceBeat() {
        guard showProjectsScreen, shrineBeatPhase == .idle else { return }
        shrineBeatPhase = .captions
        var delay: TimeInterval = 0
        for (index, line) in Self.shrineBeatLines.enumerated() {
            DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                guard showProjectsScreen else { return }
                withAnimation(.easeInOut(duration: 0.35)) {
                    shrineCaption = line
                }
            }
            delay += 1.15
            if index == Self.shrineBeatLines.count - 1 {
                DispatchQueue.main.asyncAfter(deadline: .now() + delay) {
                    guard showProjectsScreen else { return }
                    shrineBeatPhase = .starting
                    withAnimation(.easeInOut(duration: 0.35)) {
                        shrineCaption = "Your workspace is starting..."
                    }
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1.35) {
                        enterWorkAreaFromProjects()
                    }
                }
            }
        }
    }

    private func enterWorkAreaFromProjects() {
        guard showProjectsScreen else { return }
        withAnimation(.easeInOut(duration: 0.28)) {
            showProjectsScreen = false
            shrineBeatPhase = .idle
            shrineCaption = ""
        }
        // Skip polka on Projects → desk; shrine beat already did the doorway.
        showStandaloneDesk = true
    }

    private func closeProjectsScreen() {
        shrineBeatPhase = .idle
        shrineCaption = ""
        withAnimation(.easeInOut(duration: 0.25)) { showProjectsScreen = false }
        JesseKitchenBackgroundView.exitProjectsCamera()
    }

    private var modeToggleBar: some View {
        HStack(spacing: 0) {
            switch modeToggleKind {
            case .createWork:
                modePill("Create", lime: true, id: "fieldDeskCreateButton") {
                    openCreateStudio()
                }
                modePill("Work", lime: false, id: "fieldDeskWorkButton") {
                    openWorkFromJesse()
                }
            case .jessesCreate:
                modePill("Jesse's", lime: false, id: "fieldDeskJessesButton") {
                    closeStandaloneDesk()
                }
                modePill("Create", lime: true, id: "fieldDeskCreateButton") {
                    switchDeskToCreate()
                }
            case .jessesWork:
                modePill("Jesse's", lime: false, id: "fieldDeskJessesButton") {
                    closeCreateStudio()
                }
                modePill("Work", lime: true, id: "fieldDeskWorkButton") {
                    switchCreateToWork()
                }
            }
        }
        .padding(3)
        .background(
            Capsule()
                .fill(Color.white.opacity(0.96))
                .shadow(color: .black.opacity(0.16), radius: 8, y: 3)
        )
        .accessibilityIdentifier("fieldDeskModeToggle")
    }

    private func modePill(_ title: String, lime: Bool, id: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.system(size: 12, weight: .heavy, design: .rounded))
                .foregroundColor(lime ? Color(fdHex: "0c1207") : Color(fdHex: "143a2e"))
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(
                    Capsule().fill(lime ? Color(fdHex: "c4f547") : Color.clear)
                )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(id)
        .accessibilityLabel(title)
    }

    private func openManageFromChrome() {
        if showStandaloneDesk {
            openManageHubFromDesk()
        } else if showCreateStudio {
            closeCreateStudio()
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.35) {
                NotificationCenter.default.post(name: .mcOpenHubFromDesk, object: nil)
            }
        } else {
            NotificationCenter.default.post(name: .mcOpenHubFromDesk, object: nil)
        }
    }

    private func openWorkFromJesse() {
        guard !showStandaloneDesk, !showCreateStudio else { return }
        withAnimation(.easeInOut(duration: 0.25)) {
            showProjectsScreen = true
            shrineBeatPhase = .idle
            shrineCaption = ""
        }
    }

    private func switchDeskToCreate() {
        guard showStandaloneDesk else { return }
        showStandaloneDesk = false
        JesseKitchenBackgroundView.exitProjectsCamera()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) {
            openCreateStudio()
        }
    }

    private func switchCreateToWork() {
        guard showCreateStudio else { return }
        closeCreateStudio()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) {
            showStandaloneDesk = true
        }
    }

    /// Manage from the work area: land on the hub page (tutors map +
    /// workflow market) once the desk has closed.
    private func openManageHubFromDesk() {
        closeStandaloneDesk()
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.75) {
            NotificationCenter.default.post(name: .mcOpenHubFromDesk, object: nil)
        }
    }

    /// Polka dots bloom over the kitchen; the Desk waits underneath.
    private func openStandaloneDesk() {
        guard !showStandaloneDesk, !showCreateStudio else { return }
        withAnimation(.easeInOut(duration: 0.85)) { polkaProgress = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.9) {
            showStandaloneDesk = true
            withAnimation(.easeInOut(duration: 0.55)) { polkaProgress = 0 }
        }
    }

    private func closeStandaloneDesk() {
        withAnimation(.easeInOut(duration: 0.6)) { polkaProgress = 1 }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.65) {
            showStandaloneDesk = false
            // Kitchen camera settles front-facing behind the sheet.
            JesseKitchenBackgroundView.exitProjectsCamera()
            withAnimation(.easeInOut(duration: 0.6)) { polkaProgress = 0 }
        }
    }

    /// Open spatial Create board (desk-os/studio · spatial2) over Jesse's.
    private func openCreateStudio() {
        guard !showCreateStudio, !showStandaloneDesk, !showProjectsScreen else { return }
        withAnimation(.easeInOut(duration: 0.28)) {
            showCreateStudio = true
        }
    }

    private func closeCreateStudio() {
        withAnimation(.easeInOut(duration: 0.28)) {
            showCreateStudio = false
        }
    }

    private func handleKitchenAction(_ action: KitchenDeskAction) {
        showBlankPage = false
        switch action {
        case .openDesk, .projects:
            // Straight to centered shrine — no polka sheet on this path.
            withAnimation(.easeInOut(duration: 0.25)) {
                showProjectsScreen = true
            }
        case .wakeJesse:
            flash("Jesse’s Kitchen")
        case .intel:
            placeWidget(.intel)
        case .connect:
            placeWidget(.connect)
        case .binder:
            placeWidget(.binder)
        case .memo:
            placeWidget(.memo)
        case .calendar, .gcal:
            placeWidget(.calendar)
        case .notes:
            placeWidget(.notes)
        case .doc:
            showBlankPage = true
            flash("Doc · blank page")
        case .gmail:
            placeWidget(.gmail)
        }
    }

    // MARK: - Movable / resizable cards

    @ViewBuilder
    private func movableCard<Content: View>(
        _ id: DeskCardID,
        margin: Bool,
        points: [DeskCardID: CGPoint],
        showClose: Bool = false,
        title: String? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let size = cardSizes[id] ?? defaultSizes[id] ?? CGSize(width: 200, height: 160)
        let base = points[id] ?? .zero
        let settled = cardOffsets[id] ?? .zero
        let live = cardDrag[id] ?? .zero
        let focused = focusedCard == id

        paperCard(
            title: title ?? id.rawValue,
            showClose: showClose,
            marginRule: margin,
            focused: focused,
            onClose: { closeDeskPanel(id) }
        ) {
            content()
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .overlay(alignment: .bottomTrailing) {
            if focused { cornerResizeGrip(for: id) }
        }
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .compositingGroup()
        .simultaneousGesture(cardMoveGesture(id))
        .simultaneousGesture(TapGesture().onEnded {
            focusedCard = id
            scheduleChromeHide()
        })
        // `.position` keeps hit-testing in-sync with where the card is drawn.
        .position(
            x: base.x + settled.width + live.width + size.width / 2,
            y: base.y + settled.height + live.height + size.height / 2
        )
        .accessibilityIdentifier("fieldDeskCard_\(id.rawValue)")
    }

    @ViewBuilder
    private func movableBook<Content: View>(
        _ id: DeskCardID,
        points: [DeskCardID: CGPoint],
        showClose: Bool = false,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let size = cardSizes[id] ?? defaultSizes[id] ?? CGSize(width: 420, height: 300)
        let base = points[id] ?? .zero
        let settled = cardOffsets[id] ?? .zero
        let live = cardDrag[id] ?? .zero
        let focused = focusedCard == id

        bookCard(
            tab: "BOOK",
            eyebrow: "FIELD",
            title: "Binder",
            spine: Color(fdHex: "6b4f3a"),
            tabColor: Color(fdHex: "c4a484"),
            focused: focused,
            showClose: showClose,
            onClose: { closeDeskPanel(id) }
        ) {
            content()
        }
        .frame(width: size.width, height: size.height, alignment: .topLeading)
        .overlay(alignment: .bottomTrailing) {
            if focused { cornerResizeGrip(for: id) }
        }
        .contentShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
        .compositingGroup()
        .simultaneousGesture(cardMoveGesture(id))
        .simultaneousGesture(TapGesture().onEnded {
            focusedCard = id
            binderOpen = true
            scheduleChromeHide()
        })
        .position(
            x: base.x + settled.width + live.width + size.width / 2,
            y: base.y + settled.height + live.height + size.height / 2
        )
        .accessibilityIdentifier("fieldDeskRepositoryCard")
    }

    private func closeDeskPanel(_ id: DeskCardID) {
        switch id {
        case .intel:
            showIntelPanel = false
            placedWidgets.remove(.intel)
        case .connect:
            showConnectPanel = false
            placedWidgets.remove(.connect)
        case .binder:
            showBinderPanel = false
            placedWidgets.remove(.binder)
        case .calendar:
            placedWidgets.remove(.calendar)
        case .memo:
            placedWidgets.remove(.memo)
        case .gmail:
            placedWidgets.remove(.gmail)
        case .notes:
            placedWidgets.remove(.notes)
        case .gdoc:
            placedWidgets.remove(.gdoc)
        case .slides:
            placedWidgets.remove(.slides)
        }
        if focusedCard == id { focusedCard = nil }
    }

    private func cardMoveGesture(_ id: DeskCardID) -> some Gesture {
        // Min distance keeps taps/buttons working; drag moves from title chrome.
        DragGesture(minimumDistance: 12, coordinateSpace: .global)
            .onChanged { value in
                guard resizingCard == nil else { return }
                focusedCard = id
                cardDrag[id] = value.translation
            }
            .onEnded { value in
                guard resizingCard == nil else {
                    cardDrag[id] = .zero
                    return
                }
                let prev = cardOffsets[id] ?? .zero
                cardOffsets[id] = CGSize(
                    width: prev.width + value.translation.width,
                    height: prev.height + value.translation.height
                )
                cardDrag[id] = .zero
            }
    }

    /// Neutral cream L-bracket at bottom-right (no yellow arc).
    private func cornerResizeGrip(for id: DeskCardID) -> some View {
        let def = defaultSizes[id] ?? CGSize(width: 200, height: 160)
        return ZStack(alignment: .bottomTrailing) {
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color.white.opacity(0.55 + (focusPulse ? 0.25 : 0.05)))
                .frame(width: 22, height: 3)
            RoundedRectangle(cornerRadius: 3, style: .continuous)
                .fill(Color.white.opacity(0.55 + (focusPulse ? 0.25 : 0.05)))
                .frame(width: 3, height: 22)
        }
        .frame(width: 28, height: 28)
        .padding(6)
        .contentShape(Rectangle())
        .gesture(
            DragGesture(minimumDistance: 1)
                .onChanged { value in
                    focusedCard = id
                    resizingCard = id
                    if resizeStart == nil {
                        resizeStart = cardSizes[id] ?? def
                    }
                    let start = resizeStart ?? def
                    let maxW: CGFloat = id == .binder ? 640 : (id == .connect ? 720 : 520)
                    let maxH: CGFloat = id == .binder ? 420 : (id == .connect ? 780 : 420)
                    cardSizes[id] = CGSize(
                        width: min(maxW, max(140, start.width + value.translation.width)),
                        height: min(maxH, max(110, start.height + value.translation.height))
                    )
                }
                .onEnded { _ in
                    resizeStart = nil
                    resizingCard = nil
                }
        )
        .accessibilityIdentifier("fieldDeskResize_\(id.rawValue)")
        .accessibilityLabel("Resize \(id.rawValue)")
    }

    // MARK: - ACT stage

    private func actStageMaximizedLayer(viewport: CGSize) -> some View {
        let sidePad: CGFloat = 24
        let topPad: CGFloat = 44
        let bottomPad: CGFloat = 78 // desk Ask/dock gap
        let maxW = max(420, viewport.width - sidePad * 2)
        let maxH = max(320, viewport.height - topPad - bottomPad)
        let w = min(max(actStageSize.width, 480), maxW)
        let h = min(max(actStageSize.height, 340), maxH)

        return ZStack {
            // Soft dim. NOT hittable so desk pan/pinch still works in the pad.
            Color.black.opacity(0.18)
                .ignoresSafeArea()
                .allowsHitTesting(false)
                .accessibilityIdentifier("fieldDeskActStagePad")

            VStack(spacing: 0) {
                DashboardView(embeddedInDesk: true, onDeskHome: {
                    // Already on the dash stage — Home means dash Home tab
                    // (handled inside DashboardView when embedded).
                })
                    .environmentObject(studentStore)
                    .environmentObject(authService)
            }
            .frame(width: w, height: h)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(fdHex: "0f1f18"))
                    .shadow(color: .black.opacity(0.45), radius: 22, y: 10)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .stroke(Color.white.opacity(0.14), lineWidth: 1)
            )
            // Avoid clipping Pencil Metal layers - radius via background only.
            .overlay(alignment: .bottomTrailing) {
                actStageCornerControls(maxW: maxW, maxH: maxH)
            }
            .position(
                x: viewport.width / 2,
                y: topPad + h / 2
            )
            .accessibilityElement(children: .contain)
            .accessibilityIdentifier("fieldDeskActStage")

            // Corner-only minimize - must NOT be a full-screen hit target or
            // it steals desk pan in the pad around the stage.
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { actStageMaximized = false }
            } label: {
                Image(systemName: "arrow.down.right.and.arrow.up.left")
                    .font(.system(size: 12, weight: .bold))
                    .foregroundColor(.white)
                    .padding(10)
                    .background(Circle().fill(Color.black.opacity(0.55)))
            }
            .buttonStyle(.plain)
            .position(x: viewport.width - 28, y: 28)
            .accessibilityIdentifier("fieldDeskActStageMinimize")
            .accessibilityLabel("Minimize ACT stage")
        }
        .onAppear {
            // First open: fill most of the available stage area.
            actStageSize = CGSize(width: maxW, height: maxH)
        }
    }

    private func actStageCornerControls(maxW: CGFloat, maxH: CGFloat) -> some View {
        HStack(spacing: 8) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { actStageMaximized = false }
            } label: {
                Image(systemName: "arrow.down.right.and.arrow.up.left")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(fdHex: "1c1a17"))
                    .padding(8)
                    .background(RoundedRectangle(cornerRadius: 8).fill(Color.white.opacity(0.92)))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskActStageMinMax")
            .accessibilityLabel("Minimize ACT stage")

            // Bottom-right resize grip (same language as desk cards).
            Path { p in
                p.move(to: CGPoint(x: 0, y: 18))
                p.addLine(to: CGPoint(x: 18, y: 18))
                p.addLine(to: CGPoint(x: 18, y: 0))
            }
            .stroke(Color.white.opacity(0.85), style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            .frame(width: 22, height: 22)
            .padding(6)
            .contentShape(Rectangle().size(CGSize(width: 44, height: 44)))
            .gesture(
                DragGesture()
                    .onChanged { value in
                        if actStageResizeOrigin == nil { actStageResizeOrigin = actStageSize }
                        guard let origin = actStageResizeOrigin else { return }
                        actStageSize = CGSize(
                            width: min(max(origin.width + value.translation.width, 480), maxW),
                            height: min(max(origin.height + value.translation.height, 340), maxH)
                        )
                    }
                    .onEnded { _ in actStageResizeOrigin = nil }
            )
            .accessibilityIdentifier("fieldDeskActStageResize")
            .accessibilityLabel("Resize ACT stage")
        }
        .padding(10)
    }

    private var minimizedActChip: some View {
        Button {
            withAnimation(.easeInOut(duration: 0.2)) { actStageMaximized = true }
        } label: {
            VStack(alignment: .leading, spacing: 6) {
                Text("ACT")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Capsule().fill(Color(fdHex: "c4f547")))
                Text("ACT Field Book")
                    .font(.system(size: 18, weight: .regular, design: .serif))
                    .italic()
                    .foregroundColor(Color(fdHex: "1c1a17"))
                Text("Tap to maximize")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))
            }
            .padding(14)
            .frame(width: 220, height: 110, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(fdHex: "fbf8f3"))
                    .shadow(color: .black.opacity(0.4), radius: 14, y: 8)
            )
            .overlay(alignment: .bottomTrailing) {
                Image(systemName: "arrow.up.left.and.arrow.down.right")
                    .font(.system(size: 11, weight: .bold))
                    .foregroundColor(Color(fdHex: "1c1a17").opacity(0.7))
                    .padding(8)
            }
        }
        .buttonStyle(.plain)
        .offset(x: 1100, y: 160)
        .accessibilityIdentifier("fieldDeskActStageChip")
        .zIndex(25)
    }

    // MARK: - Blank page / dock

    /// Blank page stays in the current desk window (same pattern as ACT stage).
    private func blankPageInWindow(viewport: CGSize) -> some View {
        let sidePad: CGFloat = 28
        let topPad: CGFloat = 52
        let bottomPad: CGFloat = 86
        let w = min(viewport.width - sidePad * 2, 820)
        let h = min(viewport.height - topPad - bottomPad, 640)
        return ZStack {
            Color.black.opacity(0.28)
                .ignoresSafeArea()
                .onTapGesture { showBlankPage = false }
                .accessibilityIdentifier("fieldDeskBlankPad")

            BlankDeskPageView(
                embedded: true,
                onFile: { title, body in
                    store.addManualNote(title: title, course: "Pages", body: body)
                    binderOpen = true
                    focusedCard = .binder
                    showBlankPage = false
                    flash("Filed page · \(title)")
                },
                onClose: { showBlankPage = false }
            )
            .frame(width: w, height: h)
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.4), radius: 24, y: 12)
            .position(x: viewport.width / 2, y: topPad + h / 2)
            .accessibilityIdentifier("fieldDeskBlankPage")
        }
    }

    private var combinedAskAndDock: some View {
        HStack(spacing: 8) {
            Button {
                showAddPanel = true
                scheduleChromeHide()
            } label: {
                Text("+")
                    .font(.system(size: 18, weight: .bold))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .frame(width: 40, height: 40)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(fdHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskAdd")

            dockIconCompact("record.circle", tool: .record)

            // Mail → movable Gmail box. Lime only while that box is open.
            Button {
                gmailOpenTopReply = false
                showGmailBox = true
            } label: {
                Image(systemName: "envelope")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .frame(width: 40, height: 40)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(showGmailBox ? Color(fdHex: "c4f547") : Color.white)
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskMail")
            .accessibilityLabel("Gmail")

            dockIconCompact("calendar", tool: .calendar)
            dockIconCompact("magnifyingglass", tool: .search)

            // Book → Apply today board immediately (sketch popup on desk).
            Button { showApplyToday = true } label: {
                Image(systemName: "book.closed")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .frame(width: 40, height: 40)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskWorkflows")
            .accessibilityLabel("Apply today")
            .simultaneousGesture(
                LongPressGesture(minimumDuration: 0.55).onEnded { _ in
                    showWorkflowLibrary = true
                }
            )

            HStack(spacing: 8) {
                TextField("Ask MindCraft…", text: $askText)
                    .textFieldStyle(.plain)
                    .foregroundColor(.white)
                    .font(.system(size: 15, weight: .medium, design: .rounded))
                    .disabled(askBusy)
                    .onSubmit { submitDeskAsk() }
                Button {
                    submitDeskAsk()
                } label: {
                    Image(systemName: askBusy ? "hourglass" : "arrow.up.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(Color(fdHex: "c4f547"))
                }
                .buttonStyle(.plain)
                .disabled(askBusy)
                .accessibilityIdentifier("fieldDeskAskSubmit")
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .frame(maxWidth: .infinity)
            .background(Capsule().fill(Color(fdHex: "202226").opacity(0.92)))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(
            Capsule()
                .fill(Color(fdHex: "0c1207").opacity(0.82))
                .shadow(color: .black.opacity(0.4), radius: 16, y: 8)
        )
        .overlay(alignment: .topLeading) {
            Text(verbatim: "dock").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("fieldDeskFloatDock")
                .allowsHitTesting(false)
        }
        .accessibilityElement(children: .contain)
    }

    private func dockIconCompact(_ system: String, tool: RailTool) -> some View {
        Button { activeTool = tool } label: {
            Image(systemName: system)
                .font(.system(size: 15, weight: .semibold))
                .foregroundColor(.white.opacity(0.9))
                .frame(width: 40, height: 40)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("fieldDeskRail_\(tool.rawValue)")
    }

    // MARK: - Card chrome (tight - no Spacer fluff)

    private func paperCard<Content: View>(
        title: String,
        showClose: Bool = false,
        marginRule: Bool = true,
        focused: Bool = false,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        ZStack(alignment: .topLeading) {
            VStack(alignment: .leading, spacing: 0) {
                Color.clear.frame(height: 10)
                content()
                    .padding(.leading, marginRule ? 16 : 10)
                    .padding(.trailing, 10)
                    .padding(.bottom, 8)
                    .padding(.top, 2)
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            }
            .background(Color(fdHex: "fbf8f3"))
            .overlay(alignment: .leading) {
                if marginRule {
                    Rectangle()
                        .fill(Color(fdHex: "c1121f").opacity(0.28))
                        .frame(width: 1)
                        .padding(.leading, 8)
                        .padding(.top, 18)
                        .padding(.bottom, 6)
                }
            }
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .strokeBorder(
                        focused
                            ? Color(fdHex: "c4f547").opacity(focusPulse ? 1 : 0.55)
                            : Color.white.opacity(0.55),
                        lineWidth: focused ? 2.5 : 1
                    )
            )
            .overlay {
                if focused {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(fdHex: "c4f547").opacity(focusPulse ? 0.10 : 0.03))
                        .allowsHitTesting(false)
                }
            }

            HStack(spacing: 6) {
                Text(title)
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(Color(fdHex: "1c1a17"))
                    .textCase(.lowercase)
                    .padding(.horizontal, 10)
                    .padding(.vertical, 4)
                    .background(Capsule().fill(Color(fdHex: "efe9e0")))
                if showClose {
                    Button {
                        onClose?()
                    } label: {
                        Image(systemName: "xmark")
                            .font(.system(size: 10, weight: .bold))
                            .foregroundColor(Color(fdHex: "1c1a17"))
                            .padding(6)
                            .background(Circle().fill(Color(fdHex: "efe9e0")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("fieldDeskCardClose_\(title)")
                }
            }
            .offset(x: 12, y: -7)
        }
        .padding(.top, 8)
        .shadow(
            color: focused ? Color(fdHex: "c4f547").opacity(focusPulse ? 0.55 : 0.25) : .black.opacity(0.40),
            radius: focused ? 22 : 12,
            y: 8
        )
    }

    private func bookCard<Content: View>(
        tab: String, eyebrow: String, title: String,
        spine: Color, tabColor: Color,
        focused: Bool = false,
        showClose: Bool = false,
        onClose: (() -> Void)? = nil,
        @ViewBuilder content: () -> Content
    ) -> some View {
        let radius: CGFloat = 14
        return ZStack(alignment: .topLeading) {
            HStack(spacing: 0) {
                spine.frame(width: 12)
                VStack(alignment: .leading, spacing: 4) {
                    HStack {
                        Text(eyebrow)
                            .font(.system(size: 9, weight: .bold, design: .rounded))
                            .tracking(0.7)
                            .foregroundColor(Color(fdHex: "8a8478"))
                        Spacer(minLength: 0)
                        if showClose {
                            Button {
                                onClose?()
                            } label: {
                                Image(systemName: "xmark")
                                    .font(.system(size: 10, weight: .bold))
                                    .foregroundColor(Color(fdHex: "1c1a17"))
                                    .padding(6)
                                    .background(Circle().fill(Color(fdHex: "efe9e0")))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    Text(title)
                        .font(.system(size: 20, weight: .regular, design: .serif))
                        .italic()
                        .foregroundColor(Color(fdHex: "1c1a17"))
                    content()
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 8)
            }
            .background(Color(fdHex: "f7f3ee"))
            .clipShape(RoundedRectangle(cornerRadius: radius, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: radius, style: .continuous)
                    .strokeBorder(
                        focused
                            ? Color(fdHex: "c4f547").opacity(focusPulse ? 1 : 0.55)
                            : Color.white.opacity(0.55),
                        lineWidth: focused ? 2.5 : 1
                    )
            )
            .overlay {
                if focused {
                    RoundedRectangle(cornerRadius: radius, style: .continuous)
                        .fill(Color(fdHex: "c4f547").opacity(focusPulse ? 0.08 : 0.02))
                        .allowsHitTesting(false)
                }
            }

            Text(tab)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .foregroundColor(Color(fdHex: "1c1a17"))
                .padding(.horizontal, 8)
                .padding(.vertical, 3)
                .background(Capsule().fill(tabColor))
                .offset(x: 24, y: -8)
        }
        .padding(.top, 10)
        .shadow(
            color: focused ? Color(fdHex: "c4f547").opacity(focusPulse ? 0.5 : 0.22) : .black.opacity(0.40),
            radius: focused ? 20 : 12,
            y: 8
        )
    }

    // MARK: - Bodies

    private var connectBody: some View {
        let pending = FieldDeskStore.connectors.filter { !store.isConnected($0.id) }
        let linked = FieldDeskStore.connectors.filter { store.isConnected($0.id) }
        let hint = FieldDeskStore.agentHint(forConnected: Array(store.connectAt.keys))
        return VStack(alignment: .leading, spacing: 8) {
            Text("Connectors")
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(fdHex: "8a8478"))
            Text("Gmail · Calendar · Drive folder (read-only). Tap the logo anytime.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(fdHex: "8a8478").opacity(0.95))
                .fixedSize(horizontal: false, vertical: true)

            if !linked.isEmpty {
                Text("Ready for agents")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(fdHex: "247a4d"))
                ForEach(linked) { c in
                    Text("• \(c.title.replacingOccurrences(of: "Connect ", with: "")) · live")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(fdHex: "1c1a17"))
                }
            }

            if !pending.isEmpty {
                Text(linked.isEmpty ? "Tap to link" : "Still open")
                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))
                ForEach(pending) { c in
                    HStack(spacing: 8) {
                        Text("• \(c.title)")
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(fdHex: "1c1a17"))
                        Spacer(minLength: 0)
                        Text("Open")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(fdHex: "0c1207"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color(fdHex: "c4f547")))
                    }
                    .contentShape(Rectangle())
                    .onTapGesture { activeGuideId = c.id }
                    .accessibilityIdentifier("fieldDeskConnect_\(c.id)")
                }
            } else if linked.isEmpty {
                Text("No connectors yet")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))
            }

            if let hint {
                Text(hint)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(fdHex: "247a4d"))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 2)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var intelBody: some View {
        let lines: [String] = store.intelLines.isEmpty
            ? ["Connect a tool", "File into Binder", "Ask a note"]
            : Array(store.intelLines.prefix(6))
        return VStack(alignment: .leading, spacing: 0) {
            ForEach(Array(lines.enumerated()), id: \.offset) { _, line in
                HStack(alignment: .center, spacing: 10) {
                    Circle()
                        .fill(Color(fdHex: "c4a484").opacity(0.75))
                        .frame(width: 6, height: 6)
                    Text(line)
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(store.intelLines.isEmpty ? Color(fdHex: "8a8478") : Color(fdHex: "1c1a17"))
                        .lineLimit(2)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                .padding(.vertical, 7)
                .overlay(alignment: .bottom) {
                    Rectangle()
                        .fill(Color(fdHex: "d9d2c5").opacity(0.85))
                        .frame(height: 1)
                        .padding(.leading, 16)
                }
            }
        }
        .padding(.leading, 2)
    }

    @ViewBuilder
    private var binderBody: some View {
        // Binder shows ACT only (never Doc→Cook). Customs stay secondary.
        let customs = customInstances.instances.map {
            DeskBoundInstance.custom(id: $0.id, name: $0.name, subject: $0.subject)
        }
        VStack(alignment: .leading, spacing: 10) {
            Text("BINDER")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(fdHex: "8a8478"))

            // ACT → in-desk Field Book popup with notes (not Doc→Cook, not a new tab).
            Button {
                showBlankPage = false
                showGmailBox = false
                showApplyToday = false
                showDocCook = false
                withAnimation(.easeInOut(duration: 0.2)) {
                    showActFieldBook = true
                }
            } label: {
                VStack(alignment: .leading, spacing: 8) {
                    HStack(spacing: 8) {
                        Image(systemName: "book.closed.fill")
                            .font(.system(size: 13, weight: .bold))
                            .foregroundColor(Color(fdHex: "0c1207"))
                            .frame(width: 28, height: 28)
                            .background(Circle().fill(Color(fdHex: "c4f547")))
                        Text("ACT")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(fdHex: "0c1207"))
                            .padding(.horizontal, 8)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Color(fdHex: "c4f547").opacity(0.85)))
                        Spacer(minLength: 0)
                        Image(systemName: "arrow.up.left.and.arrow.down.right")
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(Color(fdHex: "8a8478"))
                    }
                    Text("ACT Field Book")
                        .font(.system(size: 17, weight: .bold, design: .rounded))
                        .foregroundColor(Color(fdHex: "1c1a17"))
                    Text("Open dash + notes on this desk")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(fdHex: "6f6a61"))
                }
                .padding(14)
                .frame(maxWidth: .infinity, minHeight: 110, alignment: .topLeading)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color.white.opacity(0.92))
                        .overlay(
                            RoundedRectangle(cornerRadius: 14, style: .continuous)
                                .stroke(Color(fdHex: "c4f547"), lineWidth: 2)
                        )
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskBinderInstance_act_main")

            if !customs.isEmpty {
                LazyVGrid(
                    columns: [GridItem(.flexible(), spacing: 8), GridItem(.flexible(), spacing: 8)],
                    spacing: 8
                ) {
                    ForEach(customs) { inst in
                        Button {
                            // Never route ACT/Doc→Cook through hub from Binder.
                            if case .custom = inst {
                                onLaunchInstance?(inst)
                            }
                        } label: {
                            VStack(alignment: .leading, spacing: 6) {
                                HStack(spacing: 6) {
                                    Image(systemName: inst.systemImage)
                                        .font(.system(size: 11, weight: .bold))
                                        .foregroundColor(Color(fdHex: "0c1207"))
                                        .frame(width: 22, height: 22)
                                        .background(Circle().fill(Color(fdHex: "c4f547")))
                                    Text(inst.badge)
                                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                                        .foregroundColor(Color(fdHex: "8a8478"))
                                    Spacer(minLength: 0)
                                }
                                Text(inst.title)
                                    .font(.system(size: 13, weight: .bold, design: .rounded))
                                    .foregroundColor(Color(fdHex: "1c1a17"))
                                    .lineLimit(2)
                            }
                            .padding(10)
                            .frame(maxWidth: .infinity, minHeight: 72, alignment: .topLeading)
                            .background(
                                RoundedRectangle(cornerRadius: 12, style: .continuous)
                                    .fill(Color.white.opacity(0.72))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: 12, style: .continuous)
                                            .stroke(Color(fdHex: "d9d2c5"), lineWidth: 1)
                                    )
                            )
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("fieldDeskBinderInstance_\(inst.id)")
                    }
                }
            }

            HStack {
                Text("FILED")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(0.8)
                    .foregroundColor(Color(fdHex: "8a8478"))
                Spacer(minLength: 0)
                Text(store.items.isEmpty ? "tap + to file" : "\(store.items.count)")
                    .font(.system(size: 10, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))
            }
            .padding(.top, 2)

            if store.items.isEmpty {
                Text("Notes, pages, and drops land here.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))
            } else {
                ForEach(store.items.prefix(4)) { item in
                    Button {
                        openEntry = item
                    } label: {
                        HStack(spacing: 6) {
                            Image(systemName: item.course == "Pages" ? "doc.plaintext" : "paperclip")
                                .font(.system(size: 11, weight: .semibold))
                                .foregroundColor(Color(fdHex: "6b4f3a"))
                            Text(item.title)
                                .font(.system(size: 13, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(fdHex: "1c1a17"))
                                .lineLimit(1)
                            Spacer(minLength: 0)
                        }
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(item.title)
                    .accessibilityIdentifier("fieldDeskBinderItem_\(item.id)")
                }
            }
        }
    }

    private var memoBody: some View {
        TextField("Type a memo…", text: $memoDraft)
            .textFieldStyle(.plain)
            .font(.system(size: 15, design: .serif))
            .foregroundColor(Color(fdHex: "1c1a17"))
            .onSubmit { submitMemo() }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private func submitMemo() {
        let t = memoDraft.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty else { return }
        store.prependIntel(t)
        memoDraft = ""
        flash("Memo → intel")
    }

    private var gmailCardBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(store.isConnected("gmail") ? "Inbox live" : "Connect inbox")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundColor(Color(fdHex: "1c1a17"))
            Text(store.isConnected("gmail")
                 ? "Pull mail into workflows · reply from the desk"
                 : "Link Gmail so Ask can start from your inbox")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(fdHex: "8a8478"))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button {
                gmailOpenTopReply = false
                showGmailBox = true
                focusedCard = .gmail
            } label: {
                Text(store.isConnected("gmail") ? "Open Gmail" : "Connect Gmail")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(fdHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskGmailCardOpen")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var notesCardBody: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Live transcribe")
                .font(.system(size: 14, weight: .semibold, design: .rounded))
                .foregroundColor(Color(fdHex: "1c1a17"))
            Text("Capture talk → filed notes on this desk")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(fdHex: "8a8478"))
                .fixedSize(horizontal: false, vertical: true)
            Spacer(minLength: 0)
            Button {
                focusedCard = .notes
                activeTool = .record
            } label: {
                Text("Transcribe Notes")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(fdHex: "0c1207"))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(fdHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskNotesCardOpen")
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    }

    private var calendarBody: some View {
        VStack(alignment: .leading, spacing: 6) {
            if store.events.isEmpty {
                Text("No events this week")
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))
                Text(GmailClient.shared.hasCalendarScope
                     ? "Your Google Calendar is clear · pull to refresh from Connect"
                     : "Connect Gmail + Calendar to show your real week")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478").opacity(0.9))
                    .fixedSize(horizontal: false, vertical: true)
            } else {
                ForEach(store.events.prefix(6)) { ev in
                    HStack(alignment: .firstTextBaseline, spacing: 8) {
                        Text(ev.day)
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(fdHex: "0c1207"))
                            .padding(.horizontal, 7)
                            .padding(.vertical, 3)
                            .background(Capsule().fill(Color(fdHex: "c4f547").opacity(0.85)))
                        Text(ev.title)
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(Color(fdHex: "1c1a17"))
                            .lineLimit(2)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .accessibilityIdentifier("fieldDeskCalendarWeek")
    }

    private func refreshDeskCalendar() async {
        // Prefer Google Calendar (same connect as Gmail), then Apple Calendar.
        // Never dump the old sample week into the desk by default.
        GmailClient.shared.refreshScopeStatus()
        if GmailClient.shared.hasCalendarScope {
            let google = await GmailClient.shared.fetchCalendarWeek()
            if !google.isEmpty {
                store.replaceEvents(google.map {
                    FieldDeskStore.CalendarEvent(id: $0.id, day: $0.day, title: $0.title)
                })
                _ = store.markConnected("gcal")
                return
            }
        }
        let apple = await DeskCalendarLoader.loadUpcomingWeek()
        if !apple.isEmpty {
            store.replaceEvents(apple)
            _ = store.markConnected("gcal")
            return
        }
        // Clear stale sample / demo rows so the card never looks fake.
        if !store.events.isEmpty {
            let sampleIds: Set<String> = ["e1", "e2", "e3", "e4", "e5"]
            if store.events.allSatisfy({ sampleIds.contains($0.id) }) {
                store.replaceEvents([])
            }
        }
    }

    // MARK: - Entry + MicroSim studio

    private func entryStudio(_ item: FieldDeskStore.FiledItem) -> some View {
        let simURL = Self.microsimURL(for: item)
        return NavigationStack {
            VStack(alignment: .leading, spacing: 14) {
                VStack(alignment: .leading, spacing: 6) {
                    Text(item.course.uppercased())
                        .font(.system(size: 11, weight: .bold, design: .rounded))
                        .foregroundColor(Color(fdHex: "8a8478"))
                    Text(item.title)
                        .font(.system(size: 24, weight: .bold, design: .rounded))
                    if !item.note.isEmpty {
                        Text(item.note)
                            .font(.system(size: 15, weight: .medium, design: .rounded))
                            .foregroundColor(Color(fdHex: "6f6a61"))
                    }
                    Text("Stored entry · live MicroSim lab")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(fdHex: "247a4d"))
                }
                .padding(.horizontal, 4)

                MicroSimWebView(url: simURL)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                    .overlay(
                        RoundedRectangle(cornerRadius: 16)
                            .strokeBorder(Color(fdHex: "c4f547").opacity(0.35), lineWidth: 1)
                    )
                    .accessibilityIdentifier("fieldDeskEntrySim")
            }
            .padding(18)
            .background(Color(fdHex: "f7f3ee"))
            .navigationTitle("Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { openEntry = nil }
                }
            }
        }
        .presentationDetents([.large])
        .accessibilityIdentifier("fieldDeskEntryStudio")
    }

    /// Pick an open MicroSim that fits the filed course/title.
    private static func microsimURL(for item: FieldDeskStore.FiledItem) -> URL {
        let hay = (item.course + " " + item.title + " " + item.note).lowercased()
        let slug: String
        if hay.contains("chem") || hay.contains("force") || hay.contains("phys") || hay.contains("projectile") {
            slug = "projectile-motion"
        } else if hay.contains("graph") || hay.contains("data") || hay.contains("stat") {
            slug = "galton-board"
        } else {
            slug = "bouncing-ball"
        }
        return URL(string: "https://dmccreary.github.io/microsims/sims/\(slug)/main.html")!
    }

    // MARK: - Guides / add / tools

    private func connectGuide(_ connector: FieldDeskStore.Connector) -> some View {
        let linked = store.isConnected(connector.id)
        return VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: 2) {
                    Text(connector.title)
                        .font(.system(size: 22, weight: .bold, design: .rounded))
                        .foregroundColor(Color(fdHex: "1c1a17"))
                        .accessibilityIdentifier("fieldDeskConnectGuide")
                    Text(connector.meta)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(Color(fdHex: "6f6a61"))
                }
                Spacer()
                Button("Close") { activeGuideId = nil }
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(fdHex: "6f6a61"))
            }

            VStack(alignment: .leading, spacing: 10) {
                ForEach(Array(connector.steps.enumerated()), id: \.offset) { i, step in
                    HStack(alignment: .top, spacing: 10) {
                        Text("\(i + 1)")
                            .font(.system(size: 12, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(fdHex: "0c1207"))
                            .frame(width: 22, height: 22)
                            .background(Circle().fill(Color(fdHex: "c4f547")))
                        Text(step)
                            .font(.system(size: 14, weight: .medium, design: .rounded))
                            .foregroundColor(Color(fdHex: "1c1a17"))
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }
            }
            .padding(14)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(fdHex: "f1eadf"))
            )

            if connector.id == "gmail" {
                Button {
                    activeGuideId = nil
                    gmailStartReconnect = true
                    showGmailBox = true
                } label: { guidePrimary("Connect Gmail + Calendar") }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fieldDeskConnectOpenGmail")
            } else if connector.id == "gcal" {
                Button {
                    activeGuideId = nil
                    if GmailClient.shared.hasCalendarScope {
                        Task { await refreshDeskCalendar() }
                        flash("Calendar refreshed")
                    } else {
                        gmailStartReconnect = true
                        showGmailBox = true
                    }
                } label: {
                    guidePrimary(
                        GmailClient.shared.hasCalendarScope
                        ? "Refresh this week"
                        : "Connect Google Calendar"
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fieldDeskConnectSampleCal")
            } else if connector.id == "gdrive" {
                Button {
                    // Prototype: mark connected after student follows Drive folder steps.
                    // Full Google Drive OAuth (folder-scoped read-only) wires next.
                    if store.markConnected("gdrive") {
                        flash("Drive ready · MindCraft Desk folder")
                        store.prependIntel("Drive · MindCraft Desk · read-only folder linked")
                    }
                    activeGuideId = nil
                } label: { guidePrimary(linked ? "Reconnect Drive steps" : "Connect Google Drive") }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fieldDeskConnectOpenDrive")

                Link(destination: URL(string: "https://drive.google.com/drive/my-drive")!) {
                    Text("Open Google Drive to create the folder")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(fdHex: "1d3a8a"))
                }
                .accessibilityIdentifier("fieldDeskConnectDriveWeb")
            } else if connector.id == "moodle" {
                Button {
                    showAddPanel = true
                    activeGuideId = nil
                } label: { guidePrimary("File upload") }
                .buttonStyle(.plain)
                .accessibilityIdentifier("fieldDeskConnectMoodleAdd")
            }

            Button {
                if linked {
                    _ = store.disconnect(connector.id)
                    flash("Disconnected")
                } else if store.markConnected(connector.id) {
                    flash("Connected · \(connector.title)")
                }
                activeGuideId = nil
            } label: {
                Text(linked ? "Disconnect" : "Mark as connected")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(linked ? Color(fdHex: "f4f7f4") : Color(fdHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(linked ? Color(fdHex: "3d3a36") : Color(fdHex: "c4f547"))
                    )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskConnectMark")
        }
        .padding(20)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color(fdHex: "fbf8f3"))
                .shadow(color: .black.opacity(0.45), radius: 28, y: 14)
        )
    }

    private func guidePrimary(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundColor(Color(fdHex: "0c1207"))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 11)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .strokeBorder(Color(fdHex: "c4f547"), lineWidth: 2)
                    .background(RoundedRectangle(cornerRadius: 12).fill(Color(fdHex: "c4f547").opacity(0.25)))
            )
    }

    private func closeProjectsPanel() {
        withAnimation(.easeInOut(duration: 0.2)) {
            showProjectsPanel = false
        }
        JesseKitchenBackgroundView.exitProjectsCamera()
    }

    private func openProjectTool(_ action: KitchenDeskAction) {
        closeProjectsPanel()
        // Slight delay so the panel dismisses before the work desk mounts.
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) {
            handleKitchenAction(action)
        }
    }

    /// Projects panel — Binder / Intel / Transcribe / Doc / Memo / Gmail / Gcal + Go Back.
    private var projectsToolsPanel: some View {
        let tools: [(KitchenDeskAction, String, String)] = [
            (.binder, "books.vertical.fill", "Binder"),
            (.intel, "sparkles", "Intel"),
            (.notes, "waveform", "Transcribe"),
            (.doc, "doc.text.fill", "Doc"),
            (.memo, "note.text", "Memo"),
            (.gmail, "envelope.fill", "Gmail"),
            (.calendar, "calendar", "Gcal"),
        ]

        return VStack(alignment: .leading, spacing: 18) {
            HStack {
                Text("Desk tools")
                    .font(.system(size: 22, weight: .bold, design: .rounded))
                    .foregroundColor(Color(fdHex: "1c1a17"))
                Spacer()
            }

            LazyVGrid(
                columns: [
                    GridItem(.flexible(), spacing: 14),
                    GridItem(.flexible(), spacing: 14),
                    GridItem(.flexible(), spacing: 14),
                    GridItem(.flexible(), spacing: 14),
                ],
                spacing: 14
            ) {
                ForEach(tools, id: \.2) { tool in
                    Button {
                        openProjectTool(tool.0)
                    } label: {
                        VStack(spacing: 10) {
                            Image(systemName: tool.1)
                                .font(.system(size: 28, weight: .semibold))
                                .foregroundColor(Color(fdHex: "0c1207"))
                                .frame(width: 56, height: 56)
                                .background(Circle().fill(Color(fdHex: "c4f547")))
                            Text(tool.2)
                                .font(.system(size: 13, weight: .bold, design: .rounded))
                                .foregroundColor(Color(fdHex: "1c1a17"))
                        }
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 16)
                        .background(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .fill(Color(fdHex: "f4efe2"))
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: 16, style: .continuous)
                                .strokeBorder(Color.black.opacity(0.06), lineWidth: 1)
                        )
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("fieldDeskProject_\(tool.2)")
                }
            }

            Button {
                closeProjectsPanel()
            } label: {
                HStack(spacing: 10) {
                    Image(systemName: "arrow.uturn.backward")
                        .font(.system(size: 15, weight: .bold))
                    Text("Go Back")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                }
                .foregroundColor(Color(fdHex: "f4efe2"))
                .frame(maxWidth: .infinity)
                .padding(.vertical, 14)
                .background(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Color(fdHex: "1f2a22"))
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("fieldDeskProjectsGoBack")
        }
        .padding(22)
        .background(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .fill(Color(fdHex: "fbf8f3"))
                .shadow(color: .black.opacity(0.45), radius: 28, y: 14)
        )
    }

    private var addPanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    Text("Add")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                    Spacer()
                    Button("Close") {
                        showAddPanel = false
                        showAddToBinderForm = false
                    }
                }

                Text("PLACE ON JESSE’S")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(0.8)
                    .foregroundColor(Color(fdHex: "8a8478"))

                Text("Drop Binder, Gmail, Calendar, Notes, Memo, Connect, Intel onto Jesse’s — drag to move.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(fdHex: "8a8478"))

                addMenuRow(
                    title: "Binder",
                    subtitle: placedWidgets.contains(.binder) ? "Already on desk" : "Repository · instances · filed",
                    system: "books.vertical.fill",
                    enabled: true
                ) {
                    placeWidget(.binder)
                }
                .accessibilityIdentifier("fieldDeskAddBinder")

                addMenuRow(
                    title: "Gmail",
                    subtitle: placedWidgets.contains(.gmail) ? "Already on desk" : "Inbox card",
                    system: "envelope.fill",
                    enabled: true
                ) {
                    placeWidget(.gmail)
                }
                .accessibilityIdentifier("fieldDeskAddGmail")

                addMenuRow(
                    title: "Calendar",
                    subtitle: placedWidgets.contains(.calendar) ? "Already on desk" : "Your week card",
                    system: "calendar",
                    enabled: true
                ) {
                    placeWidget(.calendar)
                }
                .accessibilityIdentifier("fieldDeskAddCalendar")

                addMenuRow(
                    title: "Transcribe Notes",
                    subtitle: placedWidgets.contains(.notes) ? "Already on desk" : "Live transcribe card",
                    system: "waveform",
                    enabled: true
                ) {
                    placeWidget(.notes)
                }
                .accessibilityIdentifier("fieldDeskAddNotes")

                addMenuRow(
                    title: "Memo",
                    subtitle: placedWidgets.contains(.memo) ? "Already on desk" : "Quick note card",
                    system: "note.text",
                    enabled: true
                ) {
                    placeWidget(.memo)
                }
                .accessibilityIdentifier("fieldDeskAddMemo")

                addMenuRow(
                    title: "Gdoc",
                    subtitle: placedWidgets.contains(.gdoc) ? "Already on desk" : "Whiteboard · write & scribble",
                    system: "doc.text.fill",
                    enabled: true
                ) {
                    placeWidget(.gdoc)
                }
                .accessibilityIdentifier("fieldDeskAddGdoc")

                addMenuRow(
                    title: "Presentation",
                    subtitle: placedWidgets.contains(.slides) ? "Already on desk" : "Presentation · slides",
                    system: "rectangle.on.rectangle.angled",
                    enabled: true
                ) {
                    placeWidget(.slides)
                }
                .accessibilityIdentifier("fieldDeskAddPresentation")

                addMenuRow(
                    title: "Connect",
                    subtitle: placedWidgets.contains(.connect) ? "Already on desk" : "Gmail · Calendar · Moodle tools",
                    system: "link",
                    enabled: true
                ) {
                    placeWidget(.connect)
                }
                .accessibilityIdentifier("fieldDeskAddConnect")

                addMenuRow(
                    title: "Intel",
                    subtitle: placedWidgets.contains(.intel) ? "Already on desk" : "Ask · transcript feed",
                    system: "sparkles",
                    enabled: true
                ) {
                    placeWidget(.intel)
                }
                .accessibilityIdentifier("fieldDeskAddWakeJesse")

                if placedWidgets.contains(.memo) {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Type a memo…", text: $memoDraft)
                            .textFieldStyle(.roundedBorder)
                            .accessibilityIdentifier("fieldDeskMemoField")
                        Button {
                            submitMemo()
                            showAddPanel = false
                        } label: {
                            Text("Save memo")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(fdHex: "0c1207"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 11)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(fdHex: "c4f547")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("fieldDeskSaveMemo")
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(fdHex: "efe9e0"))
                    )
                }

                Text("FILE")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(0.8)
                    .foregroundColor(Color(fdHex: "8a8478"))
                    .padding(.top, 4)

                addMenuRow(
                    title: "Add to Binder",
                    subtitle: "File a note, PDF, or photo",
                    system: "tray.and.arrow.down.fill",
                    enabled: true
                ) {
                    withAnimation(.easeInOut(duration: 0.2)) {
                        showAddToBinderForm.toggle()
                    }
                }
                .accessibilityIdentifier("fieldDeskAddToBinder")

                if showAddToBinderForm {
                    VStack(alignment: .leading, spacing: 8) {
                        TextField("Title", text: $manualTitle)
                            .textFieldStyle(.roundedBorder)
                            .accessibilityIdentifier("fieldDeskManualTitle")
                        TextField("Course", text: $manualCourse)
                            .textFieldStyle(.roundedBorder)
                            .accessibilityIdentifier("fieldDeskManualCourse")
                        TextField("Note (optional)", text: $manualBody)
                            .textFieldStyle(.roundedBorder)
                        Button {
                            UIApplication.shared.sendAction(
                                #selector(UIResponder.resignFirstResponder),
                                to: nil, from: nil, for: nil
                            )
                            let title = manualTitle.trimmingCharacters(in: .whitespacesAndNewlines)
                            guard !title.isEmpty else { flash("Add a title first"); return }
                            store.addManualNote(
                                title: title,
                                course: manualCourse.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                                    ? "Inbox" : manualCourse,
                                body: manualBody
                            )
                            binderOpen = true
                            showBinderPanel = true
                            focusedCard = .binder
                            showAddPanel = false
                            showAddToBinderForm = false
                            manualTitle = ""; manualBody = ""
                            flash("Filed · \(title)")
                        } label: {
                            Text("File to Binder")
                                .font(.system(size: 15, weight: .bold, design: .rounded))
                                .foregroundColor(Color(fdHex: "0c1207"))
                                .frame(maxWidth: .infinity)
                                .padding(.vertical, 11)
                                .background(RoundedRectangle(cornerRadius: 12).fill(Color(fdHex: "c4f547")))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("fieldDeskFileNote")

                        HStack(spacing: 12) {
                            Button("Choose file…") { showImporter = true }
                            PhotosPicker(selection: $photoItem, matching: .images) {
                                Text("Choose photo…")
                            }
                        }
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                    }
                    .padding(12)
                    .background(
                        RoundedRectangle(cornerRadius: 12)
                            .fill(Color(fdHex: "efe9e0"))
                    )
                }

                addMenuRow(
                    title: "Blank page",
                    subtitle: "Scribble · lifts become notes / LaTeX",
                    system: "doc.plaintext.fill",
                    enabled: true
                ) {
                    showAddPanel = false
                    showBlankPage = true
                }
                .accessibilityIdentifier("fieldDeskAddBlankPage")

                addMenuRow(
                    title: "Find a tutor",
                    subtitle: "Map · tutors near you",
                    system: "person.crop.circle.badge.questionmark",
                    enabled: true
                ) {
                    showAddPanel = false
                    showFindTutor = true
                }
                .accessibilityIdentifier("fieldDeskAddFindTutor")
            }
            .padding(20)
        }
        .frame(maxHeight: 560)
        .background(
            RoundedRectangle(cornerRadius: 16)
                .fill(Color(fdHex: "fbf8f3"))
                .shadow(color: .black.opacity(0.45), radius: 28, y: 14)
        )
    }

    private func addMenuRow(
        title: String,
        subtitle: String,
        system: String,
        enabled: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack(spacing: 12) {
                Image(systemName: system)
                    .font(.system(size: 16, weight: .semibold))
                    .foregroundColor(enabled ? Color(fdHex: "0c1207") : Color(fdHex: "8a8478").opacity(0.55))
                    .frame(width: 36, height: 36)
                    .background(
                        RoundedRectangle(cornerRadius: 10)
                            .fill(enabled ? Color(fdHex: "c4f547") : Color(fdHex: "d9d2c5").opacity(0.55))
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 15, weight: .bold, design: .rounded))
                        .foregroundColor(enabled ? Color(fdHex: "1c1a17") : Color(fdHex: "8a8478"))
                    Text(subtitle)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(fdHex: "8a8478"))
                }
                Spacer(minLength: 0)
                if enabled {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundColor(Color(fdHex: "8a8478"))
                }
            }
            .padding(10)
            .background(
                RoundedRectangle(cornerRadius: 12)
                    .fill(Color.white.opacity(enabled ? 0.85 : 0.4))
            )
            .opacity(enabled ? 1 : 0.55)
        }
        .buttonStyle(.plain)
        .disabled(!enabled)
    }

    private func toolSheet(_ tool: RailTool) -> some View {
        NavigationStack {
            Group {
                switch tool {
                case .mail:
                    // Legacy sheet path unused. Dock mail opens GmailWorkflowBoxView.
                    Text("Use the envelope icon for your Gmail box.")
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .padding(24)
                case .calendar:
                    VStack(alignment: .leading, spacing: 12) {
                        if store.events.isEmpty {
                            Text("No events this week yet.")
                                .font(.system(size: 15, weight: .semibold, design: .rounded))
                                .foregroundColor(Color(fdHex: "8a8478"))
                        } else {
                            ForEach(store.events) { ev in
                                Text("• \(ev.day) · \(ev.title)")
                                    .font(.system(size: 15, weight: .semibold, design: .rounded))
                            }
                        }
                        Button {
                            Task { await refreshDeskCalendar(); activeTool = nil }
                        } label: { guidePrimary("Refresh calendar") }
                        .buttonStyle(.plain)
                        Spacer()
                    }.padding(24)
                case .record:
                    DeskRecordSheet(store: store) {
                        activeTool = nil
                        binderOpen = true
                        flash("Transcript filed")
                    }
                case .search:
                    Text("• Search binder + intel next\n• Ask bar feeds intel")
                        .font(.system(size: 16, weight: .medium, design: .rounded))
                        .padding(24)
                }
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(tool == .mail ? Color(fdHex: "0a0a0a") : Color(fdHex: "f7f3ee"))
            .navigationTitle(tool == .mail ? "Mail" : tool.rawValue.capitalized)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { activeTool = nil }
                }
            }
        }
        .presentationDetents(tool == .mail ? [.large] : [.medium, .large])
    }

    private func submitDeskAsk() {
        let t = askText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !t.isEmpty, !askBusy else { return }
        askText = ""
        askBusy = true
        // Keep the question on intel so the desk trail stays visible.
        store.prependIntel("Ask · \(t)")

        var connected = Array(store.connectAt.keys)
        GmailClient.shared.refreshScopeStatus()
        if GmailClient.shared.hasGmailScope, !connected.contains("gmail") { connected.append("gmail") }
        if GmailClient.shared.hasCalendarScope, !connected.contains("gcal") { connected.append("gcal") }

        let context = DeskAskClient.DeskContext(
            intelLines: Array(store.intelLines.prefix(12)),
            binderItems: store.items.prefix(20).map {
                DeskAskClient.BinderItem(title: $0.title, course: $0.course)
            },
            calendarEvents: store.events.prefix(10).map {
                DeskAskClient.CalendarEvent(day: $0.day, title: $0.title)
            },
            connected: connected,
            openSurface: showGmailBox ? "gmail" : (showApplyToday ? "applyToday" : "desk")
        )

        Task { @MainActor in
            let result = await DeskAskClient.ask(message: t, context: context)
                ?? DeskAskClient.localFallback(message: t, context: context)
            applyDeskAskResult(result)
            askBusy = false
        }
    }

    private func applyDeskAskResult(_ result: DeskAskClient.Result) {
        if !result.reply.isEmpty {
            flash(result.reply)
        }
        for action in result.actions {
            switch action.type {
            case "open_gmail":
                gmailOpenTopReply = false
                showGmailBox = true
            case "open_gmail_top_reply":
                gmailOpenTopReply = true
                showGmailBox = true
            case "open_apply":
                showApplyToday = true
            case "open_connect":
                focusedCard = .connect
                if let first = FieldDeskStore.connectors.first(where: { !store.isConnected($0.id) }) {
                    activeGuideId = first.id
                } else {
                    activeGuideId = "gmail"
                }
            case "refresh_calendar":
                Task { await refreshDeskCalendar() }
            case "prepend_intel":
                if let line = action.payload?.trimmingCharacters(in: .whitespacesAndNewlines), !line.isEmpty {
                    store.prependIntel(line)
                }
            default:
                break
            }
        }
    }

    private func flash(_ message: String) {
        toast = message
        DispatchQueue.main.asyncAfter(deadline: .now() + 2.2) {
            if toast == message { toast = nil }
        }
    }

    private func wireUITesting() {
        let args = ProcessInfo.processInfo.arguments
        if args.contains("--ui-testing-field-desk-gmail") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.8) { activeGuideId = "gmail" }
            DispatchQueue.main.asyncAfter(deadline: .now() + 5.5) {
                store.loadSampleMail()
                activeGuideId = nil
                toast = "Mail · sample inbox loaded"
                DispatchQueue.main.asyncAfter(deadline: .now() + 12) {
                    if toast == "Mail · sample inbox loaded" { toast = nil }
                }
            }
        }
        if args.contains("--ui-testing-field-desk-add") {
            DispatchQueue.main.asyncAfter(deadline: .now() + 8.0) { showAddPanel = true }
        }
    }
}

private extension Color {
    init(fdHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}

struct FieldDeskFilename: Transferable {
    let value: String
    static var transferRepresentation: some TransferRepresentation {
        ProxyRepresentation { (url: URL) in
            FieldDeskFilename(value: url.lastPathComponent)
        }
    }
}
