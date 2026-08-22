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

/// One lesson Jesse has finished generating - surfaced as its own entry
/// under Knowledge Graph (2026-08-19), distinct from a raw Homework Help
/// upload. `id` is the topic itself: two generations of the SAME topic in
/// one session are intentionally treated as the same book (re-opening shows
/// the latest), not two list entries - there's no other stable identity a
/// re-ask of the same topic would have.
private struct GeneratedBook: Identifiable, Equatable {
    let id: String
    let lesson: WorkDashboardLesson

    init(lesson: WorkDashboardLesson) {
        self.id = lesson.topic
        self.lesson = lesson
    }
}

/// Manual `UIDocumentPickerViewController` wrapper, not SwiftUI's own
/// `.fileImporter` - confirmed via a diagnostic UI test that `.fileImporter`
/// here flips `isPresented` correctly (the tap/state wiring was never the
/// problem) but the system picker never actually appears, regardless of
/// whether the modifier sits on the tile's own Button or the screen root.
/// Driving `UIDocumentPickerViewController` directly through `.sheet`
/// sidesteps whatever's silently swallowing `.fileImporter`'s own
/// presentation here. Not `private` - `CreateCanvasView` reuses this exact
/// picker for its own upload target (2026-08-18) rather than a second copy.
struct HomeworkDocumentPicker: UIViewControllerRepresentable {
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
    /// Same shape as onFileHomeworkToBinder below - real side effect
    /// (BinderStore.addChapterBook) owned by FieldDeskView, since this
    /// view doesn't hold the real BinderStore instance. Threaded through
    /// to BookLibraryView's own callback of the same shape.
    var onFileChapterBook: (_ title: String, _ subjectId: String) -> Void = { _, _ in }
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
    /// Real `BinderItem`s (type == "book"), carrying the subjectId
    /// `onOpenBinderChapterBook` needs - `binderTitles` above is plain
    /// display strings only and can't identify which book was tapped.
    /// Real bug, live testing 2026-08-21: without this, every row in the
    /// Binder tile's preview list was non-interactive (plain text, no
    /// Button), so any tap - including directly on a book's title -
    /// bubbled up to the tile's own generic `handleTile(.binder)` and
    /// opened the unrelated `onOpenBinder()` destination instead. Reported
    /// as "it's not pressable... opens another notepad-like field."
    var binderChapterBooks: [BinderItem] = []
    /// Opens a specific tapped chapter book from the Binder tile - wired to
    /// FieldDeskView's existing `openChapterBookFromBinder`, which already
    /// does the real fetch + BookReaderView presentation correctly; this
    /// view doesn't own that presentation layer.
    var onOpenBinderChapterBook: (_ subjectId: String, _ fallbackTitle: String) -> Void = { _, _ in }
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
    /// Real `/recommend` (mode: exam) weakness signal - same source
    /// ArchiveWorkflowView's own `weakness` already reads
    /// (RouteClient.fetchExamProfile()). Real fix, 2026-08-21, direct
    /// live question: "Does it know me over time?" - checked the actual
    /// code and found `studentWeakness` was hardcoded nil on every call
    /// site that reaches the Work Dashboard flow, even though this exact
    /// real mastery signal was already one screen away the whole time.
    /// Threaded into Jesse as soft context only (same discipline
    /// ArchiveWorkflowView's own comment states) - the deterministic
    /// mastery engine stays the source of truth for WHAT is weak, Jesse
    /// decides in language whether it's worth mentioning at all.
    @State private var studentWeakness: (id: String, label: String)?
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
    /// Local, static, no network - same source `DashboardView`'s own Map
    /// tab already loads it from. Needed for `KnowledgeMapView`'s real
    /// zoom/tap-node/mastery-detail/GPS experience (2026-08-19, explicit
    /// ask: "our original web design... click on individual dots and see
    /// your mastery and see little notes... and also a learning GPS. What
    /// happened to that?" - it was never missing, just not reachable from
    /// this dashboard: `KnowledgeMapView` is a real, already-complete port
    /// of the web `ConstellationGpsExplorer`, wired into `DashboardView`'s
    /// Map tab and nowhere else).
    private let conceptDisplays: [String: ConceptDisplay] = TocDataLoader.loadConceptDisplays()

    // MARK: - Homework Help (the tile itself is the upload target now)
    @State private var showHomeworkImporter = false
    /// Chapter Library sheet (2026-08-20) — assembled, gated chapter
    /// content from mindcraft-content-engine's book_assembler, fetched live
    /// via BookLibraryClient. A plain `.sheet`, not another FieldDeskView-
    /// style ZStack overlay — sidesteps that system's documented touch-
    /// swallowing bug class entirely (see CLAUDE.md's FieldDeskView
    /// section) by using UIKit's own presentation controller instead.
    @State private var showBookLibrary = false
    @State private var showSessionReports = false
    @State private var homeworkUploading = false
    @State private var homeworkError: String?
    @State private var homeworkUploads: [HomeworkUploadSummary] = []
    @State private var presentedMicroSim: MicroSimRecord?
    /// A gate-passed GENERATED sim being viewed full-screen (closed test,
    /// LIVE_GATED_GENERATION_TEST_SPEC.md) - same presentation pattern as
    /// `presentedMicroSim`, deliberately a separate slot because a
    /// `GeneratedSimResult` is not a `MicroSimRecord` and its viewer
    /// carries the AI-generated attribution the bundled sims don't need.
    @State private var presentedGeneratedSim: GeneratedSimResult?
    /// A tapped Homework Help upload being read in the merged Binder+Intel
    /// space. No real trigger sets this anymore (2026-08-19, explicit ask:
    /// "Homework Help should just be a space for uploads" - the tap-to-view
    /// interaction moved to generated books, see `viewingBook` below) -
    /// kept structurally rather than deleted, since `uploadContentViewerBody`/
    /// the merged-space plumbing below still branches on it and a plain
    /// homework upload's cards are still worth being able to open this way
    /// later if that's ever wanted back.
    @State private var viewingUpload: HomeworkUploadSummary?
    /// Every lesson Jesse has finished generating this session (2026-08-19,
    /// explicit ask - real UX rework, not a tweak: a generated lesson is no
    /// longer an automatic full-screen takeover the moment it's ready
    /// (`StudySessionView` used to react to `jesseCall.workDashboardLesson`
    /// directly). It now becomes a durable "book" entry surfaced under the
    /// Knowledge Graph tile - `handleNewLesson` appends here instead of
    /// filing into Binder/Homework Help.
    @State private var generatedBooks: [GeneratedBook] = []
    /// The book currently open in the merged Binder+Intel space -
    /// `StudySessionView`'s Contents/chapter navigation renders embedded
    /// there (see `tileBody`'s `.binder` branch) instead of as a full-screen
    /// overlay. Mutually exclusive with `viewingUpload`/
    /// `viewingKnowledgeGraphInBinder` by construction - every place that
    /// sets one of the three clears the other two (`closeBinderContentViewer`).
    @State private var viewingBook: GeneratedBook?
    /// The live per-student mastery graph, shown big in the merged
    /// Binder+Intel space (2026-08-19, explicit ask: "when you click on
    /// Knowledge Graph, the knowledge graph should be displayed on Binder
    /// too") - the small in-tile `knowledgeGraphTileBody()` canvas stays as
    /// the at-a-glance view; this is the same live data, just full-size.
    @State private var viewingKnowledgeGraphInBinder = false
    /// Archive mode (2026-08-19, explicit ask: "when you press archive
    /// button... homework help goes blank and binder expands... all the
    /// books we have Dan's and ours will be there... you can search or
    /// scroll there itself and if you click on a book it shows content").
    /// Replaces the old dock behavior (a separate full-screen
    /// `ArchiveWorkflowView` via `onOpenArchive`) for THIS button - that
    /// flow stays reachable from `WorkflowLibraryView`'s own "Open Archive"
    /// entry, just not this one anymore.
    @State private var viewingArchiveBrowser = false
    /// The lesson currently shown as a summary + "what you'll learn" card
    /// in Homework Help WHILE browsing the archive (2026-08-19, explicit
    /// ask: "per click homework help shows you a book summary and what you
    /// will learn... like a learning outcome"). nil = the blank/prompt
    /// state before any book is picked. Deliberately separate from
    /// `viewingBook` (which drives Binder's own content) even though a tap
    /// sets both to the SAME lesson at once - Homework Help should keep
    /// showing this book's summary even if `viewingBook` later changes
    /// (e.g. a different close/reopen path), and clearing on
    /// `closeBinderContentViewer` shouldn't accidentally resurrect stale
    /// upload state.
    @State private var archiveSummaryLesson: WorkDashboardLesson?
    @State private var archiveSearchQuery = ""
    @State private var archiveSearchResults: [ArchiveRagClient.Hit] = []
    @State private var archiveSearchLoading = false
    /// Which archive title is mid-open (a real network round trip via
    /// ArchiveRagClient, unlike the bundled BookGraphLoader books which
    /// open instantly from local data) - drives a per-row spinner so a tap
    /// gives immediate feedback instead of looking unresponsive.
    @State private var archiveOpeningTitle: String?
    /// Dan McCreary's real archive, browsable by title (2026-08-19, real
    /// bug fix: "im not seeing dans books in archuve at all" - before this,
    /// his archive was reachable only through live search, with no list to
    /// browse the way the app's own bundled books already had one).
    /// Fetched once when Archive mode opens (see `archiveBrowserBody`'s
    /// `.task`), not on every re-render.
    @State private var archiveBooks: [ArchiveBooksClient.Book] = []
    @State private var archiveBooksLoading = false
    /// Real error visibility (2026-08-19, live report: "archive is not
    /// having all the dan books... it should show all books") - the actual
    /// bug wasn't the endpoint (verified separately, returns all 18 real
    /// books) but that `ArchiveBooksClient.list()` swallows every failure
    /// (`try?`) into a plain empty array, indistinguishable on screen from
    /// "still loading" or "genuinely empty" - a transient network hiccup on
    /// a real device silently left the section looking broken/incomplete
    /// with no way to tell why or retry.
    @State private var archiveBooksError = false

    /// True whenever Binder should be showing ANY of the merged-space
    /// content modes above rather than its own normal titles/blurb - the
    /// single condition every layout/visibility check below reads instead
    /// of each hand-rolling its own `viewingUpload != nil || viewingBook !=
    /// nil || ...` (three call sites already needed this before
    /// `viewingBook`/`viewingKnowledgeGraphInBinder` existed; missing one on
    /// a new mode is exactly the kind of bug this centralizes away).
    private var binderContentViewerActive: Bool {
        viewingUpload != nil || viewingBook != nil || viewingKnowledgeGraphInBinder || viewingArchiveBrowser
    }

    private func closeBinderContentViewer() {
        viewingUpload = nil
        viewingBook = nil
        viewingKnowledgeGraphInBinder = false
        viewingArchiveBrowser = false
        archiveSummaryLesson = nil
        archiveSearchQuery = ""
        archiveSearchResults = []
        // A live-sim request/verdict belongs to the Study Session that
        // asked for it - clearing here (which also drops any in-flight
        // request's eventual verdict, see clearLiveSimState) keeps a stale
        // outcome from resurfacing under the next book opened.
        jesseCall.clearLiveSimState()
    }

    /// The one seeded Study Session lesson every `--ui-testing-*` seed
    /// path shares (study-session, generated-sim, generated-sim-nogood) -
    /// extracted from the study-session block so the copies can't drift.
    private static var uiTestSeedLesson: WorkDashboardLesson {
        WorkDashboardLesson(
            topic: "derivatives",
            source: .archive(bookTitle: "Calculus"),
            chapters: ["Framing Concepts Through Delta", "The Power Rule", "Chain Rule", "Key Takeaways"],
            chapterBodies: [
                "A derivative measures how fast a quantity changes - the slope of the tangent line at a single point, found by shrinking the interval delta-x toward zero.",
                "For any power of x, bring the exponent down and subtract one from it: the derivative of x^n is n times x^(n-1). This one rule handles most polynomial terms you'll see.",
                "When a function is built out of another function, differentiate the outside first, then multiply by the derivative of the inside.",
                "Derivatives turn a curve's shape into numbers you can reason about: where it's rising, falling, or momentarily flat.",
            ],
            definition: "A derivative measures the instantaneous rate of change of a function.",
            question: "If f(x) = x^3, what is f'(x)?",
            microsims: [],
            citations: [
                LessonCitation(bookTitle: "Calculus", pageTitle: "Framing Concepts Through Delta", url: "https://dmccreary.github.io/calculus/chapters/02-limits/framing-concepts-through-delta/"),
                LessonCitation(bookTitle: "Calculus", pageTitle: "Key Takeaways", url: "https://dmccreary.github.io/calculus/chapters/03-derivatives/key-takeaways/"),
            ]
        )
    }

    /// In-canvas pan navigation for the sidebar's destinations (2026-08-18,
    /// explicit ask, second time asked more forcefully after the first pass
    /// deferred it: "when I press on Presentation, it should not open a
    /// completely new screen. Instead, it should be an animation of our
    /// current screen moving to the left... and it sits down in a nice,
    /// empty space... in the same big canvas in one place instead of
    /// opening to a new tab"). Rendered as a second same-size pane beside
    /// the dashboard's own board (see `body`'s HStack) and slid into view
    /// with an offset animation instead of going back out through
    /// `onOpenCreate`/`onOpenFlow` into FieldDeskView's separate full-
    /// screen-cover overlays. The dock's own "Design" chip (see `workDock`)
    /// also routes through this now, same as the sidebar's own "Develop"
    /// icon - only the long-press Flows rail (already dead/unreachable
    /// code, nothing sets `rail = .flows` anymore) still points at
    /// FieldDeskView's older overlays.
    @State private var activeSidebarFlow: SidebarFlow?

    private enum SidebarFlow: Equatable {
        case presentation, gdoc, resume, develop, englishPractice
    }

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
        onFileChapterBook: @escaping (_ title: String, _ subjectId: String) -> Void = { _, _ in },
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
        binderChapterBooks: [BinderItem] = [],
        onOpenBinderChapterBook: @escaping (_ subjectId: String, _ fallbackTitle: String) -> Void = { _, _ in },
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
        self.onFileChapterBook = onFileChapterBook
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
        self.binderChapterBooks = binderChapterBooks
        self.onOpenBinderChapterBook = onOpenBinderChapterBook
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
            // The left sidebar is gone (2026-08-19, explicit ask: "add the
            // settings and resume to the search bar dock too... use that
            // space to make the boxes bigger horizontally as well as
            // vertically" - Develop didn't need its own move, workDock's
            // "Design" chip already opened the identical destination
            // (openSidebarFlow(.develop)), so it was already redundant
            // with the sidebar's own Develop icon). No more reserved inset
            // to leave room for it - `scale` now uses the FULL width, which
            // (since this device's aspect ratio is still width-bound - see
            // the top-align note below) makes the whole board measurably
            // bigger, not just repositioned.
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            let board = CGSize(width: artboard.width * scale, height: artboard.height * scale)
            // Two same-size panes side by side - the dashboard, then
            // whichever sidebar destination is active - slid horizontally
            // instead of each destination presenting as its own covering
            // overlay (2026-08-18, explicit ask, see `activeSidebarFlow`'s
            // doc comment). `flowPane` mounts lazily (only when non-nil,
            // via the Group below) so there's no cost while idle.
            HStack(spacing: 0) {
            ZStack(alignment: .top) {
                // Back to cream (2026-08-18, reverted: "the black polka
                // dots is take it back to white polka dots please I don't
                // like this I like the white polka dots better").
                Color(gridHex: "fff8e9").ignoresSafeArea()
                // Full-screen, not just the board's own scaled size - on a
                // device whose aspect ratio doesn't match the 1440x810
                // artboard exactly, the board is letterboxed (real empty
                // margin above/below or left/right), and dots confined to
                // the board left that margin looking like dead space
                // (explicit ask: "expand the polka dots to go above and
                // below too").
                BlueprintGrid()
                    .frame(width: geo.size.width, height: geo.size.height)
                // Top-aligned, not centered (2026-08-18, explicit ask:
                // "push Homework Help and Intel all the way up... right at
                // the top of the screen"). The 1440x810 artboard is wider
                // than this device's own aspect ratio, so `scale` is
                // bounded by width - centering the board left real empty
                // margin above AND below it; top-aligning removes the
                // above-margin entirely so the tile column actually sits
                // at the screen's top edge instead of floating mid-screen.
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
            .task { await loadWeakness() }
            .onAppear {
                // Real STT/vision-OCR can't be driven by an automated test
                // (no simulator camera/mic), so this seeds an already-
                // uploaded, already-viewed file with a fixed summary -
                // same shape as `--ui-testing-jesse-call` elsewhere in
                // this app. Proves the content-viewer layout (Binder
                // expands into Intel's space, search icon becomes the
                // raccoon) independent of the real upload pipeline.
                if ProcessInfo.processInfo.arguments.contains("--ui-testing-content-viewer") {
                    let seed = HomeworkUploadSummary(
                        fileName: "chapter3_notes.pdf",
                        cards: [
                            IngredientHintsClient.HintCard(title: "Definition", body: "A derivative measures the instantaneous rate of change of a function."),
                            IngredientHintsClient.HintCard(title: "Chapters", body: "Limits\nDerivative Rules\nApplications"),
                        ]
                    )
                    homeworkUploads = [seed]
                    viewingUpload = seed
                }
                // Seeds directly into `generatedBooks`/`viewingBook`, same
                // directness as `--ui-testing-content-viewer` above, rather
                // than round-tripping through `jesseCall.workDashboardLesson`
                // (2026-08-19: a generated lesson no longer auto-opens the
                // moment it exists - see `handleNewLesson` - so seeding the
                // OLD way would land the book in the strip but never open
                // it, and this flag's whole point is proving the open
                // Contents/chapter view itself, same as this flag's name
                // always meant).
                if ProcessInfo.processInfo.arguments.contains("--ui-testing-study-session") {
                    let book = GeneratedBook(lesson: Self.uiTestSeedLesson)
                    generatedBooks = [book]
                    viewingBook = book
                }
                // Live gated-generation state seeds (closed test,
                // LIVE_GATED_GENERATION_TEST_SPEC.md) - a real verdict
                // needs the deployed generation service (deliberately not
                // deployed, see LiveGatedGeneration) plus a 60s+ round
                // trip, so these seed terminal states directly, same
                // directness as --ui-testing-study-session above. Both
                // args also enable the LiveGatedGeneration gate itself so
                // the section renders at all. The verified seed ALSO
                // presents the GeneratedSimView cover directly: the
                // section's own open button sits inside the same
                // non-publishing ScrollView as the tab pills (see
                // StudySessionView's `content` doc comment), so a test
                // can't tap it - the cover's chrome, like microSimView's,
                // resolves normally.
                let simArgs = ProcessInfo.processInfo.arguments
                if simArgs.contains("--ui-testing-generated-sim") || simArgs.contains("--ui-testing-generated-sim-nogood") {
                    let book = GeneratedBook(lesson: Self.uiTestSeedLesson)
                    generatedBooks = [book]
                    viewingBook = book
                    if simArgs.contains("--ui-testing-generated-sim") {
                        let result = GeneratedSimResult(
                            title: "Tangent Slope Explorer",
                            description: "Drag a point along a curve and watch the tangent line's slope update.",
                            html: "<!DOCTYPE html><html><body><h1>Tangent Slope Explorer</h1><p>Seeded UI-test fixture - not a real generated sim.</p></body></html>",
                            conceptId: "act_math::derivatives",
                            conceptLabel: "Derivatives",
                            learningObjectives: ["Relate a curve's steepness to the derivative's value"],
                            rubricPercentage: 91.0,
                            qualityGateScore: 88,
                            topic: "derivatives",
                            topicSlug: "derivatives"
                        )
                        jesseCall.seedLiveSimStateForTesting(.verified(result, topic: "derivatives", cached: false))
                        presentedGeneratedSim = result
                    } else {
                        jesseCall.seedLiveSimStateForTesting(.noGoodResult(
                            topic: "derivatives",
                            reason: "Too broad an umbrella - no single interaction teaches all of derivatives.",
                            alsoTried: "the power rule"
                        ))
                    }
                }
                // Jesse greets the moment the dashboard is on screen
                // (2026-08-19, explicit ask: "Jesse should say Hi Akshat the
                // moment you land on dash") - previously this only fired
                // once the student manually tapped the dashboard's own Jesse
                // rail to start a call (`JesseRailView(..., context:
                // "workDashboard")`'s call button -> `begin()`). `begin()`
                // already no-ops if a call is already active
                // (`guard !isActive else { return }`), so calling it here is
                // safe to repeat and won't double-greet on every re-render.
                // Skipped under any UI test flag - a real spoken greeting is
                // an unrelated async side effect (network TTS call) that
                // existing tests don't expect and shouldn't have to account
                // for.
                if !ProcessInfo.processInfo.arguments.contains(where: { $0.hasPrefix("--ui-testing") }) {
                    jesseCall.begin(
                        context: "workDashboard",
                        studentWeakness: studentWeakness.map { (conceptId: $0.id, label: $0.label) },
                        studentName: studentName
                    )
                }
            }

            Group {
                if let activeSidebarFlow {
                    // No more leading padding to clear a vertical sidebar
                    // (2026-08-19, explicit ask: "toolbar move to the
                    // bottom in design and resume too we dont need that
                    // vertical column there") - flow panes now use the
                    // full width, matching the dashboard's own sidebar-free
                    // layout from earlier tonight.
                    flowPane(activeSidebarFlow)
                        .id(activeSidebarFlow)
                } else {
                    Color.clear
                }
            }
            .frame(width: geo.size.width, height: geo.size.height)
            }
            .frame(width: geo.size.width * 2, height: geo.size.height, alignment: .leading)
            .offset(x: activeSidebarFlow == nil ? 0 : -geo.size.width)
            // Persistent across both the dashboard AND any flow pane
            // (2026-08-19, explicit ask: "toolbar move to the bottom in
            // design and resume too we dont need that vertical column
            // there" - the vertical leftSidebar is gone now, not just
            // hidden). activeDock itself picks Dashboard/Resume/Design/
            // Settings (sidebarFlowDock) while a flow is open vs. the
            // normal workDock/flowsDock otherwise - same bottom-pinned
            // screen-space position either way, so this needs to sit
            // outside the sliding HStack above (which is off-screen during
            // a flow) exactly the way leftSidebar used to.
            bottomDock
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .onChange(of: intelLines) { _, lines in boxBus.intelLines = lines }
        .onChange(of: binderTitles) { _, titles in boxBus.binderTitles = titles }
        .onChange(of: jesseCall.workDashboardLesson) { _, lesson in handleNewLesson(lesson) }
        // Voice-triggered navigation (2026-08-19, explicit ask: "if i say i
        // want to practice... take me to the practice screen") -
        // JesseCallSession only signals, this view owns navigation.
        .onChange(of: jesseCall.practiceRequested) { _, requested in
            guard requested else { return }
            jesseCall.practiceRequested = false
            openSidebarFlow(.englishPractice)
            // Auto-starts the new screen's call + listening, same two
            // calls JesseRailView's own jumpOnCall() makes for a manual
            // tap - a student who just SAID "I want to practice" mid-call
            // should land already talking, not need a second manual tap
            // to re-start what feels like the same conversation.
            jesseCall.begin(context: "englishPractice", studentName: studentName)
            jesseCall.startListening()
        }
        .fullScreenCover(item: $presentedMicroSim) { sim in
            MicroSimView(sim: sim) { presentedMicroSim = nil }
        }
        .fullScreenCover(item: $presentedGeneratedSim) { sim in
            GeneratedSimView(sim: sim) { presentedGeneratedSim = nil }
        }
        .sheet(isPresented: $showBookLibrary) {
            BookLibraryView(onFileChapterBook: onFileChapterBook)
        }
        .fullScreenCover(isPresented: $showSessionReports) {
            SessionReportsView(onClose: { showSessionReports = false })
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
            // Intel/Homework Help/Knowledge Graph are all skipped entirely
            // in content-viewer mode (see boxRect/searchField) - Binder
            // expands into the FULL board (2026-08-21 widening, see
            // `contentViewerBinder`'s own doc comment). Intel's own
            // exclusion predates this; Homework Help/Moodle's is new here.
            if !binderContentViewerActive {
                pin(boxRect(.intel), scale: scale) {
                    photoTile(.intel)
                }
                pin(boxRect(.moodle), scale: scale) {
                    photoTile(.moodle)
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
            }
            pin(boxRect(.binder), scale: scale) {
                photoTile(.binder)
            }
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
            // Back to dark green - the board background reverted to
            // cream (2026-08-18, "take it back to white polka dots"),
            // and white-on-cream is unreadable.
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
                    // Thinner colored "border" around the inner card
                    // (was 10 - explicit ask, 2026-08-18: "reduce the
                    // border in those boxes make them very thin").
                    .padding(5)
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
            // instead of opening the old Moodle LMS connect sheet, AND
            // opens the same graph big in the merged Binder+Intel space
            // (2026-08-19, explicit ask). A tap that lands on a specific
            // book strip inside this tile fires that Button's own action
            // instead (SwiftUI intercepts it before it reaches this outer
            // tile action), so this only fires for a tap on the tile
            // itself.
            closeBinderContentViewer()
            viewingKnowledgeGraphInBinder = true
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
            // Bridges into JesseCallSession's own "materials or go ahead?"
            // flow (2026-08-18) - this upload lives in this view's local
            // @State, not any shared store, so a call mid-question about
            // materials couldn't otherwise see it landed.
            jesseCall.latestHomeworkUpload = (fileName: fileName, cardSummaries: cards.map { "\($0.title): \($0.body)" })
        case .keyRejected:
            homeworkError = "That AI key was rejected. Open Settings to update it."
        case .unavailable:
            homeworkError = "Couldn't get an answer - try again in a bit."
        }
        homeworkUploading = false
    }

    /// Routes a real `WorkDashboardLesson` (from `jesseCall.askJesseWorkDashboard`,
    /// "I want to learn X") into `generatedBooks` (2026-08-19, reworked from
    /// the earlier Binder/Homework-Help filing below) - it becomes a book
    /// entry under Knowledge Graph, opened on demand, not an automatic
    /// takeover the moment generation finishes. `workDashboardLesson` was
    /// only ever a transient "Jesse just finished" signal for the old
    /// auto-overlay; `closeLessonSession()` consumes it immediately here so
    /// nothing upstream keeps reacting to a signal this view has already
    /// turned into durable state.
    private func handleNewLesson(_ lesson: WorkDashboardLesson?) {
        guard let lesson else { return }
        let book = GeneratedBook(lesson: lesson)
        generatedBooks.removeAll { $0.id == book.id }
        generatedBooks.insert(book, at: 0)
        jesseCall.closeLessonSession()
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
            // Also true for the three merged-space content modes
            // (2026-08-19) - this feeds tileIsGrown's Spacer placement AND
            // the mascot-icon exclusion condition in photoTile, both of
            // which need to know "Binder has real full-size content right
            // now" regardless of whether binderTitles itself happens to be
            // non-empty. Missing this was a real bug, not a hypothetical:
            // a book opened this way rendered with a stray person-icon
            // underneath it and its content pushed toward the tile's
            // bottom edge by an unwanted leading Spacer, caught by
            // testStudySessionShowsChaptersAndSourcesThenCloses actually
            // failing to find chapter 1's body text, not by inspection.
            return !binderTitles.isEmpty || binderContentViewerActive
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
            // Tighter internal padding (was 14 - explicit ask,
            // 2026-08-18: "the padding is too big right now for all the
            // boxes... give them more space internally").
            .padding(8)
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
        // Content-viewer mode takes priority over every other Binder
        // state - a real, tapped book/upload/knowledge-graph, not Binder's
        // normal titles/blurb. A book takes priority over an upload (2026-08-19:
        // opening a book while an old upload was mid-view should show the
        // book, not silently no-op) - in practice `closeBinderContentViewer`
        // already keeps these mutually exclusive, this ordering is a second,
        // cheap guarantee, not the only one.
        if kind == .binder, let viewingBook {
            // Deliberately NOT wrapped in tileInnerCard - StudySessionView
            // paints its own dark rounded panel + white text (its real
            // visual identity, see its `embedded` doc comment), which
            // tileInnerCard's white card background would sit uselessly
            // behind/clash with rather than complement.
            StudySessionView(
                lesson: viewingBook.lesson,
                embedded: true,
                onClose: closeBinderContentViewer,
                onOpenMicroSim: { sim in presentedMicroSim = sim },
                onOpenGeneratedSim: { sim in presentedGeneratedSim = sim }
            )
        } else if kind == .binder, viewingArchiveBrowser {
            tileInnerCard { archiveBrowserBody(ink: ink) }
        } else if kind == .binder, viewingKnowledgeGraphInBinder {
            tileInnerCard { knowledgeGraphContentViewerBody(ink: ink) }
        } else if kind == .binder, let viewingUpload {
            tileInnerCard { uploadContentViewerBody(viewingUpload, ink: ink) }
        } else if agentTakeoverActive && kind == .binder && (agentEmail != nil || agentDraftBusy || agentBinderLines != nil) {
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
    /// The merged Binder+Intel content-viewer's real body (2026-08-18,
    /// explicit ask) - the tapped upload's real AI cards and matched
    /// MicroSims, big and readable in the expanded space, plus a strip
    /// of every other upload so switching between multiple uploaded
    /// files stays reachable without leaving this view ("if I upload
    /// another PDF... click on the second PDF, binder plus intel screen
    /// should show me that").
    @ViewBuilder
    private func uploadContentViewerBody(_ upload: HomeworkUploadSummary, ink: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(upload.fileName)
                    .font(.mcChrome(size: 18, weight: .heavy))
                    .foregroundColor(ink)
                Spacer(minLength: 0)
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { closeBinderContentViewer() }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(ink.opacity(0.4))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridContentViewerClose")
            }
            if homeworkUploads.count > 1 {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(homeworkUploads) { other in
                            Button {
                                withAnimation(.easeInOut(duration: 0.2)) { viewingUpload = other }
                            } label: {
                                Text(other.fileName)
                                    .font(.mcChrome(size: 11, weight: .bold))
                                    .lineLimit(1)
                                    .foregroundColor(other.id == upload.id ? .white : ink)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(
                                        Capsule().fill(other.id == upload.id ? Color(gridHex: "247a4d") : Color(gridHex: "f3f1ec"))
                                    )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                }
            }
            ScrollView(showsIndicators: true) {
                VStack(alignment: .leading, spacing: 16) {
                    ForEach(upload.cards, id: \.title) { card in
                        VStack(alignment: .leading, spacing: 4) {
                            Text(card.title)
                                .font(.mcChrome(size: 13, weight: .heavy))
                                .foregroundColor(Color(gridHex: "247a4d"))
                            Text(card.body)
                                .font(.mcChrome(size: 14, weight: .medium))
                                .foregroundColor(ink.opacity(0.9))
                                .fixedSize(horizontal: false, vertical: true)
                        }
                    }
                    if !upload.microsims.isEmpty {
                        VStack(alignment: .leading, spacing: 8) {
                            Text("INTERACTIVE SIMULATIONS")
                                .font(.mcChrome(size: 10, weight: .heavy))
                                .tracking(0.4)
                                .foregroundColor(ink.opacity(0.5))
                            ForEach(upload.microsims) { sim in
                                Button { presentedMicroSim = sim } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: "play.circle.fill")
                                        Text(sim.title)
                                    }
                                    .font(.mcChrome(size: 13, weight: .bold))
                                    .foregroundColor(Color(gridHex: "5b3e8f"))
                                }
                                .buttonStyle(.plain)
                            }
                        }
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        // Same invisible-marker technique as `deskGridDashboard`/
        // `fieldDeskWindow` elsewhere in this file: the card content lives
        // inside a ScrollView that, for reasons specific to this nested-
        // ScrollView-inside-a-scaled-artboard shape, never publishes its
        // own Text children to the accessibility tree (confirmed via a
        // real screenshot - the content renders correctly on screen, it
        // just isn't queryable via XCUITest directly). A marker carrying
        // the real card text as its label sidesteps that without faking
        // the content.
        .overlay(alignment: .topLeading) {
            Text(verbatim: upload.cards.map(\.body).joined(separator: " | "))
                .font(.system(size: 1))
                .foregroundColor(.clear)
                .accessibilityIdentifier("deskGridContentViewerCardText")
                .allowsHitTesting(false)
        }
    }

    @ViewBuilder
    private func homeworkHelpTileBody(ink: Color) -> some View {
        // 2026-08-19, explicit ask: "when you press archive button...
        // homework help goes blank... per click homework help shows you a
        // book summary and what you will learn... like a learning
        // outcome." Real content derived from the same lesson Binder is
        // showing (archiveSummaryLesson), not a separate fabricated blurb -
        // "what you'll learn" IS the lesson's own real chapter titles.
        if viewingArchiveBrowser {
            archiveSummaryBody(ink: ink)
        } else {
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
            // Generated books (moved here 2026-08-19, explicit ask: "it
            // should show calculus in the homework help neatly somewhere
            // please not in knowledge graph" - was under the Knowledge
            // Graph tile before, see that tile's own doc comment). A real
            // Button per book, not a tap gesture, so it correctly
            // intercepts its own tap instead of bubbling up to the tile's
            // outer handleTile(.homeworkHelp).
            if !generatedBooks.isEmpty {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(generatedBooks) { book in
                            Button {
                                closeBinderContentViewer()
                                viewingBook = book
                            } label: {
                                Text(book.lesson.topic.capitalized)
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .lineLimit(1)
                                    .foregroundColor(ink)
                                    .padding(.horizontal, 10)
                                    .padding(.vertical, 6)
                                    .background(RoundedRectangle(cornerRadius: 8, style: .continuous).fill(Color(gridHex: "b19cd9").opacity(0.35)))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("deskGridGeneratedBook_\(book.id)")
                        }
                    }
                }
            }
            // "I want to learn about X" lands here once it's done (see
            // handleNewLesson), but the archive-check + generation round
            // trip it takes to get there is real network time with no
            // visible sign of progress anywhere near THIS tile - only in
            // Intel's own transcript, easy to miss while watching Homework
            // Help specifically (2026-08-18, explicit live bug report:
            // "I'm not seeing any indicator of whether anything is
            // happening... how long to wait, none of that").
            if jesseCall.isThinking, jesseCall.context == "workDashboard" {
                HStack(spacing: 6) {
                    ProgressView().tint(ink)
                    Text("Jesse is building your lesson\u{2026} can take up to a minute")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(ink.opacity(0.8))
                }
                .accessibilityIdentifier("deskGridHomeworkLessonThinking")
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
                            // No longer tappable into the merged Binder+Intel
                            // space (2026-08-19, explicit ask: "Homework Help
                            // should just be a space for uploads" - that
                            // interaction now belongs to generated books
                            // under Knowledge Graph, see `viewingBook`).
                            // Filename + summary here is still real, useful
                            // confirmation the upload worked, just not a
                            // launch point anymore.
                            .accessibilityIdentifier("deskGridHomeworkUploadRow_\(upload.id)")
                        }
                    }
                }
                .accessibilityIdentifier("deskGridHomeworkUploads")
            }
        }
        }
    }

    /// The "book summary + what you'll learn" card (2026-08-19) - shown in
    /// Homework Help while `viewingArchiveBrowser` is active. Blank/prompt
    /// state before any book is picked, matching the explicit ask exactly
    /// ("homework help goes blank").
    @ViewBuilder
    private func archiveSummaryBody(ink: Color) -> some View {
        if let lesson = archiveSummaryLesson {
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text(lesson.topic.capitalized)
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundColor(ink)
                    Text(lesson.definition)
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.75))
                        .fixedSize(horizontal: false, vertical: true)
                    if !lesson.chapters.isEmpty {
                        Text("WHAT YOU'LL LEARN")
                            .font(.system(size: 10, weight: .heavy, design: .rounded))
                            .tracking(0.6)
                            .foregroundColor(ink.opacity(0.5))
                            .padding(.top, 4)
                        ForEach(lesson.chapters, id: \.self) { chapter in
                            HStack(alignment: .top, spacing: 6) {
                                Circle().fill(ink.opacity(0.4)).frame(width: 4, height: 4).padding(.top, 6)
                                Text(chapter)
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(ink.opacity(0.85))
                            }
                        }
                    }
                }
            }
            // Plain .accessibilityIdentifier() here gets absorbed into the
            // outer tile Button's own accessibility label instead of
            // staying queryable as its own element (confirmed via a real
            // accessibility-tree dump, 2026-08-19 - even adding
            // .accessibilityElement(children: .contain) didn't stop it).
            // Same invisible-marker workaround already proven elsewhere in
            // this file (deskGridDashboard, studySessionRoot,
            // deskGridContentViewerCardText) - a marker carrying the real
            // text as its own label, not a container identifier that keeps
            // getting swallowed.
            .overlay(alignment: .topLeading) {
                Text(verbatim: [lesson.topic, lesson.definition, lesson.chapters.joined(separator: " | ")].joined(separator: " | "))
                    .font(.system(size: 1))
                    .foregroundColor(.clear)
                    .accessibilityIdentifier("deskGridArchiveSummary")
                    .allowsHitTesting(false)
            }
        } else {
            VStack {
                Spacer(minLength: 0)
                Text("Pick a book from the Archive to see what it covers.")
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(ink.opacity(0.5))
                    .multilineTextAlignment(.center)
                Spacer(minLength: 0)
            }
            .frame(maxWidth: .infinity)
            .overlay(alignment: .topLeading) {
                Text(verbatim: "archive-summary-empty")
                    .font(.system(size: 1))
                    .foregroundColor(.clear)
                    .accessibilityIdentifier("deskGridArchiveSummaryEmpty")
                    .allowsHitTesting(false)
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
            // Generated-book strip moved to Homework Help (2026-08-19,
            // explicit ask: "it should show calculus in the homework help
            // neatly somewhere please not in knowledge graph") - was here
            // per an earlier same-night ask ("the generated book then
            // appears under Knowledge Graph"), now reversed. See
            // homeworkHelpTileBody for the real button strip.
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

    /// The REAL `KnowledgeMapView` in the merged Binder+Intel space
    /// (2026-08-19, explicit ask: "our original web design... click on
    /// individual dots and see your mastery and see little notes... and
    /// also a learning GPS. What happened to that?"). It never went
    /// anywhere - `KnowledgeMapView` is a complete, already-tested port of
    /// the web `ConstellationGpsExplorer` (zoom, pan, tap-node detail
    /// panel, status/level filters, "See path" GPS routing via a real
    /// `POST /recommend`), just wired only into `DashboardView`'s Map tab
    /// until now. Reuses the SAME `knowledgeGraphClient` this tile already
    /// loads from - no second data source. `KnowledgeGraphCanvas` (the flat
    /// small-tile version) stays as-is for the at-a-glance in-tile view;
    /// this is the real, interactive one.
    @ViewBuilder
    private func knowledgeGraphContentViewerBody(ink: Color) -> some View {
        ZStack(alignment: .topTrailing) {
            // 2026-08-19, real bug found from a live report ("latency has
            // increased, screen takes forever to load"): KnowledgeMapView
            // has no idea knowledgeGraphClient is still loading - its own
            // empty state ("Your map is still empty... once you've
            // practiced a few concepts") is flatly WRONG during a real
            // fetch and reads as broken, not slow. The HF Space free tier
            // genuinely does sleep and take up to ~60-90s to wake (see
            // KnowledgeGraphClient's own coldStartTimeout) - that's real
            // and outside this app's control, but showing nothing honest
            // about it for up to 90s is a real, fixable regression from
            // swapping in KnowledgeMapView tonight, which the flat
            // KnowledgeGraphCanvas this replaced never had (it read
            // knowledgeGraphClient.isLoading directly).
            if knowledgeGraphClient.isLoading {
                VStack(spacing: 10) {
                    ProgressView().tint(ink)
                    Text("Waking up the knowledge service\u{2026} can take up to a minute the first time.")
                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                        .foregroundColor(ink.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: 320)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .accessibilityIdentifier("deskGridKnowledgeGraphLoading")
            } else {
                KnowledgeMapView(
                    nodes: knowledgeGraphClient.nodes,
                    edges: knowledgeGraphClient.edges,
                    studentPoints: knowledgeGraphClient.studentPoints,
                    axisLabels: knowledgeGraphClient.axisLabels,
                    conceptDisplays: conceptDisplays,
                    // Not wired to a destination in THIS dashboard yet
                    // (unlike DashboardView's own Map tab, which has a
                    // chapter/practice screen to hand off to) - closing
                    // back to the graph itself is an honest, safe fallback
                    // rather than a fake navigation. Real follow-up, not
                    // silently skipped.
                    onOpenConcept: { _ in },
                    onQuickPractice: { _ in },
                    // 2026-08-19, real complaint: "the display of fonts is
                    // horrible" - this view's type sizes were tuned for a
                    // full dashboard tab, not this much smaller merged
                    // space. See KnowledgeMapView's own `embedded` doc
                    // comment.
                    embedded: true
                )
            }
            Button {
                withAnimation(.easeInOut(duration: 0.25)) { closeBinderContentViewer() }
            } label: {
                Image(systemName: "xmark.circle.fill")
                    .font(.system(size: 22))
                    .foregroundColor(ink.opacity(0.4))
                    .background(Circle().fill(Color.white))
            }
            .buttonStyle(.plain)
            .padding(12)
            .accessibilityIdentifier("deskGridContentViewerClose")
        }
    }

    /// Archive mode's body: your own generated books (real, local,
    /// `BookGraphLoader.all` - the same data `askJesseWorkDashboard`
    /// already matches against) plus a live search over Dan McCreary's
    /// wider archive (real `ArchiveRagClient` hits, not a fabricated
    /// catalog - there is no local manifest of his full library to browse
    /// by title, only what a real query returns). Tapping any row opens
    /// that book's real content the same way the rest of tonight's work
    /// already does (`viewingBook`), and sets `archiveSummaryLesson` so
    /// Homework Help shows its real "what you'll learn" alongside it.
    @ViewBuilder
    private func archiveBrowserBody(ink: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Archive")
                    .font(.system(size: 18, weight: .heavy, design: .rounded))
                    .foregroundColor(ink)
                Spacer(minLength: 0)
                Button {
                    withAnimation(.easeInOut(duration: 0.25)) { closeBinderContentViewer() }
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundColor(ink.opacity(0.4))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridContentViewerClose")
            }

            HStack(spacing: 8) {
                Image(systemName: "magnifyingglass")
                    .foregroundColor(ink.opacity(0.4))
                TextField("Search Dan's archive\u{2026}", text: $archiveSearchQuery, onCommit: runArchiveSearch)
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(ink)
                    .accessibilityIdentifier("deskGridArchiveSearchField")
                if archiveSearchLoading {
                    ProgressView().tint(ink)
                }
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(gridHex: "f3f1ec")))

            ScrollView {
                VStack(alignment: .leading, spacing: 14) {
                    if !archiveSearchResults.isEmpty {
                        archiveSection("SEARCH RESULTS", ink: ink) {
                            ForEach(archiveSearchResults, id: \.pageUrl) { hit in
                                archiveBookRow(
                                    title: hit.bookTitle,
                                    subtitle: hit.pageTitle,
                                    ink: ink,
                                    isOpening: archiveOpeningTitle == hit.bookTitle
                                ) { openArchiveBook(title: hit.bookTitle) }
                            }
                        }
                    }
                    archiveSection("YOUR BOOKS", ink: ink) {
                        ForEach(BookGraphLoader.all) { book in
                            archiveBookRow(
                                title: book.title,
                                subtitle: "\(book.concepts.count) concepts",
                                ink: ink,
                                isOpening: false
                            ) { openBundledBook(book) }
                            .accessibilityIdentifier("deskGridArchiveBook_\(book.id)")
                        }
                    }
                    archiveSection("DAN'S ARCHIVE", ink: ink) {
                        if archiveBooksLoading {
                            ProgressView().tint(ink)
                        } else if archiveBooksError {
                            Button {
                                Task { await loadArchiveBooks() }
                            } label: {
                                HStack(spacing: 6) {
                                    Image(systemName: "arrow.clockwise")
                                    Text("Couldn't load Dan's Archive - tap to retry")
                                }
                                .font(.system(size: 13, weight: .semibold, design: .rounded))
                                .foregroundColor(ink.opacity(0.75))
                            }
                            .buttonStyle(.plain)
                            .accessibilityIdentifier("deskGridArchiveDanBooksRetry")
                        } else {
                            ForEach(archiveBooks) { book in
                                archiveBookRow(
                                    title: book.bookTitle,
                                    subtitle: "Open textbook",
                                    ink: ink,
                                    isOpening: archiveOpeningTitle == book.bookTitle
                                ) { openArchiveBook(title: book.bookTitle) }
                                .accessibilityIdentifier("deskGridArchiveDanBook_\(book.id)")
                            }
                        }
                    }
                }
            }
        }
        // Fetched once per app session (the archiveBooks.isEmpty guard
        // skips re-fetching on every later Archive open - this list is
        // static enough not to need refreshing per-open the way the live
        // knowledge graph does). Re-fires on a failed attempt too, since
        // archiveBooks stays empty - closing and reopening Archive retries;
        // archiveBooksError makes that failure visible instead of a silent
        // blank section in the meantime.
        .task(id: viewingArchiveBrowser) {
            guard viewingArchiveBrowser, archiveBooks.isEmpty else { return }
            await loadArchiveBooks()
        }
    }

    /// Shared by the initial `.task` fetch and the retry button - a
    /// `.task(id:)` only re-runs when its id VALUE changes, so a retry tap
    /// (id stays `viewingArchiveBrowser == true` the whole time) has to
    /// call this directly rather than relying on the task re-firing.
    private func loadArchiveBooks() async {
        archiveBooksLoading = true
        archiveBooksError = false
        let result = await ArchiveBooksClient.list()
        archiveBooks = result
        archiveBooksError = result.isEmpty
        archiveBooksLoading = false
    }

    @ViewBuilder
    private func archiveSection<Content: View>(_ title: String, ink: Color, @ViewBuilder content: () -> Content) -> some View {
        VStack(alignment: .leading, spacing: 6) {
            Text(title)
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.6)
                .foregroundColor(ink.opacity(0.5))
            content()
        }
    }

    private func archiveBookRow(title: String, subtitle: String, ink: Color, isOpening: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 10) {
                Image(systemName: "book.closed.fill")
                    .font(.system(size: 13))
                    .foregroundColor(ink.opacity(0.5))
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(ink)
                        .lineLimit(1)
                    Text(subtitle)
                        .font(.system(size: 11, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.55))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if isOpening {
                    ProgressView().tint(ink)
                } else {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(ink.opacity(0.3))
                }
            }
            .padding(10)
            .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color.white))
        }
        .buttonStyle(.plain)
        .disabled(isOpening)
    }

    private func runArchiveSearch() {
        let query = archiveSearchQuery.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !query.isEmpty else {
            archiveSearchResults = []
            return
        }
        archiveSearchLoading = true
        Task {
            let answer = await ArchiveRagClient.askDetailed(message: query, studentWeakness: nil)
            archiveSearchResults = answer?.hits ?? []
            archiveSearchLoading = false
        }
    }

    /// Opens one of your own real generated book graphs - local data, no
    /// network round trip, so this is instant unlike `openArchiveBook`.
    private func openBundledBook(_ book: BookConceptGraph) {
        let chapters = Array(book.concepts.prefix(12).map(\.label))
        let lesson = WorkDashboardLesson(
            topic: book.title,
            source: .archive(bookTitle: book.title),
            chapters: chapters,
            chapterBodies: [],
            definition: "From your archive: \(book.title).",
            question: nil,
            microsims: MicroSimLoader.matching(topic: book.title),
            citations: []
        )
        archiveSummaryLesson = lesson
        viewingBook = GeneratedBook(lesson: lesson)
    }

    /// Opens a book from Dan's wider archive - a real network round trip
    /// (same "table of contents" query `askJesseWorkDashboard`'s own
    /// archive-match branch already uses), since there's no local manifest
    /// of his library to build a lesson from offline the way
    /// `openBundledBook` can.
    private func openArchiveBook(title: String) {
        archiveOpeningTitle = title
        Task {
            defer { archiveOpeningTitle = nil }
            guard
                let answer = await ArchiveRagClient.askDetailed(
                    message: "Give me a short table of contents for \(title)",
                    studentWeakness: nil
                ),
                !answer.hits.isEmpty
            else { return }
            var seenTitles = Set<String>()
            let chapters = answer.hits.compactMap { hit -> String? in
                guard seenTitles.insert(hit.pageTitle).inserted else { return nil }
                return hit.pageTitle
            }
            let lesson = WorkDashboardLesson(
                topic: title,
                source: .archive(bookTitle: answer.hits[0].bookTitle),
                chapters: chapters,
                chapterBodies: [],
                definition: answer.reply,
                question: nil,
                microsims: MicroSimLoader.matching(topic: title),
                citations: answer.hits.map { LessonCitation(bookTitle: $0.bookTitle, pageTitle: $0.pageTitle, url: $0.pageUrl) }
            )
            archiveSummaryLesson = lesson
            viewingBook = GeneratedBook(lesson: lesson)
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
        if kind == .binder {
            // Real Button per book (2026-08-21 fix), not a plain row - see
            // `binderChapterBooks`' doc comment for the bug this closes.
            // Same "a nested Button correctly intercepts its own tap
            // instead of bubbling to the tile's outer handleTile" pattern
            // already proven for Homework Help's generatedBooks strip.
            ForEach(Array(binderChapterBooks.prefix(limit))) { item in
                Button {
                    onOpenBinderChapterBook(item.body, item.title)
                } label: {
                    DeskContentRow(
                        title: item.title,
                        dot: dot,
                        ink: ink,
                        muted: muted,
                        divider: divider,
                        showDivider: true,
                        compact: true
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridBinderBook_\(item.id)")
            }
        } else {
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
        // Content-viewer mode takes priority over everything else -
        // Binder expands to the Binder+Intel union; Intel's own tile is
        // skipped entirely (see tileBoard), so its rect is never asked
        // for while this is active.
        if binderContentViewerActive, kind == .binder {
            return WorkArtboard.contentViewerBinder
        }
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
    ///
    /// Real layout fix, 2026-08-21 live feedback: the previous hungry
    /// layout gave Binder a side column with Homework Help/Knowledge Graph
    /// squeezed into tiny boxes beside it - "the binder should occupy the
    /// full horizontal space of the screen... Homework Help and Knowledge
    /// Graph shrink into tiny little boxes." Binder now spans the full
    /// usable width across the TOP; Homework Help and Knowledge Graph sit
    /// BELOW it side by side, each getting a real half-width strip instead
    /// of a sliver. Their own tile designs are untouched - only the
    /// geometry changed, per the explicit "we already decided on the
    /// design for Knowledge Graph and Homework Help earlier, so let's
    /// stick to that."
    private func negotiated(_ kind: TileKind, hungry: DeskBoxBus.Box, page5: Bool, base: CGRect) -> CGRect {
        guard hungry == .binder else { return base }
        if page5 {
            // Usable width bounded by the memo/flows rail reserved at
            // x:1231 (WorkArtboard.memoRail/flowsRail) - matches this
            // mode's own existing idle margins (p5Binder starts at x:35).
            switch kind {
            case .binder: return CGRect(x: 35, y: 40, width: 1095, height: 340)
            case .homeworkHelp: return CGRect(x: 35, y: 400, width: 535, height: 220)
            case .moodle: return CGRect(x: 595, y: 400, width: 535, height: 220)
            case .intel: return CGRect(x: 76, y: 103, width: 280, height: 192)
            default: return base
            }
        }
        switch kind {
        case .binder: return CGRect(x: 76, y: 50, width: 1288, height: 420)
        case .homeworkHelp: return CGRect(x: 76, y: 490, width: 634, height: 270)
        case .moodle: return CGRect(x: 730, y: 490, width: 634, height: 270)
        case .intel: return CGRect(x: 1060, y: 107, width: 330, height: 522)
        default: return base
        }
    }

    /// Byte-identical to ArchiveWorkflowView's own `loadWeakness()` - same
    /// real signal, same "soft context, never blocking" doctrine. Doesn't
    /// delay `jesseCall.begin()` firing above; a student with no evidence
    /// yet (or a slow/failed fetch) simply gets today's greeting with no
    /// weakness context, same accepted behavior ArchiveWorkflowView
    /// already has for the same reason.
    private func loadWeakness() async {
        guard let profile = await RouteClient.fetchExamProfile(),
              let worst = profile.topWeaknesses.min(by: { $0.strength < $1.strength })
        else { return }
        let displays = TocDataLoader.loadConceptDisplays()
        let label = displays[worst.conceptId]?.label
            ?? worst.conceptId.replacingOccurrences(of: "_", with: " ").capitalized
        studentWeakness = (id: worst.conceptId, label: label)
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
    // Tighter footprint (2026-08-19, explicit ask: "reduce the vertical
    // padding between Knowledge Graph, Binder, Archive, Design, and Search
    // Box. There's still so much space") - was height 72 + 34 bottom
    // padding (106pt of screen-space below the artboard); the dock's own
    // content doesn't need that much air, and every point recovered here is
    // a point the artboard tiles below can grow into.
    private var bottomDock: some View {
        activeDock
            .frame(height: 60)
            // Leading padding was 110 to clear the left sidebar, which no
            // longer renders on the plain dashboard (2026-08-19) - kept a
            // small 24 for symmetry with the trailing edge instead of 0,
            // now that there's nothing to clear.
            .padding(.leading, 24)
            .padding(.trailing, 24)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
            // Pushed down further (2026-08-19, explicit ask: "push the
            // search bar a little bit down now").
            .padding(.bottom, 8)
            .ignoresSafeArea()
    }

    private func openSidebarFlow(_ flow: SidebarFlow) {
        // Real bug, found live (2026-08-19): now that the dashboard
        // auto-greets on arrival (jesseCall.begin(context: "workDashboard")
        // fires on .onAppear), `jesseCall.isActive` is true almost as soon
        // as the app boots. `begin(context:)` guards `!isActive` to avoid
        // double-starting a call on the SAME screen - but with no explicit
        // end() here, that same guard silently blocked every OTHER
        // screen's own call-start too: tapping Practice/Resume/Design's
        // call button called begin(context: "resume") etc., found isActive
        // already true from the dashboard, and no-opped - context never
        // actually changed, so the conversation kept running the
        // workDashboard system prompt/routing under a screen that looked
        // like Resume or Practice. Ending the dashboard's call before
        // switching flows lets the destination's own call button start a
        // real, correctly-contexted one.
        jesseCall.end()
        withAnimation(.easeInOut(duration: 0.35)) { activeSidebarFlow = flow }
    }

    private func closeSidebarFlow() {
        withAnimation(.easeInOut(duration: 0.35)) { activeSidebarFlow = nil }
    }

    /// The pane that slides in from the right when a sidebar destination
    /// is active - each of these views is already self-contained
    /// (`onClose` + `studentName`, own `@StateObject`/`@EnvironmentObject`
    /// state), the same shape they'd need to be presented as a
    /// `.fullScreenCover` elsewhere, so embedding them directly here needs
    /// no changes to the views themselves.
    @ViewBuilder
    private func flowPane(_ flow: SidebarFlow) -> some View {
        switch flow {
        case .presentation:
            CreateCanvasView(kind: .presentation, studentName: studentName, onClose: closeSidebarFlow)
        case .gdoc:
            CreateCanvasView(kind: .gdoc, studentName: studentName, onClose: closeSidebarFlow)
        case .resume:
            ResumeAgentView(onClose: closeSidebarFlow, studentName: studentName)
        case .englishPractice:
            EnglishPracticeView(onClose: closeSidebarFlow, studentName: studentName)
        case .develop:
            // Straight into the one content canvas (2026-08-19) - the
            // Workflows/Books toggle shell (`DevelopStudioView`) is gone.
            // Book-drafting still exists, but scoped inside a `.chapter`
            // box on this canvas rather than as a competing top-level mode.
            DesignStudioView(studentName: studentName, onClose: closeSidebarFlow)
        }
    }

    @ViewBuilder
    private var activeDock: some View {
        if activeSidebarFlow != nil {
            sidebarFlowDock
        } else if rail == .flows {
            flowsDock
        } else {
            workDock
        }
    }

    /// Replaces the old vertical `leftSidebar` (2026-08-19, explicit ask:
    /// "toolbar move to the bottom in design and resume too we dont need
    /// that vertical column there") - same three destinations
    /// (Dashboard/Resume/Design/Settings) it always had, just bottom-pinned
    /// like every other dock variant instead of a left rail. This is what
    /// makes switching directly between flows (Resume <-> Develop) or back
    /// to the dashboard still possible while a flow pane is open - the
    /// same real need `leftSidebar` originally solved (2026-08-18: "if you
    /// press GDocs again... if you say Resume, it goes to Resume").
    private var sidebarFlowDock: some View {
        HStack(spacing: 8) {
            dockChip("Dashboard", system: "square.grid.2x2.fill", identifier: "deskGridDock_BackToDash", action: closeSidebarFlow)
            // Order matches every other dock variant (2026-08-19, explicit
            // ask: "practice archive design resume settings consistently") -
            // Archive isn't a SidebarFlow (it's its own overlay, not a flow
            // pane), so it's absent here same as before, just the relative
            // order of what IS here now matches.
            dockChip("Practice", system: "waveform.and.mic", identifier: "deskGridSidebarDock_Practice") { openSidebarFlow(.englishPractice) }
            dockChip("Design", system: "square.grid.2x2.fill", identifier: "deskGridSidebarDock_Design") { openSidebarFlow(.develop) }
            dockChip("Resume", system: "person.text.rectangle", identifier: "deskGridSidebarDock_Resume") { openSidebarFlow(.resume) }
            dockChip("Settings", system: "gearshape.fill", identifier: "deskGridSidebarDock_Settings", action: onOpenManage)
            Spacer(minLength: 0)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Capsule().fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
        )
        // Same clobbering trap as workDock's own toolbar marker below -
        // .accessibilityElement(children: .contain) here too so each
        // chip keeps its own identifier instead of all reporting this
        // container's.
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "sidebar-flow-toolbar").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("deskGridSidebarFlowToolbar")
                .allowsHitTesting(false)
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
        // Order (2026-08-19, explicit ask: "the order should be practice
        // archive design resume settings consistently") - same order on
        // every dock variant that carries these chips.
        HStack(spacing: 8) {
            // English speaking/writing practice (2026-08-19) - a live Jesse
            // conversation.
            dockChip("Practice", system: "waveform.and.mic", identifier: "deskGridDock_Practice") { openSidebarFlow(.englishPractice) }
            // 2026-08-19, explicit ask: Archive now opens the in-Binder
            // browser (see viewingArchiveBrowser) instead of the old
            // full-screen ArchiveWorkflowView - that flow is still reachable
            // via WorkflowLibraryView's own "Open Archive" entry (onOpenArchive
            // stays wired there), just not from this button anymore.
            dockChip("Archive", system: "archivebox.fill", identifier: "deskGridDock_Archive") {
                closeBinderContentViewer()
                viewingArchiveBrowser = true
            }
            // "+Book" replaced with "Design" (2026-08-18, explicit ask:
            // "next to Archive, should be Design on the search bar... move
            // it from the toolbar to the search bar. Remove Book"). The
            // Develop toggle shell this used to open is gone (2026-08-19)
            // - `.develop` now lands directly on the one unified content
            // canvas (`DesignStudioView`), where Book-drafting lives inside
            // a `.chapter` box instead of behind a mode switch. Still the
            // same destination the sidebar's own "Develop" icon opens.
            dockChip("Design", system: "square.grid.2x2.fill", identifier: "deskGridDock_Design") { openSidebarFlow(.develop) }
            // Chapter Library (2026-08-20) — assembled, gated teaching
            // prose, distinct from Archive (Dan McCreary's book excerpts)
            // and from Design's own Book-drafting box: this is finished,
            // gate-passed, dependency-ordered content a student reads.
            dockChip("Library", system: "books.vertical.fill", identifier: "deskGridDock_Library") { showBookLibrary = true }
            // Session Reports (2026-08-21) - the first real display surface
            // for the ZPD/sim-telemetry pipeline shipped tonight
            // (SimInteractionClient -> generate-session-report.ts ->
            // Firestore); reports were being written with nowhere to read
            // them back until this.
            dockChip("Reports", system: "doc.text.magnifyingglass", identifier: "deskGridDock_Reports") { showSessionReports = true }
            // Resume + Settings moved here from the left sidebar (2026-08-19,
            // explicit ask: "add the settings and resume to the search bar
            // dock too... use that space to make the boxes bigger
            // horizontally as well as vertically") - the sidebar itself now
            // only renders while a flow pane is active (see leftSidebar's
            // own call site), so it no longer reserves width against
            // tileBoard's scale on the plain dashboard.
            dockChip("Resume", system: "person.text.rectangle", identifier: "deskGridDock_Resume") { openSidebarFlow(.resume) }
            dockChip("Settings", system: "gearshape.fill", identifier: "deskGridDock_Settings", action: onOpenManage)
            searchField(placeholder: "Search", identifier: "deskGridDashboardSearch", onSubmit: submitSearch)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        // White/cream, not the old black capsule (2026-08-18, explicit
        // ask: "why is the background for the toolbar not the same like
        // the white") - matches every other card on this dashboard
        // (`tileInnerCard`'s own near-white fill + soft shadow) instead of
        // being the one dark element floating on the cream board.
        .background(
            Capsule().fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
        )
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
            // Resume + Settings here too (2026-08-19, explicit ask: "add the
            // settings and resume to the search bar dock too across the
            // flows") - same chips workDock got, so they're reachable no
            // matter which dock variant is showing. Practice/Resume/Settings
            // order matches workDock's own (2026-08-19, "practice archive
            // design resume settings consistently").
            dockChip("Practice", system: "waveform.and.mic", identifier: "deskGridFlowsPractice") { openSidebarFlow(.englishPractice) }
            dockChip("Resume", system: "person.text.rectangle", identifier: "deskGridFlowsResume") { openSidebarFlow(.resume) }
            dockChip("Settings", system: "gearshape.fill", identifier: "deskGridFlowsSettings", action: onOpenManage)
            searchField(
                placeholder: "Search Presentation, Resume, Archive, Book…",
                identifier: "deskGridFlowsSearch",
                text: $flowsSearchQuery,
                onSubmit: submitFlowsSearch
            )
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 10)
        .background(
            Capsule().fill(Color(white: 0.985))
                .shadow(color: .black.opacity(0.08), radius: 10, y: 4)
        )
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
                // While Binder+Intel are merged (an upload, a book, or the
                // knowledge graph, big), the search icon becomes the raccoon
                // - the real way back to Jesse without needing Intel's own
                // tile back (2026-08-18, explicit ask: "instead of the
                // search you see the raccoon and you can press on it to
                // keep continuing to Jesse").
                if binderContentViewerActive {
                    Button {
                        withAnimation(.easeInOut(duration: 0.25)) { closeBinderContentViewer() }
                    } label: {
                        JesseRailView.raccoonImage
                            .resizable()
                            .scaledToFit()
                            .frame(width: 18, height: 18)
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("deskGridSearchJesseIcon")
                    .accessibilityLabel("Continue with Jesse")
                } else {
                    Image(systemName: "magnifyingglass")
                        .foregroundColor(tileInk.opacity(0.45))
                }
                TextField(placeholder, text: text ?? $searchQuery)
                    .textFieldStyle(.plain)
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(tileInk)
                    .submitLabel(.search)
                    .onSubmit(onSubmit)
                    .disabled(!aiKeys.hasKey)
                    .accessibilityIdentifier(identifier)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
            .background(Capsule().fill(Color(gridHex: "f3f1ec")))

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
    }

    private func dockChip(_ title: String, system: String, identifier: String? = nil, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            HStack(spacing: 5) {
                Image(systemName: system)
                Text(title)
            }
            .font(.system(size: 12, weight: .bold, design: .rounded))
            .foregroundColor(tileInk)
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
    // Fourth pass (2026-08-18, explicit ask): "move everything a little
    // bit left... increase the size of the boxes vertically... knowledge
    // graph expand it, make it horizontally the same length as homework
    // help... expand binder vertically and intel vertically too." Homework
    // Help and Knowledge Graph now share one width (were 376/315, two
    // different sizes); every box is taller, with less empty space below
    // the column before the dock. The whole layout shifted left (was
    // x:81 leftmost / x:1424 rightmost - now x:40 / x:1420) instead of
    // hugging the right edge.
    // Fifth pass (2026-08-18, explicit ask): "push Homework Help and
    // Intel all the way up... move them a little bit up... take the space
    // from Homework Help upwards to the upper border, from Knowledge
    // Graph to the down border... expand binder vertically and intel
    // vertically too." The dock no longer lives inside this board (see
    // `bottomDock`), so the column can run almost the full board height
    // instead of stopping short to leave it room.
    // Sixth pass, same session, after seeing it live (explicit ask: "move
    // everything a little bit down... increase size of the four boxes...
    // Binder/Intel/Knowledge Graph close to the search bar below") - top
    // eased back down slightly (24 -> 40, it read as too tight against
    // the very top edge), bottom pushed further down (790 -> 800, now
    // only 10pt short of the board's true 810 edge instead of 20).
    // Seventh pass (2026-08-19, explicit ask): "expand Homework Help a
    // little bit more vertically... push Knowledge Graph a little bit down
    // ... but pad it properly." Homework Help grows by 40pt; Knowledge
    // Graph's top moves down by the same 40 and loses 40pt of height so its
    // OWN bottom edge stays exactly where the sixth pass put it (800, 10pt
    // shy of the board's true 810 edge) - "padded properly" means keeping
    // that established gap, not pushing flush to the edge.
    // Eighth pass (2026-08-19, same session, explicit ask: "make Knowledge
    // Graph and Binder bigger... stretch them vertically... reduce the
    // vertical padding... there's still so much space"). Reclaims most of
    // the seventh pass's bottom cushion - 800 -> 808, 2pt shy of the true
    // 810 edge instead of 10 - since this ask directly asked for less
    // padding, not the same padding kept. Left the TOP edge (40) alone: the
    // sixth pass eased it down from 24 specifically because 24 "read as too
    // tight against the very top edge" - a real, deliberate visual call,
    // not slack.
    static let p4HomeworkHelp = CGRect(x: 40, y: 40, width: 420, height: 418)
    static let p4Moodle = CGRect(x: 40, y: 470, width: 420, height: 338)
    static let p4Binder = CGRect(x: 490, y: 40, width: 500, height: 768)
    static let p4Intel = CGRect(x: 1020, y: 40, width: 400, height: 768)

    // Same seventh-pass rebalance as p4 above, scaled to this expanded
    // page's own proportions - Moodle's bottom edge stays at 560 (matching
    // Binder/Intel's own bottom edge on this page, unchanged).
    static let p5HomeworkHelp = CGRect(x: 35, y: 35, width: 340, height: 255)
    static let p5Moodle = CGRect(x: 35, y: 305, width: 340, height: 255)
    static let p5Binder = CGRect(x: 390, y: 35, width: 420, height: 525)
    static let p5Intel = CGRect(x: 825, y: 35, width: 340, height: 525)
    static let memoRail = CGRect(x: 1231, y: 193, width: 199, height: 194)
    static let flowsRail = CGRect(x: 1231, y: 54, width: 199, height: 566)
    /// Content-viewer mode (2026-08-18, explicit ask: tap an uploaded
    /// file, Binder "mixes with Intel to get all that space on the
    /// right"). Went through two real widenings the same night: first to
    /// the Binder+Intel union (~65% width, read as "occupies maybe half
    /// the screen"), then briefly to the FULL board width (~96%, a real
    /// overshoot of the user's own "80-90%" ask). Settled here (2026-08-21
    /// design-system pass) at 82% of the 1440pt board - the upper end of
    /// the design system's own 70-82% spec, chosen deliberately over the
    /// live-overshot 96% now that a more considered number exists -
    /// width 1181 (1440 * 0.82), horizontally centered (x=130, leaving
    /// Homework Help/Moodle hidden the same way Intel's tile already was
    /// while this is active, see `tileBoard`).
    static let contentViewerBinder = CGRect(x: 130, y: 40, width: 1181, height: 768)
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
            // Real node x/y are raw PCA-axis projections from the ML
            // backend (mean-centered, roughly [-3, 3], NOT already
            // normalized to [0,1]) - multiplying them directly by canvas
            // size treated them as if they were, which put the graph off
            // -center and, for a real node spread, genuinely garbled
            // (2026-08-18, explicit ask: "the knowledge graph still is not
            // centered... it's displaying shit"). Remap the graph's own
            // real bounding box into a padded square that fills the
            // canvas instead of assuming a fixed range.
            let padding = 0.12
            let xs = nodes.compactMap(\.x)
            let ys = nodes.compactMap(\.y)
            let minX = xs.min() ?? 0, maxX = xs.max() ?? 1
            let minY = ys.min() ?? 0, maxY = ys.max() ?? 1
            let spanX = max(maxX - minX, 0.0001)
            let spanY = max(maxY - minY, 0.0001)

            func point(_ node: KnowledgeGraphNode) -> CGPoint? {
                guard let x = node.x, let y = node.y else { return nil }
                let nx = padding + (x - minX) / spanX * (1 - 2 * padding)
                let ny = padding + (y - minY) / spanY * (1 - 2 * padding)
                return CGPoint(x: nx * size.width, y: ny * size.height)
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

/// The blueprint/engineering grid (2026-08-20, explicit ask, matches the
/// same technique just built for joinmindcraft.com: two hairline rulings at
/// a fixed pitch, faded via a radial mask so it reads strongest near the
/// top of the board and disappears toward the edges instead of tiling flat
/// and even like `DottedDeskGrid` did). Forest-green hairlines at low
/// opacity - the same `143a2e` ink used everywhere else in this board, not
/// a new color. Reusable: drop `BlueprintGrid()` behind any surface that
/// wants this look; it doesn't assume anything about what's on top of it.
private struct BlueprintGrid: View {
    var lineColor: Color = Color(gridHex: "143a2e").opacity(0.09)
    var pitch: CGFloat = 44

    var body: some View {
        GeometryReader { geo in
            Canvas { context, size in
                var path = Path()
                var x: CGFloat = 0
                while x <= size.width {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                    x += pitch
                }
                var y: CGFloat = 0
                while y <= size.height {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                    y += pitch
                }
                context.stroke(path, with: .color(lineColor), lineWidth: 1)
            }
            .mask(
                RadialGradient(
                    colors: [.black, .black.opacity(0)],
                    center: UnitPoint(x: 0.5, y: 0.16),
                    startRadius: 0,
                    endRadius: max(geo.size.width, geo.size.height) * 0.62
                )
            )
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
