import SwiftUI
import UniformTypeIdentifiers
import PDFKit

/// One line of the agent takeover's Binder mail list - structured (not a
/// pre-joined string) so it can render through `DeskContentRow` like every
/// other tile row instead of looking like a raw text dump.
private struct AgentMailLine: Identifiable {
    let id = UUID()
    let from: String
    let subject: String
}

/// One solved item in a Homework Help session - a filename (or "Typed
/// problem") plus its real AI-generated cards. The tile itself is the
/// upload target now (explicit ask: "make the homework help button a space
/// to directly click on upload... and under it like transcript space
/// summaries and filenames pop up") - no separate screen.
private struct HomeworkUploadSummary: Identifiable {
    let id = UUID()
    let fileName: String
    let cards: [IngredientHintsClient.HintCard]
    /// Real, matched MicroSims from the same `WorkDashboardLesson`, if
    /// any (empty for a plain photo/PDF solve) - tappable, opens
    /// `MicroSimView`.
    var microsims: [MicroSimRecord] = []
}

/// Manual `UIDocumentPickerViewController` wrapper, not SwiftUI's own
/// `.fileImporter` - confirmed via a diagnostic UI test that `.fileImporter`
/// here flips `isPresented` correctly (the tap/state wiring was never the
/// problem) but the system picker never actually appears, regardless of
/// whether the modifier sits on the tile's own Button or the screen root.
/// Driving `UIDocumentPickerViewController` directly through `.sheet`
/// sidesteps whatever's silently swallowing `.fileImporter`'s own
/// presentation here.
private struct HomeworkDocumentPicker: UIViewControllerRepresentable {
    var onPick: (URL) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.image, .pdf])
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    final class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (URL) -> Void
        init(onPick: @escaping (URL) -> Void) { self.onPick = onPick }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            if let url = urls.first { onPick(url) }
        }
    }
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
    /// Homework Help files directly to Binder now - the tile itself is the
    /// upload target, no separate screen (explicit ask, 2026-08-18). Real
    /// side effect (BinderStore.addDoc + an Intel line), owned by
    /// FieldDeskView since it holds the real BinderStore/FieldDeskStore
    /// instances this view doesn't.
    var onFileHomeworkToBinder: (_ title: String, _ body: String) -> Void = { _, _ in }
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
    var onOpenArchive: () -> Void = {}
    /// The left sidebar's gear icon now opens the same Manage page the
    /// top-left logo used to (2026-08-18, explicit ask - the mark itself
    /// moved to top-right, see FieldDeskView's chrome overlay).
    var onOpenManage: () -> Void = {}
    /// For the Jesse-call box now living in Intel's old tile slot
    /// (explicit ask: "instead of intel put the jesse call thing in dash").
    var studentName: String = "there"

    @ObservedObject private var gmail = GmailClient.shared
    @ObservedObject private var moodle = MoodleClient.shared
    @ObservedObject private var digest = GmailDigestClient.shared
    @ObservedObject private var digestStore = GmailDigestStore.shared
    @ObservedObject private var boxBus = DeskBoxBus.shared
    @ObservedObject private var aiKeys = StudentAIKeyStore.shared
    @EnvironmentObject private var jesseCall: JesseCallSession
    @State private var showMoodleSheet = false
    /// Real, live per-student mastery graph (`GET /knowledge-graph/{uid}`,
    /// the same backend `KnowledgeMapView` already uses) - powers the
    /// Knowledge Graph tile (the old Moodle slot, 2026-08-18: "remove
    /// moodle completely... this box will be used to show the knowledge
    /// graph... live evolving as you learn"). Not a singleton - `@StateObject`
    /// owns one fresh instance per dashboard session, matching how
    /// `KnowledgeGraphClient` is already used elsewhere (its own doc
    /// comment: "this client only has one caller today").
    @StateObject private var knowledgeGraphClient = KnowledgeGraphClient()

    // MARK: - Homework Help (the tile itself is the upload target now)
    @State private var showHomeworkImporter = false
    @State private var homeworkUploading = false
    @State private var homeworkError: String?
    @State private var homeworkUploads: [HomeworkUploadSummary] = []
    @State private var presentedMicroSim: MicroSimRecord?

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
        onFileHomeworkToBinder: @escaping (_ title: String, _ body: String) -> Void = { _, _ in },
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
        onOpenLearnStudio: @escaping () -> Void = {},
        onOpenArchive: @escaping () -> Void = {},
        onOpenManage: @escaping () -> Void = {},
        studentName: String = "there"
    ) {
        self.initialRail = initialRail
        self.initialMemoText = initialMemoText
        self.onOpenBinder = onOpenBinder
        self.onClose = onClose
        self.onOpenCalendar = onOpenCalendar
        self.onOpenGmail = onOpenGmail
        self.onOpenIntel = onOpenIntel
        self.onFileHomeworkToBinder = onFileHomeworkToBinder
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
        self.onOpenArchive = onOpenArchive
        self.onOpenManage = onOpenManage
        self.studentName = studentName
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
            // The left sidebar (2026-08-18) sits ON TOP of the board as a
            // ZStack sibling, not inline in the layout, so the board's own
            // centering has to leave room for it explicitly - otherwise it
            // centers across the FULL width and the sidebar overlaps
            // whatever tile happens to sit closest to the left edge
            // (confirmed live: "Homework Help"'s title was half-hidden
            // behind it). `sidebarInset` matches the sidebar's real
            // footprint (76pt box + 14pt leading padding); halving it in
            // the offset below (see the centering math in that comment)
            // shifts the whole board right by exactly that amount instead
            // of just shrinking it centered.
            let sidebarInset: CGFloat = 106
            let scale = min((geo.size.width - sidebarInset) / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            ZStack {
                // Black, not the old cream (2026-08-18, explicit ask:
                // "the background... should be black instead of white, so
                // the raccoon pops out").
                Color.black.ignoresSafeArea()
                tileBoard(scale: scale, board: board)
                    .scaleEffect(spaceZoom * liveZoom)
                    .offset(x: sidebarInset / 2 + spacePan.width + livePan.width, y: spacePan.height + livePan.height)
                // Same dimmed-background + centered-card popup family as
                // Intel/Binder/Homework Help - was a .sheet() with its own
                // NavigationStack/toolbar, visually inconsistent with the
                // rest of the boxes.
                if showMoodleSheet {
                    moodleOverlayLayer
                        .transition(.opacity)
                }
                leftSidebar
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
        .onChange(of: jesseCall.workDashboardLesson) { _, lesson in handleNewLesson(lesson) }
        .fullScreenCover(item: $presentedMicroSim) { sim in
            MicroSimView(sim: sim) { presentedMicroSim = nil }
        }
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
                // `.sheet` + a manual UIDocumentPickerViewController, not
                // `.fileImporter` - confirmed via a diagnostic UI test that
                // the tap/state wiring was already correct (handleTile
                // fired, showHomeworkImporter flipped true, both when the
                // modifier sat on the screen root and right here on the
                // tile) but `.fileImporter`'s own picker never actually
                // presented either way. See HomeworkDocumentPicker's doc
                // comment.
                photoTile(.homeworkHelp)
                    .sheet(isPresented: $showHomeworkImporter) {
                        HomeworkDocumentPicker { url in
                            Task { await handleHomeworkFileUpload(url) }
                        }
                    }
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
            case .moodle: return "Knowledge Graph"
            case .binder: return "Binder"
            case .homeworkHelp: return "Homework Help"
            case .memo: return "Memo"
            }
        }

        /// No tile gets a mascot moment anymore. The `.moodle` case is the
        /// real Moodle LMS connector no longer (2026-08-18, explicit ask:
        /// "remove moodle completely for now") - this slot now shows a
        /// live per-student knowledge graph instead (see `tileBody`'s
        /// `.moodle` branch), always real content, no connect flow.
        var mascotSlug: String? { nil }

        func mascotAssetName(state: MascotPhase) -> String? {
            guard let mascotSlug else { return nil }
            return "desk_mascot_\(mascotSlug)_\(state.rawValue)"
        }

        var wash: [Color] {
            switch self {
            case .intel: return [Color(gridHex: "247a4d"), Color(gridHex: "143a2e")]
            // Violet, not green - matches the app's own existing "Learn"
            // accent (PawHub's violet toe, see CLAUDE.md) rather than
            // reusing Intel's or Homework Help's colors for a third,
            // different kind of box.
            case .moodle: return [Color(gridHex: "b19cd9"), Color(gridHex: "5b3e8f")]
            case .binder: return [Color(gridHex: "f3efe4"), Color(gridHex: "e4dcc8")]
            case .homeworkHelp: return [Color(gridHex: "c4f547"), Color(gridHex: "7a9e2e")]
            case .memo: return [Color(gridHex: "fff8e9"), Color(gridHex: "efe6cf")]
            }
        }

        var symbol: String {
            switch self {
            case .intel: return "sparkles"
            case .moodle: return "point.3.filled.connected.trianglepath.dotted"
            case .binder: return "person.crop.circle.fill"
            // Upload arrow, not a camera or a lightbulb - the tile opens a
            // dialogue with one Upload button (photo or PDF), it doesn't
            // jump straight into a camera.
            case .homeworkHelp: return "square.and.arrow.up"
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
            // White, not the old dark green - the board background is
            // black now (2026-08-18, explicit ask: "so the raccoon
            // pops out"), and dark-on-black is unreadable.
            Text(kind.title)
                .font(.system(size: 15, weight: .bold, design: .rounded))
                .foregroundColor(.white)
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
                    } else if kind.mascotSlug == nil, kind != .intel, kind != .homeworkHelp, kind != .moodle, !(kind == .binder && tileShowsContent(kind)) {
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
            // Knowledge Graph now, not the Moodle LMS connector - always
            // "awake" (real per-student data, no connect-first state).
            return knowledgeGraphClient.isLoading ? .working : .awake
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
            // Knowledge Graph now - a tap refreshes the real live data
            // instead of opening the old Moodle LMS connect sheet.
            Task { await knowledgeGraphClient.load() }
        case .homeworkHelp:
            showHomeworkImporter = true
        case .memo:
            setRail(rail == .memo ? .none : .memo)
        }
    }

    // MARK: - Homework Help: tile is the upload target, no separate screen

    /// Real upload, not a stub - photos go through `HomeworkClient.
    /// parseAndCreateSession` (`/api/parse-homework`, real vision-model
    /// OCR), PDFs get their text extracted locally via PDFKit (same
    /// technique `DriveClient.pdfText` uses elsewhere). Whichever path
    /// finds real text, `solveHomeworkProblem` turns it into real AI cards
    /// via the student's own key.
    private func handleHomeworkFileUpload(_ url: URL) async {
        homeworkError = nil
        homeworkUploading = true
        let accessed = url.startAccessingSecurityScopedResource()
        defer { if accessed { url.stopAccessingSecurityScopedResource() } }
        guard let data = try? Data(contentsOf: url) else {
            homeworkError = "Couldn\u{2019}t read that file. Try again."
            homeworkUploading = false
            return
        }

        if url.pathExtension.lowercased() == "pdf" {
            guard let doc = PDFDocument(data: data) else {
                homeworkError = "Couldn\u{2019}t read that PDF. Try another file."
                homeworkUploading = false
                return
            }
            var text = ""
            for i in 0..<doc.pageCount {
                text += (doc.page(at: i)?.string ?? "") + "\n"
                if text.count > 4000 { break }
            }
            let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                await solveHomeworkProblem(trimmed, fileName: url.lastPathComponent)
                return
            }
            // Real gap found live (2026-08-18: "i uploaded a pdf but
            // nothing happening") - most real homework PDFs are a phone
            // scan with NO text layer, so PDFKit's `.string` (a real text
            // extraction, not OCR) correctly finds nothing. Fall back to
            // rasterizing page 1 and running it through the exact same
            // vision-model OCR path photos already use, instead of just
            // erroring out on a case that's actually the common one.
            guard let page = doc.page(at: 0) else {
                homeworkError = "Couldn\u{2019}t find any text in that PDF. Try a photo instead."
                homeworkUploading = false
                return
            }
            let pageRect = page.bounds(for: .mediaBox)
            let scale: CGFloat = 2
            let renderSize = CGSize(width: pageRect.width * scale, height: pageRect.height * scale)
            let pageImage = page.thumbnail(of: renderSize, for: .mediaBox)
            guard let imageData = pageImage.jpegData(compressionQuality: 0.9) else {
                homeworkError = "Couldn\u{2019}t find any text in that PDF. Try a photo instead."
                homeworkUploading = false
                return
            }
            await runImageOCR(imageData, fileName: url.lastPathComponent)
            return
        }

        await runImageOCR(data, fileName: url.lastPathComponent)
    }

    private func runImageOCR(_ imageData: Data, fileName: String) async {
        // homeworkUploading (drives the tile's "Reading..." state) stays
        // true through this whole OCR + solve chain, not just the initial
        // file read - it used to flip false right here, before the actual
        // network round trips, so the tile sat idle-looking with no
        // spinner for however long those took. That silent gap is part of
        // what read as "nothing happening."
        let (result, _) = await HomeworkClient.parseAndCreateSession(imageData: imageData, fileName: fileName)
        switch result {
        case .success(let questions):
            guard let first = questions.first else {
                homeworkError = "Couldn\u{2019}t find a question on that page. Try another photo."
                homeworkUploading = false
                return
            }
            await solveHomeworkProblem(first.text, fileName: fileName)
        case .unavailable:
            homeworkError = "Couldn\u{2019}t find questions on that page. Try another photo, or this may be temporarily unavailable."
            homeworkUploading = false
        case .notSignedIn:
            homeworkError = "Please sign in again."
            homeworkUploading = false
        }
    }

    /// Files to Binder via the real callback (`onFileHomeworkToBinder` -
    /// FieldDeskView owns the actual `BinderStore`/`FieldDeskStore`
    /// instances this view doesn't) and drops the result into this tile's
    /// own scrollable summary list - no separate screen, no auto-navigate
    /// away (explicit ask: "under it like transcript space summaries and
    /// filenames pop up").
    private func solveHomeworkProblem(_ problem: String, fileName: String) async {
        switch await IngredientHintsClient.hints(for: problem) {
        case .cards(let cards):
            let title = String(problem.trimmingCharacters(in: .whitespacesAndNewlines).prefix(60))
            let body = cards.map { "\($0.title)\n\($0.body)" }.joined(separator: "\n\n")
            onFileHomeworkToBinder(title.isEmpty ? fileName : title, body)
            homeworkUploads.insert(HomeworkUploadSummary(fileName: fileName, cards: cards), at: 0)
        case .keyRejected:
            homeworkError = "That AI key was rejected. Open Settings to update it."
        case .unavailable:
            homeworkError = "Couldn't get an answer - try again in a bit."
        }
        homeworkUploading = false
    }

    /// Routes a real `WorkDashboardLesson` (from `jesseCall.askJesseWorkDashboard`,
    /// "I want to learn X") into Binder (filed artifact) and Homework Help
    /// (definition/chapters/question - reuses its existing upload-summary
    /// display, no new UI). The Knowledge Graph tile shows the student's
    /// real live mastery graph, not this lesson's chapters (2026-08-18,
    /// explicit ask: "remove moodle completely... this box will be used
    /// to show the knowledge graph"). Intel's own "table of contents" is
    /// already visible where Jesse said it, in the transcript this same
    /// call just spoke into - no separate rendering needed there.
    private func handleNewLesson(_ lesson: WorkDashboardLesson?) {
        guard let lesson else { return }
        var body = lesson.definition
        if !lesson.chapters.isEmpty {
            body += "\n\nChapters:\n" + lesson.chapters.map { "- \($0)" }.joined(separator: "\n")
        }
        if let question = lesson.question {
            body += "\n\nPractice question:\n\(question)"
        }
        onFileHomeworkToBinder("Lesson · \(lesson.topic.capitalized)", body)

        var cards: [IngredientHintsClient.HintCard] = [
            IngredientHintsClient.HintCard(title: "Definition", body: lesson.definition),
        ]
        if !lesson.chapters.isEmpty {
            cards.append(IngredientHintsClient.HintCard(title: "Chapters", body: lesson.chapters.joined(separator: "\n")))
        }
        if let question = lesson.question {
            cards.append(IngredientHintsClient.HintCard(title: "Practice question", body: question))
        }
        homeworkUploads.insert(HomeworkUploadSummary(fileName: lesson.topic.capitalized, cards: cards, microsims: lesson.microsims), at: 0)
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
            // Knowledge Graph renders through its own tileBody branch now,
            // not this generic content-rows path.
            return false
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

    /// Same floating card JesseRailView gives Intel - a light, shadowed
    /// rounded-rect the content sits inside instead of straight on the
    /// tile's colored wash. Explicit ask (2026-08-18): "i like the design
    /// on intel the borders and all that, do the same design for binder
    /// and homework help and moodle."
    @ViewBuilder
    private func tileInnerCard<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        content()
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Color(white: 0.985))
                    .shadow(color: .black.opacity(0.08), radius: 10, y: 5)
            )
    }

    @ViewBuilder
    private func tileBody(_ kind: TileKind, phase: MascotPhase) -> some View {
        // Homework Help now sits in the same near-white card as Binder/
        // Moodle (see tileInnerCard) so it needs dark ink like they do -
        // white text would vanish on that light card.
        // Knowledge Graph now sits in the same near-white tileInnerCard as
        // Binder/Homework Help, so it needs dark ink like they do, even
        // though its own tile wash (violet) is dark.
        let ink: Color = (kind == .binder || kind == .homeworkHelp || kind == .moodle) ? tileInk : .white
        // Binder only takes over when there's actually binder-shaped
        // content (an email or a list of lines) to show - a reply-only ask
        // ("what's my next assignment") shouldn't blank out Binder's real
        // titles just because Intel is showing an answer.
        if agentTakeoverActive && kind == .binder && (agentEmail != nil || agentDraftBusy || agentBinderLines != nil) {
            AnyView(agentBinderTakeoverView(ink: ink))
        } else if agentTakeoverActive && kind == .intel {
            AnyView(agentIntelTakeoverView())
        } else if kind == .intel {
            // Intel's old email/calendar/research sections are gone -
            // explicit ask: "instead of intel put the jesse call thing in
            // dash: nothing else." Reuses the exact same JesseRailView card
            // every other screen with Jesse carries (Resume/Book/Learn/
            // Presentation/Design Studio), not a new one-off. Memo/
            // Transcribe/Email/Calendar moved here as a compact icon row -
            // to the right of "Just now" in the header, not stacked above
            // the card (explicit ask, 2026-08-18) - via headerTrailing,
            // same functionality the main dock/old Intel connect row had,
            // just relocated, not rebuilt.
            JesseRailView(studentName: studentName, context: "workDashboard", headerTrailing: AnyView(jesseBoxIconRow))
                .accessibilityIdentifier("deskGridJesseCall")
        } else if kind == .homeworkHelp {
            tileInnerCard { homeworkHelpTileBody(ink: ink) }
        } else if kind == .moodle {
            tileInnerCard { knowledgeGraphTileBody() }
        } else if tileShowsContent(kind) {
            tileInnerCard {
                VStack(alignment: .leading, spacing: 0) {
                    tileContentRows(kind, ink: ink)
                }
                .accessibilityIdentifier("deskGridTileBody_\(kind.title)")
            }
        } else {
            Text(kind.blurb(phase: phase, assignmentCount: moodle.assignments.count))
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(ink)
                .lineLimit(2)
                .multilineTextAlignment(.leading)
        }
    }

    /// Compact icon-only row (no dock-style text labels - there's no room
    /// above the greeting card) for Memo/Transcribe/Email/Calendar - the
    /// same four actions that used to live in the main dock (Memo/
    /// Transcribe) and Intel's old connect row (Email/Calendar), just
    /// relocated per the explicit ask, not reimplemented.
    private var jesseBoxIconRow: some View {
        HStack(spacing: 10) {
            jesseBoxIcon("note.text") { setRail(rail == .memo ? .none : .memo) }
                .accessibilityIdentifier("deskGridJesseIcon_Memo")
            jesseBoxIcon("waveform", action: onTranscribe)
                .accessibilityIdentifier("deskGridJesseIcon_Transcribe")
            jesseBoxIcon(gmail.hasGmailScope ? "envelope.fill" : "envelope") {
                if gmail.hasGmailScope {
                    onOpenGmail()
                } else {
                    Task {
                        await gmail.connectGoogleMailAndCalendar()
                        if gmail.hasGmailScope { onGmailLinked(gmail.hasCalendarScope) }
                    }
                }
            }
            .accessibilityIdentifier("deskGridJesseIcon_Email")
            jesseBoxIcon(gmail.hasCalendarScope ? "calendar.circle.fill" : "calendar") {
                if gmail.hasCalendarScope {
                    onOpenCalendar()
                } else {
                    Task {
                        await gmail.connectGoogleMailAndCalendar()
                        if gmail.hasGmailScope { onGmailLinked(gmail.hasCalendarScope) }
                    }
                }
            }
            .accessibilityIdentifier("deskGridJesseIcon_Calendar")
        }
    }

    private func jesseBoxIcon(_ system: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .semibold))
                .foregroundColor(Color(gridHex: "143a2e"))
                .frame(width: 30, height: 30)
                .background(Circle().fill(Color.white.opacity(0.85)))
        }
        .buttonStyle(.plain)
    }

    /// The whole tile is the upload target - tapping anywhere on it
    /// (handled by `handleTile`) opens the file picker directly, no
    /// intermediate screen. This is just the display: an upload hint when
    /// empty, or a scrollable "transcript space" of every solved item this
    /// session (filename + real AI summary) once there's something to show.
    @ViewBuilder
    private func homeworkHelpTileBody(ink: Color) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                if homeworkUploading {
                    ProgressView().tint(ink)
                } else {
                    Image(systemName: "square.and.arrow.up")
                        .foregroundColor(ink)
                }
                Text(homeworkUploading ? "Reading\u{2026}" : "Tap to upload a photo or PDF")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(ink)
            }
            if let homeworkError {
                Text(homeworkError)
                    .font(.system(size: 11, weight: .semibold, design: .rounded))
                    .foregroundColor(Color(gridHex: "b0473f"))
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityIdentifier("deskGridHomeworkError")
            }
            if !homeworkUploads.isEmpty {
                ScrollView(showsIndicators: true) {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(homeworkUploads) { upload in
                            VStack(alignment: .leading, spacing: 3) {
                                Text(upload.fileName)
                                    .font(.system(size: 11, weight: .heavy, design: .rounded))
                                    .foregroundColor(ink)
                                ForEach(upload.cards, id: \.title) { card in
                                    Text(card.body)
                                        .font(.system(size: 11, weight: .medium, design: .rounded))
                                        .foregroundColor(ink.opacity(0.85))
                                        .lineLimit(4)
                                }
                                ForEach(upload.microsims) { sim in
                                    Button { presentedMicroSim = sim } label: {
                                        HStack(spacing: 4) {
                                            Image(systemName: "play.circle.fill")
                                            Text(sim.title)
                                                .lineLimit(1)
                                        }
                                        .font(.system(size: 11, weight: .bold, design: .rounded))
                                        .foregroundColor(Color(gridHex: "5b3e8f"))
                                    }
                                    .buttonStyle(.plain)
                                    .accessibilityIdentifier("deskGridMicroSim_\(sim.id)")
                                }
                            }
                            .padding(8)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color(gridHex: "f3f1ec")))
                        }
                    }
                }
                .accessibilityIdentifier("deskGridHomeworkUploads")
            }
        }
    }

    /// Real, live per-student mastery graph - the old Moodle LMS slot's
    /// new job (2026-08-18, explicit ask: "this box will be used to show
    /// the knowledge graph of this topic or your knowledge graph live
    /// evolving as you learn"). Draws straight from
    /// `knowledgeGraphClient.nodes`/`.edges`, the SAME live
    /// `GET /knowledge-graph/{uid}` data `KnowledgeMapView`'s full-screen
    /// map already renders - real x/y PCA coordinates and real
    /// mastery/status per concept, not a mock or a static illustration.
    /// Visual pass (2026-08-18, explicit ask: "why his look so cool ours
    /// look bad"): glowing radial-gradient nodes sized by real engagement
    /// (`eventCount`) instead of flat same-size dots, a legend instead of
    /// unlabeled colors, and a real single-node "empty" state instead of
    /// plain text - "should show as an empty node before you start to
    /// learn anything."
    @ViewBuilder
    private func knowledgeGraphTileBody() -> some View {
        VStack(spacing: 10) {
            if knowledgeGraphClient.nodes.isEmpty {
                Spacer(minLength: 0)
                if knowledgeGraphClient.isLoading {
                    ProgressView().tint(tileInk)
                } else {
                    emptyGraphSeed
                }
                Text(knowledgeGraphClient.isLoading
                    ? "Mapping your knowledge\u{2026}"
                    : "This grows as you learn and engage with new things.")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(tileInk.opacity(0.7))
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 0)
            } else {
                HStack(spacing: 10) {
                    let mastered = knowledgeGraphClient.nodes.filter { $0.status == "mastered" }.count
                    Text("\(mastered)/\(knowledgeGraphClient.nodes.count) concepts mastered")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundColor(tileInk.opacity(0.75))
                    Spacer(minLength: 0)
                    knowledgeGraphLegend
                }
                KnowledgeGraphCanvas(nodes: knowledgeGraphClient.nodes, edges: knowledgeGraphClient.edges)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityIdentifier("deskGridKnowledgeGraphCanvas")
            }
        }
    }

    /// A single, real node glyph standing in for "you, before you've
    /// learned anything yet" - not a fabricated preview node, just this
    /// tile's own node-drawing style applied once, centered, gently
    /// pulsing to read as alive/waiting rather than static.
    private var emptyGraphSeed: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [Color(gridHex: "b7aed6"), Color(gridHex: "b7aed6").opacity(0)], center: .center, startRadius: 0, endRadius: 22))
                .frame(width: 44, height: 44)
            Circle()
                .fill(Color(gridHex: "b7aed6"))
                .frame(width: 10, height: 10)
                .overlay(Circle().strokeBorder(Color.white.opacity(0.85), lineWidth: 1.5))
        }
        .modifier(PulseEffect())
    }

    private var knowledgeGraphLegend: some View {
        HStack(spacing: 8) {
            legendDot("3fae5a", "Mastered")
            legendDot("d9a441", "Learning")
            legendDot("c1121f", "Struggling")
        }
    }

    private func legendDot(_ hex: String, _ label: String) -> some View {
        HStack(spacing: 3) {
            Circle().fill(Color(gridHex: hex)).frame(width: 6, height: 6)
            Text(label)
                .font(.system(size: 9, weight: .semibold, design: .rounded))
                .foregroundColor(tileInk.opacity(0.55))
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
                    // Used to redirect into Homework Help's own "Connect
                    // your AI key" prompt - that prompt no longer exists
                    // now that Homework Help is a direct upload target with
                    // no settings screen of its own. No other "jump straight
                    // to AI key settings" callback exists in this view, so
                    // this points at the real destination (Manage) instead
                    // of a fabricated shortcut.
                    Text("Connect your AI key from Manage to draft replies.")
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
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

    private func tileLines(_ kind: TileKind) -> [String] {
        switch kind {
        case .intel:
            return intelLines
        case .moodle:
            return []
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
        await knowledgeGraphClient.load()
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
    /// The real nav rail (2026-08-18, second pass on the same-night
    /// redesign): "the flows should move to setting column... lock on
    /// the screen on the dash... we only go to other panels... through
    /// the setting column by pressing on different flows." Presentation/
    /// GDoc/Resume/Book/Design (the old `flowsRail`'s rows, previously
    /// only reachable by toggling the "Flows" dock chip open) live here
    /// now, always visible, icon-only - Settings/Manage anchored at the
    /// bottom. Styled as its own rounded "box" with the same dotted
    /// texture as the board (explicit ask: "it should be a box too
    /// looks weird right now the settings column").
    private var leftSidebar: some View {
        VStack(spacing: 14) {
            sidebarIcon("rectangle.on.rectangle", label: "Presentation") { onOpenCreate(.presentation) }
            sidebarIcon("doc.text", label: "GDoc") { onOpenCreate(.gdoc) }
            sidebarIcon("person.text.rectangle", label: "Resume") { onOpenFlow("resume") }
            sidebarIcon("book", label: "Book") { onOpenFlow("book") }
            sidebarIcon("square.grid.2x2.fill", label: "Design") { onOpenFlow("design") }
            Spacer(minLength: 0)
            sidebarIcon("gearshape.fill", label: "Settings", identifier: "deskGridSidebarManage", action: onOpenManage)
        }
        .padding(.vertical, 20)
        .frame(width: 76)
        .frame(maxHeight: .infinity)
        .background(
            ZStack {
                RoundedRectangle(cornerRadius: 22, style: .continuous)
                    .fill(Color(gridHex: "141416"))
                DottedDeskGrid()
                    .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
            }
        )
        .overlay(
            RoundedRectangle(cornerRadius: 22, style: .continuous)
                .strokeBorder(Color.white.opacity(0.08), lineWidth: 1)
        )
        .padding(.leading, 14)
        .padding(.vertical, 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .ignoresSafeArea()
    }

    private func sidebarIcon(_ system: String, label: String, identifier: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 17, weight: .semibold))
                .foregroundColor(.white.opacity(0.85))
                .frame(width: 44, height: 44)
                .background(Circle().fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier ?? "deskGridSidebar_\(label)")
        .accessibilityLabel(label)
    }

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
        // Explicit ask (2026-08-18, second pass): "i just want the search
        // bar to be clean Archive Flows and Book for now." Memo/Transcribe
        // moved to the icon row above Jesse's greeting (see
        // jesseBoxIconRow); Learn removed too now that it's been clarified
        // twice - "the dashboard IS learn" means the dock doesn't also need
        // a separate Learn destination. Note: this makes LearnStudioView
        // (including "Study a Book") unreachable from this dock - the
        // screen and its code are untouched, just not linked to from here
        // anymore. Flag this if that's not what was meant.
        HStack(spacing: 8) {
            dockChip("Archive", system: "archivebox.fill", identifier: "deskGridDock_Archive", action: onOpenArchive)
            // "Flows" chip removed (2026-08-18, explicit ask: "the flows
            // should move to setting column... we only go to other
            // panels... through the setting column") - Presentation/
            // GDoc/Resume/Book/Design now live as always-visible icons in
            // `leftSidebar` instead of a toggled popup. +Book kept as its
            // own quick chip since it was already a direct one-tap
            // action, not a rail toggle.
            dockChip("+Book", system: "book.fill", identifier: "deskGridDock_Book") { onOpenFlow("book") }
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
                // Used to redirect into Homework Help's own "Connect your AI
                // key" prompt - that prompt no longer exists now that
                // Homework Help is a direct upload target with no settings
                // screen of its own (see onFileHomeworkToBinder). Left as a
                // plain disabled state rather than a broken redirect;
                // Manage is the real destination for connecting a key.
                EmptyView()
                    .accessibilityLabel("Connect your AI key from Manage to power search")
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
            flowRow("+ Design", system: "square.grid.2x2.fill") { onOpenFlow("design") }
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

/// 1440×810 boxes measured from Presentation_Screen.pdf, with later
/// departures from the original PDF layout: Email/Gcal are no longer
/// separate boxes - their content lives inside Intel's box (2026-08-17) -
/// and (2026-08-18, explicit ask) Intel/Homework Help/Moodle now stack as
/// one compact left column (each the same width/height) and Binder
/// expands to fill everything else - the union of its own old footprint
/// and Intel's old top-right slot - since a filing system genuinely
/// benefits from more room more than a three-way tie for space did.
private enum WorkArtboard {
    // Reverted (2026-08-18, explicit ask: "why is it like that from the
    // start bring that back to its place... binder... looks ugly as
    // f*** right now") - the same-day "stack Intel under Moodle, Binder
    // fills the rest" layout is gone. Intel is back at its original,
    // roomy top-right slot; Binder is back to its original, proportionate
    // size instead of a mostly-empty 932pt-wide box. The .moodle slot's
    // POSITION is unchanged from the original layout - only its content
    // changed (Knowledge Graph, not the LMS connector - see tileBody).
    static let p4HomeworkHelp = CGRect(x: 81, y: 118, width: 376, height: 227)
    static let p4Moodle = CGRect(x: 115, y: 378, width: 315, height: 222)
    static let p4Binder = CGRect(x: 492, y: 61, width: 505, height: 568)
    static let p4Intel = CGRect(x: 1032, y: 107, width: 392, height: 522)

    static let p5HomeworkHelp = CGRect(x: 76, y: 103, width: 319, height: 192)
    static let p5Moodle = CGRect(x: 106, y: 323, width: 267, height: 188)
    static let p5Binder = CGRect(x: 425, y: 54, width: 428, height: 524)
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

/// Gentle, always-on pulse for the Knowledge Graph tile's empty-state seed
/// node - unlike `JesseMiniWaveform`'s conditional pulse elsewhere in this
/// app, this one never needs to stop (it's replaced by the real canvas the
/// moment real nodes exist), so a plain `.onAppear`-triggered
/// `repeatForever` is safe here.
private struct PulseEffect: ViewModifier {
    @State private var pulsing = false
    func body(content: Content) -> some View {
        content
            .scaleEffect(pulsing ? 1.15 : 0.85)
            .opacity(pulsing ? 1 : 0.55)
            .onAppear {
                withAnimation(.easeInOut(duration: 1.3).repeatForever(autoreverses: true)) {
                    pulsing = true
                }
            }
    }
}

/// The Knowledge Graph tile's real drawing surface - glowing radial-
/// gradient nodes sized by real engagement (`eventCount`), colored by
/// real status, edges weighted by their real Beta-Binomial posterior
/// (`edge.weight`). A visual pass (2026-08-18, explicit ask: "why his
/// look so cool ours look bad") over the original flat, same-size dots.
private struct KnowledgeGraphCanvas: View {
    let nodes: [KnowledgeGraphNode]
    let edges: [KnowledgeGraphEdge]

    var body: some View {
        Canvas { context, size in
            func point(_ node: KnowledgeGraphNode) -> CGPoint? {
                guard let x = node.x, let y = node.y else { return nil }
                return CGPoint(x: x * size.width, y: y * size.height)
            }
            var positions: [String: CGPoint] = [:]
            for node in nodes { positions[node.id] = point(node) }

            for edge in edges {
                guard let from = positions[edge.from], let to = positions[edge.to] else { continue }
                var path = Path()
                path.move(to: from)
                path.addLine(to: to)
                context.stroke(
                    path,
                    with: .color(Color(gridHex: "5b3e8f").opacity(0.12 + edge.weight * 0.25)),
                    lineWidth: 1 + edge.weight * 1.5
                )
            }
            for node in nodes {
                guard let p = point(node) else { continue }
                let dotColor: Color
                switch node.status {
                case "mastered": dotColor = Color(gridHex: "3fae5a")
                case "in_progress": dotColor = Color(gridHex: "d9a441")
                case "struggling": dotColor = Color(gridHex: "c1121f")
                default: dotColor = Color(gridHex: "b7aed6")
                }
                let engagement = min(1, Double(node.eventCount ?? 0) / 10)
                let r: CGFloat = 3.5 + CGFloat(engagement) * 3.5
                let glowRadius = r * 2.2
                context.fill(
                    Path(ellipseIn: CGRect(x: p.x - glowRadius, y: p.y - glowRadius, width: glowRadius * 2, height: glowRadius * 2)),
                    with: .radialGradient(
                        Gradient(colors: [dotColor.opacity(0.35), dotColor.opacity(0)]),
                        center: p, startRadius: 0, endRadius: glowRadius
                    )
                )
                context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)), with: .color(dotColor))
                context.stroke(
                    Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                    with: .color(.white.opacity(0.7)), lineWidth: 1
                )
            }
        }
    }
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
