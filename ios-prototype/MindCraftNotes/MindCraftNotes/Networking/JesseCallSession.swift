import Foundation
import Speech
import AVFoundation
import Combine

/// One turn of a Jesse call - who said it, when, and the text. The real
/// record a session summary is built from, and eventually what the central
/// agent reads back for continuity across calls.
struct JesseCallTurn: Identifiable, Codable, Equatable {
    let id: String
    let speaker: String // "student" | "jesse"
    let text: String
    let at: Date
}

/// Result of the Work Dashboard's "I want to learn X" flow (2026-08-18) -
/// either real, bundled archive material or an honestly-labeled generated
/// outline, never blurred together. `DeskGridDashboardView` reads this to
/// route content into Binder/Homework Help/Moodle; the table of contents
/// itself shows up in Intel's own transcript, spoken by Jesse, rather than
/// needing a second display surface squeezed into an already-compact box.
/// One real citation for the Study Session's Sources tab (2026-08-19,
/// Assignment L) - a book/page/URL from a real `ArchiveRagClient.Hit`,
/// never invented. A plain `[(String, String, String)]` tuple array can't
/// satisfy `WorkDashboardLesson: Equatable` (tuples aren't nominal types,
/// so they don't conform to `Equatable` even though `==` works on them
/// directly) - a real struct sidesteps that.
struct LessonCitation: Equatable, Identifiable {
    let bookTitle: String
    let pageTitle: String
    let url: String
    var id: String { url }
}

/// Real generation stats for a chapter book, only ever populated for a
/// freshly-run `/generate-book` job — see `openedChapterBookGenerationInfo`.
struct ChapterBookGenerationInfo: Equatable {
    let costUsd: Double?
    let elapsedSeconds: Double
}

struct WorkDashboardLesson: Equatable {
    enum Source: Equatable {
        case archive(bookTitle: String)
        case generated
    }
    let topic: String
    let source: Source
    let chapters: [String]
    /// Same index as `chapters` - one real paragraph per chapter for the
    /// Study Session's own per-tab content (2026-08-19). Empty for the
    /// archive-matched paths (`BookGraphLoader`/`ArchiveRagClient` only
    /// ever return chapter TITLES, not body text) - `WorkDashboardLesson`
    /// itself doesn't fake one; `chapterBody(at:)` below falls back to
    /// `definition` the same way `LessonOutline.chapterBody(at:)` does.
    let chapterBodies: [String]
    let definition: String
    let question: String?
    /// Real, matched interactive MicroSims (`MicroSimLoader.matching`) -
    /// not fabricated placeholders. Empty for any topic outside the
    /// bundled Calculus set today.
    let microsims: [MicroSimRecord]
    /// Real archive citations when `source` is `.archive` - empty for
    /// `.generated` (the Sources tab shows "AI-generated, no source" in
    /// that case instead of inventing attribution).
    let citations: [LessonCitation]

    func chapterBody(at index: Int) -> String {
        if chapterBodies.indices.contains(index), !chapterBodies[index].isEmpty { return chapterBodies[index] }
        return definition
    }
}

/// State machine for one live gated-generation request
/// (LIVE_GATED_GENERATION_TEST_SPEC.md) - exactly two real outcomes plus
/// the two infrastructure states, matching `GeneratedSimVerdict`. `topic`
/// on every case is the ORIGINAL topic the student asked for (never the
/// retry angle), so `StudySessionView` can match state to the lesson it
/// belongs to and ignore stale state from a previously-viewed lesson.
enum LiveSimState: Equatable {
    /// `attemptTopic` differs from `topic` only during the one automatic
    /// adjacent-angle retry (see `requestLiveGatedSim`).
    case running(topic: String, attemptTopic: String?)
    case verified(GeneratedSimResult, topic: String, cached: Bool)
    /// The NORMAL case at the pipeline's real measured yield (1/10-6/10
    /// depending on domain), not an error state. `alsoTried` names the
    /// adjacent angle if the automatic retry also came back empty.
    case noGoodResult(topic: String, reason: String?, alsoTried: String?)
    case rateLimited(topic: String, reason: String?)
    case unavailable(topic: String, note: String?)
}

/// Real chapter-level progress of one background `/generate-book` run -
/// published by `JesseCallSession.generationProgress` so the Gurukul orb
/// (and any other surface) can show a live build state instead of blocking
/// the conversation behind a spinner for minutes. `topic` is what the
/// student asked for, so stale progress from an abandoned request can be
/// told apart from the current one.
struct BookGenerationProgress: Equatable {
    let topic: String
    var chaptersReady: Int
    var totalChapters: Int
}

/// What the student said they want out of a lesson, parsed (lightweight
/// keyword scan, same style as `mentionsDriveImport`) from their answer to
/// the clarifying question - the Gurukul redesign's "ask 1-2 real
/// questions (what kind of content, what level) BEFORE generating" flow.
/// Every field is optional signal, not a gate: an answer that matches
/// nothing still proceeds with defaults, same permissiveness the old
/// "materials or go ahead?" exchange already had.
struct LearnPreferences: Equatable {
    var wantsSims = false
    var wantsReading = false
    /// "Talk me through it" - delivery is SPOKEN and the line deliberately
    /// stays open afterward (hanging up mid-walkthrough would defeat the
    /// point); sims/reading deliveries hang up once the content is shown.
    var wantsVocal = false
    /// "beginner" / "intro" vs "advanced" / "deep" - carried into the
    /// delivery ack today (generation's own API takes topic+grade only).
    var levelNote: String?

    static func parse(_ text: String) -> LearnPreferences {
        let lowered = text.lowercased()
        var prefs = LearnPreferences()
        if ["sim", "simulation", "interactive", "play with", "hands-on", "hands on"].contains(where: lowered.contains) { prefs.wantsSims = true }
        if ["read", "reading", "book", "text", "chapters", "written"].contains(where: lowered.contains) { prefs.wantsReading = true }
        if ["talk", "voice", "vocal", "walk me through", "speak", "out loud", "explain it to me"].contains(where: lowered.contains) { prefs.wantsVocal = true }
        if ["beginner", "intro", "basics", "new to", "first time", "simple"].contains(where: lowered.contains) { prefs.levelNote = "intro" }
        else if ["advanced", "deep", "detail", "past the basics", "already know"].contains(where: lowered.contains) { prefs.levelNote = "deep" }
        return prefs
    }
}

/// App-lifetime voice session for Jesse (native `SFSpeechRecognizer` +
/// `AVSpeechSynthesizer`, not the old WKWebView JS Web Speech API calls,
/// which died with the WKWebView the moment its screen closed). Owned once
/// at `DeskShellView`'s root and handed down via `.environmentObject`, NOT
/// created inside whichever screen opens a call - that's the whole point:
/// closing the Archive workflow and switching to another Field Desk tab
/// does not end an in-progress conversation, because this object was never
/// scoped to that screen in the first place.
///
/// This is the **one central Jesse**. Dashboard boxes (Intel / Moodle /
/// Binder / Gmail / Gcal) are scoped connectors and stores — they do not
/// talk. See `JESSE_CENTRAL_AI_PLAN.md` Level 2.
///
/// Two entry points:
/// - `begin(context:)` — listen-respond-speak call (Archive, Resume, Hub,
///   Presentation).
/// - `beginAmbientTranscription(context:)` — record the room and append
///   turns, no `askJesse()` / `speak()`. Flows dock "Transcribe" uses this.
///
/// Stage 1+2 of the "fluid, persists-across-tabs Jesse call" build: real
/// native audio I/O, real transcript, real pause, calling `archive-rag`
/// directly (`ArchiveRagClient`) instead of routing through the web JS, and
/// real Kokoro-generated speech (`KokoroTTSClient`, see its own doc comment
/// for the voice comparison and why Kokoro) in place of the default iOS
/// system voice - `AVSpeechSynthesizer` stays wired as a fallback for when
/// the network call fails (offline, cold-start timeout), so the call is
/// never silent, just briefly less natural.
/// NOT yet built (deliberately out of scope for this pass): nav-intent
/// routing during a live call itself (the Ask The Desk text field already
/// has this - see FieldDeskView's `study_concept` action - wiring it into
/// THIS call specifically is a separate stage), and live knowledge-graph
/// updates while a call is in progress.
@MainActor
final class JesseCallSession: NSObject, ObservableObject {
    @Published private(set) var isActive = false
    /// True while Flows "Transcribe" (or any ambient capture) is running.
    /// `isActive` is still true so the pill and turn persistence keep
    /// working; this flag only suppresses the reply loop.
    @Published private(set) var isAmbient = false
    @Published private(set) var isListening = false
    @Published private(set) var isSpeaking = false
    @Published private(set) var isPaused = false
    @Published private(set) var isThinking = false
    // Persists across calls (not reset in begin()) and across relaunches -
    // "so you can refer to things you've said" - capped so it can't grow
    // unbounded, same shape as FieldDeskStore's intelLines cap.
    @Published private(set) var turns: [JesseCallTurn] = JesseCallSession.loadTurns() {
        didSet { JesseCallSession.saveTurns(turns) }
    }
    @Published private(set) var liveTranscript = ""
    @Published var status: String?
    /// Which surface most recently opened this call ("archive" today) -
    /// purely descriptive, so a persistent pill elsewhere in the chrome can
    /// say "Jesse - still on the line" without caring about the call's
    /// internal state machine.
    @Published private(set) var context: String?
    /// Real, bounded Socratic back-and-forth (2026-08-22, explicit ask:
    /// "only have the agent talk to the student when there are simulations
    /// or microsims where you have to have a back-and-forth... like a
    /// discussion... 'what's your summary of all this' then 'why do you
    /// think' until they polish it"). Set only while `context ==
    /// "discussion"` (`beginDiscussion`) - prepended to the student's
    /// message in `askJesse`'s shared archive-chat fallback instead of the
    /// normal `bus.briefing()`, since this needs the section's own
    /// content/instructions, not the Work dashboard's box briefing.
    private var discussionSeed: String?
    /// Book's live draft (Assignment F, 2026-08-18) - set only while
    /// `context == "book"`, updated from the real `/api/book-agent` round
    /// trip on every turn (see `askJesseBook`) so `BookWorkflowView` can
    /// render chapters live as the student talks instead of the old
    /// WKWebView-only draft. Reset in `begin()` so a fresh call never shows
    /// a previous book's chapters before the first reply.
    @Published private(set) var bookDraft: BookAgentDraft?
    /// Learn Studio's live study plan (Assignment G, 2026-08-18) - set only
    /// while `context == "learnStudio"`, regenerated fresh from the running
    /// conversation on every turn (see `askJesseLearnStudio`) so
    /// `LearnStudioView`'s cards update as the student talks instead of
    /// coming from one static form submit. Reset in `begin()` so a fresh
    /// call never shows a previous session's cards before the first reply.
    @Published private(set) var studyPlan: StudyPlan?
    /// Honest failure surface for a live Learn Studio turn that didn't
    /// produce a usable plan (model failure, thin topic) - `LearnStudioView`
    /// surfaces this instead of silently leaving stale cards on screen with
    /// no indication anything went wrong, same honesty rule the original
    /// form path already followed.
    @Published private(set) var studyPlanError: String?
    /// Resume's live draft (Assignment H, 2026-08-18) - same shape as
    /// `bookDraft`: set only while `context == "resume"`, updated from the
    /// real `/api/resume-agent` round trip on every turn (see
    /// `askJesseResume`) so `ResumeAgentView` can render the profile live as
    /// the student talks.
    ///
    /// Real fix, 2026-08-25 (explicit ask: "automatically create a
    /// profile... blended into the dash") - this used to be a plain
    /// in-memory `@Published` var, reset to nil on every fresh `begin()`
    /// of "resume" context (see that branch's own history: `jobOS` context
    /// already carved out an exception - "a student who already built one
    /// via the Resume rail should arrive with it intact, not blanked" -
    /// but "resume" context itself still wiped it every time). A
    /// dashboard-surfaced profile that vanishes both on relaunch AND on
    /// simply reopening the Resume screen isn't a profile. Now persists
    /// the same `didSet`-triggers-save shape `workDashboardLesson` already
    /// uses, and `begin()`'s "resume" branch no longer resets it - see
    /// `loadPersistedResumeDraft`/`savePersistedResumeDraft`.
    @Published private(set) var resumeDraft: ResumeAgentDraft? = JesseCallSession.loadPersistedResumeDraft() {
        didSet { Self.savePersistedResumeDraft(resumeDraft) }
    }
    /// English-practice conversation state (2026-08-19) - same lightweight
    /// shape idea as `resumeDraft`/`bookDraft` but far smaller: just what
    /// goal/deadline the student stated, so the webhook's system prompt can
    /// shape register/vocabulary once known instead of asking every turn.
    /// Set only while `context == "englishPractice"`, updated from the real
    /// `/api/english-practice` round trip (see `askJesseEnglishPractice`).
    /// Reset in `begin()`.
    @Published private(set) var englishPracticeState: EnglishPracticeGoal?
    /// Work Dashboard's "I want to learn X" flow (2026-08-18) - set only
    /// while `context == "workDashboard"`, after a real archive check
    /// (`BookGraphLoader`) or generation call (see
    /// `askJesseWorkDashboard`).
    ///
    /// Real fix, 2026-08-21, direct live feedback: this used to be wiped
    /// to nil unconditionally every time `begin(context: "workDashboard")`
    /// ran (a plain in-memory `@Published` var, no persistence at all) -
    /// "when I told it to open the lesson it built, it said it couldn't
    /// do it." There was nothing left TO open the moment the student
    /// navigated away and came back - not a bug in recognizing the
    /// request, a bug in there being no lesson left to find. Now persists
    /// the same `didSet`-triggers-save shape `turns` already uses just
    /// below, restored on `begin()` instead of discarded - see
    /// `loadPersistedLesson`/`savePersistedLesson`.
    @Published private(set) var workDashboardLesson: WorkDashboardLesson? = JesseCallSession.loadPersistedLesson() {
        didSet { Self.savePersistedLesson(workDashboardLesson) }
    }
    /// A real, gated, topologically-ordered Chapter Library book Jesse
    /// found for the student's spoken topic (2026-08-21) - checked FIRST
    /// in `askJesseWorkDashboard`, ahead of the older bundled-books/
    /// archive-RAG/raw-generation chain. Direct live feedback drove this:
    /// asking Jesse by voice never touched the new gated pipeline at all
    /// before this, so a subject that genuinely had real content (Circuits)
    /// was invisible to voice, and the only way to reach it was a separate
    /// Library page the same feedback also said shouldn't exist as its own
    /// destination. FieldDeskView observes this and presents
    /// BookReaderView; set to nil to dismiss, same shape as
    /// `workDashboardLesson`/`pendingLearnTopic` above.
    @Published private(set) var openedChapterBook: AssembledBook?
    /// Real cost/time for a FRESH `/generate-book` run, nil for a Tier-0
    /// Chapter Library hit or an `on_demand` cache hit — showing "generated
    /// in 3m42s, $3.60" on a book that was actually served instantly from
    /// Firestore would be a real lie to the student, not a rounding error.
    /// 2026-08-21: "show the time required to generate it and then the
    /// credits required to generate it... after the chapter was generated."
    @Published private(set) var openedChapterBookGenerationInfo: ChapterBookGenerationInfo?
    /// Which section(s) of `openedChapterBook` the student's actual spoken
    /// topic matched, nil when the whole book is relevant. Real gap
    /// (2026-08-23, direct ask: "we dont show all pages... we show what
    /// pages are relevant to that learning session"): before this, asking
    /// about one specific sub-topic ("the chain rule") inside a large
    /// archive book (Calculus, 23 chapters) opened the ENTIRE book at page
    /// 1 - correct content, wrong scope, forcing the student through every
    /// tab to find the one they asked about. nil for a whole-title match
    /// (the student asked about the SUBJECT, not a sub-topic - showing
    /// everything is correct) and for a freshly generated book (Tier 3 -
    /// `BookGenerationClient.generate(topic:)` already scopes its output
    /// to just the requested topic, so every section it returns is already
    /// relevant). BookReaderView reads this to open pre-filtered to the
    /// matched section(s), with its own affordance to see the rest.
    @Published private(set) var openedChapterBookFocusConceptIds: Set<String>?
    /// Set the moment a topic is first recognized, cleared once the
    /// student answers - the real gap behind a live bug report
    /// (2026-08-18: "I said 'learn California bar'... the next thing
    /// would have been: should Jesse ask if you have materials to
    /// upload, or should I go ahead"). Before this, `askJesseWorkDashboard`
    /// ran straight from topic -> archive check -> generation on the
    /// very first utterance, with no chance for the student to attach an
    /// upload first. Reset in `begin()`.
    @Published private(set) var pendingLearnTopic: String?
    /// The grade `extractGrade` found in the SAME utterance as
    /// `pendingLearnTopic`, if any - carried alongside it through the
    /// "materials or go ahead?" exchange so a grade the student states
    /// in-the-moment ("I'm in grade 8") survives to the actual generation
    /// call instead of being discarded once the topic is parked.
    private var pendingLearnGrade: Int?
    /// One-shot navigation signal (2026-08-19, explicit ask: "if i say i
    /// want to practice... take me to the practice screen") - set true when
    /// the student's workDashboard utterance matches a practice-intent
    /// phrase (see `isPracticeRequest`), read and reset by
    /// `DeskGridDashboardView`'s own `.onChange`, same "JesseCallSession
    /// signals, the view navigates" shape `pendingLearnTopic`/
    /// `workDashboardLesson` already use - this class owns no navigation
    /// state itself.
    @Published var practiceRequested = false
    /// True while `StudyCompanionView` (the merged Learn+Practice surface,
    /// 2026-08-23) is on screen. Set/cleared by that view itself.
    ///
    /// Why this exists: `practiceRequested` is a fire-and-forget signal -
    /// once set true, EVERY observer sees the same transition (SwiftUI has
    /// no single-consumer model), so `DeskGridDashboardView`'s own
    /// `.onChange(of: practiceRequested)` fires even while it's mounted
    /// underneath Study Companion, teleporting the hidden dashboard's rail
    /// to `.englishPractice` behind the student's back - invisible until
    /// they close Study Companion and land somewhere they never asked for.
    /// Gating `isPracticeRequest`'s branch on this flag (see `askJesse`)
    /// stops that signal from ever firing while this surface owns the
    /// conversation, instead of trying to race/undo it after the fact.
    @Published var studyCompanionPresented = false
    /// Live gated-generation request state (LIVE_GATED_GENERATION_TEST_SPEC.md,
    /// closed-test only - see `LiveGatedGeneration.isEnabled`'s doc comment
    /// for the gate). Owned here rather than in a view because the request
    /// outlives any one screen (60-180s) the same way a call does, and
    /// because the loading state deliberately IS `isThinking` - the same,
    /// already-validated mechanism every Jesse generation round trip uses
    /// (call pill, JesseRailView status, the Homework Help tile indicator
    /// from commit 7b537beb all read it) - not a second parallel one.
    @Published private(set) var liveSimState: LiveSimState?
    /// Same staleness guard shape as `speakGeneration`: bumped by
    /// `clearLiveSimState`, checked before every state write so a request
    /// finishing after its Study Session closed can't resurrect UI state
    /// for a lesson nobody is looking at anymore.
    private var liveSimGeneration = 0
    /// Live progress of a BACKGROUND book generation (2026-08-25, the
    /// Gurukul redesign's "use the conversation as the generation window"):
    /// Tier-3 generation no longer blocks the whole conversation behind
    /// `isThinking` for its multi-minute run - it runs in a detached Task,
    /// publishes real chapter counts here for the UI (the Jesse orb's
    /// build state), and the student keeps talking meanwhile. nil when
    /// nothing is generating.
    @Published private(set) var generationProgress: BookGenerationProgress?
    /// Staleness guard for background lesson delivery, same shape as
    /// `liveSimGeneration`: bumped whenever a NEW learn request kicks off
    /// (and on `begin()`/`closeLessonSession()`), checked before a
    /// finishing background generation writes any state - so a student who
    /// switched topics mid-build never has the abandoned topic's book stomp
    /// the one they actually asked for.
    private var learnDeliveryGeneration = 0
    /// Tier-0 Chapter Library probe fired the moment a topic is recognized
    /// (during the clarifying question), so the answer usually arrives
    /// before the student finishes replying - the library check costs one
    /// network list + match, and running it during the natural
    /// back-and-forth means a library hit feels instant at delivery time.
    private var libraryProbeTask: Task<(book: AssembledBook, focusConceptIds: Set<String>?)?, Never>?
    private var libraryProbeTopic: String?
    /// Rotates the clarifying-question phrasing so it isn't "the same set
    /// of questions every time" (direct 2026-08-25 feedback).
    private var clarifyPhrasingIndex = 0
    /// Dedupe for the spoken "Still building - X of Y" pacing lines on the
    /// non-Gurukul surfaces (the orb replaces them on Gurukul itself).
    private var lastSpokenGenerationReady = 0
    /// Real bug fix (2026-08-25, direct live repro: asked to learn
    /// photosynthesis, Jesse's clarifying question never got heard - "it
    /// just keeps listening... not talking back... it should be doing
    /// that instead of just showing the text"). `context == "workDashboard"`
    /// is shared by TWO surfaces: Gurukul's redesigned voice-first orb
    /// (`StudyCompanionView`) AND `DeskGridDashboardView`'s small
    /// `JesseRailView` sidebar box, which never asked for spoken replies
    /// and still wants the original 2026-08-22 silent-text convention
    /// ("no conversations please, it delays learning"). Set true only by
    /// Gurukul's own `begin(voiceFirst: true)` call sites, so the rail box
    /// is untouched. See `reply(_:)` below for where this is read.
    private var voiceFirstReplies = false

    /// Homework Help's own uploads live in `DeskGridDashboardView`'s
    /// local `@State`, not in any shared store - this is the one bridge
    /// DeskGridDashboardView pushes into whenever a real upload finishes
    /// (`.onChange(of: homeworkUploads)`, same pattern already used for
    /// `intelLines`/`binderTitles`), so a call that's mid-"do you have
    /// materials" can actually see what the student just uploaded instead
    /// of a second, parallel upload path.
    @Published var latestHomeworkUpload: (fileName: String, cardSummaries: [String])?

    /// Locale-aware (2026-08-19, explicit ask: accommodate Spanish, chosen
    /// once after login - see StudentLanguagePreference). A computed
    /// property, not a cached `let`, since the student's language choice
    /// can change between calls (Settings can update it) and
    /// SFSpeechRecognizer's locale is fixed at init - a fresh instance per
    /// access is the only way to honor a change without restarting the app.
    private var recognizer: SFSpeechRecognizer? {
        SFSpeechRecognizer(locale: Locale(identifier: StudentLanguagePreference.current.recognizerLocaleIdentifier))
    }
    private let audioEngine = AVAudioEngine()
    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
    /// Apple's on-device recognizer's own `result.isFinal` does not reliably
    /// fire after a pause on a live `SFSpeechAudioBufferRecognitionRequest`
    /// (that's built for a real end-of-utterance signal that mostly never
    /// comes on a streaming mic input) - the ONLY way a turn used to submit
    /// was the explicit mic-toggle button. Real conversational turn-taking
    /// needs pause detection instead: reset this timer on every new partial
    /// result, and treat 4 uninterrupted seconds of silence as "the
    /// instruction is done" the same way `isFinal` already does.
    private var silenceTimer: Timer?
    private static let silenceTimeout: TimeInterval = 4.0
    private var studentWeakness: (conceptId: String, label: String)?
    private var speakGeneration = 0
    /// Index into `turns` at the start of this session so `end()` can
    /// hand back only what was said *this* capture, not the 60-turn cache.
    private var sessionTurnOrigin = 0

    /// Whether the STUDENT has said anything in the CURRENT session
    /// (since the last `begin()`), not ever, in the whole persisted
    /// `turns` history. Real bug fix (2026-08-25, found live-testing
    /// Gurukul's redesigned idle form): a plain `turns.contains { student
    /// }` check meant a single stray student turn from an unrelated test
    /// session weeks/hours earlier permanently hid the idle form on
    /// every future launch, since `turns` persists across relaunches and
    /// never gets cleared just by opening the app fresh.
    var hasStudentSpokenThisSession: Bool {
        turns.suffix(max(0, turns.count - sessionTurnOrigin)).contains { $0.speaker == "student" }
    }

    override init() {
        super.init()
        synthesizer.delegate = self
        // Test-only seam: real STT/TTS needs actual audio hardware no CI
        // simulator has, so an automated test can't drive a real call - but
        // the entire point of this object (surviving navigation away from
        // whatever screen started the call) is a real, testable claim about
        // state persistence, independent of the audio layer. Seeds an
        // already-active call with a fixed transcript.
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-jesse-call") {
            isActive = true
            isAmbient = false
            context = "archive"
            turns = [
                JesseCallTurn(id: "t1", speaker: "student", text: "Can you help me with quadratic equations?", at: Date()),
                JesseCallTurn(id: "t2", speaker: "jesse", text: "I opened Algebra I at Method 3: Solving by Elimination.", at: Date()),
            ]
        } else if ProcessInfo.processInfo.arguments.contains("--ui-testing-jesse-ambient") {
            isActive = true
            isAmbient = true
            context = "flows"
            turns = [
                JesseCallTurn(id: "a1", speaker: "student", text: "We should review the lab write-up before Friday.", at: Date()),
            ]
        }
    }

    // MARK: - Lifecycle

    /// `quiet: true` rejoins an existing conversation without ceremony -
    /// no greeting, no per-context state reset. Exists for the hang-up
    /// flow (2026-08-25, direct ask: "Jesse should stop being on the line
    /// after showing me the text it wants me to see"): once a delivery
    /// auto-ends the line, the student's next tap/typed message re-opens
    /// it - and that re-open must not replay "Heyy!" into the transcript
    /// or wipe the just-delivered `openedChapterBook` the way a fresh
    /// `begin()` deliberately does.
    func begin(context: String, studentWeakness: (conceptId: String, label: String)? = nil, studentName: String = "there", quiet: Bool = false, voiceFirst: Bool = false) {
        guard !isActive else { return }
        voiceFirstReplies = voiceFirst
        if quiet {
            self.context = context
            self.studentWeakness = studentWeakness
            isAmbient = false
            isActive = true
            sessionTurnOrigin = turns.count
            status = nil
            return
        }
        self.context = context
        self.studentWeakness = studentWeakness
        isAmbient = false
        isActive = true
        sessionTurnOrigin = turns.count
        // turns is NOT reset here - the conversation carries across calls
        // (and relaunches, via loadTurns()/saveTurns()) so past turns stay
        // visible instead of vanishing every time a new call starts.
        if context == "learnStudio" {
            studyPlan = nil
            studyPlanError = nil
        }
        if context == "book" {
            bookDraft = nil
        }
        // "resume" no longer resets resumeDraft here (2026-08-25) - see
        // that property's own doc comment. A returning student arrives
        // with their real profile intact, same as "jobOS" already did.
        if context == "englishPractice" {
            englishPracticeState = nil
            Task { await speak("Hi, I'm Jesse. Let's practice your English together - what are you hoping to get better at, and is there a deadline you're working toward?") }
        }
        if context == "workDashboard" {
            // `workDashboardLesson` is deliberately NOT reset here anymore
            // (2026-08-21, direct live feedback: "when I told it to open
            // the lesson it built, it said it couldn't do it" - there was
            // nothing left to open because this line wiped it every single
            // time the student came back). It now persists across
            // sessions (see the property's own doc comment + `didSet`) and
            // survives re-entry on purpose, same "don't blank real
            // progress" reasoning `jobOS` right below already uses for
            // `resumeDraft`.
            pendingLearnTopic = nil
            pendingLearnGrade = nil
            openedChapterBook = nil
            openedChapterBookGenerationInfo = nil
            openedChapterBookFocusConceptIds = nil
            // Short spoken greeting only, then text (2026-08-22, explicit
            // ask: "Jesse says Heyy! and then everything else is just
            // writing. no conversations please, it delays learning - just
            // show the texts and then listen to what they have to say").
            // Replaces the old long spoken open question (2026-08-18's
            // "say hi Akshat what can I help you study today" ask) - that
            // greeting was real and worth keeping SOMETHING spoken for,
            // but forcing an immediate spoken reply to an open question is
            // exactly the "conversation that delays learning" being asked
            // to remove here. The context (welcome-back vs. fresh) still
            // gets said - as text, not a question, via `postText`.
            print("[JesseDebug] begin() GREETING branch: workDashboardLesson=\(workDashboardLesson?.topic ?? "nil")")
            let followup: String
            if let progress = generationProgress {
                // A build kicked off before they left is still running -
                // that's the most relevant thing to say, not last week's
                // lesson.
                followup = "Still building \(progress.topic). It'll drop in here the moment it's ready. What else can I do meanwhile?"
            } else if let lesson = workDashboardLesson {
                followup = "Pick up where you left off with \(lesson.topic), or start something new?"
            } else {
                followup = "What would you like to learn today, \(studentName)?"
            }
            if voiceFirstReplies {
                // One utterance, not two speak() calls back to back - Kokoro
                // playback doesn't auto-queue like AVSpeechSynthesizer does,
                // so a second speak() fired right after "Heyy!" would cut it
                // off or overlap instead of following it.
                Task { await speak("Heyy! \(followup)") }
            } else {
                Task { await speak("Heyy!") }
                postText(followup)
            }
        }
        if context == "jobOS" {
            // resumeDraft is NOT reset here, unlike "resume" above - Job
            // OS reads/writes the exact same draft (2026-08-18 ask: "don't
            // fork the schema a third time"), so a student who already
            // built one via the Resume rail should arrive with it intact,
            // not blanked. Blank-slate intake for a genuinely new student
            // is just `resumeDraft` already being nil/.empty, not a reset
            // here wiping real progress for a returning one.
            let opening = (resumeDraft?.name.isEmpty ?? true)
                ? "Hi, I'm Jesse. Let's build your Job OS profile - what's your name, and what kind of roles are you targeting?"
                : "Welcome back, let's keep building your Job OS profile. What would you like to add?"
            Task { await speak(opening) }
        }
        status = nil
    }

    /// Real, bounded Socratic discussion (2026-08-22) - opened from a
    /// specific book section's "Talk it through with Jesse" prompt
    /// (`BookReaderView`), not the generic `begin()` above: the opening
    /// question and every follow-up need to be grounded in THIS section's
    /// content, which `begin()`'s fixed per-context greetings have no room
    /// for. `seed` is a real instruction (ask for a summary, probe with a
    /// "why" follow-up, wrap up once it holds up) - prepended to the
    /// student's replies in `askJesse`'s shared fallback via
    /// `discussionSeed`, not a new dedicated backend endpoint.
    func beginDiscussion(seed: String, opening: String) {
        guard !isActive else { return }
        context = "discussion"
        discussionSeed = seed
        isAmbient = false
        isActive = true
        sessionTurnOrigin = turns.count
        Task { await speak(opening) }
    }

    /// Room recording: same STT + transcript box as a call, but Jesse
    /// never replies. Used by the Flows dock Transcribe chip.
    func beginAmbientTranscription(context: String) {
        guard !isActive else { return }
        self.context = context
        self.studentWeakness = nil
        isAmbient = true
        isActive = true
        sessionTurnOrigin = turns.count
        status = nil
        startListening()
    }

    /// `StudySessionView`'s own close button (2026-08-19) - the lesson was
    /// already filed to Binder/Homework Help the moment it was generated
    /// (`DeskGridDashboardView.handleNewLesson`, unchanged), so closing
    /// the tabbed view just needs to dismiss it. `workDashboardLesson` is
    /// `private(set)` on purpose (every other write to it goes through a
    /// real archive/generation result) - this is the one deliberate
    /// external clear.
    func closeLessonSession() {
        workDashboardLesson = nil
        pendingLearnTopic = nil
        pendingLearnGrade = nil
    }

    /// FieldDeskView's dismiss for `openedChapterBook` - same one-deliberate-
    /// external-clear shape as `closeLessonSession()` above.
    func closeChapterBook() {
        openedChapterBook = nil
        openedChapterBookGenerationInfo = nil
        openedChapterBookFocusConceptIds = nil
    }

    /// Real bug, live testing 2026-08-21: the Chapter Library (Tier 0) and
    /// on-demand generation (Tier 3) paths only ever set `openedChapterBook`
    /// - `workDashboardLesson` (what the reopen check at `isReopenLessonRequest`
    /// and the call-start "welcome back" greeting both actually read) was
    /// left completely untouched by either path. Concretely: a student asks
    /// for a brand-new topic, it succeeds via one of these newer tiers, and
    /// `workDashboardLesson` keeps pointing at whatever was built (or
    /// persisted from a PRIOR session - see that property's own doc
    /// comment) before this request - the exact shape of "Jesse announces
    /// old, unrelated content instead of what I just asked for." Keeping
    /// both pieces of state in sync here, at the one real source (a
    /// just-resolved `AssembledBook`), fixes it at the root rather than
    /// patching each read site.
    private func syncWorkDashboardLesson(from book: AssembledBook, source: WorkDashboardLesson.Source) {
        let sections = book.chapters.flatMap(\.sections)
        workDashboardLesson = WorkDashboardLesson(
            topic: book.title,
            source: source,
            chapters: sections.map(\.title),
            chapterBodies: sections.map { $0.summary.isEmpty ? $0.body : $0.summary },
            definition: book.title,
            question: nil,
            microsims: [],
            citations: []
        )
    }

    /// Test-only seam for `StudySessionView` (2026-08-19) - real voice
    /// generation needs a connected AI key and a live network round trip,
    /// neither available in the UI-testing harness. Only ever called from
    /// `DeskGridDashboardView`'s own `--ui-testing-*`-gated seed hook, same
    /// shape as `--ui-testing-content-viewer` elsewhere in this app.
    func seedWorkDashboardLessonForTesting(_ lesson: WorkDashboardLesson) {
        workDashboardLesson = lesson
    }

    /// This session's own turns only, the same slice `end()` computes -
    /// exposed so a live view (DeskGridDashboardView's Transcribe rail) can
    /// render an in-progress ambient transcript without ending the session
    /// first just to read it.
    var currentSessionTurns: [JesseCallTurn] {
        Array(turns.suffix(max(0, turns.count - sessionTurnOrigin)))
    }

    /// Ends the call and returns the final transcript for the caller to
    /// summarize/archive - the session itself doesn't decide where a
    /// transcript goes (Firestore, Drive, both), it just hands over what
    /// was really said.
    @discardableResult
    func end() -> [JesseCallTurn] {
        speakGeneration += 1 // invalidate any in-flight Kokoro request's result
        stopListening()
        synthesizer.stopSpeaking(at: .immediate)
        audioPlayer?.stop()
        audioPlayer = nil
        isSpeaking = false
        let sessionTurns = Array(turns.suffix(max(0, turns.count - sessionTurnOrigin)))
        isActive = false
        isAmbient = false
        isPaused = false
        isThinking = false
        context = nil
        return sessionTurns
    }

    func pause() {
        guard isActive else { return }
        speakGeneration += 1
        isPaused = true
        stopListening()
        if synthesizer.isSpeaking { synthesizer.pauseSpeaking(at: .word) }
        if let audioPlayer, audioPlayer.isPlaying {
            audioPlayer.pause()
        }
    }

    func resume() {
        guard isActive else { return }
        isPaused = false
        if synthesizer.isPaused { synthesizer.continueSpeaking() }
        audioPlayer?.play()
    }

    // MARK: - Speaking

    /// Real Kokoro speech first; native `AVSpeechSynthesizer` only if the
    /// network call fails (offline, real server error) - so the call keeps
    /// talking either way, just less naturally on the fallback path.
    /// `speakGeneration` guards against a slow Kokoro response landing
    /// after the student has since paused or ended the call.
    /// `useKokoro: false` no longer has any call site (2026-08-20) - every
    /// opening greeting used to force it because Kokoro was self-hosted on
    /// Vercel serverless and paid a cold-start cost on literally every
    /// call open (2026-08-18 complaint: "Jesse is mad slow to speak when I
    /// start a call"). That's fixed at the hosting layer now (Fly.io,
    /// always-on, see ../../JESSE_VOICE_TTS_SPEC.md) rather than by
    /// special-casing away the good voice on a student's first impression
    /// - the parameter stays (still useful for the transcription-only
    /// path/tests) but nothing needs it to open a call anymore.
    /// Non-English languages still skip Kokoro unconditionally (see
    /// StudentLanguage.usesKokoro) - it has no Spanish voice wired up.
    /// `voice` defaults to whatever the student picked in VoiceChoiceView
    /// (2026-08-20) - was hardcoded `.heart` before, which meant `.bella`
    /// and `.michael` were fully built and server-validated but unreachable
    /// from any real call site. No call site below passes its own `voice:`,
    /// so this one default is the whole fix; don't add a hardcoded voice
    /// back at a call site without a real reason, that would silently
    /// override the student's choice for that one line.
    private func speak(_ text: String, voice: KokoroVoice = StudentVoicePreference.current, useKokoro: Bool = true) async {
        guard !isPaused, !isAmbient else { return }
        // TEMP diagnostic (2026-08-21) - see askJesse's matching print.
        print("[JesseDebug] speaking=\"\(text)\"")
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "jesse", text: text, at: Date()))
        configureAudioSession()

        let language = StudentLanguagePreference.current
        let generation = speakGeneration
        if useKokoro, language.usesKokoro, let wav = await KokoroTTSClient.synthesize(text: text, voice: voice) {
            guard generation == speakGeneration, isActive, !isPaused else { return }
            do {
                let player = try AVAudioPlayer(data: wav)
                player.delegate = self
                audioPlayer = player
                isSpeaking = true
                player.play()
                return
            } catch {
                // Fall through to the native voice below.
            }
        }

        guard generation == speakGeneration, isActive, !isPaused else { return }
        let utterance = AVSpeechUtterance(string: text)
        utterance.voice = AVSpeechSynthesisVoice(language: language.synthesisLanguageIdentifier)
        utterance.rate = 0.48
        utterance.pitchMultiplier = 1.02
        isSpeaking = true
        synthesizer.speak(utterance)
    }

    /// Text-only counterpart to `speak(_:)` above - same transcript-append
    /// line (`:541`), no TTS/audio at all. Real fix, 2026-08-22, explicit
    /// ask: "no conversations please, it delays learning - just show the
    /// texts." Every `workDashboard`-context reply after the one short
    /// opening greeting uses this instead of `speak()` now, so a student
    /// still sees everything Jesse says in the transcript, it just doesn't
    /// interrupt with spoken narration during multi-step work.
    private func postText(_ text: String) {
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "jesse", text: text, at: Date()))
    }

    /// Routes a workDashboard-context CONVERSATIONAL line (a clarifying
    /// question, an acknowledgment, a status update) through voice when
    /// `voiceFirstReplies` is set, otherwise keeps the original silent
    /// `postText` convention - see that flag's own doc comment. This is
    /// deliberately NOT used for `deliver(_:prefs:)`'s own final-content
    /// line further down, which already has its own correct, separate
    /// `wantsVocal`-driven speak/text choice plus the hang-up-after-
    /// delivery fix - don't route that one through here too.
    private func sayToStudent(_ text: String) async {
        if voiceFirstReplies {
            await speak(text)
        } else {
            postText(text)
        }
    }

    // MARK: - Listening

    func startListening() {
        // Real bug fix (2026-08-23, live report on StudyCompanionView:
        // "when I speak there, it's not rendering anything") - every one of
        // these four conditions used to fail SILENTLY (a bare `return`, no
        // status set), which looks identical to "tapped the mic, nothing
        // happened" whether the real cause was a genuine race (isActive not
        // true yet right as the screen opens) or something the student
        // could actually act on. Now each real cause says so.
        guard isActive else { status = "Say hi to Jesse first - one sec."; return }
        guard !isPaused else { status = "Call is paused."; return }
        guard !isListening else { return }
        guard !isThinking else { status = "Still working on your last question - one sec."; return }
        SFSpeechRecognizer.requestAuthorization { [weak self] auth in
            Task { @MainActor in
                guard let self else { return }
                guard auth == .authorized else {
                    self.status = "Mic permission needed for voice."
                    return
                }
                self.beginListening()
            }
        }
    }

    private func beginListening() {
        guard let recognizer, recognizer.isAvailable else {
            status = "Speech not available on this device."
            return
        }
        configureAudioSession()

        let req = SFSpeechAudioBufferRecognitionRequest()
        req.shouldReportPartialResults = true
        request = req

        let input = audioEngine.inputNode
        let format = input.outputFormat(forBus: 0)
        input.removeTap(onBus: 0)
        input.installTap(onBus: 0, bufferSize: 1024, format: format) { [weak self] buffer, _ in
            self?.request?.append(buffer)
        }

        audioEngine.prepare()
        do {
            try audioEngine.start()
        } catch {
            status = "Mic failed to start."
            return
        }

        isListening = true
        liveTranscript = ""
        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.liveTranscript = result.bestTranscription.formattedString
                    self.resetSilenceTimer()
                    if result.isFinal { self.finishListeningTurn() }
                }
                if error != nil {
                    let shouldResume = self.isAmbient && self.isActive && !self.isPaused
                    self.stopListening()
                    if shouldResume { self.startListening() }
                }
            }
        }
    }

    /// Ambient mode deliberately does NOT get silence-based auto-submit -
    /// it's recording a whole room's conversation, not taking a single
    /// instruction, and a 4-second lull in a real meeting is normal, not a
    /// signal to cut the transcript there.
    private func resetSilenceTimer() {
        guard !isAmbient, !liveTranscript.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        silenceTimer?.invalidate()
        silenceTimer = Timer.scheduledTimer(withTimeInterval: Self.silenceTimeout, repeats: false) { [weak self] _ in
            Task { @MainActor in
                guard let self, self.isListening else { return }
                self.finishListeningTurn()
            }
        }
    }

    private func finishListeningTurn() {
        let text = liveTranscript.trimmingCharacters(in: .whitespacesAndNewlines)
        stopListening()
        guard !text.isEmpty else { return }
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "student", text: text, at: Date()))
        if isAmbient {
            // Keep capturing the room. A conversational call waits for Jesse
            // to reply before listening again; ambient never takes that turn.
            if isActive, !isPaused { startListening() }
            return
        }
        Task { await askJesse(text) }
    }

    /// Typed-text counterpart to `finishListeningTurn()` above, for a real
    /// text input box (StudyCompanionView, 2026-08-23) - same tail (append
    /// the student's turn, then ask Jesse) minus the ASR-specific bits
    /// (no live transcript/silence timer to tear down for a typed message).
    /// Voice stays the primary path elsewhere in the app per CLAUDE.md
    /// (tap-to-toggle mic, never hold-to-talk) - this is additive, not a
    /// replacement.
    func submitText(_ text: String) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, isActive, !isAmbient else { return }
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "student", text: trimmed, at: Date()))
        Task { await askJesse(trimmed) }
    }

    func stopListening() {
        silenceTimer?.invalidate()
        silenceTimer = nil
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
        liveTranscript = ""
    }

    private func configureAudioSession() {
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.playAndRecord, mode: .spokenAudio, options: [.duckOthers, .defaultToSpeaker, .allowBluetooth])
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            status = "Couldn't open the mic."
        }
    }

    // MARK: - Jesse's reply

    private func askJesse(_ message: String) async {
        guard !isAmbient else { return }
        // TEMP diagnostic (2026-08-21) - tracing a real, reproducing bug
        // (Jesse referencing an old, unrelated topic instead of a fresh
        // request) that survived one fix already. Remove once root-caused.
        print("[JesseDebug] recognized=\"\(message)\" context=\(context ?? "nil") pendingLearnTopic=\(pendingLearnTopic ?? "nil") workDashboardLesson.topic=\(workDashboardLesson?.topic ?? "nil")")
        isThinking = true

        // Book (Assignment F) and Learn Studio (Assignment G) each drive
        // their own real backend instead of the generic archive-RAG path
        // below - see their doc comments. Checked before the Work
        // dashboard's DeskBoxBus briefing on purpose: that briefing ("the
        // Work boxes are helpers, quote them") is specific to the Work
        // dashboard and would be actively wrong context to inject into a
        // book-writing or study-plan conversation happening on a different
        // screen entirely.
        if context == "book" {
            await askJesseBook(message)
            isThinking = false
            return
        }
        if context == "learnStudio" {
            await askJesseLearnStudio(message)
            isThinking = false
            return
        }
        if context == "resume" {
            await askJesseResume(message)
            isThinking = false
            return
        }
        if context == "jobOS" {
            await askJesseJobOS(message)
            isThinking = false
            return
        }
        if context == "englishPractice" {
            await askJesseEnglishPractice(message)
            isThinking = false
            return
        }
        // Explicit ask (2026-08-18): "when i said i want to learn calculus
        // it should now check the archive for lessons on it... create a
        // lesson plan." Only intercepts genuine "I want to learn X"-shaped
        // phrasing - anything else on this context (e.g. "what's my next
        // assignment") falls through to the same generic briefing path as
        // before this feature existed, unchanged.
        // A pending topic (the student was just asked "materials or go
        // ahead?") takes priority over trying to extract a brand-new
        // topic from THIS utterance - it's almost certainly the answer to
        // that question, not a second unrelated learn request.
        //
        // BUT: only when the new utterance doesn't itself look like a
        // fresh "I want to learn X" request. Real bug, found via live
        // testing 2026-08-21: `pendingLearnTopic` only clears when a NEW
        // call begins or `closeLessonSession()` fires - it does NOT clear
        // just because the student never actually answered "materials or
        // go ahead?" and moved on within the same still-active call/
        // session. A student who asked about Calculus, got asked that
        // question, then later in the SAME session said "I want to learn
        // Circuits" had "Circuits" silently swallowed as if it were the
        // answer to the stale Calculus question - `askJesseWorkDashboard`
        // ran with `topic: "Calculus"` (the stale pending value), not
        // Circuits, and the reply text was only ever checked for
        // upload-related keywords, never for a brand-new topic. Checking
        // extractLearnTopic on the new message FIRST, and only falling
        // through to the stale-pending path when it does NOT look like a
        // fresh topic request, fixes this without weakening the original
        // "materials or go ahead" flow for genuine replies to it.
        if context == "workDashboard", let pending = pendingLearnTopic {
            // Real live bug, 2026-08-21: the bare "try " lead-in (below,
            // shared with fresh-topic requests like "try circuits") matches
            // ANYWHERE in a sentence, not just as a prefix - "I uploaded.
            // Try again." contains "try " mid-sentence, so extractLearnTopic
            // returned the garbage "topic" "again." instead of falling
            // through to treat this as a reply to the pending topic. Junk
            // extractions (too short, or a known non-topic continuation
            // word) are treated the same as "no fresh topic found."
            let freshTopic = Self.extractLearnTopic(from: message).flatMap { Self.isPlausibleTopic($0) ? $0 : nil }
            if let freshTopic {
                await askJesseWorkDashboardClarify(topic: freshTopic, grade: Self.extractGrade(from: message))
            } else {
                await askJesseWorkDashboardResume(topic: pending, reply: message)
            }
            isThinking = false
            return
        }
        // Real bug, direct live feedback 2026-08-21: "open the lesson it
        // built" matched no recognized intent at all, so it fell all the
        // way through to `extractLearnTopic`, which - finding no lead-in
        // either - fell through further to generic conversation, which
        // (before `workDashboardLesson` persisted, see that property's own
        // doc comment) had nothing real to work with and failed outright:
        // "it said it couldn't do it." Checked BEFORE extractLearnTopic so
        // an explicit reopen request can never be misread as a brand-new
        // topic to generate.
        if context == "workDashboard", let lesson = workDashboardLesson, Self.isReopenLessonRequest(message) {
            print("[JesseDebug] REOPEN branch fired - lesson.topic=\(lesson.topic)")
            guard isActive else { isThinking = false; return }
            await sayToStudent("Here's what we built on \(lesson.topic) - \(lesson.chapters.joined(separator: ", ")).")
            isThinking = false
            // Content shown -> off the line (bug #3, "everywhere").
            hangUpAfterDelivery()
            return
        }
        // A live background build answers its own status questions with
        // real numbers instead of letting them fall through to the generic
        // archive chat (which knows nothing about the build and would
        // confabulate).
        if context == "workDashboard", let progress = generationProgress, Self.isProgressQuestion(message) {
            guard isActive else { isThinking = false; return }
            if progress.totalChapters > 0 {
                await sayToStudent("Still building \(progress.topic) - \(progress.chaptersReady) of \(progress.totalChapters) chapters through the quality gate. It'll drop in here the moment it's done.")
            } else {
                await sayToStudent("Still building \(progress.topic) - the first chapters are in the works. It'll drop in here the moment it's done.")
            }
            isThinking = false
            return
        }
        if context == "workDashboard", let topic = Self.extractLearnTopic(from: message) {
            await askJesseWorkDashboardClarify(topic: topic, grade: Self.extractGrade(from: message))
            isThinking = false
            return
        }
        if context == "workDashboard", Self.isPracticeRequest(message) {
            guard isActive else { isThinking = false; return }
            // Real fix, 2026-08-23, explicit ask: "if I tell you that I
            // want to practice this vocal, including a lesson... it's
            // still going to be a lesson" - while Study Companion owns the
            // conversation, a practice request stays IN it (no context
            // switch, no teleport to the separate Practice screen); the
            // dedicated Practice screen is still exactly what every other
            // "workDashboard" entry point (the dashboard's own Answer box)
            // gets, unchanged - see studyCompanionPresented's own doc
            // comment for why this can't be done by resetting
            // practiceRequested after the fact instead.
            if studyCompanionPresented {
                await sayToStudent("Sure - let's practice it right here. Go ahead and try it, or tell me what you want to be quizzed on.")
            } else {
                await sayToStudent("On it - opening Practice now.")
                practiceRequested = true
            }
            isThinking = false
            return
        }
        // Last-resort bare-topic fallback (2026-08-21) - even with the
        // widened lead-in list above, a student answering Jesse's own "what
        // would you like to learn today?" very naturally just says the
        // subject with no lead-in verb at all ("corporate law", no "I want
        // to learn" scaffolding needed since the question already
        // established the intent) - confirmed via live device console:
        // ASR heard "Corporate love please corporate law" for exactly this,
        // matched no lead-in, and fell all the way through to the generic
        // archive-chat path below, which confidently returned an unrelated
        // real book. Deliberately narrow to avoid false-triggering on real
        // conversation ("what's my next assignment", "yes go ahead", "open
        // the lesson" - that last one is caught by the reopen check above
        // already): short (<=6 words) AND doesn't open with a question/
        // command word this heuristic would otherwise misread as a topic.
        if context == "workDashboard", let topic = Self.extractBareTopicFallback(message) {
            await askJesseWorkDashboardClarify(topic: topic, grade: Self.extractGrade(from: message))
            isThinking = false
            return
        }

        let bus = DeskBoxBus.shared
        // Shared fallback - reachable from workDashboard AND other contexts
        // (archive, designStudio) that fall through every context-specific
        // branch above without matching. Only workDashboard goes quiet
        // (postText) here; other contexts keep the real spoken reply -
        // this path is their only reply mechanism, unlike workDashboard's
        // dedicated askJesseWorkDashboard cluster below.
        if let local = bus.directAnswer(for: message) {
            guard isActive else { isThinking = false; return }
            if context == "workDashboard" { await sayToStudent(local) } else { await speak(local) }
            isThinking = false
            return
        }
        // Discussion mode (`beginDiscussion`) grounds every reply in the
        // section's own seed instruction instead of the Work dashboard's
        // box briefing, which has nothing to do with book content.
        let composed: String
        if context == "discussion", let seed = discussionSeed {
            composed = seed + "\n\nStudent said: " + message
        } else {
            let briefing = bus.briefing()
            composed = briefing.isEmpty ? message : briefing + "\n\nStudent said: " + message
        }
        let reply = await ArchiveRagClient.ask(message: composed, studentWeakness: studentWeakness)
        // isThinking stays true through speech generation too (Kokoro's own
        // network round-trip) rather than adding a separate UI state - the
        // call pill already reads "Jesse is thinking..." either way.
        guard isActive else { isThinking = false; return } // call may have ended while awaiting
        let fallbackReply = reply ?? "I didn't quite catch that. Try again?"
        if context == "workDashboard" { await sayToStudent(fallbackReply) } else { await speak(fallbackReply) }
        isThinking = false
    }

    // MARK: - Book (Assignment F, 2026-08-18)

    /// Real `/api/book-agent` round trip - mirrors `agent.js`'s `ask()`
    /// exactly (same URL, same `{ message, draft }` request, same
    /// `{ reply, draft, readyToPublish }` response). `bookDraft` is the one
    /// piece of state `BookWorkflowView` observes to render chapters live
    /// as the student talks; `readyToPublish` is available on the reply if
    /// a future pass wants to surface it, not consumed yet - the left
    /// panel derives its own "ready" state from `title`/`chapters` directly,
    /// same rule `agent.js`'s own publish-button-disabled check already used.
    /// Seeds the book draft from outside - the Design Studio canvas's
    /// scoped `.chapter` flow uses this so a call about an EXISTING chapter
    /// starts from that chapter's real text instead of a blank draft
    /// (`begin(context: "book")` deliberately nils the draft, which is
    /// right for the standalone flow but would erase a box's work here).
    /// Guarded to the book context and to an empty live draft so it can
    /// never stomp a conversation already in progress.
    func seedBookDraft(_ draft: BookAgentDraft) {
        guard context == "book" else { return }
        guard bookDraft == nil || bookDraft?.chapters.isEmpty == true else { return }
        bookDraft = draft
    }

    private func askJesseBook(_ message: String) async {
        let draft = bookDraft ?? .empty
        guard let result = await BookAgentClient.ask(message: message, draft: draft) else {
            guard isActive else { return }
            await speak("I couldn't reach the book desk just now. Keep talking and I'll catch up.")
            return
        }
        guard isActive else { return }
        bookDraft = result.draft
        await speak(result.reply)
    }

    // MARK: - Resume (Assignment H, 2026-08-18)

    /// Real `/api/resume-agent` round trip - mirrors `agent.js`'s
    /// `askJesse()` request/response cycle the same way `askJesseBook`
    /// mirrors the book workflow's `ask()`.
    private func askJesseResume(_ message: String, resumeText: String? = nil, resumeFileName: String? = nil) async {
        let draft = resumeDraft ?? .empty
        guard let result = await ResumeAgentClient.ask(message: message, draft: draft, resumeText: resumeText, resumeFileName: resumeFileName) else {
            guard isActive else { return }
            await speak("I couldn't reach the resume desk just now. Keep talking and I'll catch up.")
            return
        }
        guard isActive else { return }
        resumeDraft = result.draft
        await speak(result.reply)
    }

    /// Real upload wire-up (2026-08-25, explicit ask: "Hey, I need a resume
    /// to work with, do you have one to upload") - was a genuine gap (see
    /// ResumeAgentClient's own doc comment): the server has always accepted
    /// `sources.resumeText`, nothing native ever sent it. ResumeAgentView
    /// extracts real text via PDFKit and calls this once, same
    /// begin()-then-submit shape `submitLearnForm` uses for Gurukul's own
    /// upload-or-talk opening. quiet: true skips the spoken "Heyy!" greeting
    /// entirely - the upload itself is the opening move, not a call the
    /// student initiated by talking first.
    func submitResumeUpload(text: String, fileName: String, studentName: String) {
        guard !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else { return }
        if !isActive || context != "resume" {
            begin(context: "resume", studentName: studentName, quiet: true)
        }
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "student", text: "Uploaded \(fileName)", at: Date()))
        Task { await askJesseResume("I uploaded my resume, \(fileName) - please pull my real details from it.", resumeText: text, resumeFileName: fileName) }
    }

    // MARK: - English practice (2026-08-19)

    /// Real `/api/english-practice` round trip - mirrors `askJesseResume`'s
    /// shape exactly, just with a lightweight goal/deadline state instead of
    /// a full document draft. `turns` (this session's own real transcript)
    /// supplies `recentTurns` directly - no separate history to maintain.
    private func askJesseEnglishPractice(_ message: String) async {
        let state = englishPracticeState ?? .empty
        let recent = turns.suffix(6).map { EnglishPracticeTurn(speaker: $0.speaker, text: $0.text) }
        guard let result = await EnglishPracticeClient.ask(message: message, recentTurns: Array(recent), state: state) else {
            guard isActive else { return }
            await speak("I couldn't reach the practice desk just now. Keep talking and I'll catch up.")
            return
        }
        guard isActive else { return }
        englishPracticeState = result.state
        await speak(result.reply)
    }

    // MARK: - Job OS (2026-08-18)

    /// Blank-slate intake for any student, not just the one real seeded
    /// CRM (`macalesterApplySeed.json` is deliberately empty for everyone
    /// else - that data must never leak into the public seed). Same
    /// `ResumeAgentDraft` shape and `/api/resume-agent` round trip
    /// `askJesseResume` already drives - explicitly NOT a second schema -
    /// just a different conversational context (interviewing for name/
    /// target roles/skills/experience rather than resume bullets) and,
    /// unlike the voice-only resume path, a real mid-conversation Drive
    /// import: the student can say something like "import my resume from
    /// drive" and this reuses the exact same `DriveClient.shared.
    /// connectAndReadFolder()` the resume workflow's own web import
    /// already calls, not a second Drive integration.
    private func askJesseJobOS(_ message: String) async {
        var draft = resumeDraft ?? .empty
        var driveFiles: [ResumeAgentClient.DriveSourceFile] = []

        if Self.mentionsDriveImport(message) {
            let files = await DriveClient.shared.connectAndReadFolder()
            guard isActive else { return }
            if files.isEmpty {
                await speak("I didn't find anything in your Drive folder to import - keep talking and I'll build your profile from what you tell me.")
            } else {
                driveFiles = files.map { .init(name: $0.name, text: $0.text) }
                draft.drive = true
                draft.files = Array(Set(draft.files + files.map(\.name)))
            }
        }

        guard let result = await ResumeAgentClient.ask(message: message, draft: draft, driveFiles: driveFiles) else {
            guard isActive else { return }
            await speak("I couldn't reach the Job OS desk just now. Keep talking and I'll catch up.")
            return
        }
        guard isActive else { return }
        resumeDraft = result.draft
        await speak(result.reply)
    }

    private static func mentionsDriveImport(_ message: String) -> Bool {
        let lowered = message.lowercased()
        return lowered.contains("drive") && (lowered.contains("import") || lowered.contains("resume") || lowered.contains("upload") || lowered.contains("read"))
    }

    // MARK: - Learn Studio (Assignment G, 2026-08-18)

    /// Re-runs the same `StudentAIKeyStore.generateStudyPlan` the intake
    /// form's one-shot submit uses, but per turn, standing the accumulated
    /// conversation SINCE THIS CALL BEGAN in for the topic text (not the
    /// full cross-context `turns` history - a Resume or Book conversation
    /// from earlier has no business bleeding into a study plan; scoping to
    /// `sessionTurnOrigin` is the same boundary `end()` already uses to hand
    /// back "just this session's" turns). Regenerates the whole plan fresh
    /// every turn - the cheap, already-proven-correct option the assignment
    /// calls out, not a true incremental patch. Never touches
    /// `SampleQuestion.all`'s question text itself - only asks the model to
    /// name a real `matchedConceptId` from the known list, same firewall the
    /// form path already relies on.
    private func askJesseLearnStudio(_ message: String) async {
        let sessionTurns = Array(turns.suffix(max(0, turns.count - sessionTurnOrigin)))
        let conversation = sessionTurns
            .map { "\($0.speaker == "student" ? "Student" : "Jesse"): \($0.text)" }
            .joined(separator: "\n")
        let topic = conversation.isEmpty ? message : conversation
        let known = Array(Set(SampleQuestion.all.map(\.conceptId)))
        let level = "Not chosen from a picker this time - infer a level from what the student has said, if they've said enough to tell."

        let result = await StudentAIKeyStore.shared.generateStudyPlan(topic: topic, level: level, knownConceptIds: known)
        guard isActive else { return }
        switch result {
        case .success(let plan):
            studyPlan = plan
            studyPlanError = nil
            await speak(plan.definition.isEmpty ? "Got it - take a look at the cards." : plan.definition)
        case .failure(.noKey):
            studyPlanError = "Connect your AI key in Settings so Jesse can actually plan this."
            await speak("You'll need to connect an AI key in Settings before I can build your plan.")
        case .failure(.rejected):
            studyPlanError = "That AI key was rejected. Open Settings to update it."
            await speak("That AI key isn't working right now. Check it in Settings?")
        case .failure(.unavailable):
            studyPlanError = "Couldn't put a plan together from that - try again, or say more about the topic."
            await speak("I couldn't quite put a plan together from that. Tell me a bit more?")
        }
    }

    // MARK: - Work Dashboard "I want to learn X" (2026-08-18)

    /// Deliberately narrow: only strips a short, explicit list of real
    /// lead-in phrases rather than trying to classify arbitrary sentences
    /// as "wants to learn something" - a false positive here would hijack
    /// an ordinary desk question (e.g. "what's my next assignment") into
    /// the lesson-generation path instead of answering it.
    /// Real bug, confirmed live (2026-08-18): "hi Jesse can you please
    /// teach me calculus" fell through to the generic path entirely -
    /// `hasPrefix` required the lead-in to be the very first words, so
    /// "hi Jesse..." and "...please teach me..." (real, natural filler a
    /// strict prefix match doesn't survive) both broke the match, and
    /// Jesse ended up talking about an unrelated archive hit instead of
    /// running the real learn flow at all. Fixed to search anywhere in
    /// the message, not just at the start, and widened the phrase list
    /// to cover "please".
    /// Deliberately narrower than `extractLearnTopic` - a fixed-phrase
    /// match, not a lead-in-plus-topic extraction, since "practice" has no
    /// topic to parse out (the Practice screen it opens is a live
    /// conversation, not something that takes a subject argument today).
    private static func isPracticeRequest(_ message: String) -> Bool {
        let lowered = message.lowercased()
        let phrases = [
            "i want to practice", "i'd like to practice", "i would like to practice",
            "let's practice", "lets practice", "help me practice", "can i practice",
            "take me to practice", "open practice", "go to practice",
        ]
        return phrases.contains { lowered.contains($0) }
    }

    /// Real bug, direct live feedback 2026-08-21: "open the lesson it
    /// built" - see this function's call site for the full failure it
    /// fixes. Only meaningful when `workDashboardLesson` is already
    /// non-nil (the call site checks that), so this doesn't need to
    /// disambiguate "open" from a genuinely new topic request itself.
    /// TEMP diagnostic (2026-08-21) - a concise, safe-to-print summary of a
    /// BookGenerationClient.Verdict. Deliberately doesn't interpolate the
    /// verdict directly (its .verified case carries a full AssembledBook -
    /// every chapter/section body/sim HTML - printing that raw would flood
    /// the console with megabytes of text per call). Remove once root-caused.
    private static func debugDescribe(_ verdict: BookGenerationClient.Verdict) -> String {
        switch verdict {
        case .verified(let book, let cached, let costUsd, let elapsed):
            return "verified(title=\(book.title), cached=\(cached), costUsd=\(costUsd ?? -1), elapsed=\(elapsed))"
        case .noGoodResult(let reason):
            return "noGoodResult(\(reason ?? "nil"))"
        case .rateLimited(let reason):
            return "rateLimited(\(reason ?? "nil"))"
        case .unavailable(let reason):
            return "unavailable(\(reason ?? "nil"))"
        }
    }

    /// "Is it done yet?"-shaped questions about a build in flight - see
    /// the `generationProgress` branch in `askJesse`. Fixed-phrase match,
    /// same conservative style as `isPracticeRequest`.
    private static func isProgressQuestion(_ message: String) -> Bool {
        let lowered = message.lowercased()
        let phrases = [
            "how long", "how much longer", "is it done", "done yet",
            "is it ready", "ready yet", "are you done", "you finished",
            "is it finished", "finished yet", "status", "how's it going",
            "hows it going", "how is it going", "where's my lesson",
            "wheres my lesson", "where is my lesson", "still building",
        ]
        return phrases.contains { lowered.contains($0) }
    }

    private static func isReopenLessonRequest(_ message: String) -> Bool {
        let lowered = message.lowercased()
        let phrases = [
            "open the lesson", "open that lesson", "open my lesson",
            "show me the lesson", "show the lesson", "show me what we built",
            "show me what you built", "open what we built", "open it up",
            "open it", "pull it up", "pull up the lesson",
            "reopen the lesson", "go back to the lesson", "back to the lesson",
            "continue the lesson", "keep going with", "keep going on",
        ]
        return phrases.contains { lowered.contains($0) }
    }

    /// Real Chapter Library lookup (2026-08-21) - the Tier 0 check in
    /// `askJesseWorkDashboard`. Loose substring match against real
    /// synced book titles, same style `BookGraphLoader` matching already
    /// uses one tier down - deliberately not a fourth different matching
    /// strategy to reason about. Returns nil (not an error) on any
    /// network failure or empty catalog, same "fall through to the next
    /// real tier" shape every other source in this chain already has.
    /// Returns the matched book plus WHICH section(s) the topic actually
    /// hit - nil focus means the whole-title matched (the student asked
    /// about the subject itself, so the whole book is relevant); a non-nil,
    /// non-empty set means only specific section(s) matched (2026-08-23,
    /// see `openedChapterBookFocusConceptIds`'s doc comment) and the caller
    /// should open pre-filtered to just those.
    private static func matchChapterLibraryBook(topic: String) async -> (book: AssembledBook, focusConceptIds: Set<String>?)? {
        let loweredTopic = topic.lowercased()
        guard let summaries = try? await BookLibraryClient.listBooks() else { return nil }
        if let match = summaries.first(where: { summary in
            topicWordsMatch(loweredTopic, summary.title.lowercased())
        }) {
            guard let book = try? await BookLibraryClient.getBook(subjectId: match.subjectId) else { return nil }
            return (book, nil)
        }
        // Real fix (2026-08-23, live report: asking for a specific chapter
        // topic like "the chain rule" instead of the whole book's own
        // title fell straight through this whole-title-only check into
        // fresh generation, even though a real, rich, already-assembled
        // book covering it existed) - also check each real book's own
        // CHAPTER titles, not just its top-level title. Real cost: one
        // getBook fetch per candidate book whose title alone didn't match
        // (bounded by however many books are actually synced, today a
        // handful) - acceptable for a voice request that's already waiting
        // on a network round trip either way.
        for summary in summaries {
            guard let book = try? await BookLibraryClient.getBook(subjectId: summary.subjectId) else { continue }
            let matchedIds = book.chapters.flatMap(\.sections).filter { section in
                topicWordsMatch(loweredTopic, section.title.lowercased())
            }.map(\.conceptId)
            if !matchedIds.isEmpty {
                return (book, Set(matchedIds))
            }
        }
        return nil
    }

    /// Word-boundary-safe replacement for the bidirectional substring
    /// `.contains` check every topic matcher in this file used to use -
    /// real live bug, found via an actual device repro 2026-08-25: asking
    /// for "US History" matched "Timeline of Calculus History" because the
    /// raw substring "us history" is literally embedded in "Calc-us
    /// History" (a character coincidence - "calculus" ends in "us" - with
    /// zero topical relevance), and separately matched a leftover "History
    /// of Hydroponics" chapter from unrelated 2026-08-18 testing, on
    /// nothing but the bare word "history". Tokenizing both sides and
    /// requiring a WHOLE-WORD subset match (either direction, same
    /// "shorter topic vs a longer real title, or vice versa" shape the old
    /// bidirectional `.contains` was already going for) keeps genuine
    /// matches ("calculus" -> "Calculus: ..."; "the chain rule" -> "Chain
    /// Rule") while rejecting same-substring-different-word collisions
    /// like this one - "us" is a real token of "us history" but never a
    /// standalone token of "calculus".
    ///
    /// Tokenization repair (2026-08-25, same session, found by running this
    /// matcher against the REAL live library): splitting on every
    /// non-alphanumeric turned the genuine synced book "U.S. History" into
    /// {u, s, history}, so the topic "us history" ({us, history}) matched
    /// NOTHING - the one real book that exists for the founder's exact
    /// request was unreachable by its own name, and the request fell
    /// through to a multi-minute paid generation instead. Tokens are now
    /// whitespace-delimited words with internal punctuation STRIPPED
    /// ("u.s." -> "us"), plus the punctuation-split parts for multi-part
    /// tokens ("pre-calculus" -> "precalculus", "pre", "calculus") so both
    /// spellings of a compound keep matching. "Calc-us" style collisions
    /// stay dead: "calculus" is one whitespace token, so "us" is never
    /// minted from it.
    static func topicWordsMatch(_ a: String, _ b: String) -> Bool {
        let wa = topicWords(a), wb = topicWords(b)
        guard !wa.isEmpty, !wb.isEmpty else { return false }
        return wa.isSubset(of: wb) || wb.isSubset(of: wa)
    }

    private static func topicWords(_ s: String) -> Set<String> {
        var out = Set<String>()
        for raw in s.lowercased().split(whereSeparator: { $0.isWhitespace }) {
            let parts = raw.split(whereSeparator: { !$0.isLetter && !$0.isNumber }).map(String.init)
            let joined = parts.joined()
            if !joined.isEmpty { out.insert(joined) }
            if parts.count > 1 { for part in parts { out.insert(part) } }
        }
        return out
    }

    /// Strips a trailing self-description clause ("I'm in grade 8", "I am
    /// grade 8", "grade 8") off a spoken topic and returns the grade it
    /// found - real bug, live testing 2026-08-21: a student said
    /// "...photosynthesis, I'm in grade 8" in one breath, and with no
    /// stripping the ENTIRE trailing clause rode along as literal topic
    /// text into generation - the model, asked to build a lesson on a
    /// garbled compound "topic," produced nonsense chapters trying to make
    /// sense of it. Regex, not a leadIns-style prefix list, because the
    /// grade clause can appear anywhere near the end of the utterance, not
    /// just after a fixed lead-in phrase.
    private static let _gradeClauseRegex = try! NSRegularExpression(
        pattern: #"[,.]?\s*(?:i(?:'m| am)?\s+)?(?:in\s+)?grade\s+(\d{1,2})\s*\.?\s*$"#,
        options: [.caseInsensitive]
    )

    private static func stripTrailingGrade(_ topic: String) -> (topic: String, grade: Int?) {
        let full = NSRange(topic.startIndex..., in: topic)
        guard let match = _gradeClauseRegex.firstMatch(in: topic, options: [], range: full),
              let gradeRange = Range(match.range(at: 1), in: topic),
              let grade = Int(topic[gradeRange]),
              let wholeRange = Range(match.range, in: topic)
        else {
            return (topic, nil)
        }
        let cleaned = topic.replacingCharacters(in: wholeRange, with: "").trimmingCharacters(in: .whitespacesAndNewlines)
        return (cleaned.isEmpty ? topic : cleaned, grade)
    }

    private static func extractLearnTopic(from message: String) -> String? {
        // Widened 2026-08-21, direct live feedback ("try again on
        // enterprise technology, equity research, finance" got no
        // recognized lead-in, fell all the way through to the generic
        // archive-chat path instead of running the real learn flow, which
        // read as Jesse ignoring the request and defaulting to whatever
        // topic was last on screen). This function only ever runs already
        // scoped to `context == "workDashboard"` - a student actively in
        // a lesson-building conversation - so a broader match here is a
        // real, contained improvement, not a global "guess the intent of
        // any sentence" risk the way it would be if this ran everywhere.
        let leadIns = [
            "i want to learn about ", "i want to learn ",
            "i want to study ", "help me learn ", "help me study ",
            "can you please teach me ", "can you teach me ", "please teach me ",
            "teach me about ", "teach me ",
            "i'd like to learn ", "i would like to learn ",
            "let's learn ", "lets learn ",
            "try again on ", "try again with ", "try ",
            "what about ", "how about ",
            "let's do ", "lets do ", "let's try ", "lets try ",
            "look into ", "can we do ", "switch to ", "go with ", "instead do ",
            // Added 2026-08-21, direct live feedback - the exact phrasing
            // used ("give me lessons around photosynthesis") had no
            // matching lead-in at all.
            "give me lessons around ", "give me a lesson on ", "give me lessons on ",
            "give me a lesson about ", "give me lessons about ",
            // Added 2026-08-21 - real root cause of a recurring, reported
            // "Jesse announces a random unrelated book" bug: "generate me a
            // lesson on X" / "create me a book on X" are this student's own
            // consistent, repeated phrasing all night (verbatim from live
            // reports: "generate me a lesson on chemical compounds",
            // "create me a book on Corporate Law") and NONE of it matched
            // any lead-in above - every one of those requests silently fell
            // through past this function entirely into the generic
            // ArchiveRagClient conversational fallback below, which does
            // its OWN loose retrieval over Dan McCreary's real archive and
            // can return a real, unrelated book with total confidence
            // ("I opened Calculus at Why Calculus Matters...") for a query
            // that isn't in that archive at all. Confirmed via a live
            // device console capture, not inferred.
            "generate me a lesson on ", "generate a lesson on ",
            "generate me lessons on ", "generate lessons on ",
            "generate me a book on ", "generate a book on ",
            "create me a lesson on ", "create a lesson on ",
            "create me a book on ", "create a book on ",
            "build me a lesson on ", "build a lesson on ",
            "build me a book on ", "build a book on ",
            "make me a lesson on ", "make a lesson on ",
        ]
        let lowered = message.lowercased()
        for leadIn in leadIns {
            guard let range = lowered.range(of: leadIn) else { continue }
            let rawTopic = String(message[range.upperBound...]).trimmingCharacters(in: .whitespacesAndNewlines)
            // Real bug, live testing 2026-08-21: "...photosynthesis, I'm in
            // grade 8" spoken as one utterance rode the WHOLE trailing
            // clause into the topic verbatim, and the model - asked to
            // build a lesson on a garbled compound "topic" - produced
            // nonsense chapters trying to make sense of it. Strip it here
            // so the topic is always clean regardless of which lead-in
            // matched; extractGrade(from:) below recovers the number
            // separately for callers that want to use it for real
            // personalization instead of just discarding it.
            let topic = stripTrailingGrade(rawTopic).topic
            if !topic.isEmpty { return topic }
        }
        return nil
    }

    /// Guards `extractLearnTopic`'s output where a bare, substring-anywhere
    /// lead-in (`"try "`) can extract a junk continuation word instead of a
    /// real topic - e.g. "I uploaded. Try again." matches "try " mid-
    /// sentence and would otherwise extract "again." 2026-08-21 real bug.
    private static let _junkTopicContinuations: Set<String> = [
        "again", "it", "that", "this", "now", "please", "again please",
    ]

    private static func isPlausibleTopic(_ topic: String) -> Bool {
        let cleaned = topic.lowercased().trimmingCharacters(in: .punctuationCharacters)
        return cleaned.count >= 3 && !_junkTopicContinuations.contains(cleaned)
    }

    /// Last-resort companion to `extractLearnTopic` above - see its call
    /// site's doc comment for why this exists. Deliberately conservative:
    /// only a short phrase (<=6 words) that doesn't open with a word this
    /// heuristic would otherwise misread as a question/command/affirmation
    /// counts as a bare topic name. A message this function accepts but
    /// that ISN'T really a topic just becomes a slightly odd generation
    /// request (harmless, self-correcting once Jesse asks a clarifying
    /// question) - the real risk this guards against is the opposite
    /// direction: swallowing genuine conversation ("what's my next
    /// assignment", "yes let's do that") as if it were a topic.
    private static let _bareTopicStopWords: Set<String> = [
        "what", "whats", "how", "why", "when", "where", "who", "which",
        "can", "could", "should", "would", "will", "shall",
        "is", "are", "was", "were", "do", "does", "did",
        "yes", "yeah", "yep", "no", "nope", "okay", "ok", "sure",
        "open", "show", "pull", "continue", "keep", "go", "stop", "wait",
        "help", "thanks", "thank",
    ]

    private static func extractBareTopicFallback(_ message: String) -> String? {
        let (stripped, _) = stripTrailingGrade(message.trimmingCharacters(in: .whitespacesAndNewlines))
        let words = stripped.split(separator: " ")
        guard (1...6).contains(words.count) else { return nil }
        guard let first = words.first?.lowercased().trimmingCharacters(in: .punctuationCharacters),
              !_bareTopicStopWords.contains(first)
        else { return nil }
        return stripped
    }

    /// The grade `extractLearnTopic` stripped out of the same utterance,
    /// if it found one - a real, in-the-moment signal from what the
    /// student just said, not the durable Firestore profile field
    /// generate-lesson-outline.ts also checks server-side. Deliberately a
    /// SEPARATE lookup on the raw message rather than baked into
    /// `extractLearnTopic`'s return value, so every existing caller of
    /// that function keeps working unchanged.
    private static func extractGrade(from message: String) -> Int? {
        stripTrailingGrade(message).grade
    }

    /// First half of the learn exchange - parks the topic and asks ONE
    /// real clarifying question (2026-08-25 Gurukul redesign, replacing
    /// 2026-08-18's fixed "materials or go ahead?" script the founder was
    /// tired of hearing verbatim every time): what kind of content
    /// (sims / reading / voice walkthrough) and what level, with phrasing
    /// that rotates. The Tier-0 Chapter Library probe starts HERE, in the
    /// background, so the clarifying back-and-forth doubles as lookup
    /// time - a library hit is usually already resolved by the time the
    /// student answers. An attached upload is still surfaced, just inline
    /// ("I can build straight from <file>") instead of as the whole
    /// question.
    private func askJesseWorkDashboardClarify(topic: String, grade: Int? = nil) async {
        pendingLearnTopic = topic
        pendingLearnGrade = grade
        startLibraryProbe(topic: topic)
        let phrasings = [
            "\(topic) - love it. What would help most: sims you can play with, a clean reading, or me talking you through it? And are you new to this or past the basics?",
            "Okay, \(topic). Want me to lean into interactive sims, keep it something to read, or walk you through it out loud? Intro-level or deeper?",
            "\(topic), got it. Do you want something to play with, something to read, or a voice walkthrough - and should I keep it beginner-friendly or go deep?",
        ]
        var question = phrasings[clarifyPhrasingIndex % phrasings.count]
        clarifyPhrasingIndex += 1
        if let upload = latestHomeworkUpload {
            question += " I can also build straight from \(upload.fileName) - just say the word."
        }
        await sayToStudent(question)
    }

    /// Fires the Tier-0 Chapter Library lookup concurrently with the
    /// clarifying question - see `libraryProbeTask`'s doc comment.
    private func startLibraryProbe(topic: String) {
        libraryProbeTask?.cancel()
        libraryProbeTopic = topic
        libraryProbeTask = Task { await Self.matchChapterLibraryBook(topic: topic) }
    }

    /// The probe's result if it was fired for THIS topic, else a fresh
    /// lookup - so delivery never uses a stale probe from a topic the
    /// student has since moved past.
    private func consumeLibraryProbe(topic: String) async -> (book: AssembledBook, focusConceptIds: Set<String>?)? {
        if libraryProbeTopic == topic, let task = libraryProbeTask {
            return await task.value
        }
        return await Self.matchChapterLibraryBook(topic: topic)
    }

    /// Second half - interprets the student's answer to the question
    /// `askJesseWorkDashboardClarify` just asked. Deliberately permissive
    /// about what counts as "go ahead" (same lightweight keyword-check
    /// style already used elsewhere in this file, e.g.
    /// `mentionsDriveImport`) - a reply that matches neither pattern still
    /// proceeds rather than leaving the conversation stuck waiting
    /// forever on an ambiguous answer.
    private func askJesseWorkDashboardResume(topic: String, reply: String) async {
        let grade = pendingLearnGrade
        pendingLearnGrade = nil
        let lowered = reply.lowercased()
        let mentionsUpload = lowered.contains("upload") || lowered.contains("file") || lowered.contains("pdf")
            || lowered.contains("use that") || lowered.contains("use it") || lowered.contains("reference")
        let context = mentionsUpload ? latestHomeworkUpload : nil
        if mentionsUpload, context == nil {
            await sayToStudent("I don't see an upload yet - go ahead and tap Homework Help to add it, then tell me when it's there. Or just say go ahead and I'll build from what's available.")
            pendingLearnTopic = topic // still waiting - didn't fall through silently
            pendingLearnGrade = grade
            return
        }
        // Real live bug, 2026-08-21: this used to clear pendingLearnTopic
        // unconditionally BEFORE even knowing whether generation would
        // succeed. On a real failure (noGoodResult/rateLimited/thin-path
        // failure), the topic was gone - a plain "try again" with no topic
        // restated had nothing to reattach to, so it either got misread as
        // a brand-new topic by the bare-topic fallback (re-triggering
        // "materials or go ahead?" forever) or fell through to the generic
        // archive chat (a real, unrelated book - "I opened Calculus at...").
        // Kept set through the attempt instead; askJesseWorkDashboard's own
        // real success branches clear it, every failure branch leaves it
        // alone on purpose so the NEXT reply-shaped utterance re-enters
        // right here, with the SAME upload-aware logic above.
        pendingLearnTopic = topic
        // The clarify answer carries real signal now (kind / level /
        // sometimes a grade said in the moment) - parse it here so the
        // delivery can honor and acknowledge it (2026-08-25 redesign).
        let prefs = LearnPreferences.parse(reply)
        await askJesseWorkDashboard(topic: topic, materialsContext: context, grade: grade ?? Self.extractGrade(from: reply), prefs: prefs)
    }

    /// "Check the archive for lessons on it, extract things, create a
    /// lesson plan." Real archives get checked, in order, before ever
    /// generating anything:
    /// 1. `BookGraphLoader.all` - the 5 bundled literary/philosophy book
    ///    concept graphs (Learn Studio's "Study a Book" data).
    /// 2. Dan McCreary's real open-textbook archive (`ArchiveRagClient`,
    ///    the same backend the Archive workflow's own call already uses)
    ///    - genuinely covers Calculus, Algebra I, Geometry, Linear
    ///    Algebra, Biology, Chemistry, Physics, Computer Science, and
    ///    more (confirmed by reading the real corpus,
    ///    `webhook/data/dans-archive-chunks.json`). Correction
    ///    (2026-08-18): this file originally only checked (1), which
    ///    genuinely doesn't cover something like "calculus" - but (2)
    ///    does, and was already live, just not wired into this flow.
    /// 3. `MicroSimLoader.matching` - real, bundled, interactive p5.js
    ///    MicroSims (today: the 123-sim Calculus set; more subjects follow
    ///    the same bundling pattern). Originally CC BY-NC-SA
    ///    (non-commercial); wired in with explicit authorization
    ///    (2026-08-18) via MindCraft's advisor relationship with Dan
    ///    McCreary, the content's own creator - see `MicroSimRecord`'s doc
    ///    comment. Additive to whichever branch below actually produces a
    ///    lesson, not a fourth competing source.
    ///
    /// Only generation (the final fallback) gets skipped when a topic has
    /// no real archived material anywhere - unless the student explicitly
    /// pointed at their own upload (`materialsContext`, non-nil only via
    /// `askJesseWorkDashboardResume`), in which case that's what they
    /// asked Jesse to build from, so the archive checks below are skipped
    /// entirely in favor of generation grounded in their own material
    /// instead of a generic archive match that might not even be about
    /// their specific document.
    /// Structured-form entry point (2026-08-25, explicit ask: "a cute
    /// little questionnaire... What would you like to learn, then another
    /// field level, and things we need to create the best sim... once
    /// they hit create Jesse starts to create"). Skips the spoken
    /// clarifying question entirely - the form already collected the same
    /// signal (topic/level/content type) directly, so hitting Create
    /// should start generation immediately, not re-ask what was just
    /// answered on the form a second time out loud.
    func submitLearnForm(topic: String, prefs: LearnPreferences, grade: Int?) {
        let trimmed = topic.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, isActive, context == "workDashboard" else { return }
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "student", text: trimmed, at: Date()))
        pendingLearnTopic = trimmed
        Task { await askJesseWorkDashboard(topic: trimmed, grade: grade, prefs: prefs) }
    }

    private func askJesseWorkDashboard(topic: String, materialsContext: (fileName: String, cardSummaries: [String])? = nil, grade: Int? = nil, prefs: LearnPreferences = LearnPreferences()) async {
        print("[JesseDebug] askJesseWorkDashboard ENTRY topic=\"\(topic)\"")
        if let materialsContext {
            await generateFromMaterials(topic: topic, materials: materialsContext, grade: grade, prefs: prefs)
            return
        }
        // Tier 0 (2026-08-21, real live feedback fix): the gated,
        // topologically-ordered Chapter Library pipeline, checked BEFORE
        // any of the three older tiers below. This is the actual fix for
        // "why does asking Jesse never find the real content" - the three
        // tiers below predate this pipeline entirely and never checked it.
        // 2026-08-25: the lookup itself now usually already ran during the
        // clarifying question (`startLibraryProbe`), so this await is
        // near-instant on the happy path; and a matched book that is THIN
        // (no sims, only a few short sections - the exact shape of the
        // founder's "no sims, no proper writings" U.S. History report) no
        // longer short-circuits delivery: it's held as a fallback while
        // the real generation pipeline builds a proper book with sims.
        var thinFallback: (book: AssembledBook, focusConceptIds: Set<String>?)?
        if let (book, focusConceptIds) = await consumeLibraryProbe(topic: topic) {
            let sections = book.chapters.flatMap(\.sections)
            let hasSims = sections.contains { !($0.simHtml ?? "").isEmpty }
            if hasSims || sections.count >= 8 {
                print("[JesseDebug] Tier-0 MATCHED book.title=\"\(book.title)\" book.subjectId=\(book.subjectId) focus=\(focusConceptIds?.count.description ?? "whole book") for topic=\"\(topic)\"")
                guard isActive else { return }
                pendingLearnTopic = nil
                openedChapterBook = book
                openedChapterBookGenerationInfo = nil
                openedChapterBookFocusConceptIds = focusConceptIds
                syncWorkDashboardLesson(from: book, source: .archive(bookTitle: book.title))
                let relevantSections = sections.filter {
                    focusConceptIds == nil || focusConceptIds!.contains($0.conceptId)
                }
                let sectionTitles = relevantSections.map(\.title)
                if focusConceptIds != nil {
                    await deliver("Found it - \(sectionTitles.joined(separator: ", ")), from \(book.title).", prefs: prefs)
                } else {
                    await deliver("Found it in the library - \(book.title), \(book.coverageLabel): \(sectionTitles.joined(separator: ", ")).", prefs: prefs)
                }
                return
            }
            print("[JesseDebug] Tier-0 match \"\(book.title)\" is THIN (\(sections.count) sections, sims=\(hasSims)) - holding as fallback, building fresh")
            thinFallback = (book, focusConceptIds)
        }
        let loweredTopic = topic.lowercased()
        // Real, matched interactive MicroSims (Dan McCreary's, licensed
        // for commercial use via MindCraft's advisor relationship with
        // him - 2026-08-18) - checked once, attached to whichever branch
        // below actually produces a lesson, since they're additive to any
        // source, not a fourth competing archive.
        let microsims = MicroSimLoader.matching(topic: topic)
        let microsimNote = microsims.isEmpty ? "" : " I also found \(microsims.count) interactive simulation\(microsims.count == 1 ? "" : "s") you can play with."

        if let match = BookGraphLoader.all.first(where: { book in
            Self.topicWordsMatch(loweredTopic, book.title.lowercased())
                || book.concepts.contains { Self.topicWordsMatch(loweredTopic, $0.label.lowercased()) }
        }) {
            let chapters = Array(match.concepts.prefix(6).map(\.label))
            guard isActive else { return }
            pendingLearnTopic = nil
            workDashboardLesson = WorkDashboardLesson(
                topic: topic,
                source: .archive(bookTitle: match.title),
                chapters: chapters,
                chapterBodies: [],
                definition: "Found in your archive: \(match.title).",
                question: nil,
                microsims: microsims,
                citations: []
            )
            await deliver("Good news - I already have \(match.title) in your archive. Here's the table of contents: \(chapters.joined(separator: ", ")).\(microsimNote)", prefs: prefs)
            return
        }

        // Tier 2 relevance gate (2026-08-25 - THE root cause of the
        // founder's "asked for US History, got History of Hydroponics
        // Timeline" report, confirmed by reproducing it live in a scripted
        // run of this exact flow): ArchiveRagClient's retrieval is loose
        // semantic search over Dan's real archive, and for a topic the
        // archive doesn't cover at all it still confidently returns its
        // nearest neighbors - "US History" pulled "Hydroponics: From
        // Mason Jar to Vertical Farm / History of Hydroponics Timeline"
        // on nothing but the shared word "history", and this branch used
        // to trust ANY non-empty hit list as a real lesson. Hits are now
        // kept only when their book or page title genuinely word-matches
        // the topic; an all-off-topic answer falls through to real
        // generation instead of dressing an unrelated book up as the
        // lesson.
        if let answer = await ArchiveRagClient.askDetailed(message: "Give me a short table of contents for \(topic)", studentWeakness: studentWeakness),
           !answer.hits.isEmpty {
            let relevantHits = answer.hits.filter {
                Self.topicWordsMatch(topic, $0.bookTitle) || Self.topicWordsMatch(topic, $0.pageTitle)
            }
            if relevantHits.isEmpty {
                print("[JesseDebug] Tier-2 archive hits REJECTED as off-topic for \"\(topic)\": \(answer.hits.map { "\($0.bookTitle) / \($0.pageTitle)" })")
            } else {
                guard isActive else { return }
                pendingLearnTopic = nil
                var seenTitles = Set<String>()
                let chapters = relevantHits.compactMap { hit -> String? in
                    guard seenTitles.insert(hit.pageTitle).inserted else { return nil }
                    return hit.pageTitle
                }
                workDashboardLesson = WorkDashboardLesson(
                    topic: topic,
                    source: .archive(bookTitle: relevantHits[0].bookTitle),
                    chapters: chapters,
                    chapterBodies: [],
                    definition: answer.reply,
                    question: nil,
                    microsims: microsims,
                    citations: relevantHits.map { LessonCitation(bookTitle: $0.bookTitle, pageTitle: $0.pageTitle, url: $0.pageUrl) }
                )
                await deliver(answer.reply + microsimNote, prefs: prefs)
                return
            }
        }

        // Real fix, 2026-08-21, closing the actual reported gap: "the
        // generated content has no text or preloaded simulations... I
        // want to see results like [the photosynthesis sim] across the
        // board, no matter what I want to study." This was the old thin
        // fallback (a single raw, ungated outline call, zero sims) - now
        // tried FIRST is the real, gated, multi-chapter pipeline
        // (BookGenerationClient -> /generate-book -> the same
        // generate/gate/assemble machinery the overnight cron uses on an
        // ad-hoc decomposed graph). Verified live on the exact topic that
        // produced garbage before this: 3 gate-passed chapters, 2 real
        // embedded sims, ~4 minutes, $3.60.
        print("[JesseDebug] No rich Tier-0 match for topic=\"\(topic)\" - kicking off BACKGROUND BookGenerationClient")
        // 2026-08-25 redesign ("it needs time to create sims anyways so
        // this background is perfect for generating during"): the Tier-3
        // build no longer holds the entire conversation hostage behind
        // `isThinking` for its multi-minute run - it kicks off here, the
        // conversational turn returns immediately (mic free, student can
        // keep talking), `generationProgress` carries live chapter counts
        // for the Gurukul orb, and delivery lands whenever it lands,
        // followed by the auto hang-up.
        learnDeliveryGeneration += 1
        let delivery = learnDeliveryGeneration
        pendingLearnTopic = nil
        generationProgress = BookGenerationProgress(topic: topic, chaptersReady: 0, totalChapters: 0)
        var ack: String
        if prefs.wantsSims {
            ack = "On it - building \(topic) with interactive sims front and center."
        } else if prefs.wantsVocal {
            ack = "On it - I'll put \(topic) together and then talk you through it."
        } else if prefs.wantsReading {
            ack = "On it - putting together a proper \(topic) read, with sims where they genuinely help."
        } else {
            ack = "Nothing ready-made in the library for \(topic) - building you a real lesson with sims, not just an outline."
        }
        if let level = prefs.levelNote {
            ack += level == "intro" ? " Keeping it beginner-friendly." : " Going deep."
        }
        ack += " It takes a few minutes - keep talking to me meanwhile if you like."
        await sayToStudent(ack + microsimNote)
        let fallback = thinFallback
        Task { [weak self] in
            await self?.runBackgroundBookGeneration(topic: topic, grade: grade, prefs: prefs, delivery: delivery, thinFallback: fallback, microsims: microsims, microsimNote: microsimNote)
        }
    }

    /// The Tier-3 book build, detached from the conversational turn that
    /// requested it (2026-08-25 redesign). Every state write is guarded by
    /// `delivery == learnDeliveryGeneration`, so a topic switch mid-build
    /// drops this run's result instead of stomping the newer request.
    /// Deliberately does NOT require the call to still be active at
    /// delivery time - the line hanging up (or the student leaving the
    /// screen) while a build runs is the NORMAL flow now, and the finished
    /// book landing in the transcript + lesson state is what they come
    /// back to.
    private func runBackgroundBookGeneration(topic: String, grade: Int?, prefs: LearnPreferences, delivery: Int, thinFallback: (book: AssembledBook, focusConceptIds: Set<String>?)?, microsims: [MicroSimRecord], microsimNote: String) async {
        let onProgress: (Int, Int) -> Void = { [weak self] ready, total in
            Task { @MainActor in
                guard let self, delivery == self.learnDeliveryGeneration, total > 0 else { return }
                self.generationProgress = BookGenerationProgress(topic: topic, chaptersReady: ready, totalChapters: total)
                // Spoken pacing survives ONLY off the Gurukul surface (the
                // dashboard's own Answer-box flow has no orb to watch);
                // Gurukul shows the same numbers visually instead of
                // interrupting the conversation every poll.
                if !self.studyCompanionPresented, ready > self.lastSpokenGenerationReady {
                    self.lastSpokenGenerationReady = ready
                    Task { await self.speak("Still building - \(ready) of \(total) chapters done.") }
                }
            }
        }
        lastSpokenGenerationReady = 0
        var bookVerdict = await BookGenerationClient.generate(topic: topic, onProgress: onProgress)
        print("[JesseDebug] First BookGenerationClient attempt verdict=\(Self.debugDescribe(bookVerdict))")
        if case .unavailable = bookVerdict, delivery == learnDeliveryGeneration {
            // One retry before falling back - real live bug, 2026-08-21:
            // `.unavailable` fires on ANY connection hiccup (one bad
            // network moment, a cold start) and a single transient blip
            // silently downgraded the whole experience to the old sim-less
            // outline. A second attempt is cheap insurance; the fallbacks
            // below stay the real last resort for a sustained outage.
            lastSpokenGenerationReady = 0
            bookVerdict = await BookGenerationClient.generate(topic: topic, onProgress: onProgress)
            print("[JesseDebug] Retry BookGenerationClient attempt verdict=\(Self.debugDescribe(bookVerdict))")
        }
        guard delivery == learnDeliveryGeneration else { return }
        generationProgress = nil
        switch bookVerdict {
        case .verified(let book, let cached, let costUsd, let elapsedSeconds):
            openedChapterBook = book
            // nil for a cache hit - nothing was actually generated for THIS
            // student just now, so a "generated in 3m42s, $3.60" badge would
            // be a real lie, not a rounding error.
            openedChapterBookGenerationInfo = cached ? nil : ChapterBookGenerationInfo(costUsd: costUsd, elapsedSeconds: elapsedSeconds)
            // Whole-book focus (nil) - this book was generated specifically
            // FOR this topic, so every section it returned is relevant.
            openedChapterBookFocusConceptIds = nil
            syncWorkDashboardLesson(from: book, source: .generated)
            let sectionTitles = book.chapters.flatMap(\.sections).map(\.title)
            Task { await LessonGraphIngestClient.ingest(topic: topic, chapterTitles: sectionTitles) }
            await deliver("Done - \(book.title): \(sectionTitles.joined(separator: ", ")).", prefs: prefs)
        case .noGoodResult(let reason):
            // A REAL outcome (the gate genuinely didn't clear) - but a
            // thin REAL library book, when one matched earlier, beats
            // empty-handed: it's genuine gated content, just honestly
            // labeled as the thin thing it is.
            if let thin = thinFallback {
                await deliverThinFallback(thin, topic: topic, prefs: prefs, note: "the generator couldn't clear the quality gate on a fresh build")
                return
            }
            clearLessonStates()
            pendingLearnTopic = topic // "try again" re-attaches to this topic
            await sayToStudent("I couldn't build a good enough lesson on that just now" + (reason.map { " - \($0)" } ?? "") + ". Want to try rephrasing it?")
        case .rateLimited(let reason):
            if let thin = thinFallback {
                await deliverThinFallback(thin, topic: topic, prefs: prefs, note: "I've hit today's generation limit")
                return
            }
            clearLessonStates()
            pendingLearnTopic = topic
            await sayToStudent("I've hit today's generation limit - \(reason ?? "try again tomorrow").")
        case .unavailable:
            if let thin = thinFallback {
                await deliverThinFallback(thin, topic: topic, prefs: prefs, note: "the generation service is unreachable right now")
                return
            }
            await deliverOutlineFallback(topic: topic, grade: grade, prefs: prefs, delivery: delivery, microsims: microsims, microsimNote: microsimNote)
        }
    }

    /// A thin (sim-less, few-section) Tier-0 library match, served only
    /// after a fresh build genuinely couldn't do better - honestly labeled,
    /// never passed off as the rich thing the student asked for.
    private func deliverThinFallback(_ thin: (book: AssembledBook, focusConceptIds: Set<String>?), topic: String, prefs: LearnPreferences, note: String) async {
        openedChapterBook = thin.book
        openedChapterBookGenerationInfo = nil
        openedChapterBookFocusConceptIds = thin.focusConceptIds
        syncWorkDashboardLesson(from: thin.book, source: .archive(bookTitle: thin.book.title))
        let sectionTitles = thin.book.chapters.flatMap(\.sections).map(\.title)
        await deliver("Heads up - \(note), but I do have a real (if thin) \(thin.book.title) in the library: \(sectionTitles.joined(separator: ", ")). Opening that for now - ask me again later for the fuller version.", prefs: prefs)
    }

    /// The old raw-outline last resort (server-side, platform-funded -
    /// see 2026-08-21 notes), now reached only when the rich pipeline is
    /// genuinely unreachable AND no library fallback exists.
    private func deliverOutlineFallback(topic: String, grade: Int?, prefs: LearnPreferences, delivery: Int, microsims: [MicroSimRecord], microsimNote: String) async {
        let known = Array(Set(SampleQuestion.all.map(\.conceptId)))
        let result = await LessonOutlineClient.generate(topic: topic, knownConceptIds: known, grade: grade)
        guard delivery == learnDeliveryGeneration else { return }
        switch result {
        case .success(let outline):
            workDashboardLesson = WorkDashboardLesson(
                topic: topic,
                source: .generated,
                chapters: outline.chapters,
                chapterBodies: outline.chapterBodies ?? [],
                definition: outline.definition,
                question: outline.question,
                microsims: microsims,
                citations: []
            )
            // Fire-and-forget concept-graph tagging, same as the rich path.
            Task { await LessonGraphIngestClient.ingest(topic: topic, chapterTitles: outline.chapters) }
            await deliver("Here's a quick outline for \(topic) while the fuller version isn't available: \(outline.chapters.joined(separator: ", ")).\(microsimNote)", prefs: prefs)
        case .failure(.notSignedIn):
            // Failure must look like a failure - see 2026-08-21's "keeps
            // defaulting to calculus" root cause; nil lesson states, honest
            // message, topic kept pending so "try again" works.
            workDashboardLesson = nil
            pendingLearnTopic = topic
            await sayToStudent("You'll need to be signed in before I can put a lesson together on \(topic).")
        case .failure(.rateLimited(let reason)):
            workDashboardLesson = nil
            pendingLearnTopic = topic
            await sayToStudent("I've hit today's generation limit - \(reason)")
        case .failure(.failed):
            workDashboardLesson = nil
            pendingLearnTopic = topic
            await sayToStudent("I couldn't put a lesson together on that just now - try again in a bit?")
        }
    }

    /// Both lesson-state slots, cleared together - a failure must never
    /// leave stale content on screen (the "keeps defaulting to X" bug
    /// class, 2026-08-21).
    private func clearLessonStates() {
        workDashboardLesson = nil
        openedChapterBook = nil
        openedChapterBookGenerationInfo = nil
        openedChapterBookFocusConceptIds = nil
    }

    /// Posts (or, for a "talk me through it" preference, SPEAKS) the
    /// delivery line, then closes the voice line - the bug-#3 fix
    /// (2026-08-25, verbatim: "Jesse should stop being on the line after
    /// showing me the text it wants me to see btw everywhere"). A spoken
    /// walkthrough deliberately stays on the line - hanging up mid-
    /// walkthrough would cut off the very thing the student asked for.
    private func deliver(_ text: String, prefs: LearnPreferences) async {
        if prefs.wantsVocal {
            await speak(text)
        } else {
            postText(text)
            hangUpAfterDelivery()
        }
    }

    /// See `deliver` - `end()` keeps the transcript and every lesson slot
    /// intact (it only tears down the live audio session), so the student
    /// loses nothing; tapping the mic or typing re-opens the line via
    /// `begin(quiet: true)`.
    private func hangUpAfterDelivery() {
        guard isActive else { return }
        print("[JesseDebug] hangUpAfterDelivery - closing the line after content delivery")
        _ = end()
    }

    /// Generation grounded in the student's own upload, not the archive
    /// (2026-08-18, explicit ask - see `askJesseWorkDashboard`'s doc
    /// comment on `materialsContext`). Real MicroSims are still attached
    /// if any match the topic - additive to any source, same as the
    /// archive/generation branches above.
    private func generateFromMaterials(topic: String, materials: (fileName: String, cardSummaries: [String]), grade: Int? = nil, prefs: LearnPreferences = LearnPreferences()) async {
        let microsims = MicroSimLoader.matching(topic: topic)
        let microsimNote = microsims.isEmpty ? "" : " I also found \(microsims.count) interactive simulation\(microsims.count == 1 ? "" : "s") you can play with."
        let known = Array(Set(SampleQuestion.all.map(\.conceptId)))
        let reference = materials.cardSummaries.joined(separator: "\n")
        // Same server-side, platform-funded switch as askJesseWorkDashboard
        // above - see that call site's doc comment for why.
        let result = await LessonOutlineClient.generate(topic: topic, knownConceptIds: known, referenceMaterial: reference, grade: grade)
        guard isActive else { return }
        switch result {
        case .success(let outline):
            pendingLearnTopic = nil
            workDashboardLesson = WorkDashboardLesson(
                topic: topic,
                source: .generated,
                chapters: outline.chapters,
                chapterBodies: outline.chapterBodies ?? [],
                definition: outline.definition,
                question: outline.question,
                microsims: microsims,
                citations: []
            )
            // Same fire-and-forget tagging as the archive-generation path above.
            Task { await LessonGraphIngestClient.ingest(topic: topic, chapterTitles: outline.chapters) }
            await deliver("Built this from \(materials.fileName): \(outline.chapters.joined(separator: ", ")).\(microsimNote)", prefs: prefs)
        case .failure(.notSignedIn):
            workDashboardLesson = nil
            await sayToStudent("You'll need to be signed in before I can build a lesson from \(materials.fileName).")
        case .failure(.rateLimited(let reason)):
            workDashboardLesson = nil
            await sayToStudent("I've hit today's generation limit - \(reason)")
        case .failure(.failed):
            workDashboardLesson = nil
            await sayToStudent("I couldn't put a lesson together from that just now - try again in a bit?")
        }
    }

    // MARK: - Live gated generation (closed test, LIVE_GATED_GENERATION_TEST_SPEC.md)

    /// One student request -> at most TWO billed generation attempts: the
    /// asked topic, plus one automatic adjacent-angle retry if (and only
    /// if) the pipeline's own skip reasoning suggested a narrower angle
    /// (e.g. "too broad an umbrella" -> a concrete sub-topic). The retry
    /// mirrors the spec's option of using the skip message's own
    /// information before telling the student it didn't work - and stops
    /// there, because at the real 1/10-6/10 yield an unbounded retry loop
    /// is an unbounded bill.
    ///
    /// `isThinking` wraps the whole round trip - deliberately the same
    /// mechanism as every other Jesse generation (see `liveSimState`'s doc
    /// comment), so every existing thinking indicator lights up without a
    /// second loading system.
    func requestLiveGatedSim(topic: String) async {
        guard LiveGatedGeneration.isEnabled else { return }
        if case .running = liveSimState { return } // one request at a time
        let generation = liveSimGeneration
        isThinking = true
        defer { isThinking = false }

        liveSimState = .running(topic: topic, attemptTopic: nil)
        let verdict = await GeneratedSimClient.requestSim(topic: topic)
        guard generation == liveSimGeneration else { return }

        switch verdict {
        case .verified(let result, let cached):
            liveSimState = .verified(result, topic: topic, cached: cached)
        case .rateLimited(let reason):
            liveSimState = .rateLimited(topic: topic, reason: reason)
        case .unavailable(let note):
            liveSimState = .unavailable(topic: topic, note: note)
        case .noGoodResult(let reason, let suggestedRetryTopic):
            guard let retryTopic = suggestedRetryTopic, !retryTopic.isEmpty else {
                liveSimState = .noGoodResult(topic: topic, reason: reason, alsoTried: nil)
                return
            }
            liveSimState = .running(topic: topic, attemptTopic: retryTopic)
            let second = await GeneratedSimClient.requestSim(topic: retryTopic)
            guard generation == liveSimGeneration else { return }
            switch second {
            case .verified(let result, let cached):
                liveSimState = .verified(result, topic: topic, cached: cached)
            case .noGoodResult(let secondReason, _):
                // No third attempt even if the retry suggests yet another
                // angle - the second reason is usually the more specific
                // one, so it leads.
                liveSimState = .noGoodResult(topic: topic, reason: secondReason ?? reason, alsoTried: retryTopic)
            case .rateLimited, .unavailable:
                // The retry being blocked by budget/infra isn't the
                // student's answer - the first attempt's honest reason is.
                liveSimState = .noGoodResult(topic: topic, reason: reason, alsoTried: nil)
            }
        }
    }

    /// Called when the Study Session showing this state closes. Bumps the
    /// generation counter so an in-flight request's eventual verdict is
    /// dropped instead of resurrecting state for a dismissed lesson.
    func clearLiveSimState() {
        liveSimGeneration += 1
        liveSimState = nil
    }

    /// Test-only seam, same shape as `seedWorkDashboardLessonForTesting`:
    /// a real verdict needs the deployed generation service (deliberately
    /// not deployed - see LiveGatedGeneration) plus a 60s+ round trip,
    /// neither available in the UI-testing harness. Only ever called from
    /// `DeskGridDashboardView`'s `--ui-testing-*`-gated seed hook.
    func seedLiveSimStateForTesting(_ state: LiveSimState) {
        liveSimState = state
    }

    /// Test-only seam for the Gurukul orb's build state - a real
    /// `generationProgress` needs a signed-in student plus a live
    /// multi-minute `/generate-book` job, neither available in the
    /// harness. Only ever called from the `--ui-testing-gurukul-building`
    /// seed hook.
    func seedGenerationProgressForTesting(_ progress: BookGenerationProgress?) {
        generationProgress = progress
    }

    // MARK: - Persistence

    private static let turnsKey = "jesseCall.turns"
    private static let maxStoredTurns = 60

    private static func loadTurns() -> [JesseCallTurn] {
        guard let data = UserDefaults.standard.data(forKey: turnsKey),
              let decoded = try? JSONDecoder().decode([JesseCallTurn].self, from: data)
        else { return [] }
        return decoded
    }

    private static func saveTurns(_ turns: [JesseCallTurn]) {
        let capped = turns.count > maxStoredTurns ? Array(turns.suffix(maxStoredTurns)) : turns
        guard let data = try? JSONEncoder().encode(capped) else { return }
        UserDefaults.standard.set(data, forKey: turnsKey)
    }

    // `WorkDashboardLesson` itself stays Equatable-only (not Codable) - it
    // isn't retrofitted here because `microsims: [MicroSimRecord]` carries
    // full extracted sim file contents (`files: [String: String]`, real
    // HTML/JS bodies) that would bloat UserDefaults for no reason; they're
    // cheaply re-derived from `topic` via `MicroSimLoader.matching` on
    // restore instead of persisted. `PersistedLesson` is the thin, real
    // Codable mirror of everything that actually needs to survive.
    private struct PersistedLesson: Codable {
        let topic: String
        let sourceIsArchive: Bool
        let sourceBookTitle: String?
        let chapters: [String]
        let chapterBodies: [String]
        let definition: String
        let question: String?
        let citationBookTitles: [String]
        let citationPageTitles: [String]
        let citationURLs: [String]
        /// When this lesson was persisted - optional so blobs saved before
        /// this field existed still decode (they're treated as expired,
        /// which is exactly right: they're by definition older than any
        /// build that writes the stamp). Real bug this expires (2026-08-25,
        /// founder live report: lessons "seem preloaded"): a "History of
        /// Hydroponics" lesson persisted during 2026-08-18 dev testing was
        /// still being greeted with "pick up where you left off" a week
        /// later - unbounded persistence turns every abandoned dev/test
        /// topic into a permanent ghost. 48h keeps the real fix this
        /// persistence exists for (2026-08-21's "open the lesson it built"
        /// working across a same-day relaunch) while letting genuinely old
        /// state die.
        var savedAt: Date?

        init(_ lesson: WorkDashboardLesson) {
            savedAt = Date()
            topic = lesson.topic
            switch lesson.source {
            case .archive(let bookTitle): sourceIsArchive = true; sourceBookTitle = bookTitle
            case .generated: sourceIsArchive = false; sourceBookTitle = nil
            }
            chapters = lesson.chapters
            chapterBodies = lesson.chapterBodies
            definition = lesson.definition
            question = lesson.question
            citationBookTitles = lesson.citations.map(\.bookTitle)
            citationPageTitles = lesson.citations.map(\.pageTitle)
            citationURLs = lesson.citations.map(\.url)
        }

        func restored() -> WorkDashboardLesson {
            let citations = zip(zip(citationBookTitles, citationPageTitles), citationURLs).map {
                LessonCitation(bookTitle: $0.0, pageTitle: $0.1, url: $1)
            }
            return WorkDashboardLesson(
                topic: topic,
                source: sourceIsArchive ? .archive(bookTitle: sourceBookTitle ?? "") : .generated,
                chapters: chapters,
                chapterBodies: chapterBodies,
                definition: definition,
                question: question,
                microsims: MicroSimLoader.matching(topic: topic),
                citations: citations
            )
        }
    }

    private static let persistedLessonKey = "jesseCall.workDashboardLesson"
    /// See `PersistedLesson.savedAt` - the window inside which "pick up
    /// where you left off" is a plausible thing to say about a lesson.
    private static let persistedLessonMaxAge: TimeInterval = 48 * 60 * 60

    private static func loadPersistedLesson() -> WorkDashboardLesson? {
        guard let data = UserDefaults.standard.data(forKey: persistedLessonKey),
              let decoded = try? JSONDecoder().decode(PersistedLesson.self, from: data)
        else { return nil }
        guard let savedAt = decoded.savedAt, Date().timeIntervalSince(savedAt) < persistedLessonMaxAge else {
            UserDefaults.standard.removeObject(forKey: persistedLessonKey)
            return nil
        }
        return decoded.restored()
    }

    private static func savePersistedLesson(_ lesson: WorkDashboardLesson?) {
        guard let lesson else {
            UserDefaults.standard.removeObject(forKey: persistedLessonKey)
            return
        }
        guard let data = try? JSONEncoder().encode(PersistedLesson(lesson)) else { return }
        UserDefaults.standard.set(data, forKey: persistedLessonKey)
    }

    /// See `resumeDraft`'s own doc comment. No max-age expiry unlike the
    /// lesson above - a resume profile doesn't go stale after 48 hours the
    /// way "pick up where you left off" framing would for a lesson;
    /// `ResumeAgentDraft` is already `Codable`, no wrapper struct needed.
    private static let persistedResumeDraftKey = "jesseCall.resumeDraft"

    private static func loadPersistedResumeDraft() -> ResumeAgentDraft? {
        guard let data = UserDefaults.standard.data(forKey: persistedResumeDraftKey) else { return nil }
        return try? JSONDecoder().decode(ResumeAgentDraft.self, from: data)
    }

    private static func savePersistedResumeDraft(_ draft: ResumeAgentDraft?) {
        guard let draft else {
            UserDefaults.standard.removeObject(forKey: persistedResumeDraftKey)
            return
        }
        guard let data = try? JSONEncoder().encode(draft) else { return }
        UserDefaults.standard.set(data, forKey: persistedResumeDraftKey)
    }
}

extension JesseCallSession: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
            // Auto-listen the moment Jesse finishes talking (2026-08-19,
            // explicit ask: "it should... automatically listen to the
            // speaker instead of having them press the voice button every
            // time"). startListening() already no-ops if the call ended or
            // something else started listening first (guard isActive,
            // !isPaused, !isListening, !isThinking), so this is safe to
            // call unconditionally on a normal finish.
            self.startListening()
        }
    }

    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }
}

extension JesseCallSession: AVAudioPlayerDelegate {
    nonisolated func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in
            self.isSpeaking = false
            self.startListening()
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }
}
