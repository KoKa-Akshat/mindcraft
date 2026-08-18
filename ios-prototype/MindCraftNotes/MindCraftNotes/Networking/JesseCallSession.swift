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

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private let synthesizer = AVSpeechSynthesizer()
    private var audioPlayer: AVAudioPlayer?
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?
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

        // Learn Studio (Assignment G) drives its own real study-plan
        // machinery instead of the generic archive-RAG path below - see
        // askJesseLearnStudio's doc comment. Checked before the Work
        // dashboard's DeskBoxBus briefing on purpose: that briefing ("the
        // Work boxes are helpers, quote them") is specific to the Work
        // dashboard and would be actively wrong context to inject into a
        // study-plan conversation happening on a different screen entirely.
        if context == "learnStudio" {
            await askJesseLearnStudio(message)
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
