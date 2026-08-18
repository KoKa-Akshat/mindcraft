import SwiftUI

/// One line of the agent takeover's Binder mail list - structured (not a
/// pre-joined string) so it can render through `DeskContentRow` like every
/// other tile row instead of looking like a raw text dump.
private struct AgentMailLine: Identifiable {
    let id = UUID()
    let from: String
    let subject: String
}

/// Work canvas from Presentation Screen.pdf pages 4–5.
/// Tiles sit on a measured 1440×810 artboard (scaled to the iPad).
/// Page 4 = five photo cards + one dock. Page 5 = tiles shrink left, right rail opens.
/// Dock fill is Binder · Calendar · Memo · Gmail · Flows · search — not Ask AI.
struct DeskGridDashboardView: View {
    enum Rail: String {
        case none
        case memo
        case flows
    }

    var initialRail: Rail = .none
    var initialMemoText: String = ""
    var onOpenBinder: () -> Void = {}
    var onClose: () -> Void = {}
    var onOpenCalendar: () -> Void = {}
    var onOpenGmail: () -> Void = {}
    var onOpenIntel: () -> Void = {}
    var onOpenHomeworkHelp: () -> Void = {}
    var onOpenCreate: (CreateCanvasKind) -> Void = { _ in }
    var onOpenFlow: (String) -> Void = { _ in }
    var onSaveMemo: (String) -> Void = { _ in }
    var onTranscribe: () -> Void = {}
    var intelHasData: Bool = false
    var binderHasData: Bool = false
    var onGmailLinked: (_ calendarToo: Bool) -> Void = { _ in }
    var onMoodleLinked: () -> Void = {}
    var onMoodleDisconnected: () -> Void = {}
    var intelLines: [String] = []
    /// Titles from `BinderStore`, not `FieldDeskStore.FiledItem`.
    var binderTitles: [String] = []
    var onSyncCalendar: () -> Void = {}
    var onOpenLearnStudio: () -> Void = {}

    @ObservedObject private var gmail = GmailClient.shared
    @ObservedObject private var moodle = MoodleClient.shared
    @ObservedObject private var digest = GmailDigestClient.shared
    @ObservedObject private var digestStore = GmailDigestStore.shared
    @ObservedObject private var boxBus = DeskBoxBus.shared
    @ObservedObject private var aiKeys = StudentAIKeyStore.shared
    @State private var showMoodleSheet = false

    // MARK: - Agent takeover (any real ask, not just the email/draft case)
    // Any request longer than a quick nav keyword borrows Binder and/or
    // Intel in place instead of spawning a new floating box - Akshat's
    // explicit spec after the search-triggered Gmail box felt disconnected
    // from the dashboard's own tile grid ("this mechanism of using screen +
    // 1 box is great... make this happen across any and all request").
    // Two content shapes share the same on/off switch:
    //  - the email/draft case (agentEmail/agentDraftText/...) - richer,
    //    uses the student's own AI key for a real drafted reply, not just
    //    whatever the shared backend says.
    //  - everything else (agentBinderLines/agentReplyText) - a plain
    //    Desk Ask round trip (same agent Jesse's Kitchen's own Ask bar
    //    calls), shown as short lines in Binder and the reply text in
    //    Intel. A handful of asks (Apply Today, a full connect flow, a
    //    specific concept's Field Book) still open their own existing
    //    screen instead of a tile - the "screen + 1 box" model's one-box
    //    allowance, routed through the same callbacks already passed in
    //    from FieldDeskView rather than a new floating overlay.
    // Done (top-right) reverts every tile to its normal content; nothing
    // here persists past that.
    @State private var agentTakeoverActive = false
    @State private var agentEmail: GmailClient.Message?
    @State private var agentDraftText = ""
    @State private var agentDraftBusy = false
    @State private var agentDraftError: String?
    @State private var agentSending = false
    @State private var agentBinderLines: [AgentMailLine]?
    @State private var agentReplyText: String?
    /// Separate from `agentDraftBusy` - that one also gates Binder's
    /// spinner (it fetches the email first), but a general ask only ever
    /// affects Intel, so reusing it would flash Binder's spinner then
    /// silently drop it for every non-email request.
    @State private var agentAskBusy = false

    @State private var rail: Rail
    @State private var memoDraft: String
    @State private var memoSaved = true
    @State private var searchQuery = ""
    @State private var flowsSearchQuery = ""
    @State private var binderPulled = false
    @State private var spacePan: CGSize = .zero
    @State private var spaceZoom: CGFloat = 1
    @GestureState private var livePan: CGSize = .zero
    @GestureState private var liveZoom: CGFloat = 1

    private let artboard = CGSize(width: 1440, height: 810)

    init(
        initialRail: Rail = .none,
        initialMemoText: String = "",
        onOpenBinder: @escaping () -> Void = {},
        onClose: @escaping () -> Void = {},
        onOpenCalendar: @escaping () -> Void = {},
        onOpenGmail: @escaping () -> Void = {},
        onOpenIntel: @escaping () -> Void = {},
        onOpenHomeworkHelp: @escaping () -> Void = {},
        onOpenCreate: @escaping (CreateCanvasKind) -> Void = { _ in },
        onOpenFlow: @escaping (String) -> Void = { _ in },
        onSaveMemo: @escaping (String) -> Void = { _ in },
        onTranscribe: @escaping () -> Void = {},
        intelHasData: Bool = false,
        binderHasData: Bool = false,
        onGmailLinked: @escaping (_ calendarToo: Bool) -> Void = { _ in },
        onMoodleLinked: @escaping () -> Void = {},
        onMoodleDisconnected: @escaping () -> Void = {},
        intelLines: [String] = [],
        binderTitles: [String] = [],
        onSyncCalendar: @escaping () -> Void = {},
        onOpenLearnStudio: @escaping () -> Void = {}
    ) {
        self.initialRail = initialRail
        self.initialMemoText = initialMemoText
        self.onOpenBinder = onOpenBinder
        self.onClose = onClose
        self.onOpenCalendar = onOpenCalendar
        self.onOpenGmail = onOpenGmail
        self.onOpenIntel = onOpenIntel
        self.onOpenHomeworkHelp = onOpenHomeworkHelp
        self.onOpenCreate = onOpenCreate
        self.onOpenFlow = onOpenFlow
        self.onSaveMemo = onSaveMemo
        self.onTranscribe = onTranscribe
        self.intelHasData = intelHasData
        self.binderHasData = binderHasData
        self.onGmailLinked = onGmailLinked
        self.onMoodleLinked = onMoodleLinked
        self.onMoodleDisconnected = onMoodleDisconnected
        self.intelLines = intelLines
        self.binderTitles = binderTitles
        self.onSyncCalendar = onSyncCalendar
        self.onOpenLearnStudio = onOpenLearnStudio
        _rail = State(initialValue: initialRail)
        _memoDraft = State(initialValue: initialMemoText)
    }

    private var expanded: Bool { rail != .none }

    /// Drag empty cream to pan; pinch to move through the board in space.
    /// Tiles still win taps (minimumDistance keeps a tap from becoming a pan).
    private var spaceGesture: some Gesture {
        let drag = DragGesture(minimumDistance: 12)
            .updating($livePan) { value, state, _ in state = value.translation }
            .onEnded { value in
                spacePan.width += value.translation.width
                spacePan.height += value.translation.height
            }
        let pinch = MagnificationGesture()
            .updating($liveZoom) { value, state, _ in state = value }
            .onEnded { value in
                spaceZoom = min(2.6, max(0.65, spaceZoom * value))
            }
        return drag.simultaneously(with: pinch)
    }

    var body: some View {
        // GeometryReader is the root (same shape as CreateCanvasView).
        // Do not wrap it in an outer ZStack + Color sibling, and do not
        // center the board with .position() — that pair was laying the
        // 1440×810 artboard out at ~half width on iPad (Email / Gcal
        // off-screen, FieldDeskView's 050a08 bleeding through on the
        // right) even when geo.size reported the full 1180×820.
        // One explicit ZStack child only. Tiles may .position() inside
        // the hard-framed board; the board itself must not.
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            ZStack {
                Color(gridHex: "fff8e9").ignoresSafeArea()
                tileBoard(scale: scale, board: board)
                    .scaleEffect(spaceZoom * liveZoom)
                    .offset(x: spacePan.width + livePan.width, y: spacePan.height + livePan.height)
                // Same dimmed-background + centered-card popup family as
                // Intel/Binder/Homework Help - was a .sheet() with its own
                // NavigationStack/toolbar, visually inconsistent with the
                // rest of the boxes.
                if showMoodleSheet {
                    moodleOverlayLayer
                        .transition(.opacity)
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            .contentShape(Rectangle())
            .gesture(spaceGesture)
            .task { await syncConnectedBoxes() }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .onChange(of: intelLines) { _, lines in boxBus.intelLines = lines }
        .onChange(of: binderTitles) { _, titles in boxBus.binderTitles = titles }
        // No Exit control here anymore - moved into the Manage page
        // (logo tap) so the dashboard itself stays clean. onClose is still
        // wired from FieldDeskView but nothing on this screen calls it now.
        // Not a direct .accessibilityIdentifier() here either - same
        // clobbering bug as workDock, this time it would stomp every
        // nested tile/dock/rail identifier with "deskGridDashboard".
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "dashboard").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridDashboard")
                .allowsHitTesting(false)
        }
        // Pinned to the actual screen corner, not the pannable/zoomable
        // board coordinate space - Binder/Intel can be panned off-center,
        // but Done needs to stay reachable regardless.
        .overlay(alignment: .topTrailing) {
            if agentTakeoverActive {
                Button(action: closeAgentTakeover) {
                    Text("Done")
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(Color(gridHex: "143a2e"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(gridHex: "c4f547")))
                        .shadow(color: .black.opacity(0.18), radius: 10, y: 4)
                }
                .buttonStyle(.plain)
                .padding(.top, 16)
                .padding(.trailing, 16)
                .accessibilityIdentifier("deskGridAgentDone")
                .transition(.opacity)
            }
        }
    }

    private func tileBoard(scale: CGFloat, board: CGSize) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear
                .frame(width: board.width, height: board.height)
            DottedDeskGrid()
                .frame(width: board.width, height: board.height)
            pin(boxRect(.intel), scale: scale) {
                photoTile(.intel)
            }
            pin(boxRect(.moodle), scale: scale) {
                photoTile(.moodle)
            }
            pin(boxRect(.binder), scale: scale) {
                photoTile(.binder)
            }
            pin(boxRect(.homeworkHelp), scale: scale) {
                photoTile(.homeworkHelp)
            }
            pin(WorkArtboard.dock, scale: scale) { activeDock }
            if expanded {
                pin(rail == .memo ? WorkArtboard.memoRail : WorkArtboard.flowsRail, scale: scale) {
                    if rail == .memo { memoRail } else { flowsRail }
                }
            }
        }
        .frame(width: board.width, height: board.height, alignment: .topLeading)
        .animation(.spring(response: 0.42, dampingFraction: 0.86), value: boxBus.hungry)
    }

    /// Place a measured PDF box on the hard-framed board. `.position()` is
    /// safe here — same helper as CreateCanvasView. The half-width bug was
    /// applying `.position()` to the board itself inside GeometryReader.
    private func pin<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(width: box.width * scale, height: box.height * scale)
            .position(
                x: (box.minX + box.width / 2) * scale,
                y: (box.minY + box.height / 2) * scale
            )
    }

    // MARK: - Tiles

    private enum TileKind {
        case intel, moodle, binder, homeworkHelp, memo

        var title: String {
            switch self {
            case .intel: return "Intel"
            case .moodle: return "Moodle"
            case .binder: return "Binder"
            case .homeworkHelp: return "Homework Help"
            case .memo: return "Memo"
            }
        }

        /// Binder and the merged Intel box always show real content (each
        /// section has its own empty/connect state built in) - neither
        /// gets a mascot moment anymore. Homework Help has no commissioned
        /// art; SF Symbol fallback in `mascotArt` covers it. Moodle keeps
        /// its slug (identity for the accessibility marker + tap-to-connect
        /// hint) but its `desk_mascot_moodle_*` art assets were deleted -
        /// they were MindCraft's own generic raccoon mascot recolored, not
        /// real Moodle branding, and read as a mismatch (flagged, not
        /// fixed, in an earlier session; Akshat asked to remove it rather
        /// than keep shipping the wrong brand). `UIImage(named:)` now
        /// misses for moodle too, so it falls back to the same SF Symbol
        /// path as Homework Help (`graduationcap.fill` - already
        /// brand-neutral) until real art exists.
        var mascotSlug: String? {
            switch self {
            case .moodle: return "moodle"
            case .intel, .binder, .homeworkHelp, .memo: return nil
            }
        }

        func mascotAssetName(state: MascotPhase) -> String? {
            guard let mascotSlug else { return nil }
            return "desk_mascot_\(mascotSlug)_\(state.rawValue)"
        }

        var wash: [Color] {
            switch self {
            case .intel: return [Color(gridHex: "247a4d"), Color(gridHex: "143a2e")]
            case .moodle: return [Color(gridHex: "d7e4d4"), Color(gridHex: "b7c9b4")]
            case .binder: return [Color(gridHex: "f3efe4"), Color(gridHex: "e4dcc8")]
            case .homeworkHelp: return [Color(gridHex: "c4f547"), Color(gridHex: "7a9e2e")]
            case .memo: return [Color(gridHex: "fff8e9"), Color(gridHex: "efe6cf")]
            }
        }

        var symbol: String {
            switch self {
            case .intel: return "sparkles"
            case .moodle: return "graduationcap.fill"
            case .binder: return "person.crop.circle.fill"
            case .homeworkHelp: return "lightbulb.fill"
            case .memo: return "note.text"
            }
        }

        func blurb(phase: MascotPhase, assignmentCount: Int) -> String {
            switch self {
            case .moodle:
                if phase == .working { return "Talking to Moodle…" }
                if phase == .awake {
                    return assignmentCount == 0
                        ? "Connected. No assignments in view yet."
                        : "\(assignmentCount) assignment\(assignmentCount == 1 ? "" : "s") from Moodle."
                }
                return "Tap the sleeping mascot to connect."
            case .intel:
                return phase == .sleeping
                    ? "Connect Gmail, Calendar, or Moodle to fill this in."
                    : "Email, calendar, and what Jesse's pulled this week."
            case .binder:
                return phase == .sleeping
                    ? "Empty until Jesse files something here."
                    : "Memo, docs, and your own books."
            case .homeworkHelp:
                return "Paste a problem, upload a page, or write it out."
            case .memo:
                return "Pin a note on the right rail."
            }
        }
    }

    /// Real paper-cut illustrated stills (`desk_mascot_<slug>_<state>` in
    /// Assets.xcassets) replace the earlier procedurally-drawn creature -
    /// same three-state model, same five box identities, just image-backed
    /// with an SF Symbol fallback if an asset is ever missing.
    private enum MascotPhase: String {
        case sleeping
        case working
        case awake
    }

    private func photoTile(_ kind: TileKind) -> some View {
        let phase = mascotPhase(kind)
        let awake = phase != .sleeping
        return VStack(alignment: .leading, spacing: 6) {
            Text(kind.title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
            Button {
                handleTile(kind)
            } label: {
                ZStack {
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .fill(LinearGradient(colors: kind.wash, startPoint: .topLeading, endPoint: .bottomTrailing))
                    // Grown + real data: rows replace the mascot. Sleeping /
                    // working / not-yet-grown keep the mascot (Assignment B).
                    // Binder is a filing system, not a connector - it never
                    // gets a mascot/icon moment once it has real items,
                    // always just its own neat rows (`tileBody`) below.
                    if kind.mascotSlug != nil, !tileIsGrown(kind) {
                        mascotArt(kind, phase: phase)
                        .scaleEffect(tileShowsContent(kind) ? 0.55 : 1)
                        .offset(
                            x: tileShowsContent(kind) ? 48 : 0,
                            y: tileShowsContent(kind) ? -28 : -8
                        )
                    } else if kind.mascotSlug == nil, kind != .intel, !(kind == .binder && tileShowsContent(kind)) {
                        Image(systemName: kind.symbol)
                            .font(.system(size: kind == .binder ? 54 : 36, weight: .medium))
                            .foregroundColor(.white.opacity(awake ? 0.88 : 0.35))
                            .offset(y: kind == .binder && binderPulled ? 18 : 0)
                    }
                    VStack(alignment: .leading, spacing: 6) {
                        if !tileIsGrown(kind) { Spacer(minLength: 0) }
                        tileBody(kind, phase: phase)
                        if tileIsGrown(kind) { Spacer(minLength: 0) }
                    }
                    .padding(10)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
                .shadow(color: .black.opacity(0.14), radius: 12, y: 6)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder(awake ? Color.clear : Color(gridHex: "143a2e").opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("deskGridTile_\(kind.title)")
        }
    }

    private func mascotPhase(_ kind: TileKind) -> MascotPhase {
        switch kind {
        case .moodle:
            if moodle.isBusy { return .working }
            return moodle.isConnected ? .awake : .sleeping
        case .intel:
            // Merged box: awake once Intel's own research, Gmail, or
            // Calendar has anything to show.
            if gmail.isBusy { return .working }
            return (intelHasData || gmail.hasGmailScope || gmail.hasCalendarScope) ? .awake : .sleeping
        case .binder:
            return binderHasData ? .awake : .sleeping
        case .homeworkHelp, .memo:
            return .awake
        }
    }

    /// Identifier lives on a nested marker, not the root image - same
    /// clobber family as `DeskGridDashboardView`'s dock (see CLAUDE.md):
    /// a parent's `.accessibilityIdentifier` stomps a plain child's own id.
    @ViewBuilder
    private func mascotArt(_ kind: TileKind, phase: MascotPhase) -> some View {
        let content = mascotContent(kind, phase: phase)
        if mascotTappable(kind) {
            Button(action: { connectMascot(kind) }) { content }
                .buttonStyle(.plain)
                .accessibilityHint("Connect this box")
        } else {
            content
        }
    }

    /// Plain (non-`@ViewBuilder`) function - it just returns whichever
    /// content applies, so an ordinary `if/else` with `return` works
    /// without `@ViewBuilder` trying to treat the branches themselves as
    /// view-producing statements.
    private func mascotContent(_ kind: TileKind, phase: MascotPhase) -> AnyView {
        if let assetName = kind.mascotAssetName(state: phase), let image = UIImage(named: assetName) {
            return AnyView(
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: .fit)
                    .overlay(alignment: .topLeading) {
                        Text(verbatim: "mascot-\(kind.mascotSlug ?? "")")
                            .font(.system(size: 1))
                            .foregroundColor(.clear)
                            .accessibilityIdentifier("deskGridMascot_\(kind.mascotSlug ?? "")")
                            .allowsHitTesting(false)
                    }
                    .accessibilityLabel("\(kind.title) mascot, \(phase.rawValue)")
                    .accessibilityAddTraits(.isImage)
            )
        }
        // No commissioned art for this tile (Homework Help never had any;
        // Moodle's raccoon illustration was pulled - it was MindCraft's own
        // generic mascot recolored, not actual Moodle branding, and read as
        // a mismatch). SF Symbol fallback, same treatment either way.
        return AnyView(
            Image(systemName: kind.symbol)
                .font(.system(size: kind == .binder ? 54 : 36, weight: .medium))
                .foregroundColor(.white.opacity(phase != .sleeping ? 0.88 : 0.35))
                .overlay(alignment: .topLeading) {
                    Text(verbatim: "mascot-\(kind.mascotSlug ?? "")")
                        .font(.system(size: 1))
                        .foregroundColor(.clear)
                        .accessibilityIdentifier("deskGridMascot_\(kind.mascotSlug ?? "")")
                        .allowsHitTesting(false)
                }
                .accessibilityLabel("\(kind.title) mascot, \(phase.rawValue)")
        )
    }

    private func mascotTappable(_ kind: TileKind) -> Bool {
        switch kind {
        case .moodle: return !moodle.isConnected
        default: return false
        }
    }

    private func connectMascot(_ kind: TileKind) {
        // Only Moodle's mascot is tap-to-connect now (`mascotTappable`
        // gates this) - Gmail/Calendar connect from inside Intel's popup,
        // since one mascot tap can no longer mean "connect the one thing
        // this box is for" once Intel covers three sources at once.
        if kind == .moodle {
            showMoodleSheet = true
        }
    }

    private var moodleOverlayLayer: some View {
        MoodleBoxSheet(
            client: moodle,
            onLinked: onMoodleLinked,
            onDisconnected: onMoodleDisconnected,
            onClose: { showMoodleSheet = false }
        )
    }

    /// The search field had no wired behavior at all - typing did nothing,
    /// submitting did nothing (reported explicitly). Short static keywords
    /// still jump straight to the matching destination (fast, no network),
    /// same as the dock chips and tiles. Anything else - a real
    /// natural-language ask - goes to `startAgentTakeover`, which borrows
    /// Binder/Intel (or one of the existing full-screen flows for the
    /// handful of asks that genuinely need their own screen) instead of
    /// silently doing nothing just because it isn't one of the ~6
    /// recognized keywords.
    private func submitSearch() {
        let raw = searchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let query = raw.lowercased()
        defer { searchQuery = "" }
        guard !query.isEmpty else { return }
        // A short 1-3 word query ("gmail", "open calendar") is almost
        // always someone naming a destination - keep that instant, no
        // network round trip. Anything longer is a real instruction
        // ("open my recent email and draft a response") - a single-keyword
        // match on a long sentence would silently drop everything after
        // the matched word (e.g. routing straight to onOpenGmail() and
        // never acting on "and draft a response").
        guard raw.split(separator: " ").count <= 3 else {
            startAgentTakeover(raw)
            return
        }
        if query.contains("binder") || query.contains("act field book") {
            handleTile(.binder)
        } else if query.contains("calendar") || query.contains("gcal") {
            onOpenCalendar()
        } else if query.contains("gmail") || query.contains("email") {
            onOpenGmail()
        } else if query.contains("homework") {
            handleTile(.homeworkHelp)
        } else if query.contains("memo") {
            setRail(rail == .memo ? .none : .memo)
        } else if query.contains("flows") || query.contains("presentation") || query.contains("gdoc")
            || query.contains("resume") || query.contains("archive") || query.contains("book") || query.contains("apply") {
            setRail(rail == .flows ? .none : .flows)
        } else {
            startAgentTakeover(raw)
        }
    }

    /// Flows-only search - already inside the rail, so a match opens the
    /// flow directly instead of just toggling the rail (which is already open).
    private func submitFlowsSearch() {
        let raw = flowsSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        let query = raw.lowercased()
        defer { flowsSearchQuery = "" }
        guard !query.isEmpty else { return }
        guard raw.split(separator: " ").count <= 3 else {
            startAgentTakeover(raw)
            return
        }
        if query.contains("presentation") || query.contains("slide") {
            onOpenCreate(.presentation)
        } else if query.contains("gdoc") || query.contains("doc") {
            onOpenCreate(.gdoc)
        } else if query.contains("resume") {
            onOpenFlow("resume")
        } else if query.contains("archive") {
            onOpenFlow("archive")
        } else if query.contains("book") {
            onOpenFlow("book")
        } else if query.contains("apply") || query.contains("job") {
            onOpenFlow("apply")
        } else {
            startAgentTakeover(raw)
        }
    }

    private func isEmailDraftRequest(_ query: String) -> Bool {
        let mailWords = ["email", "mail", "inbox"]
        let draftWords = ["draft", "reply", "response", "respond", "write"]
        return mailWords.contains(where: query.contains) && draftWords.contains(where: query.contains)
    }

    /// Fetches the most recent email and a real AI-drafted reply (the
    /// student's own connected key - `GmailClient.suggestedReply` was only
    /// ever a hardcoded template, never a real answer), then shows the
    /// email in Binder and the draft in Intel in place of their normal
    /// content until `closeAgentTakeover()`.
    private func startEmailDraftTakeover() {
        withAnimation(.easeInOut(duration: 0.2)) {
            agentTakeoverActive = true
        }
        resetAgentTakeoverFields()
        agentDraftBusy = true
        Task {
            gmail.refreshScopeStatus()
            guard gmail.hasGmailScope else {
                agentDraftError = "Connect Gmail first - Search \u{201C}gmail\u{201D} or open it from Intel."
                agentDraftBusy = false
                return
            }
            if gmail.messages.isEmpty {
                await gmail.fetchInbox()
            }
            guard let top = gmail.messages.first else {
                agentDraftError = "No recent email found."
                agentDraftBusy = false
                return
            }
            agentEmail = top
            guard aiKeys.hasKey else {
                agentDraftError = "Connect your AI key to draft a real reply, not a template."
                agentDraftBusy = false
                return
            }
            switch await aiKeys.draftEmailReply(from: top.from, subject: top.subject, snippet: top.snippet) {
            case .success(let text):
                agentDraftText = text
            case .failure(.rejected), .failure(.noKey):
                agentDraftError = "That AI key was rejected. Open Settings to update it."
            case .failure(.unavailable):
                agentDraftError = "Couldn\u{2019}t draft a reply - try again in a bit."
            }
            agentDraftBusy = false
        }
    }

    private func closeAgentTakeover() {
        withAnimation(.easeInOut(duration: 0.2)) {
            agentTakeoverActive = false
        }
        resetAgentTakeoverFields()
    }

    private func sendAgentDraft() async {
        guard let email = agentEmail else { return }
        let body = agentDraftText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !body.isEmpty else { return }
        agentSending = true
        let ok = await gmail.sendReply(to: email, body: body)
        agentSending = false
        if ok {
            closeAgentTakeover()
        }
    }

    /// Clears every field either takeover flow writes to. Both entry points
    /// call this first - a second request while a first was still showing
    /// (a real reported bug: a fresh general ask left the previous draft's
    /// stale `agentDraftText` non-empty, so `agentIntelTakeoverView`'s
    /// `isDraftFlow` check stayed true and kept showing the OLD draft
    /// instead of the new answer) must never inherit anything from
    /// whatever ran before it.
    private func resetAgentTakeoverFields() {
        agentEmail = nil
        agentDraftText = ""
        agentDraftError = nil
        agentDraftBusy = false
        agentAskBusy = false
        agentSending = false
        agentBinderLines = nil
        agentReplyText = nil
    }

    /// General entry point for any ask that isn't a quick nav keyword.
    /// The email/draft case gets the richer, dedicated flow above. A
    /// question with the student's own AI key connected gets answered
    /// directly from real on-device context (their actual recent mail/
    /// calendar/binder, not a canned string) - the shared backend
    /// (`DeskAskClient`) is only the fallback when no key is connected,
    /// since it can silently degrade to a generic template whenever its
    /// own LLM call fails (confirmed: the endpoint itself is reachable -
    /// a bare unauthenticated POST returns 401, not a network error - so a
    /// literal "Opening your Gmail box." reply is the hardcoded fallback
    /// string, not a real answer that happened to be short).
    private func startAgentTakeover(_ text: String) {
        let lower = text.lowercased()
        if isEmailDraftRequest(lower) {
            startEmailDraftTakeover()
            return
        }
        // Apply Today is its own board, not tile content - check before
        // spending an AI call on it.
        if lower.contains("apply") || lower.contains("job") {
            onOpenFlow("apply")
            return
        }
        withAnimation(.easeInOut(duration: 0.2)) {
            agentTakeoverActive = true
        }
        resetAgentTakeoverFields()
        agentAskBusy = true
        let mentionsMail = ["email", "mail", "inbox"].contains(where: lower.contains)
        if mentionsMail, !gmail.messages.isEmpty {
            agentBinderLines = gmail.messages.prefix(5).map { AgentMailLine(from: $0.from, subject: $0.subject) }
        }
        Task {
            if aiKeys.hasKey {
                let context = buildAskContextText()
                switch await aiKeys.answerDeskQuestion(question: text, context: context) {
                case .success(let answer):
                    agentReplyText = answer
                case .failure(.rejected), .failure(.noKey):
                    agentReplyText = "That AI key was rejected. Open Settings to update it."
                case .failure(.unavailable):
                    agentReplyText = "Couldn\u{2019}t get an answer - try again in a bit."
                }
            } else {
                let context = buildDeskAskContext()
                let result = await DeskAskClient.ask(message: text, context: context)
                    ?? DeskAskClient.localFallback(message: text, context: context)
                applyGeneralAgentResult(result)
            }
            agentAskBusy = false
        }
    }

    /// Plain-text context for the student's own key (`StudentAIKeyStore`) -
    /// real recent mail/calendar/binder content, not just titles, so a
    /// question like "tell me more about this recurring email" is actually
    /// answerable instead of only ever producing a canned navigation reply.
    private func buildAskContextText() -> String {
        var parts: [String] = []
        if !intelLines.isEmpty {
            parts.append("Recent activity:\n" + intelLines.prefix(12).map { "- \($0)" }.joined(separator: "\n"))
        }
        if !gmail.messages.isEmpty {
            let mail = gmail.messages.prefix(10)
                .map { "- From \($0.from): \"\($0.subject)\" - \($0.snippet)" }
                .joined(separator: "\n")
            parts.append("Recent emails:\n\(mail)")
        }
        if !gmail.week.isEmpty {
            let cal = gmail.week.prefix(10).map { "- \($0.day): \($0.title)" }.joined(separator: "\n")
            parts.append("This week's calendar:\n\(cal)")
        }
        if !binderTitles.isEmpty {
            parts.append("Binder items:\n" + binderTitles.prefix(20).map { "- \($0)" }.joined(separator: "\n"))
        }
        return parts.isEmpty ? "No connected data yet." : parts.joined(separator: "\n\n")
    }

    private func buildDeskAskContext() -> DeskAskClient.DeskContext {
        var connected: [String] = []
        if gmail.hasGmailScope { connected.append("gmail") }
        if gmail.hasCalendarScope { connected.append("gcal") }
        if moodle.isConnected { connected.append("moodle") }
        return DeskAskClient.DeskContext(
            intelLines: Array(intelLines.prefix(12)),
            binderItems: binderTitles.prefix(20).map { DeskAskClient.BinderItem(title: $0, course: "") },
            calendarEvents: gmail.week.prefix(10).map { DeskAskClient.CalendarEvent(day: $0.day, title: $0.title) },
            connected: connected,
            openSurface: "dashboard"
        )
    }

    /// Maps a Desk Ask result onto Binder/Intel where the content is
    /// short enough to belong in a tile. A few action types are inherently
    /// full-screen (Apply Today's board, a connect flow, a specific
    /// concept's Field Book) - those close the takeover and use the same
    /// existing callback FieldDeskView already wired in for that surface,
    /// rather than squeezing something that doesn't fit into a tile.
    private func applyGeneralAgentResult(_ result: DeskAskClient.Result) {
        for action in result.actions {
            switch action.type {
            case "open_gmail_top_reply":
                startEmailDraftTakeover()
                return
            case "open_gmail":
                agentBinderLines = gmail.messages.prefix(5).map { AgentMailLine(from: $0.from, subject: $0.subject) }
            case "refresh_calendar":
                onSyncCalendar()
            case "open_apply":
                closeAgentTakeover()
                onOpenFlow("apply")
                return
            case "open_connect":
                closeAgentTakeover()
                onOpenIntel()
                return
            case "study_concept":
                closeAgentTakeover()
                onOpenBinder()
                return
            default:
                break
            }
        }
        agentReplyText = result.reply.isEmpty ? "Done." : result.reply
    }

    /// Binder is the only tile that still grows-in-place on first tap
    /// (`DeskBoxBus.requestSpace`, borrowing height from neighbors) - Intel/
    /// Moodle/Homework Help each already have a fixed, generous slot (Intel
    /// doubled in size absorbing Email/Gcal) and open their destination
    /// directly on tap instead.
    private func handleTile(_ kind: TileKind) {
        if kind == .binder {
            let box = boxID(kind)
            if tileShowsContent(kind), boxBus.hungry != box {
                boxBus.requestSpace(for: box)
                return
            }
        }
        switch kind {
        case .binder:
            withAnimation(.spring(response: 0.42, dampingFraction: 0.78)) { binderPulled = true }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.28) { onOpenBinder() }
        case .intel:
            onOpenIntel()
        case .moodle:
            showMoodleSheet = true
        case .homeworkHelp:
            onOpenHomeworkHelp()
        case .memo:
            setRail(rail == .memo ? .none : .memo)
        }
    }

    /// Only Binder participates in `DeskBoxBus`'s grow/shrink negotiation -
    /// the rest map to `.jesse`, the bus's existing "doesn't grow" sentinel
    /// (same treatment `.memo` already had).
    private func boxID(_ kind: TileKind) -> DeskBoxBus.Box {
        switch kind {
        case .binder: return .binder
        case .intel, .moodle, .homeworkHelp, .memo: return .jesse
        }
    }

    private func tileIsGrown(_ kind: TileKind) -> Bool {
        tileShowsContent(kind) && boxBus.hungry == boxID(kind)
    }

    private func tileShowsContent(_ kind: TileKind) -> Bool {
        switch kind {
        case .moodle:
            return moodle.isConnected && (!moodle.assignments.isEmpty || !moodle.grades.isEmpty)
        case .intel:
            let hasEmail = gmail.hasGmailScope && (shownDigest != nil || !gmail.messages.isEmpty)
            let hasCalendar = gmail.hasCalendarScope && !gmail.week.isEmpty
            return !intelLines.isEmpty || hasEmail || hasCalendar
        case .binder:
            return !binderTitles.isEmpty
        case .homeworkHelp, .memo:
            return false
        }
    }

    private var shownDigest: GmailDigestClient.Digest? {
        if let d = digest.digest { return d }
        guard let rec = digestStore.history.first else { return nil }
        return GmailDigestClient.Digest(
            headline: rec.headline,
            actionItems: rec.actionItems,
            fyi: rec.fyi,
            fallback: false
        )
    }

    private var tileInk: Color { Color(gridHex: "143a2e") }

    @ViewBuilder
    private func tileBody(_ kind: TileKind, phase: MascotPhase) -> some View {
        let ink: Color = (kind == .binder || kind == .moodle) ? tileInk : .white
        // Binder only takes over when there's actually binder-shaped
        // content (an email or a list of lines) to show - a reply-only ask
        // ("what's my next assignment") shouldn't blank out Binder's real
        // titles just because Intel is showing an answer.
        if agentTakeoverActive && kind == .binder && (agentEmail != nil || agentDraftBusy || agentBinderLines != nil) {
            AnyView(agentBinderTakeoverView(ink: ink))
        } else if agentTakeoverActive && kind == .intel {
            AnyView(agentIntelTakeoverView())
        } else if kind == .intel {
            // Merged box: three labeled sub-sections, not one flat list -
            // each of Email/Calendar/Research keeps its own visible space.
            ScrollView(showsIndicators: false) {
                intelSections(ink: .white)
            }
            .accessibilityIdentifier("deskGridEmailSummaries")
        } else if tileShowsContent(kind) {
            VStack(alignment: .leading, spacing: 0) {
                tileContentRows(kind, ink: ink)
            }
            .accessibilityIdentifier("deskGridTileBody_\(kind.title)")
        } else {
            Text(kind.blurb(phase: phase, assignmentCount: moodle.assignments.count))
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
    }

    private func agentTakeoverLabel(_ text: String, ink: Color) -> some View {
        Text(text.uppercased())
            .font(.system(size: 10, weight: .heavy, design: .rounded))
            .tracking(0.4)
            .foregroundColor(ink.opacity(0.55))
    }

    /// Binder's half of the takeover - the fetched email (draft-reply ask)
    /// or a short list of relevant lines (any other ask that touched
    /// Binder-shaped content), in place of Binder's normal Memo/Doc/BYOB
    /// titles. Uses `DeskContentRow` (dot/title/subtitle/divider) - the
    /// same primitive every other tile's real content already renders
    /// through - instead of stacked plain `Text`, so this reads as part of
    /// the dashboard's own visual language rather than a raw dump.
    @ViewBuilder
    private func agentBinderTakeoverView(ink: Color) -> some View {
        let dot = Color(gridHex: "c1121f")
        let muted = Color(gridHex: "8a8478")
        let divider = Color(gridHex: "d9d2c5").opacity(0.85)
        if let email = agentEmail {
            AnyView(
                VStack(alignment: .leading, spacing: 8) {
                    agentTakeoverLabel("Agent \u{00B7} Email", ink: ink)
                    DeskContentRow(
                        title: email.subject.isEmpty ? "(no subject)" : email.subject,
                        subtitle: email.from,
                        dot: dot, ink: ink, muted: muted, divider: divider,
                        showDivider: false, compact: true
                    )
                    Text(email.snippet)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.85))
                        .lineLimit(6)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .accessibilityIdentifier("deskGridAgentEmail")
            )
        } else if let lines = agentBinderLines {
            AnyView(
                VStack(alignment: .leading, spacing: 4) {
                    agentTakeoverLabel("Agent \u{00B7} Mail", ink: ink)
                    ForEach(Array(lines.prefix(5).enumerated()), id: \.element.id) { i, line in
                        DeskContentRow(
                            title: line.subject.isEmpty ? "(no subject)" : line.subject,
                            subtitle: line.from,
                            dot: dot, ink: ink, muted: muted, divider: divider,
                            showDivider: i < lines.prefix(5).count - 1, compact: true
                        )
                    }
                }
                .accessibilityIdentifier("deskGridAgentEmail")
            )
        } else if agentDraftBusy {
            AnyView(
                ProgressView().tint(ink)
                    .accessibilityIdentifier("deskGridAgentEmail")
            )
        } else {
            AnyView(
                Text(agentDraftError ?? "No recent email found.")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(ink.opacity(0.7))
                    .accessibilityIdentifier("deskGridAgentEmail")
            )
        }
    }

    /// Intel's half of the takeover. Two modes share one tile: the
    /// draft-reply flow (busy/error/draft+Send, keyed off `agentEmail`/
    /// `agentDraftBusy`/`agentDraftError`/`agentDraftText`) and a plain
    /// answer from the general agent (`agentAskBusy`/`agentReplyText`) for
    /// every other ask - "what's due this week," "check my grades," etc.
    @ViewBuilder
    private func agentIntelTakeoverView() -> some View {
        let isDraftFlow = agentEmail != nil || agentDraftBusy || agentDraftError != nil || !agentDraftText.isEmpty
        if isDraftFlow {
            AnyView(agentIntelDraftBody())
        } else {
            AnyView(agentIntelReplyBody())
        }
    }

    private func agentIntelDraftBody() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            agentTakeoverLabel("Agent \u{00B7} Draft reply", ink: .white)
            if agentDraftBusy {
                HStack(spacing: 8) {
                    ProgressView().tint(.white)
                    Text("Writing a reply\u{2026}")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
                }
            } else if let error = agentDraftError {
                Text(error)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.85))
                    .fixedSize(horizontal: false, vertical: true)
                if !aiKeys.hasKey {
                    Button {
                        closeAgentTakeover()
                        onOpenHomeworkHelp()
                    } label: {
                        Text("Connect your AI")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(gridHex: "143a2e"))
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(Capsule().fill(Color.white.opacity(0.9)))
                    }
                    .buttonStyle(.plain)
                }
            } else {
                ScrollView(showsIndicators: false) {
                    Text(agentDraftText)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
                Button {
                    Task { await sendAgentDraft() }
                } label: {
                    if agentSending {
                        ProgressView().tint(Color(gridHex: "143a2e"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    } else {
                        Text("Send")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(gridHex: "143a2e"))
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 8)
                    }
                }
                .buttonStyle(.plain)
                .background(Capsule().fill(Color(gridHex: "c4f547")))
                .disabled(agentSending || agentDraftText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
                .accessibilityIdentifier("deskGridAgentDraftSend")
            }
        }
        .accessibilityIdentifier("deskGridAgentDraft")
    }

    private func agentIntelReplyBody() -> some View {
        VStack(alignment: .leading, spacing: 8) {
            agentTakeoverLabel("Agent", ink: .white)
            if agentAskBusy {
                HStack(spacing: 8) {
                    ProgressView().tint(.white)
                    Text("Thinking\u{2026}")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
                }
            } else {
                ScrollView(showsIndicators: false) {
                    Text(agentReplyText ?? "")
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            }
        }
        .accessibilityIdentifier("deskGridAgentDraft")
    }

    /// Popup-matching rows (dot + title + optional subtitle/divider), not
    /// a scaled mascot sitting behind stacked `Text`.
    @ViewBuilder
    private func tileContentRows(_ kind: TileKind, ink: Color) -> some View {
        let limit = 3
        let muted = kind == .binder || kind == .moodle ? Color(gridHex: "8a8478") : Color.white.opacity(0.72)
        let dot = kind == .binder || kind == .moodle ? Color(gridHex: "c4a484").opacity(0.85) : Color.white.opacity(0.75)
        let divider = kind == .binder || kind == .moodle ? Color(gridHex: "d9d2c5").opacity(0.85) : Color.white.opacity(0.28)
        ForEach(Array(tileLines(kind).prefix(limit).enumerated()), id: \.offset) { _, line in
            DeskContentRow(
                title: line,
                dot: dot,
                ink: ink,
                muted: muted,
                divider: divider,
                showDivider: true,
                compact: true
            )
        }
    }

    /// Intel's three merged sections - own research, Email digest, Calendar
    /// week - each with a small caption header and its own real rows, same
    /// `DeskContentRow` primitive the popups use. A section only renders
    /// when it actually has something (or a connect prompt) to show.
    @ViewBuilder
    /// Each section is type-erased (`AnyView`) at its own boundary before
    /// joining the others in one VStack. Three multi-branch conditional
    /// chains (Research's optional, Email's 4-way if/else-if/else-if/else
    /// with a nested if+ForEach inside one branch, Calendar's 3-way), left
    /// as plain sibling `@ViewBuilder` content, compose into a generic type
    /// complex enough to overflow the Swift runtime's metadata-resolution
    /// stack on any re-render - a real SIGSEGV on-device (confirmed via the
    /// device's actual crash log, "Could not determine thread index for
    /// stack guard region" - the signature of this exact failure class),
    /// not a hang or a simulator quirk. `AnyView` per section breaks the
    /// cross-section compounding; do not remove these erasures casually.
    private func intelSections(ink: Color) -> some View {
        let muted = Color.white.opacity(0.72)
        let divider = Color.white.opacity(0.28)
        return VStack(alignment: .leading, spacing: 12) {
            AnyView(intelResearchSection(ink: ink, muted: muted, divider: divider))
            AnyView(intelEmailSection(ink: ink, muted: muted))
            AnyView(intelCalendarSection(ink: ink, muted: muted))
        }
    }

    @ViewBuilder
    private func intelResearchSection(ink: Color, muted: Color, divider: Color) -> some View {
        if !intelLines.isEmpty {
            intelSectionHeader("Research")
            ForEach(Array(intelLines.prefix(4).enumerated()), id: \.offset) { _, line in
                DeskContentRow(
                    title: line, dot: Color.white.opacity(0.75), ink: ink, muted: muted,
                    divider: divider, showDivider: true, compact: true
                )
            }
        }
    }

    @ViewBuilder
    private func intelEmailSection(ink: Color, muted: Color) -> some View {
        intelSectionHeader("Email")
        if !gmail.hasGmailScope {
            intelConnectRow(label: "Connect Gmail")
        } else if let digest = shownDigest {
            AnyView(intelEmailDigestBody(digest: digest, ink: ink, muted: muted))
        } else if !gmail.messages.isEmpty {
            ForEach(Array(gmail.messages.prefix(3).enumerated()), id: \.offset) { _, msg in
                DeskContentRow(
                    title: msg.subject, dot: Color(gridHex: "c1121f"), ink: ink, muted: muted,
                    showDivider: false, compact: true
                )
            }
        } else {
            Text("Nothing to summarize yet.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(muted)
        }
    }

    @ViewBuilder
    private func intelEmailDigestBody(digest: GmailDigestClient.Digest, ink: Color, muted: Color) -> some View {
        if !digest.headline.isEmpty {
            Text(digest.headline)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(ink)
                .fixedSize(horizontal: false, vertical: true)
        }
        ForEach(Array(digest.actionItems.prefix(3))) { item in
            DeskContentRow(
                title: item.subject, subtitle: item.why.isEmpty ? nil : item.why,
                dot: Color(gridHex: "c1121f"), ink: ink, muted: muted, showDivider: false, compact: true
            )
        }
    }

    @ViewBuilder
    private func intelCalendarSection(ink: Color, muted: Color) -> some View {
        intelSectionHeader("Calendar")
        if !gmail.hasCalendarScope {
            intelConnectRow(label: "Connect Calendar")
        } else if !gmail.week.isEmpty {
            ForEach(Array(gmail.week.prefix(4))) { ev in
                DeskContentRow(
                    title: "\(ev.day) · \(ev.title)", dot: Color.white.opacity(0.75), ink: ink, muted: muted,
                    showDivider: false, compact: true
                )
            }
        } else {
            Text("Clear this week.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(muted)
        }
    }

    private func intelSectionHeader(_ title: String) -> some View {
        Text(title.uppercased())
            .font(.system(size: 10, weight: .heavy, design: .rounded))
            .tracking(0.4)
            .foregroundColor(.white.opacity(0.55))
    }

    private func intelConnectRow(label: String) -> some View {
        Button {
            Task {
                await gmail.connectGoogleMailAndCalendar()
                if gmail.hasGmailScope { onGmailLinked(gmail.hasCalendarScope) }
            }
        } label: {
            Text(label)
                .font(.system(size: 12, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(Capsule().fill(Color.white.opacity(0.85)))
        }
        .buttonStyle(.plain)
    }

    private func tileLines(_ kind: TileKind) -> [String] {
        switch kind {
        case .intel:
            return intelLines
        case .moodle:
            let work = moodle.assignments.prefix(5).map { "\($0.name) · \($0.dueLabel)" }
            if !work.isEmpty { return Array(work) }
            return moodle.grades.prefix(5).map { "\($0.itemName) · \($0.gradeLabel)" }
        case .binder:
            return binderTitles
        case .homeworkHelp, .memo:
            return []
        }
    }

    private func boxRect(_ kind: TileKind) -> CGRect {
        let base: CGRect
        switch kind {
        case .intel: base = expanded ? WorkArtboard.p5Intel : WorkArtboard.p4Intel
        case .moodle: base = expanded ? WorkArtboard.p5Moodle : WorkArtboard.p4Moodle
        case .binder: base = expanded ? WorkArtboard.p5Binder : WorkArtboard.p4Binder
        case .homeworkHelp: base = expanded ? WorkArtboard.p5HomeworkHelp : WorkArtboard.p4HomeworkHelp
        case .memo: return WorkArtboard.memoRail
        }
        guard let hungry = boxBus.hungry else { return base }
        return negotiated(kind, hungry: hungry, page5: expanded, base: base)
    }

    /// Binder is the only box that still borrows space from neighbors
    /// (`DeskBoxBus.requestSpace`) - Intel/Moodle/Homework Help each have
    /// their own fixed, generous slot now (Intel doubled in size absorbing
    /// Email/Gcal) and don't compete for room with a neighbor anymore.
    private func negotiated(_ kind: TileKind, hungry: DeskBoxBus.Box, page5: Bool, base: CGRect) -> CGRect {
        guard hungry == .binder else { return base }
        if page5 {
            switch kind {
            case .binder: return CGRect(x: 380, y: 54, width: 500, height: 560)
            case .intel: return CGRect(x: 76, y: 103, width: 280, height: 192)
            case .moodle: return CGRect(x: 76, y: 323, width: 280, height: 188)
            case .homeworkHelp: return CGRect(x: 76, y: 54, width: 280, height: 192)
            default: return base
            }
        }
        switch kind {
        case .binder: return CGRect(x: 430, y: 50, width: 580, height: 600)
        case .intel: return CGRect(x: 1060, y: 107, width: 330, height: 522)
        case .moodle: return CGRect(x: 81, y: 378, width: 330, height: 222)
        case .homeworkHelp: return CGRect(x: 81, y: 118, width: 330, height: 227)
        default: return base
        }
    }

    private func syncConnectedBoxes() async {
        boxBus.intelLines = intelLines
        boxBus.binderTitles = binderTitles
        await gmail.restoreSessionIfNeeded()
        if gmail.hasGmailScope {
            await gmail.fetchInbox()
            // Seeded UI tests have messages but no Google user — skip the
            // webhook so the tile can show subjects without a network wait.
            if gmail.hasLiveGoogleUser, !gmail.messages.isEmpty {
                await digest.summarize(gmail.messages)
                if let d = digest.digest {
                    digestStore.save(d, messageCount: gmail.messages.count)
                }
            }
        }
        if gmail.hasCalendarScope {
            _ = await gmail.fetchCalendarWeek()
        }
        onSyncCalendar()
        if moodle.isConnected {
            await moodle.refresh()
        }
    }

    // MARK: - Dock

    /// Flows has its own dock: Binder/Calendar/Memo/Gmail don't apply inside
    /// that rail, so it's just a way back + a search optimized for flows.
    @ViewBuilder
    private var activeDock: some View {
        if rail == .flows {
            flowsDock
        } else {
            workDock
        }
    }

    /// Binder/Calendar/Gmail dropped from here on purpose (2026-08-17,
    /// explicit ask) - they're already reachable as their own tiles on the
    /// board, so the dock chips were a redundant second path that was
    /// crowding this strip. Book added alongside Learn as a direct
    /// entry point instead of being buried one level inside Flows -
    /// reuses the existing `onOpenFlow("book")` callback FieldDeskView
    /// already wires for the Flows rail's own Book row, not a new path.
    private var workDock: some View {
        HStack(spacing: 8) {
            dockChip("Memo", system: "note.text", identifier: "deskGridDashboardAddMemo") { setRail(rail == .memo ? .none : .memo) }
            dockChip("Flows", system: "bolt.fill", identifier: "deskGridDock_Flows") { setRail(rail == .flows ? .none : .flows) }
            dockChip("Learn", system: "square.grid.2x2.fill", identifier: "deskGridDock_LearnStudio") { onOpenLearnStudio() }
            dockChip("Book", system: "book.fill", identifier: "deskGridDock_Book") { onOpenFlow("book") }
            searchField(placeholder: "Search", identifier: "deskGridDashboardSearch", onSubmit: submitSearch)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color(gridHex: "1c1c1e")))
        // NOT .accessibilityIdentifier() directly on this container - that
        // clobbers every child dockChip's own identifier with this one
        // (confirmed live: each chip reported identifier
        // "deskGridDashboardToolbar" instead of its own deskGridDock_*,
        // even though .accessibilityElement(children: .contain) correctly
        // kept them individually queryable/tappable). Same proven fix as
        // FieldDeskView's combinedAskAndDock: an invisible marker Text
        // carries the container's own identifier instead.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "toolbar").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridDashboardToolbar")
                .allowsHitTesting(false)
        }
    }

    private var flowsDock: some View {
        HStack(spacing: 8) {
            dockChip("Dashboard", system: "square.grid.2x2.fill", identifier: "deskGridDock_BackToDash") { setRail(.none) }
            // Binder/Calendar/Gmail don't apply inside Flows - they're
            // already on the dashboard's own dock. Just Memo + Transcribe
            // (ambient room recording, not a Jesse call) + the flow search.
            dockChip("Memo", system: "note.text", identifier: "deskGridFlowsMemo") { setRail(.memo) }
            dockChip("Transcribe", system: "waveform", identifier: "deskGridFlowsTranscribe", action: onTranscribe)
            searchField(
                placeholder: "Search Presentation, Resume, Archive, Book…",
                identifier: "deskGridFlowsSearch",
                text: $flowsSearchQuery,
                onSubmit: submitFlowsSearch
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(Capsule().fill(Color(gridHex: "1c1c1e")))
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "toolbar").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridDashboardToolbar")
                .allowsHitTesting(false)
        }
    }

    /// Same connect prompt Homework Help shows when no AI key is saved -
    /// tapping any search field (dock or Flows rail) before a key exists
    /// opens that exact popup instead of focusing the field, since search
    /// itself doesn't need a key but this is the one place every session
    /// passes through, and it's where the boxes' own AI-powered bits key
    /// off of (Homework Help today; Intel's research summary later).
    private func searchField(placeholder: String, identifier: String, text: Binding<String>? = nil, onSubmit: @escaping () -> Void) -> some View {
        ZStack {
            HStack(spacing: 6) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(.white.opacity(0.45))
                TextField(placeholder, text: text ?? $searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(.white)
                    .submitLabel(.search)
                    .onSubmit(onSubmit)
                    .disabled(!aiKeys.hasKey)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color.white.opacity(0.12)))

            if !aiKeys.hasKey {
                // No nested .accessibilityIdentifier here - the outer one
                // below already identifies this whole control, and a second
                // one on this overlay would clobber it (same family as the
                // dock/workDock clobbering CLAUDE.md documents). The popup
                // this opens (`fieldDeskHomeworkHelpOverlay`) is what a test
                // should assert on, not this transparent tap-catcher.
                Color.clear
                    .contentShape(Rectangle())
                    .onTapGesture { onOpenHomeworkHelp() }
                    .accessibilityLabel("Connect your AI to power search")
            }
        }
        .accessibilityIdentifier(identifier)
    }

    private func dockChip(_ title: String, system: String, identifier: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: system)
                Text(title)
            }
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(.white)
            .padding(.horizontal, 10)
            .padding(.vertical, 8)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier ?? "deskGridDock_\(title)")
    }

    // MARK: - Right rails (page 5)

    private var memoRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Memo")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
                Spacer(minLength: 0)
                Button {
                    onSaveMemo(memoDraft)
                    memoSaved = true
                } label: {
                    Text(memoSaved ? "Saved" : "Save")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundColor(memoSaved ? Color(gridHex: "8a8478") : Color(gridHex: "143a2e"))
                        .padding(.horizontal, 10)
                        .padding(.vertical, 5)
                        .background(Capsule().fill(memoSaved ? Color(gridHex: "e4dcc8") : Color(gridHex: "c4f547")))
                }
                .buttonStyle(.plain)
                .disabled(memoSaved)
                .accessibilityIdentifier("deskGridDashboardMemoSave")
            }
            TextField("Pin a note…", text: $memoDraft, axis: .vertical)
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .textFieldStyle(.plain)
                .lineLimit(3...6)
                .onChange(of: memoDraft) { _, _ in memoSaved = false }
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        )
        .accessibilityIdentifier("deskGridTile_Memo")
        .accessibilityElement(children: .contain)
    }

    private var flowsRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Flows")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
            flowRow("Presentation", system: "rectangle.on.rectangle") { onOpenCreate(.presentation) }
            flowRow("GDoc", system: "doc.text") { onOpenCreate(.gdoc) }
            flowRow("Resume", system: "person.text.rectangle") { onOpenFlow("resume") }
            // Archive dropped as its own row (2026-08-17, explicit ask) -
            // blended into Learn Studio (Browse Archive button there) since
            // it's fundamentally the same "find what you already have"
            // motion as studying. onOpenFlow("archive") still resolves.
            flowRow("Book", system: "book") { onOpenFlow("book") }
            // Apply dropped as its own row (2026-08-17, explicit ask) -
            // Apply Today/JobOS now lives inside Resume, reached from
            // there instead of as a peer Flow. onOpenFlow("apply") still
            // resolves (see FieldDeskView) so nothing else calling it
            // silently breaks - it opens Resume now, not a standalone
            // Apply screen.
            Spacer(minLength: 0)
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        )
        // Not a direct .accessibilityIdentifier() - same clobbering bug as
        // workDock, would stomp all 6 flowRow identifiers
        // (Presentation/GDoc/Resume/Archive/Book/Apply) with this
        // container's own.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "flows").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridFlowsRail")
                .allowsHitTesting(false)
        }
    }

    private func flowRow(_ title: String, system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 8) {
                Image(systemName: system)
                    .font(.system(size: 12, weight: .semibold))
                Text(title)
                    .font(.system(size: 13, weight: .semibold, design: .rounded))
                Spacer(minLength: 0)
            }
            .foregroundColor(Color(gridHex: "143a2e"))
            .padding(.vertical, 6)
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskGridFlow_\(title)")
    }

    private func setRail(_ next: Rail) {
        withAnimation(.spring(response: 0.45, dampingFraction: 0.84)) { rail = next }
    }
}

/// 1440×810 boxes measured from Presentation_Screen.pdf, with two later
/// departures from the original PDF layout (2026-08-17): Email/Gcal are no
/// longer separate boxes - their content lives inside Intel's box, which
/// took over their combined footprint on the right - and Homework Help is
/// new, in Intel's original top-left slot.
private enum WorkArtboard {
    static let p4HomeworkHelp = CGRect(x: 81, y: 118, width: 376, height: 227)
    static let p4Moodle = CGRect(x: 115, y: 378, width: 315, height: 222)
    static let p4Binder = CGRect(x: 492, y: 61, width: 505, height: 568)
    /// Was Email (1033,107,381,212) + Gcal (1032,343,392,286) stacked.
    static let p4Intel = CGRect(x: 1032, y: 107, width: 392, height: 522)

    static let p5HomeworkHelp = CGRect(x: 76, y: 103, width: 319, height: 192)
    static let p5Moodle = CGRect(x: 106, y: 323, width: 267, height: 188)
    static let p5Binder = CGRect(x: 425, y: 54, width: 428, height: 524)
    /// Was Email (884,93,322,180) + Gcal (884,295,332,325) stacked.
    static let p5Intel = CGRect(x: 884, y: 93, width: 332, height: 527)
    static let memoRail = CGRect(x: 1231, y: 193, width: 199, height: 194)
    static let flowsRail = CGRect(x: 1231, y: 54, width: 199, height: 566)
    // Only the dock's own box moves toward the board's bottom edge (was
    // y: 632, leaving an 82pt empty gap below it out of an 810pt-tall
    // board). Tile boxes above are untouched - bottom-aligning the whole
    // ZStack instead moved the tiles too, which is explicitly wrong.
    // Nudged closer to the true bottom edge again (was y: 698, leaving a
    // 16pt gap under a 96pt-tall dock on an 810pt board) - tiles untouched.
    static let dock = CGRect(x: 96, y: 706, width: 1321, height: 96)
}

private struct DottedDeskGrid: View {
    var body: some View {
        Canvas { context, size in
            let step: CGFloat = 16
            for x in stride(from: 8, through: size.width, by: step) {
                for y in stride(from: 8, through: size.height, by: step) {
                    let dot = Path(ellipseIn: CGRect(x: x, y: y, width: 1.4, height: 1.4))
                    context.fill(dot, with: .color(Color(gridHex: "d7d0c2")))
                }
            }
        }
        .allowsHitTesting(false)
    }
}

private extension Color {
    init(gridHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

/// Moodle box sheet: connect form when sleeping, real assignments/grades
/// when connected. Never invents homework.
/// Same cream-card / dimmed-background popup family as Intel/Binder/Homework
/// Help (was a `.sheet()` with its own NavigationStack + toolbar Close
/// button, visually inconsistent with the rest of the boxes).
private struct MoodleBoxSheet: View {
    @ObservedObject var client: MoodleClient
    var onLinked: () -> Void
    var onDisconnected: () -> Void
    var onClose: () -> Void

    @State private var site = ""
    @State private var username = ""
    @State private var password = ""

    var body: some View {
        ZStack {
            Color.black.opacity(0.35)
                .ignoresSafeArea()
                .onTapGesture { onClose() }

            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 10) {
                    Text("Moodle")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(Color(gridHex: "143a2e"))
                    Spacer(minLength: 0)
                    Button(action: onClose) {
                        Text("Done")
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(gridHex: "0c1207"))
                            .padding(.horizontal, 12)
                            .padding(.vertical, 8)
                            .background(Capsule().fill(Color(gridHex: "c4f547")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("moodleSheetClose")
                }

                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if client.isConnected {
                            connectedBody
                        } else {
                            connectForm
                        }
                        if let err = client.lastError, !err.isEmpty {
                            Text(err)
                                .font(.system(size: 13, weight: .medium, design: .rounded))
                                .foregroundColor(Color(gridHex: "b0473f"))
                        }
                    }
                }
            }
            .padding(18)
            .frame(width: 420, height: 480)
            .background(
                RoundedRectangle(cornerRadius: 20, style: .continuous)
                    .fill(Color(gridHex: "fff8e9"))
                    .shadow(color: .black.opacity(0.35), radius: 24, y: 12)
            )
            .accessibilityElement(children: .contain)
            .overlay(alignment: .topLeading) {
                Text(verbatim: "moodle").font(.system(size: 1)).foregroundColor(.clear)
                    .accessibilityIdentifier("moodleSheetOverlay")
                    .allowsHitTesting(false)
            }
        }
    }

    private var connectForm: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("Read-only. Assignments and grades for this student, nothing else. Schools that only allow SSO can’t mint a mobile token this way — that’s Moodle, not a fake empty inbox.")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e").opacity(0.7))
            field("Moodle URL", text: $site, hint: "https://moodle.school.edu")
            field("Username", text: $username, hint: "school username")
            SecureField("Password", text: $password)
                .textFieldStyle(.plain)
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
            Button {
                Task {
                    await client.connect(siteURL: site, username: username, password: password)
                    if client.isConnected {
                        onLinked()
                    }
                }
            } label: {
                Text(client.isBusy ? "Connecting…" : "Wake Moodle")
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "0c1207"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
                    .background(Capsule().fill(Color(gridHex: "c4f547")))
            }
            .buttonStyle(.plain)
            .disabled(client.isBusy)
            .accessibilityIdentifier("moodleSheetConnect")
        }
    }

    private var connectedBody: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(client.siteHost ?? "Connected")
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(Color(gridHex: "8a8478"))
            if client.assignments.isEmpty && client.grades.isEmpty && !client.isBusy {
                Text("Connected, and Moodle returned nothing to show yet.")
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
            }
            ForEach(client.assignments) { item in
                VStack(alignment: .leading, spacing: 2) {
                    Text(item.name)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                    Text("\(item.courseName) · \(item.dueLabel)")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(Color(gridHex: "8a8478"))
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
            }
            ForEach(Array(client.grades.prefix(12))) { item in
                HStack {
                    Text(item.itemName)
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                    Spacer()
                    Text(item.gradeLabel)
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                }
                .foregroundColor(Color(gridHex: "143a2e"))
            }
            Button("Disconnect") {
                client.disconnect()
                onDisconnected()
            }
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(Color(gridHex: "b0473f"))
            .accessibilityIdentifier("moodleSheetDisconnect")
        }
    }

    private func field(_ title: String, text: Binding<String>, hint: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title)
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .foregroundColor(Color(gridHex: "8a8478"))
            TextField(hint, text: text)
                .textFieldStyle(.plain)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .padding(12)
                .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
        }
    }
}
