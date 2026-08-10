import Foundation
import Speech
import AVFoundation
import Combine

/// Shared speech → text helper for Field Desk writing boxes (memo / Ask).
/// Requests mic + speech auth on first use; appends partial/final results
/// into `transcript` for the active field to bind.
@MainActor
final class SpeechCaptureController: ObservableObject {
    @Published var transcript: String = ""
    @Published var isListening = false
    @Published var status: String?

    private let recognizer = SFSpeechRecognizer(locale: Locale(identifier: "en-US"))
    private let audioEngine = AVAudioEngine()
    private var request: SFSpeechAudioBufferRecognitionRequest?
    private var task: SFSpeechRecognitionTask?

    func toggle() {
        if isListening { stop(); return }
        start()
    }

    func start() {
        status = nil
        SFSpeechRecognizer.requestAuthorization { [weak self] auth in
            Task { @MainActor in
                guard let self else { return }
                guard auth == .authorized else {
                    self.status = "Mic permission needed for voice."
                    return
                }
                AVAudioSession.sharedInstance().requestRecordPermission { ok in
                    Task { @MainActor in
                        guard ok else {
                            self.status = "Microphone access is off."
                            return
                        }
                        self.beginSession()
                    }
                }
            }
        }
    }

    private func beginSession() {
        stop()
        guard let recognizer, recognizer.isAvailable else {
            status = "Speech not available on this device."
            return
        }
        do {
            let session = AVAudioSession.sharedInstance()
            try session.setCategory(.record, mode: .measurement, options: .duckOthers)
            try session.setActive(true, options: .notifyOthersOnDeactivation)
        } catch {
            status = "Couldn't open the mic."
            return
        }

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
        status = "Listening…"
        task = recognizer.recognitionTask(with: req) { [weak self] result, error in
            Task { @MainActor in
                guard let self else { return }
                if let result {
                    self.transcript = result.bestTranscription.formattedString
                    if result.isFinal { self.stop() }
                }
                if error != nil { self.stop() }
            }
        }
    }

    func stop() {
        if audioEngine.isRunning {
            audioEngine.stop()
            audioEngine.inputNode.removeTap(onBus: 0)
        }
        request?.endAudio()
        task?.cancel()
        request = nil
        task = nil
        isListening = false
        if status == "Listening…" { status = nil }
    }

    func consumeTranscript() -> String {
        let t = transcript.trimmingCharacters(in: .whitespacesAndNewlines)
        transcript = ""
        return t
    }
}
