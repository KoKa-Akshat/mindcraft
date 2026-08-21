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
    /// the student talks. Reset in `begin()`.
    @Published private(set) var resumeDraft: ResumeAgentDraft?
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

    func begin(context: String, studentWeakness: (conceptId: String, label: String)? = nil, studentName: String = "there") {
        guard !isActive else { return }
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
        if context == "resume" {
            resumeDraft = nil
        }
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
            // Real voice greeting on arrival (2026-08-18, explicit ask:
            // "the first thing you should do is say hi Akshat what can I
            // help you study today - it says nothing, it's waiting for
            // my input"). A narrow, context-gated `speak()` call before
            // any listening starts - not a generalized entry point (see
            // CURSOR_HANDOFF.md Assignment J's own note on this).
            //
            // Context-aware as of 2026-08-21, same live feedback: a
            // student who was mid-lesson two minutes ago heard the exact
            // same cold-open line as a first-ever visit - "Say something
            // like, Welcome back! Would you like to pick up learning
            // something, or something new?" A restored/still-in-memory
            // lesson is real, available evidence of what to say instead
            // of guessing at a "personalized" greeting with nothing behind
            // it.
            if let lesson = workDashboardLesson {
                Task { await speak("Welcome back \(studentName) - want to keep going with \(lesson.topic), or start something new?") }
            } else {
                Task { await speak("Hi \(studentName), what would you like to learn today?") }
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

    // MARK: - Listening

    func startListening() {
        guard isActive, !isPaused, !isListening, !isThinking else { return }
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
            if let freshTopic = Self.extractLearnTopic(from: message) {
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
            guard isActive else { isThinking = false; return }
            await speak("Here's what we built on \(lesson.topic) - \(lesson.chapters.joined(separator: ", ")).")
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
            await speak("On it - opening Practice now.")
            practiceRequested = true
            isThinking = false
            return
        }

        let bus = DeskBoxBus.shared
        if let local = bus.directAnswer(for: message) {
            guard isActive else { isThinking = false; return }
            await speak(local)
            isThinking = false
            return
        }
        let briefing = bus.briefing()
        let composed = briefing.isEmpty
            ? message
            : briefing + "\n\nStudent said: " + message
        let reply = await ArchiveRagClient.ask(message: composed, studentWeakness: studentWeakness)
        // isThinking stays true through speech generation too (Kokoro's own
        // network round-trip) rather than adding a separate UI state - the
        // call pill already reads "Jesse is thinking..." either way.
        guard isActive else { isThinking = false; return } // call may have ended while awaiting
        await speak(reply ?? "I didn't quite catch that. Try again?")
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
    /// mirrors the book workflow's `ask()`. `sources` stays empty here (see
    /// `ResumeAgentClient` doc comment) - this is the voice-only path;
    /// LinkedIn/Drive/PDF extraction are a separate, not-yet-native piece.
    private func askJesseResume(_ message: String) async {
        let draft = resumeDraft ?? .empty
        guard let result = await ResumeAgentClient.ask(message: message, draft: draft) else {
            guard isActive else { return }
            await speak("I couldn't reach the resume desk just now. Keep talking and I'll catch up.")
            return
        }
        guard isActive else { return }
        resumeDraft = result.draft
        await speak(result.reply)
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
    private static func matchChapterLibraryBook(topic: String) async -> AssembledBook? {
        let loweredTopic = topic.lowercased()
        guard let summaries = try? await BookLibraryClient.listBooks(),
              let match = summaries.first(where: { summary in
                  summary.title.lowercased().contains(loweredTopic) || loweredTopic.contains(summary.title.lowercased())
              })
        else { return nil }
        return try? await BookLibraryClient.getBook(subjectId: match.subjectId)
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

    /// First half of the "materials or go ahead?" exchange (2026-08-18,
    /// explicit live ask) - just asks and parks the topic, doesn't touch
    /// the archive or generate anything yet. `askJesseWorkDashboard` used
    /// to run this whole pipeline off the FIRST utterance a topic was
    /// recognized in, with no chance for the student to attach an upload
    /// first.
    private func askJesseWorkDashboardClarify(topic: String, grade: Int? = nil) async {
        pendingLearnTopic = topic
        pendingLearnGrade = grade
        await speak("Got it, \(topic). Want to upload any materials first, or should I just go ahead and build the lesson?")
    }

    /// Second half - interprets the student's answer to the question
    /// `askJesseWorkDashboardClarify` just asked. Deliberately permissive
    /// about what counts as "go ahead" (same lightweight keyword-check
    /// style already used elsewhere in this file, e.g.
    /// `mentionsDriveImport`) - a reply that matches neither pattern still
    /// proceeds rather than leaving the conversation stuck waiting
    /// forever on an ambiguous answer.
    private func askJesseWorkDashboardResume(topic: String, reply: String) async {
        pendingLearnTopic = nil
        let grade = pendingLearnGrade
        pendingLearnGrade = nil
        let lowered = reply.lowercased()
        let mentionsUpload = lowered.contains("upload") || lowered.contains("file") || lowered.contains("pdf")
            || lowered.contains("use that") || lowered.contains("use it") || lowered.contains("reference")
        let context = mentionsUpload ? latestHomeworkUpload : nil
        if mentionsUpload, context == nil {
            await speak("I don't see an upload yet - go ahead and tap Homework Help to add it, then tell me when it's there. Or just say go ahead and I'll build from what's available.")
            pendingLearnTopic = topic // still waiting - didn't fall through silently
            pendingLearnGrade = grade
            return
        }
        await askJesseWorkDashboard(topic: topic, materialsContext: context, grade: grade)
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
    private func askJesseWorkDashboard(topic: String, materialsContext: (fileName: String, cardSummaries: [String])? = nil, grade: Int? = nil) async {
        if let materialsContext {
            await generateFromMaterials(topic: topic, materials: materialsContext, grade: grade)
            return
        }
        // Tier 0 (2026-08-21, real live feedback fix): the gated,
        // topologically-ordered Chapter Library pipeline, checked BEFORE
        // any of the three older tiers below. This is the actual fix for
        // "why does asking Jesse never find the real content" - the three
        // tiers below predate this pipeline entirely and never checked it.
        // A student's spoken topic is matched against real book titles the
        // same loose-substring way BookGraphLoader matching already works
        // one tier down, so this doesn't need its own separate matching
        // strategy to reason about.
        if let book = await Self.matchChapterLibraryBook(topic: topic) {
            guard isActive else { return }
            openedChapterBook = book
            openedChapterBookGenerationInfo = nil
            syncWorkDashboardLesson(from: book, source: .archive(bookTitle: book.title))
            let sectionTitles = book.chapters.flatMap(\.sections).map(\.title)
            await speak("Found it in the library - \(book.title), \(book.coverageLabel): \(sectionTitles.joined(separator: ", ")).")
            return
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
            book.title.lowercased().contains(loweredTopic) || loweredTopic.contains(book.title.lowercased())
                || book.concepts.contains {
                    $0.label.lowercased().contains(loweredTopic) || loweredTopic.contains($0.label.lowercased())
                }
        }) {
            let chapters = Array(match.concepts.prefix(6).map(\.label))
            guard isActive else { return }
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
            await speak("Good news - I already have \(match.title) in your archive. Here's the table of contents: \(chapters.joined(separator: ", ")).\(microsimNote)")
            return
        }

        if let answer = await ArchiveRagClient.askDetailed(message: "Give me a short table of contents for \(topic)", studentWeakness: studentWeakness),
           !answer.hits.isEmpty {
            guard isActive else { return }
            var seenTitles = Set<String>()
            let chapters = answer.hits.compactMap { hit -> String? in
                guard seenTitles.insert(hit.pageTitle).inserted else { return nil }
                return hit.pageTitle
            }
            workDashboardLesson = WorkDashboardLesson(
                topic: topic,
                source: .archive(bookTitle: answer.hits[0].bookTitle),
                chapters: chapters,
                chapterBodies: [],
                definition: answer.reply,
                question: nil,
                microsims: microsims,
                citations: answer.hits.map { LessonCitation(bookTitle: $0.bookTitle, pageTitle: $0.pageTitle, url: $0.pageUrl) }
            )
            await speak(answer.reply + microsimNote)
            return
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
        await speak("Nothing in the archive yet for \(topic) - give me a bit, I'm putting together a real lesson with sims, not just an outline.\(microsimNote)")
        var lastSpokenChaptersReady = 0
        var bookVerdict = await BookGenerationClient.generate(topic: topic) { [weak self] ready, total in
            guard let self, total > 0, ready > lastSpokenChaptersReady else { return }
            lastSpokenChaptersReady = ready
            Task { await self.speak("Still building - \(ready) of \(total) chapters done.") }
        }
        if case .unavailable = bookVerdict {
            // One retry before falling back to the old thin path - real
            // live bug, 2026-08-21: asked for "chemical compounds," this
            // exact branch fired, and the student got the old sim-less
            // "About Chemical Compounds" outline this whole pipeline was
            // built to replace. `.unavailable` fires on ANY connection
            // hiccup (one bad network moment, a cold start) with no retry
            // today, so a single transient blip silently downgrades the
            // WHOLE experience - content-engine was confirmed healthy
            // moments after this report, consistent with exactly that. A
            // second attempt is cheap insurance against the common case;
            // the old path stays as the real last resort for a genuine
            // sustained outage.
            guard isActive else { return }
            lastSpokenChaptersReady = 0
            bookVerdict = await BookGenerationClient.generate(topic: topic) { [weak self] ready, total in
                guard let self, total > 0, ready > lastSpokenChaptersReady else { return }
                lastSpokenChaptersReady = ready
                Task { await self.speak("Still building - \(ready) of \(total) chapters done.") }
            }
        }
        guard isActive else { return }
        switch bookVerdict {
        case .verified(let book, let cached, let costUsd, let elapsedSeconds):
            openedChapterBook = book
            // nil for a cache hit - nothing was actually generated for THIS
            // student just now, so a "generated in 3m42s, $3.60" badge would
            // be a real lie, not a rounding error.
            openedChapterBookGenerationInfo = cached ? nil : ChapterBookGenerationInfo(costUsd: costUsd, elapsedSeconds: elapsedSeconds)
            syncWorkDashboardLesson(from: book, source: .generated)
            let sectionTitles = book.chapters.flatMap(\.sections).map(\.title)
            Task { await LessonGraphIngestClient.ingest(topic: topic, chapterTitles: sectionTitles) }
            await speak("Done - \(book.title): \(sectionTitles.joined(separator: ", ")).")
            return
        case .noGoodResult(let reason):
            // A REAL outcome (the gate genuinely didn't clear for this
            // topic), not masked by a silent fallback to the thin path -
            // that would hide a genuine quality signal behind fake
            // content, the exact opposite of the fix this is. Clears
            // BOTH lesson states, same "a failure must never leave stale
            // content on screen" discipline as the failure branches
            // below - this is a second, separate piece of state
            // (openedChapterBook) that's just as real a source of the
            // "keeps defaulting to X" bug class if left untouched here.
            workDashboardLesson = nil
            openedChapterBook = nil
            openedChapterBookGenerationInfo = nil
            await speak("I couldn't build a good enough lesson on that just now" + (reason.map { " - \($0)" } ?? "") + ". Want to try rephrasing it?")
            return
        case .rateLimited(let reason):
            workDashboardLesson = nil
            openedChapterBook = nil
            openedChapterBookGenerationInfo = nil
            await speak("I've hit today's generation limit - \(reason ?? "try again tomorrow").")
            return
        case .unavailable:
            // Only THIS branch falls through to the old thin path below -
            // the rich pipeline being genuinely unreachable (not yet
            // deployed, or a real outage) shouldn't leave a student with
            // nothing at all while it's the only realistic gap during
            // rollout.
            break
        }

        let known = Array(Set(SampleQuestion.all.map(\.conceptId)))
        // Server-side, platform-funded generation (2026-08-21) - was
        // StudentAIKeyStore (a personal bring-your-own-key call), real
        // fix for direct live feedback: this core "build me a lesson"
        // flow shouldn't need a student's own API key at all when the
        // platform already pays for generation elsewhere with the exact
        // same budget-capped pattern (generate-sim.ts). StudentAIKeyStore
        // itself is untouched and still real for homework help/study
        // plans, which are genuinely meant to be bring-your-own-key.
        let result = await LessonOutlineClient.generate(topic: topic, knownConceptIds: known, grade: grade)
        guard isActive else { return }
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
            // Fire-and-forget: tags this lesson into the live concept graph
            // (see CONTENT_GROWTH_PIPELINE.md). Never awaited - ontology
            // bookkeeping must not delay the student hearing their lesson,
            // and its own failure (a bad graph, a network blip) shouldn't
            // surface here; generation already succeeded.
            Task { await LessonGraphIngestClient.ingest(topic: topic, chapterTitles: outline.chapters) }
            await speak("Here's a quick outline for \(topic) while the fuller version isn't available: \(outline.chapters.joined(separator: ", ")).\(microsimNote)")
        case .failure(.notSignedIn):
            // Real bug, found via live testing 2026-08-21: this branch
            // never touched `workDashboardLesson`, so a failed generation
            // silently left whatever the LAST successful lesson was on
            // screen (e.g. Calculus from earlier testing) while Jesse
            // spoke an error nobody necessarily caught mid-conversation -
            // read as "it keeps defaulting to calculus" when it was
            // actually just never being replaced. Clearing it here (and
            // in the two cases below, and in generateFromMaterials's
            // matching switch) makes a failure look like a failure -
            // whatever view reads a nil workDashboardLesson already has
            // its own real "nothing yet" state, not a screen bug to fix.
            workDashboardLesson = nil
            await speak("You'll need to be signed in before I can put a lesson together on \(topic).")
        case .failure(.rateLimited(let reason)):
            workDashboardLesson = nil
            await speak("I've hit today's generation limit - \(reason)")
        case .failure(.failed):
            workDashboardLesson = nil
            await speak("I couldn't put a lesson together on that just now - try again in a bit?")
        }
    }

    /// Generation grounded in the student's own upload, not the archive
    /// (2026-08-18, explicit ask - see `askJesseWorkDashboard`'s doc
    /// comment on `materialsContext`). Real MicroSims are still attached
    /// if any match the topic - additive to any source, same as the
    /// archive/generation branches above.
    private func generateFromMaterials(topic: String, materials: (fileName: String, cardSummaries: [String]), grade: Int? = nil) async {
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
            await speak("Built this from \(materials.fileName): \(outline.chapters.joined(separator: ", ")).\(microsimNote)")
        case .failure(.notSignedIn):
            workDashboardLesson = nil
            await speak("You'll need to be signed in before I can build a lesson from \(materials.fileName).")
        case .failure(.rateLimited(let reason)):
            workDashboardLesson = nil
            await speak("I've hit today's generation limit - \(reason)")
        case .failure(.failed):
            workDashboardLesson = nil
            await speak("I couldn't put a lesson together from that just now - try again in a bit?")
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

        init(_ lesson: WorkDashboardLesson) {
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

    private static func loadPersistedLesson() -> WorkDashboardLesson? {
        guard let data = UserDefaults.standard.data(forKey: persistedLessonKey),
              let decoded = try? JSONDecoder().decode(PersistedLesson.self, from: data)
        else { return nil }
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
