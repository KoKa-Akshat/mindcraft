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
struct WorkDashboardLesson: Equatable {
    enum Source: Equatable {
        case archive(bookTitle: String)
        case generated
    }
    let topic: String
    let source: Source
    let chapters: [String]
    let definition: String
    let question: String?
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
    /// Work Dashboard's "I want to learn X" flow (2026-08-18) - set only
    /// while `context == "workDashboard"`, after a real archive check
    /// (`BookGraphLoader`) or generation call (see
    /// `askJesseWorkDashboard`). Reset in `begin()`, same as the other
    /// per-context state above.
    @Published private(set) var workDashboardLesson: WorkDashboardLesson?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
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

    func begin(context: String, studentWeakness: (conceptId: String, label: String)? = nil) {
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
        if context == "workDashboard" {
            workDashboardLesson = nil
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
    /// network call fails (offline, cold container timeout) - so the call
    /// keeps talking either way, just less naturally on the fallback path.
    /// `speakGeneration` guards against a slow Kokoro response landing
    /// after the student has since paused or ended the call.
    private func speak(_ text: String, voice: KokoroVoice = .heart) async {
        guard !isPaused, !isAmbient else { return }
        turns.append(JesseCallTurn(id: UUID().uuidString, speaker: "jesse", text: text, at: Date()))
        configureAudioSession()

        let generation = speakGeneration
        if let wav = await KokoroTTSClient.synthesize(text: text, voice: voice) {
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
        utterance.voice = AVSpeechSynthesisVoice(language: "en-US")
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
        // Explicit ask (2026-08-18): "when i said i want to learn calculus
        // it should now check the archive for lessons on it... create a
        // lesson plan." Only intercepts genuine "I want to learn X"-shaped
        // phrasing - anything else on this context (e.g. "what's my next
        // assignment") falls through to the same generic briefing path as
        // before this feature existed, unchanged.
        if context == "workDashboard", let topic = Self.extractLearnTopic(from: message) {
            await askJesseWorkDashboard(topic: topic)
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
    private static func extractLearnTopic(from message: String) -> String? {
        let leadIns = [
            "i want to learn ", "i want to study ", "help me learn ", "help me study ",
            "teach me ", "i'd like to learn ", "i would like to learn ",
            "can you teach me ", "let's learn ", "lets learn ",
        ]
        let lowered = message.lowercased()
        for leadIn in leadIns where lowered.hasPrefix(leadIn) {
            let topic = String(message.dropFirst(leadIn.count)).trimmingCharacters(in: .whitespacesAndNewlines)
            return topic.isEmpty ? nil : topic
        }
        return nil
    }

    /// "Check the archive for lessons on it, extract things, create a
    /// lesson plan" - real bundled book concept graphs
    /// (`BookGraphLoader.all`, the same data Learn Studio's "Study a Book"
    /// already browses) are checked FIRST, honestly, before ever
    /// generating anything. Most topics (e.g. "calculus") won't match any
    /// of the handful of bundled books - that's the expected, honest
    /// outcome, not a bug, and falls through to a real generation call
    /// instead of pretending archived material exists.
    private func askJesseWorkDashboard(topic: String) async {
        let loweredTopic = topic.lowercased()
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
                definition: "Found in your archive: \(match.title).",
                question: nil
            )
            await speak("Good news - I already have \(match.title) in your archive. Here's the table of contents: \(chapters.joined(separator: ", ")).")
            return
        }

        let known = Array(Set(SampleQuestion.all.map(\.conceptId)))
        let result = await StudentAIKeyStore.shared.generateTableOfContents(topic: topic, knownConceptIds: known)
        guard isActive else { return }
        switch result {
        case .success(let outline):
            workDashboardLesson = WorkDashboardLesson(
                topic: topic,
                source: .generated,
                chapters: outline.chapters,
                definition: outline.definition,
                question: outline.question
            )
            await speak("Nothing in the archive yet for \(topic), so I put together a fresh outline: \(outline.chapters.joined(separator: ", ")).")
        case .failure(.noKey):
            await speak("You'll need to connect an AI key in Settings before I can put a lesson together on \(topic).")
        case .failure(.rejected):
            await speak("That AI key isn't working right now. Check it in Settings?")
        case .failure(.unavailable):
            await speak("I couldn't put a lesson together on that just now - try again in a bit?")
        }
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
}

extension JesseCallSession: AVSpeechSynthesizerDelegate {
    nonisolated func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        Task { @MainActor in
            self.isSpeaking = false
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
        }
    }

    nonisolated func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in
            self.isSpeaking = false
        }
    }
}
