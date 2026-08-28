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
        case transcribe
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
    var onOpenFlow: (String) -> Void = { _ in }
    var onSaveMemo: (String) -> Void = { _ in }
    /// Same "side effect this view doesn't own" shape as onSaveMemo -
    /// archiving (FieldDeskStore.fileJesseTranscript) + the workDashboard
    /// session-report kick-off both live in FieldDeskView, not here. Fires
    /// when transcribeRail's Stop button ends the ambient session
    /// (2026-08-27) - was FieldDeskView's own now-dead showJesseCallSheet
    /// .sheet(onEnd:), moved here so ending a transcript from the blended
    /// rail still gets filed the same way ending it from that old drawer did.
    var onFileTranscript: (_ turns: [JesseCallTurn], _ context: String?, _ ambient: Bool) -> Void = { _, _, _ in }
    var intelHasData: Bool = false
    var binderHasData: Bool = false
    var onGmailLinked: (_ calendarToo: Bool) -> Void = { _ in }
    var onGmailDisconnected: () -> Void = {}
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
    /// Opens the merged Learn+Practice AI study companion full-screen
    /// (2026-08-23) - FieldDeskView's own `.studyCompanion` overlay, not a
    /// workspace-column swap like `viewingXxx` below.
    /// Gained an optional topic param (2026-08-25, explicit ask: tapping a
    /// concept on the Knowledge Map's "Open lesson" button did nothing -
    /// onOpenConcept/onQuickPractice below were still stub closures,
    /// exactly the bug ConstellationView's own equivalent already got
    /// fixed for on 2026-08-25 earlier the same day, just never ported to
    /// this screen's embedded map). nil (from learnModuleBox, the plain
    /// Gurukul tile) opens idle, same as before this change.
    var onOpenStudyCompanion: (_ topic: String?) -> Void = { _ in }
    /// Opens the concept's real pre-authored chapter/book (2026-08-27,
    /// reversing the 2026-08-25 "route the map into Gurukul" ask -
    /// explicit new direction: "these are already ready made books...
    /// instead taking me to Jesse's screen. We really don't need that").
    var onOpenConceptChapter: (_ conceptId: String) -> Void = { _ in }
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
    // MARK: - Co-Work (2026-08-24, explicit ask - renamed from the tile's
    // old single-purpose upload). Own document picker instance rather than
    // reusing showHomeworkImporter, since that one's onPick is wired to
    // handleHomeworkFileUpload (the AI-hints path), a different flow. Used
    // to offer a choice between this and an "Upload to Presentation"
    // branch (showCoWorkChoice/showCoWorkPresentationPicker) - removed
    // 2026-08-25 alongside the rest of CreateCanvasView, leaving OCR as
    // the tile's only destination.
    @State private var showCoWorkOCRPicker = false
    @State private var coWorkPages: [UIImage] = []
    @State private var coWorkFileName = ""
    @State private var showCoWorkAnnotate = false
    /// Chapter Library sheet (2026-08-20) — assembled, gated chapter
    /// content from mindcraft-content-engine's book_assembler, fetched live
    /// via BookLibraryClient. A plain `.sheet`, not another FieldDeskView-
    /// style ZStack overlay — sidesteps that system's documented touch-
    /// swallowing bug class entirely (see CLAUDE.md's FieldDeskView
    /// section) by using UIKit's own presentation controller instead.
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
    /// Design Studio / Resume / Session Reports, now shown INSIDE the
    /// binder's own content-viewer space instead of a separate screen
    /// (2026-08-22, explicit ask: "everything should be displayed inside
    /// the dash binder... so you can see and interact with the entire
    /// system from this one place"). Same mutually-exclusive-via-
    /// `closeBinderContentViewer` discipline as every other `viewingXxx`
    /// flag above.
    @State private var viewingDesignStudio = false
    @State private var viewingResumeAgent = false
    @State private var resumeStartInApplications = false
    @State private var viewingSessionReports = false
    /// Same "inside the binder's content-viewer, not a separate screen"
    /// treatment as Design Studio/Resume above, now applied to Gmail
    /// (2026-08-27, explicit ask: "Gmail... opens on its own... blend it
    /// into the page neatly") - replaces the floating, semi-transparent
    /// GmailWorkflowBoxView overlay this dock icon used to open via the
    /// external onOpenGmail() closure (FieldDeskView's `.gmailBox`).
    @State private var viewingGmail = false
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
    // Book-browsing state (search, Dan's Archive listing, view-mode toggle)
    // removed 2026-08-23, explicit ask: "remove the books completely from
    // the archive and keep just simulations" - `archiveBrowserBody` is
    // simulations-only now, see its own doc comment.
    @State private var archiveSims: [ArchiveSimEntry] = []
    @State private var archiveSimsLoading = false
    @State private var archiveSimsLoaded = false
    @State private var presentedArchiveSim: ArchiveSimEntry?
    @State private var showArchiveGenerateSim = false
    /// Jesse's rail, dock-only now (2026-08-22, Binder-to-88%-at-landing
    /// Topic-tile grid on Binder's landing "page" (2026-08-22, reference
    /// images: real books with real progress bars, Chapter Library only -
    /// confirmed over mixing in Simulations/Dan's Archive, since those
    /// don't carry a comparable progress number). Loaded once per session
    /// (the `libraryBooksLoaded` guard below skips re-fetching on re-render).
    @State private var libraryBooks: [AssembledBookSummary] = []
    @State private var libraryBooksLoaded = false
    /// "+ New" create-a-book flow (2026-08-22, reference images' top-right
    /// "New" tab). `CreateBookView` is a real, standalone view with no
    /// `JesseCallSession` reference at all - see its own doc comment for
    /// why (the explicit "it does not speak" ask).
    @State private var showCreateBook = false

    /// Friends, embedded in the binder's content-viewer (2026-08-22, same
    /// mechanism as Archive/Design/Resume/Reports) - reached from the
    /// bottom dock's "Friends" chip, see `workDock`.
    @State private var viewingFriends = false

    /// True whenever Binder should be showing ANY of the merged-space
    /// content modes above rather than its own normal titles/blurb - the
    /// single condition every layout/visibility check below reads instead
    /// of each hand-rolling its own `viewingUpload != nil || viewingBook !=
    /// nil || ...` (three call sites already needed this before
    /// `viewingBook`/`viewingKnowledgeGraphInBinder` existed; missing one on
    /// a new mode is exactly the kind of bug this centralizes away).
    private var binderContentViewerActive: Bool {
        viewingUpload != nil || viewingBook != nil || viewingKnowledgeGraphInBinder || viewingArchiveBrowser
            || viewingDesignStudio || viewingResumeAgent || viewingSessionReports || viewingFriends || viewingGmail
    }

    private func closeBinderContentViewer() {
        viewingUpload = nil
        viewingBook = nil
        viewingKnowledgeGraphInBinder = false
        viewingArchiveBrowser = false
        viewingDesignStudio = false
        viewingResumeAgent = false
        viewingSessionReports = false
        viewingFriends = false
        viewingGmail = false
        archiveSummaryLesson = nil
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

    /// Pruned to Practice only (2026-08-22): `.presentation`/`.gdoc` were
    /// already dead (real triggers route through `onOpenCreate`, never
    /// `openSidebarFlow`), and `.resume`/`.develop` moved to the binder's
    /// own content-viewer (`viewingResumeAgent`/`viewingDesignStudio`) -
    /// see `binderUtilityRow`. The two-pane slide this drives stays alive
    /// for Practice alone.
    private enum SidebarFlow: Equatable {
        case englishPractice
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
        onOpenFlow: @escaping (String) -> Void = { _ in },
        onSaveMemo: @escaping (String) -> Void = { _ in },
        onFileTranscript: @escaping (_ turns: [JesseCallTurn], _ context: String?, _ ambient: Bool) -> Void = { _, _, _ in },
        intelHasData: Bool = false,
        binderHasData: Bool = false,
        onGmailLinked: @escaping (_ calendarToo: Bool) -> Void = { _ in },
        onGmailDisconnected: @escaping () -> Void = {},
        onMoodleLinked: @escaping () -> Void = {},
        onMoodleDisconnected: @escaping () -> Void = {},
        intelLines: [String] = [],
        binderTitles: [String] = [],
        binderChapterBooks: [BinderItem] = [],
        onOpenBinderChapterBook: @escaping (_ subjectId: String, _ fallbackTitle: String) -> Void = { _, _ in },
        onSyncCalendar: @escaping () -> Void = {},
        onOpenLearnStudio: @escaping () -> Void = {},
        onOpenArchive: @escaping () -> Void = {},
        onOpenStudyCompanion: @escaping (_ topic: String?) -> Void = { _ in },
        onOpenConceptChapter: @escaping (_ conceptId: String) -> Void = { _ in },
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
        self.onOpenFlow = onOpenFlow
        self.onSaveMemo = onSaveMemo
        self.onFileTranscript = onFileTranscript
        self.intelHasData = intelHasData
        self.binderHasData = binderHasData
        self.onGmailLinked = onGmailLinked
        self.onGmailDisconnected = onGmailDisconnected
        self.onMoodleLinked = onMoodleLinked
        self.onMoodleDisconnected = onMoodleDisconnected
        self.intelLines = intelLines
        self.binderTitles = binderTitles
        self.binderChapterBooks = binderChapterBooks
        self.onOpenBinderChapterBook = onOpenBinderChapterBook
        self.onSyncCalendar = onSyncCalendar
        self.onOpenLearnStudio = onOpenLearnStudio
        self.onOpenArchive = onOpenArchive
        self.onOpenStudyCompanion = onOpenStudyCompanion
        self.onOpenConceptChapter = onOpenConceptChapter
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
                //
                // Real fix (2026-08-23, live report: "the map is not
                // filling vertically" - true even after the Knowledge Map
                // field itself was fixed to correctly claim all the height
                // ITS OWN box offers). Root cause: `board` is `artboard *
                // scale`, and `scale` is bound by whichever dimension is
                // tighter (`min(w/1440, h/810)`) - on this device width is
                // the binding constraint, so `board.height < geo.size.
                // height` by design (same letterboxing BlueprintGrid's own
                // 2026-08-18 fix already worked around for the dots). The
                // plain Binder landing (`isPlainBinderLanding` below) is
                // already documented elsewhere in this file as "one
                // continuous page," not board content that needs
                // 1440x810-relative positioning like the other tiles still
                // do - so it now renders as its own full-geo.size sibling
                // here, same escape hatch BlueprintGrid already uses,
                // instead of through `pin()`'s board-scaled box (which
                // WorkArtboard.landingBinder happened to size at 100% of
                // the artboard, but 100% of a letterboxed artboard is
                // still short of the real screen). `tileBoard` skips its
                // own binder pin in this same case so it isn't rendered
                // twice.
                let isPlainBinderLanding = !binderContentViewerActive && !expanded
                if isPlainBinderLanding {
                    photoTile(.binder)
                        .frame(width: geo.size.width, height: geo.size.height)
                }
                tileBoard(scale: scale, board: board, skipBinder: isPlainBinderLanding)
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
            // Eager load (2026-08-23) - the real per-concept nodes now
            // fill the Knowledge Map's own diffuse field on first render
            // (`UnifiedKnowledgeFieldCanvas`, in `binderWorkspaceColumn`),
            // not just after tapping into the full graph viewer.
            .task { await knowledgeGraphClient.load() }
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
                // Straight into Resume/Gantabya (2026-08-25) - same
                // no-tap-automation verification need as the flags above,
                // for the Gurukul-style resume redesign.
                if ProcessInfo.processInfo.arguments.contains("--ui-testing-resume") {
                    viewingResumeAgent = true
                }
                // Straight into JobOS/Applications (2026-08-25) - same
                // reasoning as --ui-testing-resume above, for the role-list
                // card redesign (Phase 3 of the resume rebuild).
                if ProcessInfo.processInfo.arguments.contains("--ui-testing-jobos") {
                    resumeStartInApplications = true
                    viewingResumeAgent = true
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
                // Straight into the bundled "Timeline of Calculus History"
                // MicroSim (2026-08-25) - the exact sim behind the
                // founder's "Error loading timeline data" report. Presents
                // the real MicroSimView cover with the real bundled record
                // (no fixture HTML), so a screenshot proves whether the
                // sim's fetch('data.json')/style.css actually resolve now
                // - see MicroSimRecord.selfContainedHTML's sidecar shim.
                if simArgs.contains("--ui-testing-timeline-sim"),
                   let timeline = MicroSimLoader.all.first(where: { $0.simDir == "timeline" }) {
                    presentedMicroSim = timeline
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
        // Explicit keyboard exemption (2026-08-22, real regression fix):
        // this whole screen's board scale is computed from THIS
        // GeometryReader's own geo.size (`scale = min(w/1440, h/810)`) -
        // the new binder ask bar's TextField means the keyboard can now
        // appear here for the first time, and without this, the keyboard
        // showing shrinks geo.size.height, which shrinks the WHOLE binder/
        // board proportionally (not just the text field area) - the exact
        // "binder shrinks in dimension" bug already fixed once for a
        // different cause. The bare .ignoresSafeArea() above already
        // covers this in principle (its default region is .all, which
        // includes .keyboard), but naming .keyboard explicitly here is the
        // reliable fix in practice for a GeometryReader-sized root view.
        .ignoresSafeArea(.keyboard, edges: .bottom)
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
        .fullScreenCover(isPresented: $showCreateBook) {
            CreateBookView(
                onClose: { showCreateBook = false },
                onFiled: { subjectId, title in
                    onFileChapterBook(title, subjectId)
                    Task { libraryBooks = (try? await BookLibraryClient.listBooks()) ?? libraryBooks }
                }
            )
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

    private func tileBoard(scale: CGFloat, board: CGSize, skipBinder: Bool = false) -> some View {
        ZStack(alignment: .topLeading) {
            Color.clear
                .frame(width: board.width, height: board.height)
            // Intel/Homework Help/Knowledge Graph are folded away entirely
            // on a plain landing (2026-08-22, explicit ask + reference
            // images: Binder alone fills ~88% of the board the moment you
            // land - "the display itself is horror" with four competing
            // tiles). Knowledge Graph now blends into Binder itself (see
            // its embedded preview below), Intel moved to a dock chip
            // (`deskGridDock_Intel`), Homework Help keeps its existing dock
            // chip as its only entry point. These three still render in
            // the `expanded` (Memo/Flows rail open) mode below, unchanged -
            // that's a separate interaction this pass doesn't touch.
            if !binderContentViewerActive && expanded {
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
                    // Co-Work's two upload choices (2026-08-24) - both
                    // pickers + the confirmation dialog attached at this
                    // SAME call site as showHomeworkImporter's own sheet
                    // above, deliberately - this exact spot is where a
                    // hard-won earlier fix confirmed presentation modifiers
                    // actually work for this tile (see the comment above);
                    // attaching them anywhere else risks reproducing that
                    // same "state flips correctly but nothing ever
                    // presents" bug.
                    photoTile(.homeworkHelp)
                        .sheet(isPresented: $showHomeworkImporter) {
                            HomeworkDocumentPicker { url in
                                Task { await handleHomeworkFileUpload(url) }
                            }
                        }
                        // Was a 2-way "Upload to Presentation / Upload OCR"
                        // confirmationDialog (showCoWorkChoice) - the
                        // Presentation branch is gone (2026-08-25, "we dont
                        // need create anywhere"), leaving OCR as the only
                        // real destination, so the tile now opens that
                        // picker directly instead of asking first.
                        .sheet(isPresented: $showCoWorkOCRPicker) {
                            HomeworkDocumentPicker { url in
                                coWorkFileName = url.lastPathComponent
                                coWorkPages = CoWorkPageRenderer.renderPages(fileURL: url)
                                showCoWorkAnnotate = true
                            }
                        }
                        .fullScreenCover(isPresented: $showCoWorkAnnotate) {
                            CoWorkAnnotateView(
                                fileName: coWorkFileName,
                                pages: coWorkPages,
                                onClose: { showCoWorkAnnotate = false }
                            )
                        }
                }
            }
            // skipBinder: true means the plain landing already rendered
            // Binder as its own full-geo.size sibling one level up (see
            // body's own doc comment) - rendering it again here through
            // the board-scaled pin() would double it.
            if !skipBinder {
                pin(boxRect(.binder), scale: scale) {
                    photoTile(.binder)
                }
            }
            if expanded {
                switch rail {
                case .memo:
                    pin(WorkArtboard.memoRail, scale: scale) { memoRail }
                case .transcribe:
                    pin(WorkArtboard.transcribeRail, scale: scale) { transcribeRail }
                case .flows, .none:
                    pin(WorkArtboard.flowsRail, scale: scale) { flowsRail }
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
            // Renamed to Co-Work (2026-08-24, explicit ask: "remove this
            // button and instead put Co-Work here") - same tile, its
            // upload action now offers a real choice (Presentation vs
            // OCR/annotate) instead of going straight into the old
            // AI-hint-cards picker - see handleTile's .homeworkHelp case.
            case .homeworkHelp: return "Co-Work"
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
        // The binder-as-the-whole-page landing (boxRect ->
        // `WorkArtboard.landingBinder`) gets NO tile chrome at all
        // (2026-08-23, live feedback: after `binderBookFrame` lost its
        // dark-green cover, this wrapper's own cream-gradient rounded
        // card + shadow was the remaining "big box outline" - the whole
        // point is one continuous page, so the card look only survives in
        // the expanded/rail and content-viewer modes where Binder really
        // is one tile among others).
        let fullPageBinder = kind == .binder && !binderContentViewerActive && !expanded
        return VStack(alignment: .leading, spacing: 6) {
            // Back to dark green - the board background reverted to
            // cream (2026-08-18, "take it back to white polka dots"),
            // and white-on-cream is unreadable.
            if !fullPageBinder {
                Text(kind.title)
                    .font(.system(size: 15, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
            }
            Button {
                handleTile(kind)
            } label: {
                ZStack {
                    if !fullPageBinder {
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .fill(LinearGradient(colors: kind.wash, startPoint: .topLeading, endPoint: .bottomTrailing))
                    }
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
                // Corner radius 0 on the full-page landing: with no
                // visible card behind it, a rounded clip would just shave
                // the page's own content out of its corners for no reason.
                .clipShape(RoundedRectangle(cornerRadius: fullPageBinder ? 0 : 18, style: .continuous))
                .shadow(color: fullPageBinder ? .clear : .black.opacity(0.14), radius: 12, y: 6)
                .overlay(
                    RoundedRectangle(cornerRadius: 18, style: .continuous)
                        .strokeBorder((awake || fullPageBinder) ? Color.clear : Color(gridHex: "143a2e").opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [5, 4]))
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
            if gmail.hasGmailScope {
                closeBinderContentViewer()
                viewingGmail = true
            } else {
                onOpenGmail()
            }
        } else if query.contains("homework") {
            handleTile(.homeworkHelp)
        } else if query.contains("memo") {
            setRail(rail == .memo ? .none : .memo)
        } else if query.contains("transcribe") {
            setRail(rail == .transcribe ? .none : .transcribe)
        } else if query.contains("flows")
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
        if query.contains("resume") {
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
        // A background tap on the binder while a content viewer (Archive/
        // Design/Resume/...) is open used to fall through to onOpenBinder()
        // below - easy to hit by accident on Design's drag-heavy canvas.
        // Added 2026-08-22 alongside the in-binder consolidation.
        if kind == .binder, binderContentViewerActive { return }
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
            // Renamed to Co-Work (2026-08-24). Used to offer a choice
            // between OCR and "Upload to Presentation" - the latter is
            // gone (2026-08-25, with the rest of CreateCanvasView), so
            // this goes straight to OCR now, same as before that rename.
            showCoWorkOCRPicker = true
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

    /// Binder's landing paints straight onto the page now (2026-08-23,
    /// live feedback after the full-bleed pass: even spanning the whole
    /// board, the dark-green rounded "cover" + cream inset page still read
    /// as "a box" - "horror" - so BOTH RoundedRectangle layers and their
    /// shadow are gone entirely, not just shrunk or recolored). No fill of
    /// any kind here either: the screen's own cream page behind the board
    /// (`Color(gridHex: "fff8e9")` + `BlueprintGrid`) shows straight
    /// through, which is the only way to guarantee zero visible seam
    /// between "inside the old card" and the page around it - painting a
    /// matching cream fill would still cover the blueprint grid lines and
    /// leave a ghost rectangle where they stop. The `BinderKnowledgeDots`
    /// whole-page concept texture that used to render here is gone
    /// (2026-08-23, Knowledge Map merge): those same real nodes are now
    /// the diffuse field INSIDE the Knowledge Map itself
    /// (`UnifiedKnowledgeFieldCanvas`, in `binderWorkspaceColumn`) -
    /// drawing them a second time here, faint, directly behind that same
    /// map would double the exact same dots at two different scales.
    @ViewBuilder
    private func binderBookFrame<Content: View>(@ViewBuilder _ content: () -> Content) -> some View {
        ZStack {
            content()
                .padding(.horizontal, 32)
                .padding(.vertical, 24)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    /// Gold binder-ring column - a real HStack sibling between the graph
    /// preview and the topic grid in `binderLandingBody` (not an absolutely-
    /// positioned overlay, which would drift out of alignment the moment
    /// either column's width changes). Matches the reference's open-book
    /// binding down the center seam.
    private var binderRingSpine: some View {
        let gold = Color(red: 0.72, green: 0.58, blue: 0.28)
        return VStack(spacing: 22) {
            ForEach(0..<7, id: \.self) { _ in
                Circle()
                    .fill(LinearGradient(colors: [gold.opacity(0.9), gold.opacity(0.6)], startPoint: .topLeading, endPoint: .bottomTrailing))
                    .frame(width: 14, height: 14)
                    .overlay(Circle().strokeBorder(Color.white.opacity(0.35), lineWidth: 1))
                    .shadow(color: .black.opacity(0.25), radius: 2, y: 1)
            }
        }
        .frame(maxHeight: .infinity)
    }

    /// Picks Binder's content-viewer body and erases it to ONE concrete
    /// type (2026-08-22) - replaces four separate if/else-if branches that
    /// used to live directly in `tileBody`'s already highest-risk chain
    /// (a real stack-overflow crash was fixed there tonight via `AnyView`
    /// on the plain-landing branch). Consolidating every viewer mode
    /// behind a single `AnyView?` here means adding Design/Resume/Reports
    /// makes this chain SHORTER, not longer - one branch instead of seven.
    /// A book takes priority over an upload (2026-08-19: opening a book
    /// while an old upload was mid-view should show the book, not silently
    /// no-op) - `closeBinderContentViewer` already keeps these mutually
    /// exclusive, this ordering is a second, cheap guarantee, not the only
    /// one.
    private func binderContentViewerSelection(ink: Color) -> AnyView? {
        if let viewingBook {
            // Deliberately NOT wrapped in tileInnerCard - StudySessionView
            // paints its own dark rounded panel + white text (its real
            // visual identity, see its `embedded` doc comment), which
            // tileInnerCard's white card background would sit uselessly
            // behind/clash with rather than complement.
            return AnyView(StudySessionView(
                lesson: viewingBook.lesson,
                embedded: true,
                onClose: closeBinderContentViewer,
                onOpenMicroSim: { sim in presentedMicroSim = sim },
                onOpenGeneratedSim: { sim in presentedGeneratedSim = sim }
            ))
        }
        if viewingArchiveBrowser {
            return AnyView(tileInnerCard { archiveBrowserBody(ink: ink) })
        }
        if viewingKnowledgeGraphInBinder {
            return AnyView(tileInnerCard { knowledgeGraphContentViewerBody(ink: ink) })
        }
        if let viewingUpload {
            return AnyView(tileInnerCard { uploadContentViewerBody(viewingUpload, ink: ink) })
        }
        // Design/Resume paint their own full backgrounds (same reasoning
        // as StudySessionView above), so - like it - they're NOT wrapped in
        // tileInnerCard. Both self-scale from whatever GeometryReader frame
        // they're given (own internal 1440x810 artboard math), so they
        // correctly shrink to fit `WorkArtboard.contentViewerBinder`
        // instead of needing any special-casing here.
        if viewingDesignStudio {
            return AnyView(DesignStudioView(studentName: studentName, onClose: closeBinderContentViewer, embedded: true))
        }
        if viewingResumeAgent {
            return AnyView(ResumeAgentView(onClose: closeBinderContentViewer, studentName: studentName, embedded: true, startInApplications: resumeStartInApplications))
        }
        if viewingGmail {
            return AnyView(GmailWorkflowBoxView(
                onClose: closeBinderContentViewer,
                onConnected: onGmailLinked,
                onDisconnected: onGmailDisconnected,
                embedded: true
            ))
        }
        if viewingSessionReports {
            return AnyView(tileInnerCard { SessionReportsView(onClose: closeBinderContentViewer) })
        }
        if viewingFriends {
            return AnyView(tileInnerCard { FriendsView(studentName: studentName) })
        }
        return nil
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
        if kind == .binder, let selection = binderContentViewerSelection(ink: ink) {
            selection
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
        } else if kind == .binder {
            // Binder's own landing "page" (2026-08-22, reference images) -
            // takes over Binder's default body instead of the old plain
            // memo/doc list or "Empty until Jesse files something here"
            // blurb, which sit behind the content-viewer branches above
            // and are now unreachable on a plain landing.
            binderBookFrame { binderLandingBody(ink: ink) }
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
            // Blended rail (2026-08-27), not the old onTranscribe ->
            // showJesseCallSheet bottom drawer - see transcribeRail's own
            // doc comment.
            jesseBoxIcon("waveform") { setRail(rail == .transcribe ? .none : .transcribe) }
                .accessibilityIdentifier("deskGridJesseIcon_Transcribe")
            jesseBoxIcon(gmail.hasGmailScope ? "envelope.fill" : "envelope") {
                if gmail.hasGmailScope {
                    // Blended content-viewer swap (2026-08-27), not the old
                    // onOpenGmail() -> FieldDeskView's floating .gmailBox
                    // overlay - see viewingGmail's own doc comment.
                    closeBinderContentViewer()
                    viewingGmail = true
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
                // Renamed to Co-Work (2026-08-24) - tap now offers a real
                // choice (Presentation / OCR-annotate) instead of going
                // straight to a single upload destination.
                Text(homeworkUploading ? "Reading\u{2026}" : "Tap to upload \u{2013} Presentation or OCR")
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
                    // Impact-weighted mastery (2026-08-24, explicit ask,
                    // inspired by Dan McCreary's Concept Impact Score -
                    // see ConceptImpactScore.swift's own doc comment). A
                    // flat X/Y count treats a leaf concept and a
                    // foundational hub as equally important; this weights
                    // each mastered concept by its real recursive impact
                    // on the graph instead, same log-normalized formula
                    // chapter 28 uses for content length, applied to
                    // mastery. Falls back to the plain count on an empty
                    // graph or before any edges have loaded.
                    if let weighted = ConceptImpactScore.impactWeightedMastery(
                        nodes: knowledgeGraphClient.nodes, edges: knowledgeGraphClient.edges
                    ) {
                        Text("\(Int((weighted * 100).rounded()))% impact-weighted mastery")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(tileInk.opacity(0.75))
                    } else {
                        let mastered = knowledgeGraphClient.nodes.filter { $0.status == "mastered" }.count
                        Text("\(mastered)/\(knowledgeGraphClient.nodes.count) concepts mastered")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(tileInk.opacity(0.75))
                    }
                    Spacer(minLength: 0)
                    knowledgeGraphLegend
                }
                KnowledgeGraphCanvas(nodes: knowledgeGraphClient.nodes, edges: knowledgeGraphClient.edges)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .accessibilityIdentifier("deskGridKnowledgeGraphCanvas")
            }
        }
    }

    /// Binder's landing "page" (2026-08-22, reference images): a small
    /// Knowledge Map preview on the left ("blended inside the binder
    /// itself in that little space... click on it, it expands to occupy
    /// the whole binder"), real topic tiles pulled from the Chapter
    /// Library on the right. Tapping the graph preview reuses the exact
    /// same action `handleTile(.moodle)` already performs - relocated,
    /// not rebuilt.
    // AnyView, not `some View` (2026-08-22, real crash fix): a fresh stack
    // overflow (EXC_BAD_ACCESS / SIGSEGV, "Could not determine thread index
    // for stack guard region") hit LIVE on-device immediately after the
    // 94%-binder pass added another VStack + .overlay layer on top of this
    // function's already-deep call site (photoTile -> tileBoard ->
    // DeskGridDashboardView.body.getter - confirmed from the real crash
    // report's symbolicated stack, which spent the bulk of its 117 frames
    // recursing inside swift_getTypeByMangledName/AttributeGraph trying to
    // resolve this closure's opaque return type). This function's own
    // doc-comment already flagged `tileBody`'s giant if/else-if chain as
    // this file's highest-risk area - erasing the type right at this
    // boundary caps the complexity increase here without touching that
    // chain itself.
    private func binderLandingBody(ink: Color) -> AnyView {
        AnyView(binderLandingBodyContent(ink: ink))
    }

    /// Left workspace (~68%) / gutter dots / right module boxes (2026-08-22,
    /// explicit ask from the hand sketch + written spec: "Left 65-70%: one
    /// dominant workspace... Right 30-35%: modular boxes... small progress
    /// dots between the workspace and the modules." The workspace's own
    /// content (Knowledge Map, Archive, Chapter Library grid) is exactly
    /// what was already here - this pass adds the missing right column and
    /// gutter, it doesn't touch how the workspace itself works. A local
    /// GeometryReader only proportions these two columns within whatever
    /// frame the binder already has - it does not feed the root board-scale
    /// GeometryReader (`WorkArtboard`'s `scale = min(w/1440,h/810)`), so it
    /// can't reproduce the keyboard-driven shrink bug that fix addressed.
    @ViewBuilder
    private func binderLandingBodyContent(ink: Color) -> some View {
        GeometryReader { geo in
            HStack(alignment: .top, spacing: 16) {
                // Widened 2026-08-23, explicit ask: "expand the map to
                // occupy... space right before Learn Practice" - the
                // unified Knowledge Map field (inside this column) gets
                // more real room, the module box column on the right
                // shrinks to match.
                // maxHeight: .infinity added 2026-08-23, explicit ask:
                // "increase the vertical space the opening knowledge map
                // and everything takes, bring them almost close to jesse
                // at the bottom... there is white space between those two
                // that is currently unused" - this column previously had
                // no height constraint at all, so it sized to its own
                // shortest child's natural height (the Knowledge Map
                // preview card) and left the rest of the column's real
                // height as blank cream space above the dock.
                // binderWorkspaceColumn's field is a GeometryReader inside
                // this column - it now actually gets the full real height
                // to spread across.
                binderWorkspaceColumn(ink: ink)
                    .frame(width: geo.size.width * 0.76, height: geo.size.height, alignment: .top)

                binderProgressGutter

                moduleBoxColumn(ink: ink)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        // jesseBoxIconRow moved off this overlay (2026-08-23, explicit
        // ask: "put the 4 icons on top of the search bar instead of below
        // leverage") - see `bottomDock`'s own overlay for where it lives
        // now.
        .task {
            // Plain .task, not .task(id:) - keying it to libraryBooksLoaded
            // and then setting that same flag true INSIDE this task self-
            // cancels the in-flight fetch the instant the id changes
            // (confirmed live: the grid silently came back empty). Refresh
            // after creating a new book is instead a direct, explicit
            // re-fetch in `onFiled` below, not this task re-running.
            guard !libraryBooksLoaded else { return }
            libraryBooksLoaded = true
            libraryBooks = (try? await BookLibraryClient.listBooks()) ?? []
        }
    }

    /// The workspace itself - ONE unified Knowledge Map filling the whole
    /// column (2026-08-23, Knowledge Map merge - direct ask: "why is map
    /// nor mixing with the second column and the dots highlighted should
    /// be organically in the map"). Used to be three side-by-side pieces
    /// [200pt preview | decorative binderRingSpine | separate ambient
    /// garden] that never visually read as one thing. Now: the real
    /// per-concept graph IS the ambient field (dimmed, spread across the
    /// full column), with recommended books as a highlighted, labeled
    /// overlay layer sitting organically inside that same field instead
    /// of on a second, disconnected canvas. `binderRingSpine` is dropped
    /// here - its "open-book center seam" meaning doesn't apply once
    /// there's no longer a visual seam between two halves (kept as a
    /// `private var` in case it's wanted elsewhere).
    ///
    /// Tapping anywhere in the empty field still opens the full
    /// interactive graph viewer (`deskGridBinderGraphPreview` - same
    /// identifier and action as the old preview card, so existing UI
    /// tests keep passing); tapping a book dot opens that book, exactly
    /// as `topicTileGrid` did. See KNOWLEDGE_MAP_MERGE_PLAN.md for the
    /// full design writeup, including the honest caveat that book
    /// placement is still a deterministic hash (`ambientGardenPosition`),
    /// not a real semantic position - Section 2's Phase 2 spike is what
    /// would change that, and is explicitly not part of this pass.
    @ViewBuilder
    private func binderWorkspaceColumn(ink: Color) -> some View {
        let nodes = knowledgeGraphClient.nodes
        let recommendedBooks = libraryBooks.filter { $0.totalConcepts > 0 && $0.coveredConcepts > 0 }
        let mastered = nodes.filter { $0.status == "mastered" }.count

        VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 10) {
                Text("Knowledge Map")
                    .font(.mcContent(size: 17, weight: .semibold))
                    .foregroundColor(ink)
                Spacer(minLength: 0)
                if !nodes.isEmpty {
                    Text("\(mastered)/\(nodes.count) concepts mastered")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .foregroundColor(ink.opacity(0.6))
                    knowledgeGraphLegend
                }
            }

            // Real fix (2026-08-23, live report: "expand the map and
            // everything more vertically" - a GeometryReader sitting
            // inside a plain VStack has no guaranteed height on its own;
            // without an explicit maxHeight it can settle to a small
            // ideal size instead of claiming the rest of the column,
            // which is exactly "empty space underneath" - the outer
            // `.frame(height: geo.size.height)` this whole function
            // receives from binderLandingBodyContent only bounds the
            // VStack's MAX, it doesn't force this GeometryReader row to
            // actually fill it.
            GeometryReader { geo in
                let conceptPositions = graphNormalizedPositions(nodes: nodes, size: geo.size, padding: 0.1)
                let bookPositions: [String: CGPoint] = Dictionary(
                    uniqueKeysWithValues: recommendedBooks
                        .sorted { $0.subjectId < $1.subjectId }
                        .compactMap { book -> (String, CGPoint)? in
                            guard let p = ambientGardenPosition(for: book, in: geo.size, avoiding: Array(conceptPositions.values)) else { return nil }
                            return (book.subjectId, p)
                        }
                )

                ZStack {
                    // Background tap target - identical action/identifier
                    // to the old 200pt preview card, now spanning the
                    // whole field so tapping empty space anywhere still
                    // opens the full graph.
                    Button {
                        closeBinderContentViewer()
                        viewingKnowledgeGraphInBinder = true
                        Task { await knowledgeGraphClient.load() }
                    } label: {
                        Color.clear.contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("deskGridBinderGraphPreview")

                    UnifiedKnowledgeFieldCanvas(
                        nodes: nodes, edges: knowledgeGraphClient.edges,
                        books: recommendedBooks, bookPositions: bookPositions, ink: ink,
                        onOpenBook: { onOpenBinderChapterBook($0.subjectId, $0.title) }
                    )

                    if nodes.isEmpty && recommendedBooks.isEmpty {
                        VStack(spacing: 10) {
                            if knowledgeGraphClient.isLoading {
                                ProgressView().tint(ink)
                                Text("Mapping your knowledge\u{2026}")
                            } else {
                                emptyGraphSeed
                                Text("This grows as you learn and engage with new things.")
                            }
                        }
                        .font(.system(size: 12, weight: .semibold, design: .rounded))
                        .foregroundColor(ink.opacity(0.7))
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                        .allowsHitTesting(false)
                    }
                }
                .frame(width: geo.size.width, height: geo.size.height)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .frame(maxHeight: .infinity, alignment: .top)
    }

    /// Real progress dots in the gutter between the workspace and the
    /// module boxes (2026-08-22, explicit ask - and an explicit correction
    /// after the gold `binderRingSpine` circles were mistaken for this:
    /// those are decorative binding rings inside the workspace column, this
    /// is a separate, distinct element in the gutter between the two
    /// columns). Filled count is real, not decorative filler: how many of
    /// the loaded Chapter Library books have any recorded progress at all.
    private var binderProgressGutter: some View {
        let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)
        let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
        let filled = min(libraryBooks.filter { $0.coveredConcepts > 0 }.count, 5)
        return VStack(spacing: 10) {
            ForEach(0..<5, id: \.self) { index in
                Circle()
                    .fill(index < filled ? lime : ink.opacity(0.15))
                    .frame(width: 6, height: 6)
            }
        }
        .padding(.top, 6)
        .accessibilityIdentifier("deskGridBinderProgressGutter")
    }

    /// Learn+Practice / Create / Answer as real, visible boxes in the
    /// right column (2026-08-22, explicit correction: these were wrongly
    /// built as bottom-dock chips - "i told you to display the learn and
    /// the boxes i had made and the practice and other boxes would move
    /// onto the screen"). Tapping one transforms the workspace column via
    /// the same `viewingXxx`/`closeBinderContentViewer` mechanism already
    /// used throughout this file, per the spec's own principle: "clicking
    /// Learn, Practice, Create, or Answer transforms that same area
    /// instead of navigating the student into disconnected pages."
    ///
    /// Learn and Practice merged into ONE box (2026-08-23, explicit ask:
    /// "Learn and Practice can be merged... intelligent AI conversational
    /// thing"). This one now goes full-screen (`onOpenStudyCompanion`,
    /// FieldDeskView's `.studyCompanion` overlay), not the workspace-column
    /// swap the other three still use - the founder's own words were
    /// "whatever we have on the dash changes", the whole screen, not just
    /// this column.
    @ViewBuilder
    private func moduleBoxColumn(ink: Color) -> some View {
        VStack(spacing: 12) {
            learnModuleBox(ink: ink)
            // Renamed PencilWork -> Lab (2026-08-25, explicit ask: "the
            // pencilwork section should be the design studio... where
            // students and teachers can design custom lessons... using
            // AI... perfectly working on the iphone not here in ipad" -
            // iPhone's own "Design" card already opens DesignStudioView
            // via onDesign/showDesignStudio, confirmed working; this box
            // now opens the SAME real destination instead of
            // showCreateBook/CreateBookView, which loses its only trigger
            // as a result - flagged, not silently orphaned: CreateBookView
            // itself is untouched on disk, just unreachable from this
            // dashboard now, a separate call if that feature still needs a
            // home. Identifier kept stable (deskGridModule_Create still
            // refers to the box's ORIGINAL name, not its current display
            // text - same convention deskGridModule_Design/_Leverage
            // below already established for their own renames).
            mascotModuleBox("Lab", badgeSystem: "pencil.and.scribble", identifier: "deskGridModule_Create", ink: ink) {
                closeBinderContentViewer()
                viewingDesignStudio = true
            }
            // Leverage (2026-08-23, explicit ask: "add a resume box...
            // called Leverage" alongside the existing four) - the EXACT
            // same action the binder utility row's Resume icon already
            // performs (`deskGridBinderUtility_Resume`), including the
            // jesseCall.end() that lets ResumeAgentView's own call button
            // start a correctly-contexted call. A fifth entry point, not a
            // new destination.
            //
            // Renamed Kamana -> Gantabya (2026-08-25, explicit ask -
            // Nepali for "destination"; Kamana itself was Nepali for
            // "good luck," renamed 2026-08-24). Same box, same action,
            // identifier kept stable.
            mascotModuleBox("Gantabya", subtitle: gantabyaSubtitle, badgeSystem: "sparkles", identifier: "deskGridModule_Leverage", ink: ink) {
                jesseCall.end()
                closeBinderContentViewer()
                viewingResumeAgent = true
            }
        }
    }

    /// Phase 2 of the resume rebuild (2026-08-25, explicit ask: "it also
    /// has an applications section... A short bio, skills, experiences
    /// which is now blended into the dash") - real data off
    /// `jesseCall.resumeDraft`, same "computed fact, or an inviting empty
    /// state" shape the phone dashboard's Gurukul card already uses for
    /// impact-weighted mastery. Headline first (the actual "short bio"
    /// the ask names), skills/roles counts as a fallback once a headline
    /// hasn't been written yet, and the same static line the phone card
    /// already ships as the true empty state.
    private var gantabyaSubtitle: String {
        guard let draft = jesseCall.resumeDraft,
              !draft.headline.isEmpty || !draft.skills.isEmpty || !draft.roles.isEmpty
        else {
            return "Build your resume, one conversation at a time."
        }
        if !draft.headline.isEmpty { return draft.headline }
        var parts: [String] = []
        if !draft.skills.isEmpty { parts.append("\(draft.skills.count) skill\(draft.skills.count == 1 ? "" : "s")") }
        if !draft.roles.isEmpty { parts.append("\(draft.roles.count) role\(draft.roles.count == 1 ? "" : "s")") }
        return parts.joined(separator: " · ")
    }

    /// Learn+Practice's box carries the raccoon itself (2026-08-23,
    /// explicit ask) - the same static `JesseRailView.raccoonImage` every
    /// Jesse surface in this app already uses (search-field icon, Jesse
    /// rail), NOT a new asset - instead of the generic book SF Symbol the
    /// other module boxes get. This is also the merged Learn+Practice
    /// trigger: opens the full-screen study companion instead of the old
    /// `closeBinderContentViewer()` no-op. Bespoke view rather than another
    /// `moduleBox` parameter: an Image-vs-SF-Symbol fork inside the shared
    /// helper would leak this one box's special case into every call site.
    private func learnModuleBox(ink: Color) -> some View {
        Button {
            // Retargeted off StudyCompanionView's full-screen takeover
            // (2026-08-27, explicit ask: "Gurukul, we don't need because
            // it's ask anything... I still have to go to Gurukul to learn
            // something. This should be possible from the Jesse ask
            // anything section right there"). Opens the SAME inline
            // agent-takeover panel the "Ask anything…" search field
            // already drives (startAgentTakeover/agentTakeoverActive,
            // borrowing Binder+Intel in place) instead of navigating to a
            // separate screen - identifier kept stable (deskGridModule_Learn).
            closeBinderContentViewer()
            withAnimation(.easeInOut(duration: 0.2)) {
                agentTakeoverActive = true
            }
            resetAgentTakeoverFields()
        } label: {
            VStack(alignment: .leading, spacing: 8) {
                JesseRailView.raccoonImage
                    .resizable()
                    .scaledToFit()
                    .frame(height: 42)
                Text("Ask anything")
                    .font(.mcContent(size: 16, weight: .semibold))
                    .foregroundColor(ink)
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskGridModule_Learn")
    }

    private func moduleBox(_ title: String, system: String, identifier: String, ink: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 10) {
                Image(systemName: system)
                    .font(.system(size: 18, weight: .medium))
                    .foregroundColor(ink)
                Text(title)
                    .font(.mcContent(size: 16, weight: .semibold))
                    .foregroundColor(ink)
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
            // White card fill dropped (2026-08-23, live feedback: the
            // module boxes blend straight into the cream page, no
            // border/shadow). contentShape keeps the full box area
            // tappable without an opaque fill.
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    /// PencilWork and Kamana's mascot treatment (2026-08-24, explicit ask:
    /// "i want different Jesse to be sitting on top of PaperWork, kamana
    /// and gurukul instead of the current logos please design them pretty
    /// and beautiful... be creative"). Real custom art per box needs either
    /// generated illustrations (blocked tonight - the founder's Higgsfield
    /// account has no active plan/credits, and starting a paid trial
    /// without them there to confirm the card charge isn't something to
    /// do unilaterally) or hand-authored assets neither of us has right
    /// now. This is the honest middle ground: the SAME raccoon mascot
    /// Gurukul already uses (not a new asset), with a small distinct
    /// accent badge per box so they still read as visually different from
    /// each other and from a plain SF Symbol - not the final art, a real
    /// placeholder worth swapping for generated/illustrated poses once
    /// there's a plan to pay for that.
    private func mascotModuleBox(_ title: String, subtitle: String? = nil, badgeSystem: String, identifier: String, ink: Color, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(alignment: .leading, spacing: 8) {
                ZStack(alignment: .bottomTrailing) {
                    JesseRailView.raccoonImage
                        .resizable()
                        .scaledToFit()
                        .frame(height: 34)
                    Image(systemName: badgeSystem)
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(.white)
                        .padding(5)
                        .background(Circle().fill(ink))
                        .offset(x: 6, y: 4)
                }
                Text(title)
                    .font(.mcContent(size: 16, weight: .semibold))
                    .foregroundColor(ink)
                // Live profile summary (2026-08-25, Phase 2 of the resume
                // rebuild: "a short bio, skills, experiences... blended
                // into the dash") - same computed-with-fallback shape the
                // phone dashboard's own Gurukul card already established
                // for impact-weighted mastery (ConceptImpactScore), just
                // reused here for Gantabya's resumeDraft instead.
                if let subtitle {
                    Text(subtitle)
                        .font(.mcChrome(size: 11))
                        .foregroundColor(ink.opacity(0.6))
                        .lineLimit(2)
                }
                Spacer(minLength: 0)
            }
            .padding(14)
            .frame(maxWidth: .infinity, minHeight: 84, alignment: .topLeading)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
    }

    /// Deterministic scatter so each book's glow sits in a stable spot
    /// across re-renders instead of jumping around - hashed from the
    /// book's own real `subjectId`, not random per frame.
    ///
    /// `avoiding` added 2026-08-23 (Knowledge Map merge, "the dots
    /// highlighted should be organically in the map"): now that book
    /// dots sit inside the SAME field as the real concept nodes instead
    /// of a separate empty canvas, a hashed position can land right on
    /// top of a concept dot it has no real relationship to. A cheap,
    /// deterministic repulsion nudge pushes the book dot away from any
    /// concept within ~40pt - honest Phase-1 placement, not a claim that
    /// a book "belongs" near whichever concept it happened to land by
    /// (see KNOWLEDGE_MAP_MERGE_PLAN.md §2 for the real semantic-
    /// placement idea this deliberately defers).
    private func ambientGardenPosition(for book: AssembledBookSummary, in size: CGSize, avoiding conceptPoints: [CGPoint] = []) -> CGPoint? {
        guard size.width > 1, size.height > 1 else { return nil }
        var hasher = Hasher()
        hasher.combine(book.subjectId)
        let h = UInt64(bitPattern: Int64(hasher.finalize()))
        let fx = Double(h % 1000) / 1000.0
        let fy = Double((h / 1000) % 1000) / 1000.0
        let x = 0.14 + fx * 0.72
        let y = 0.16 + fy * 0.68
        var p = CGPoint(x: x * size.width, y: y * size.height)
        let minDistance: CGFloat = 40
        for cp in conceptPoints {
            let dx = p.x - cp.x, dy = p.y - cp.y
            let dist = (dx * dx + dy * dy).squareRoot()
            if dist < 0.001 {
                p.x += minDistance
            } else if dist < minDistance {
                let nx = dx / dist, ny = dy / dist
                p.x += nx * (minDistance - dist)
                p.y += ny * (minDistance - dist)
            }
        }
        return p
    }

    // binderUtilityRow (Design/Reports/Resume/Settings) removed 2026-08-23,
    // replaced at its one call site by jesseBoxIconRow (see the explicit
    // ask quoted there). Design and Resume are real module boxes now
    // (Design, Leverage) and Settings is on the main dock - Session
    // Reports (viewingSessionReports) has no other entry point after this,
    // a real, named trade-off, not an oversight.

    private func binderUtilityIcon(_ system: String, identifier: String, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Image(systemName: system)
                .font(.system(size: 14, weight: .medium))
                .foregroundColor(Color(gridHex: "143a2e").opacity(0.65))
                .frame(width: 30, height: 30)
                // Real bug fix (2026-08-23, live report: "i cant click on
                // either friends or sims or setting on the bottom left") -
                // a live accessibility-tree dump showed each button's real
                // hit-tested frame was only the SF Symbol's own tight glyph
                // ink bounds (as small as 14x13pt for gearshape.fill), not
                // the 30x30 frame above it - .buttonStyle(.plain) with no
                // .contentShape reports/hit-tests the rendered content's
                // intrinsic bounds, not the frame around it. A real finger
                // tap on the padding around the glyph (most of the visual
                // button) landed on nothing. contentShape makes the whole
                // 30x30 square the real tap target, matching how it looks.
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier(identifier)
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
                    // Real wire-up (2026-08-25, explicit ask: "talk it
                    // through is not working, it should open the gurukul
                    // jesse in ready to talk in this topic context") - was
                    // an empty closure (see this block's own prior doc
                    // comment: "not wired to a destination... real
                    // follow-up, not silently skipped" - now it isn't).
                    // Same resolve-id-to-label + open-Gurukul-with-topic
                    // pattern ConstellationView's own onOpenConcept already
                    // uses, via onOpenStudyCompanion's new topic param.
                    // onQuickPractice stays a stub deliberately - no real
                    // practice-by-concept-id destination exists yet to
                    // hand off to, and silently routing it into Gurukul
                    // too would misrepresent what tapping it does.
                    onOpenConcept: { conceptId in
                        onOpenConceptChapter(conceptId)
                    },
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

    /// Archive mode's body - simulations only now (2026-08-23, explicit
    /// ask: "remove the books completely from the archive and keep just
    /// simulations"). Used to also browse/search real book content
    /// (`BookGraphLoader.all` + a live `ArchiveRagClient` search over Dan
    /// McCreary's wider archive) - that whole path is gone, along with the
    /// real bug it carried (`openArchiveBook` always left `chapterBodies`
    /// empty, so every chapter tab silently repeated the same summary
    /// string). Real per-book content is reached exclusively through the
    /// Chapter Library / ambient map now, via `onOpenBinderChapterBook`.
    @ViewBuilder
    private func archiveBrowserBody(ink: Color) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Simulations")
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

            archiveSimulationsSection(ink: ink)
        }
        .task {
            guard !archiveSimsLoaded else { return }
            archiveSimsLoading = true
            archiveSims = await ArchiveSimsLoader.loadAll()
            archiveSimsLoaded = true
            archiveSimsLoading = false
        }
        // fullScreenCover, not .sheet (2026-08-23, explicit ask: "use the
        // entire simulations box to show them the sim") - a plain .sheet
        // on iPad presents as a large card with real margins around it,
        // not edge-to-edge, which is exactly what made a sim (usually
        // 800x650+) need pinch/scroll to actually see.
        .fullScreenCover(item: $presentedArchiveSim) { sim in
            ArchiveChapterSimView(
                sim: sim,
                onUseInClass: { onFileChapterBook(sim.bookTitle, sim.bookSubjectId) },
                onClose: { presentedArchiveSim = nil }
            )
        }
        .sheet(isPresented: $showArchiveGenerateSim) {
            ArchiveGenerateSimSheet(onGenerated: { book in
                let newOnes = book.chapters.flatMap(\.sections)
                    .filter { $0.simHtml != nil }
                    .map { ArchiveSimEntry(id: "\(book.subjectId)_\($0.conceptId)", bookSubjectId: book.subjectId, bookTitle: book.title, section: $0) }
                let existingIds = Set(archiveSims.map(\.id))
                archiveSims.append(contentsOf: newOnes.filter { !existingIds.contains($0.id) })
            })
        }
    }

    /// Archive's one and only view now (2026-08-23, see
    /// `archiveBrowserBody`'s doc comment) - real, gated sims flattened
    /// across every synced Chapter Library book.
    @ViewBuilder
    private func archiveSimulationsSection(ink: Color) -> some View {
        if archiveSimsLoading {
            ProgressView("Loading the simulation library\u{2026}").tint(ink)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else if archiveSims.isEmpty {
            VStack(spacing: 10) {
                Text("No simulations synced yet.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(ink.opacity(0.6))
                Button("Write the first one") { showArchiveGenerateSim = true }
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .accessibilityIdentifier("deskGridArchiveSimGenerate")
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
            ScrollView {
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 150), spacing: 10)], spacing: 10) {
                    Button { showArchiveGenerateSim = true } label: {
                        VStack(spacing: 6) {
                            Image(systemName: "plus.circle.fill").font(.system(size: 20))
                            Text("Write one").font(.system(size: 12, weight: .heavy, design: .rounded))
                        }
                        .foregroundColor(ink.opacity(0.6))
                        .frame(height: 92, alignment: .center)
                        .frame(maxWidth: .infinity)
                        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(ink.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("deskGridArchiveSimGenerate")

                    ForEach(archiveSims) { sim in
                        Button { presentedArchiveSim = sim } label: {
                            VStack(alignment: .leading, spacing: 4) {
                                Text(sim.section.simTitle ?? sim.section.title)
                                    .font(.system(size: 12, weight: .bold, design: .rounded))
                                    .foregroundColor(ink)
                                    .lineLimit(2)
                                    .multilineTextAlignment(.leading)
                                Text(sim.bookTitle)
                                    .font(.system(size: 10, weight: .medium, design: .rounded))
                                    .foregroundColor(ink.opacity(0.55))
                                    .lineLimit(1)
                                Spacer(minLength: 0)
                                // "Try it" text removed (2026-08-23, explicit
                                // ask) - the whole card is still the real tap
                                // target, this is just its icon now.
                                Image(systemName: "play.fill")
                                    .font(.system(size: 12, weight: .heavy))
                                    .foregroundColor(ink.opacity(0.8))
                            }
                            .padding(10)
                            .frame(height: 92, alignment: .topLeading)
                            .frame(maxWidth: .infinity)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("deskGridArchiveSim_\(sim.id)")
                    }
                }
            }
        }
    }

    // loadArchiveBooks / archiveSection / archiveBookRow / runArchiveSearch /
    // openBundledBook / openArchiveBook removed 2026-08-23 along with the
    // Archive book-browsing UI they only served (see archiveBrowserBody's
    // doc comment) - this also removes a real, previously-flagged bug
    // (openArchiveBook always built a lesson with chapterBodies: [], so
    // every chapter tab silently fell back to the same single summary
    // string with no per-chapter content or sim). Books open from the
    // Chapter Library / ambient map now exclusively through
    // `onOpenBinderChapterBook` -> FieldDeskView.openChapterBookFromBinder,
    // which fetches real per-section content via BookLibraryClient.getBook.

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
            agentTakeoverLabel("Ask anything", ink: .white)
            if agentAskBusy {
                HStack(spacing: 8) {
                    ProgressView().tint(.white)
                    Text("Thinking\u{2026}")
                        .font(.system(size: 12, weight: .medium, design: .rounded))
                        .foregroundColor(.white.opacity(0.85))
                }
            } else if let reply = agentReplyText {
                ScrollView(showsIndicators: false) {
                    Text(reply)
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(.white)
                        .fixedSize(horizontal: false, vertical: true)
                        .frame(maxWidth: .infinity, alignment: .leading)
                }
            } else {
                // The reply-in-progress states above already carry their
                // own copy - this is only the true "just opened, nothing
                // asked yet" state, which used to render as a blank Text("").
                Text("Type a question in \u{201C}Ask anything\u{2026}\u{201D} below - what to learn, what to build, anything.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(.white.opacity(0.75))
                    .fixedSize(horizontal: false, vertical: true)
                    .frame(maxWidth: .infinity, alignment: .leading)
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
        case .binder: base = expanded ? WorkArtboard.p5Binder : WorkArtboard.landingBinder
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
            // jesseBoxIconRow moved here (2026-08-23, explicit ask: "put
            // the 4 icons on top of the search bar instead of below
            // leverage") - was an overlay on binderLandingBodyContent,
            // positioned near wherever the module column's Leverage box
            // happened to land. This is bottomDock's own screen-global
            // coordinate space, so "above the search bar" is exact rather
            // than approximate: trailing padding matches the search
            // field's own 240pt width + this dock's 24pt trailing inset,
            // bottom padding clears the 60pt-tall dock bar itself. Only
            // shown for workDock (Notes/Transcribe/Gmail/Calendar are
            // workDashboard actions - flowsDock/sidebarFlowDock have their
            // own separate docks and don't apply).
            .overlay(alignment: .bottomTrailing) {
                if activeSidebarFlow == nil, rail != .flows {
                    jesseBoxIconRow
                        .padding(.trailing, 24)
                        .padding(.bottom, 76)
                }
            }
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
        case .englishPractice:
            EnglishPracticeView(onClose: closeSidebarFlow, studentName: studentName)
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
            // Design/Resume now open INSIDE the binder (2026-08-22) - close
            // the Practice flow pane at the same time so the dashboard
            // that slides back into view already shows the destination.
            dockChip("Design", system: "square.grid.2x2.fill", identifier: "deskGridSidebarDock_Design") {
                jesseCall.end()
                closeBinderContentViewer()
                viewingDesignStudio = true
                closeSidebarFlow()
            }
            dockChip("Resume", system: "person.text.rectangle", identifier: "deskGridSidebarDock_Resume") {
                jesseCall.end()
                closeBinderContentViewer()
                viewingResumeAgent = true
                closeSidebarFlow()
            }
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
        // Rearranged 2026-08-23, explicit ask: "move that archive button
        // next to friends... move the jesse logo on the bottom panel close
        // to the search bar." Two clusters, plain HStack now (Jesse no
        // longer needs independent screen-centering - see jesseDockCenter's
        // own doc comment):
        //   bottom-LEFT  - Friends, Archive, Settings
        //   bottom-RIGHT - Jesse, then the ask-anything field right beside it
        HStack(spacing: 8) {
            binderUtilityIcon("person.2.fill", identifier: "deskGridDock_Friends") {
                jesseCall.end()
                closeBinderContentViewer()
                viewingFriends = true
            }
            binderUtilityIcon("archivebox.fill", identifier: "deskGridDock_Archive") {
                closeBinderContentViewer()
                viewingArchiveBrowser = true
            }
            binderUtilityIcon("gearshape.fill", identifier: "deskGridDock_Settings", action: onOpenManage)
            Spacer(minLength: 0)
            jesseDockCenter
            // "Ask anything" (2026-08-22, explicit ask) - `submitSearch`
            // already does real keyword routing + a full agent takeover
            // for anything longer. Fixed width so it can't stretch across
            // the whole row. Widened 240 -> 420 (2026-08-27, explicit ask:
            // "make the search bar next to Jesse bigger, and that's our
            // ask anything now" - this field IS the primary entry point
            // now that Gurukul retargets here instead of its own screen,
            // so it needs real visual weight, not a token search box.
            searchField(placeholder: "Ask anything…", identifier: "deskGridDashboardSearch", onSubmit: submitSearch)
                .frame(width: 420)
        }
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

    /// Jesse's dock seat, now right beside the "Ask anything" field
    /// (2026-08-23, explicit ask: "move the jesse logo on the bottom panel
    /// close to the search bar" - superseding the same day's earlier
    /// "put Jesse at the center" ask). The raccoon is
    /// `JesseRailView.raccoonImage` - the exact static image the search
    /// field's content-viewer icon and the Jesse rail itself already use,
    /// not a new asset.
    private var jesseDockCenter: some View {
        // 2026-08-23, explicit ask: with Binder/Map/Calendar gone from the
        // dock, Jesse's icon becomes the one "take me back" anchor - the
        // workspace itself already shows current work directly ("you can
        // kind of see it in the cache"), so this returns to that plain
        // landing state instead of opening the chat sheet. Talking to
        // Jesse is being redesigned into its own merged Learn/Practice
        // surface (separate, scoped effort) - this icon is home, not chat,
        // until that lands.
        Button { closeBinderContentViewer() } label: {
            VStack(spacing: 2) {
                JesseRailView.raccoonImage
                    .resizable()
                    .scaledToFit()
                    .frame(height: 32)
                Text("Jesse")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(tileInk)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("deskGridDock_Jesse")
        .accessibilityLabel("Talk to Jesse")
    }

    private var flowsDock: some View {
        HStack(spacing: 8) {
            dockChip("Dashboard", system: "square.grid.2x2.fill", identifier: "deskGridDock_BackToDash") { setRail(.none) }
            // Binder/Calendar/Gmail don't apply inside Flows - they're
            // already on the dashboard's own dock. Just Memo + Transcribe
            // (ambient room recording, not a Jesse call) + the flow search.
            dockChip("Memo", system: "note.text", identifier: "deskGridFlowsMemo") { setRail(.memo) }
            dockChip("Transcribe", system: "waveform", identifier: "deskGridFlowsTranscribe") { setRail(.transcribe) }
            // Resume + Settings here too (2026-08-19, explicit ask: "add the
            // settings and resume to the search bar dock too across the
            // flows") - same chips workDock got, so they're reachable no
            // matter which dock variant is showing. Practice/Resume/Settings
            // order matches workDock's own (2026-08-19, "practice archive
            // design resume settings consistently").
            dockChip("Practice", system: "waveform.and.mic", identifier: "deskGridFlowsPractice") { openSidebarFlow(.englishPractice) }
            dockChip("Resume", system: "person.text.rectangle", identifier: "deskGridFlowsResume") {
                jesseCall.end()
                setRail(.none)
                closeBinderContentViewer()
                viewingResumeAgent = true
            }
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
                // Real bug fix (2026-08-23, live report: "i cant click...
                // ask anything on the bottom right") - the field really is
                // meant to stay disabled with no key connected (Manage is
                // the real destination), but an invisible EmptyView here
                // meant a sighted student saw a search box that silently
                // did nothing, with no way to tell why or what to do about
                // it. A real, tappable prompt over the disabled field
                // instead - same "Manage is the destination" reasoning,
                // now actually visible and actionable.
                Button(action: onOpenManage) {
                    HStack(spacing: 4) {
                        Image(systemName: "key.fill")
                        Text("Connect AI key")
                    }
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(tileInk.opacity(0.7))
                    .padding(.horizontal, 10)
                    .padding(.vertical, 6)
                    .background(Capsule().fill(Color(gridHex: "f3f1ec")))
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridDashboardSearchConnectKey")
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

    /// Blended replacement for the old `showJesseCallSheet` bottom drawer
    /// (2026-08-27, explicit ask: "transcribe opens its own fucking
    /// window... blend it into the page neatly"). Same white-card rail
    /// chrome as `memoRail`, same turns+liveTranscript rendering
    /// `JesseCallSheetView` already proved, just restyled for this light
    /// background instead of that dark one.
    ///
    /// Does NOT auto-start listening on appear (reverted 2026-08-27, same
    /// message: "it's so weird it's just listening to me on random times...
    /// only happens on simulations where there's a necessity... interactive
    /// like you talk, you answer questions" - the mic should turn on
    /// because the student asked it to, never because a panel opened).
    /// Idle state shows a real Start button; only ends the session on an
    /// explicit Stop once started, so navigating away leaves it recording
    /// (the existing `JesseCallPill` already surfaces that state everywhere
    /// else in the app) - that half of the original design still holds,
    /// only the auto-start was wrong.
    private var transcribeRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Transcribe")
                    .font(.system(size: 14, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
                Spacer(minLength: 0)
                if jesseCall.isActive, jesseCall.isAmbient {
                    Button {
                        let ambient = jesseCall.isAmbient
                        let ctx = jesseCall.context
                        let turns = jesseCall.end()
                        onFileTranscript(turns, ctx, ambient)
                    } label: {
                        Text("Stop")
                            .font(.system(size: 11, weight: .heavy, design: .rounded))
                            .foregroundColor(.white)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 5)
                            .background(Capsule().fill(Color(gridHex: "b0473f")))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("deskGridTranscribeStop")
                }
            }
            if jesseCall.isActive, jesseCall.isAmbient {
                ScrollViewReader { proxy in
                    ScrollView(showsIndicators: false) {
                        VStack(alignment: .leading, spacing: 8) {
                            ForEach(jesseCall.currentSessionTurns) { turn in
                                Text(turn.text)
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(gridHex: "3a362c"))
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            if jesseCall.isListening, !jesseCall.liveTranscript.isEmpty {
                                Text(jesseCall.liveTranscript)
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(gridHex: "3a362c").opacity(0.5))
                                    .fixedSize(horizontal: false, vertical: true)
                                    .frame(maxWidth: .infinity, alignment: .leading)
                            }
                            if jesseCall.currentSessionTurns.isEmpty, jesseCall.liveTranscript.isEmpty {
                                Text("Listening\u{2026} start talking and it'll show up here.")
                                    .font(.system(size: 12, weight: .medium, design: .rounded))
                                    .foregroundColor(Color(gridHex: "8a8478"))
                            }
                            Color.clear.frame(height: 1).id("bottom")
                        }
                    }
                    .onChange(of: jesseCall.turns.count) { _, _ in withAnimation { proxy.scrollTo("bottom") } }
                }
            } else {
                Spacer(minLength: 12)
                Button {
                    jesseCall.beginAmbientTranscription(context: "flows")
                } label: {
                    HStack(spacing: 6) {
                        Image(systemName: "mic.fill")
                        Text("Start listening")
                    }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(gridHex: "143a2e"))
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color(gridHex: "c4f547")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridTranscribeStart")
                Text("Records the room until you tap Stop.")
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(gridHex: "8a8478"))
                Spacer(minLength: 12)
            }
        }
        .padding(12)
        .background(
            RoundedRectangle(cornerRadius: 16, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.12), radius: 10, y: 4)
        )
        .accessibilityIdentifier("deskGridTile_Transcribe")
        .accessibilityElement(children: .contain)
    }

    private var flowsRail: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Flows")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(Color(gridHex: "143a2e"))
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
    // Same tall footprint as flowsRail - a scrolling transcript needs the
    // room, not the memoRail's 3-line box.
    static let transcribeRail = CGRect(x: 1231, y: 54, width: 199, height: 566)
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
    /// Landing state: Binder IS the page (2026-08-23, explicit ask:
    /// "superimpose Binder on top of the page we have... I don't want
    /// [Binder in a box that moves around] anymore"). Full board, no
    /// margin - a real step past the 94% pass this replaces, which still
    /// left a visible cream `BlueprintGrid` gutter on every side making
    /// Binder read as a card floating on the page rather than being it.
    static let landingBinder = CGRect(x: 0, y: 0, width: 1440, height: 810)
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
/// Shared real-PCA-bounding-box-to-canvas remap (2026-08-23) - factored
/// out of `KnowledgeGraphCanvas` so `UnifiedKnowledgeFieldCanvas` uses the
/// exact same math instead of a second copy that could silently drift.
/// Node x/y are raw PCA-axis projections (mean-centered, roughly [-3, 3],
/// NOT already normalized to [0,1]) - see `KnowledgeGraphCanvas`'s
/// original 2026-08-18 fix for why this remap exists at all.
fileprivate func graphNormalizedPositions(nodes: [KnowledgeGraphNode], size: CGSize, padding: Double) -> [String: CGPoint] {
    let xs = nodes.compactMap(\.x)
    let ys = nodes.compactMap(\.y)
    let minX = xs.min() ?? 0, maxX = xs.max() ?? 1
    let minY = ys.min() ?? 0, maxY = ys.max() ?? 1
    let spanX = max(maxX - minX, 0.0001)
    let spanY = max(maxY - minY, 0.0001)
    var positions: [String: CGPoint] = [:]
    for node in nodes {
        guard let x = node.x, let y = node.y else { continue }
        let nx = padding + (x - minX) / spanX * (1 - 2 * padding)
        let ny = padding + (y - minY) / spanY * (1 - 2 * padding)
        positions[node.id] = CGPoint(x: nx * size.width, y: ny * size.height)
    }
    return positions
}

private struct KnowledgeGraphCanvas: View {
    let nodes: [KnowledgeGraphNode]
    let edges: [KnowledgeGraphEdge]

    var body: some View {
        Canvas { context, size in
            let positions = graphNormalizedPositions(nodes: nodes, size: size, padding: 0.12)

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
                guard let p = positions[node.id] else { continue }
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

/// The unified Knowledge Map field (2026-08-23, see
/// `binderWorkspaceColumn`'s doc comment + KNOWLEDGE_MAP_MERGE_PLAN.md).
/// Two granularities in one visualization: the real concept graph is a
/// dimmed, diffuse field filling the whole space (same visual language
/// as `KnowledgeGraphCanvas`, just quieter - roughly half the opacity,
/// smaller dots, no per-node label), with recommended books drawn ON TOP
/// as a highlighted overlay - larger, brighter, white-ringed, and
/// labeled, which is what makes them read as "the important dots" against
/// the quiet field behind them rather than a same-size color clash.
/// `bookPositions` is precomputed by the caller (`ambientGardenPosition`
/// + the repulsion nudge, which needs the concept positions this struct
/// also draws from) so this stays a pure rendering struct like
/// `KnowledgeGraphCanvas`, not one that reaches back into the parent
/// view's own methods.
private struct UnifiedKnowledgeFieldCanvas: View {
    let nodes: [KnowledgeGraphNode]
    let edges: [KnowledgeGraphEdge]
    let books: [AssembledBookSummary]
    let bookPositions: [String: CGPoint]
    let ink: Color
    let onOpenBook: (AssembledBookSummary) -> Void

    private let recommendColor = Color(gridHex: "d9a441")

    var body: some View {
        GeometryReader { geo in
            let conceptPositions = graphNormalizedPositions(nodes: nodes, size: geo.size, padding: 0.1)

            ZStack {
                // Layer 1: dimmed diffuse concept field - the "spread out"
                // texture. allowsHitTesting(false) so taps fall through to
                // the background preview button underneath this whole view.
                Canvas { context, size in
                    for edge in edges {
                        guard let from = conceptPositions[edge.from], let to = conceptPositions[edge.to] else { continue }
                        var path = Path()
                        path.move(to: from)
                        path.addLine(to: to)
                        context.stroke(
                            path,
                            with: .color(Color(gridHex: "5b3e8f").opacity(0.1 + edge.weight * 0.22)),
                            lineWidth: 1 + edge.weight * 1.5
                        )
                    }
                    // Real fix (2026-08-23, live report: "the map is not
                    // diffusing across the screen"): the field WAS being
                    // drawn correctly, spread across the whole column via
                    // the same real bounding-box remap KnowledgeGraphCanvas
                    // uses - it just wasn't VISIBLE. "Dimmed" (the plan's
                    // own word) got compounded with the canvas being much
                    // bigger than the old 200pt preview: same 42 dots,
                    // 3-4x the area, AND roughly half the opacity/size on
                    // top of that reads as "basically empty," not "spread
                    // out." Spreading a fixed dot count across more area
                    // already IS what makes a field read as diffuse -
                    // shrinking the dots on top of that was the actual
                    // bug. Sized back up close to KnowledgeGraphCanvas's
                    // own original numbers; the book overlay stays
                    // visually dominant purely through being 2-3x bigger
                    // + labeled + white-ringed, not through suppressing
                    // this layer into near-invisibility.
                    for node in nodes {
                        guard let p = conceptPositions[node.id] else { continue }
                        let dotColor = conceptStatusColor(node.status)
                        let engagement = min(1, Double(node.eventCount ?? 0) / 10)
                        let r: CGFloat = 4 + CGFloat(engagement) * 4.5
                        let glowRadius = r * 2.2
                        context.fill(
                            Path(ellipseIn: CGRect(x: p.x - glowRadius, y: p.y - glowRadius, width: glowRadius * 2, height: glowRadius * 2)),
                            with: .radialGradient(
                                Gradient(colors: [dotColor.opacity(0.3), dotColor.opacity(0)]),
                                center: p, startRadius: 0, endRadius: glowRadius
                            )
                        )
                        context.fill(Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)), with: .color(dotColor.opacity(0.8)))
                        context.stroke(
                            Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                            with: .color(.white.opacity(0.5)), lineWidth: 0.75
                        )
                    }
                }
                .allowsHitTesting(false)

                // Layer 2: book glow - the highlighted overlay, same
                // drawing `topicTileGrid` used to do on its own separate
                // canvas, now layered directly over the concept field.
                Canvas { context, size in
                    for book in books {
                        guard let p = bookPositions[book.subjectId] else { continue }
                        let progress = min(1, Double(book.coveredConcepts) / Double(max(book.totalConcepts, 1)))
                        let r: CGFloat = 11 + CGFloat(progress) * 14
                        let glow = r * 2.8
                        context.fill(
                            Path(ellipseIn: CGRect(x: p.x - glow, y: p.y - glow, width: glow * 2, height: glow * 2)),
                            with: .radialGradient(
                                Gradient(colors: [recommendColor.opacity(0.3 + progress * 0.3), recommendColor.opacity(0)]),
                                center: p, startRadius: 0, endRadius: glow
                            )
                        )
                        context.fill(
                            Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                            with: .color(recommendColor.opacity(0.6 + progress * 0.4))
                        )
                        context.stroke(
                            Path(ellipseIn: CGRect(x: p.x - r, y: p.y - r, width: r * 2, height: r * 2)),
                            with: .color(.white.opacity(0.6)), lineWidth: 1
                        )
                    }
                }
                .allowsHitTesting(false)

                // Layer 3: real tap targets, identical action/identifiers
                // to the old topicTileGrid.
                ForEach(books) { book in
                    if let p = bookPositions[book.subjectId] {
                        Button {
                            onOpenBook(book)
                        } label: {
                            VStack(spacing: 4) {
                                Color.clear.frame(width: 52, height: 52)
                                Text(book.title)
                                    .font(.system(size: 11, weight: .bold, design: .rounded))
                                    .foregroundColor(ink.opacity(0.85))
                                    .lineLimit(1)
                                    .frame(width: 110)
                            }
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .position(p)
                        .accessibilityIdentifier("deskGridTopicTile_\(book.subjectId)")
                    }
                }
            }
        }
    }

    private func conceptStatusColor(_ status: String?) -> Color {
        switch status {
        case "mastered": return Color(gridHex: "3fae5a")
        case "in_progress": return Color(gridHex: "d9a441")
        case "struggling": return Color(gridHex: "c1121f")
        default: return Color(gridHex: "b7aed6")
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

/// Full-screen player for one sim opened from the Work dashboard's Archive
/// "Simulations" tab — same chrome/disclosure convention as
/// `GeneratedSimView`/`MicroSimView`. "Use in class" files the sim's whole
/// book into the Binder via `onFileChapterBook` (Binder has no
/// standalone-simulation item today, only a book pointer — see
/// `ArchiveSimsLoader`'s doc comment).
private struct ArchiveChapterSimView: View {
    let sim: ArchiveSimEntry
    var onUseInClass: () -> Void
    var onClose: () -> Void
    @State private var addedToBinder = false
    /// Un-bundled Dan's-archive sims arrive with `simHtml == nil` plus a
    /// `microSimId` - content is fetched per-sim on open (4,013 sims'
    /// worth is far too much to prefetch into the grid), assembled
    /// server-side by /api/microsims into the same self-contained html
    /// shape every other source already renders.
    @State private var remoteHTML: String?
    @State private var remoteFailed = false

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(sim.section.simTitle ?? sim.section.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                    Text(sim.bookTitle)
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
                // "Use in class" files the sim's WHOLE book into the Binder
                // - only chapter-book sims HAVE a book to file, so the
                // button would be a broken promise on the other two stores.
                if sim.source == .chapterBook {
                    Button(addedToBinder ? "Added to Binder" : "Use in class") {
                        onUseInClass()
                        addedToBinder = true
                    }
                    .disabled(addedToBinder)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .accessibilityIdentifier("deskGridArchiveSimUseInClass")
                }
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskGridArchiveSimClose")
            }
            .padding(14)
            if let html = sim.section.simHtml ?? remoteHTML {
                InlineSimWebView(html: html)
            } else if let microSimId = sim.microSimId, !remoteFailed {
                ProgressView("Fetching from Dan's archive\u{2026}")
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .task {
                        if let html = await MicroSimCatalogClient.fetchHTML(id: microSimId) {
                            remoteHTML = html
                        } else {
                            remoteFailed = true
                        }
                    }
            } else {
                Text("This simulation isn't available right now.")
                    .foregroundColor(.secondary)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .background(Color.white)
    }
}
