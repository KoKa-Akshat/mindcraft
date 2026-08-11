import SwiftUI
import AVFoundation

/// Native **Piano Field Book** - hub card `piano_main` → this module, the
/// same relationship web `openInstance()` → `openInteractiveBook()` →
/// `loadSeedBook('piano')` → `bookPlayer.open()` has for `kind: 'piano'`.
/// Pages come from the real bundled `Resources/pianoSeed.json` (copied from
/// `agent_work/product/desk_os/data/pianoSeed.json`). Cover / read / piano
/// drill / quiz / done - on-screen C4–C5 keys, Play phrase, Mark practiced,
/// local page progress (`deskOs.bookProgress.piano_seed`).
struct PianoFieldBookView: View {
    @Environment(\.dismiss) private var dismiss
    @StateObject private var book = PianoBookStore()
    @StateObject private var tones = PianoTonePlayer()

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color(pbHex: "1a2430"), Color(pbHex: "121820"), Color(pbHex: "0c1016")],
                startPoint: .topLeading, endPoint: .bottomTrailing
            )
            .ignoresSafeArea()

            if book.pages.isEmpty {
                ProgressView().tint(Color(pbHex: "7ec8e3"))
            } else {
                VStack(spacing: 0) {
                    topBar
                    pageBody
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                    bottomBar
                }
                .padding(20)
            }
        }
        .onAppear { book.load() }
    }

    private var topBar: some View {
        HStack {
            VStack(alignment: .leading, spacing: 2) {
                Text(book.title)
                    .font(.system(size: 18, weight: .bold, design: .rounded))
                    .foregroundColor(Color(pbHex: "e8f1f6"))
                Text("Page \(book.pageIndex + 1) of \(max(book.pages.count, 1))")
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.55))
                    .accessibilityIdentifier("pianoPageLabel")
            }
            Spacer()
            Button("Close") { dismiss() }
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.85))
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
                .background(Capsule().stroke(Color(pbHex: "e8f1f6").opacity(0.3), lineWidth: 1))
                .accessibilityIdentifier("pianoBookClose")
        }
        .padding(.bottom, 16)
    }

    @ViewBuilder
    private var pageBody: some View {
        let page = book.pages[book.pageIndex]
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                switch page.type {
                case "cover":
                    coverPage(page)
                case "read":
                    readPage(page)
                case "piano":
                    pianoPage(page)
                case "quiz":
                    quizPage(page)
                case "done":
                    donePage(page)
                default:
                    Text(page.title ?? "Page")
                        .foregroundColor(Color(pbHex: "e8f1f6"))
                }
            }
            .padding(20)
            .frame(maxWidth: 720, alignment: .leading)
            .background(
                RoundedRectangle(cornerRadius: 18, style: .continuous)
                    .fill(Color(pbHex: "1c2836").opacity(0.85))
                    .overlay(
                        RoundedRectangle(cornerRadius: 18, style: .continuous)
                            .stroke(Color(pbHex: "7ec8e3").opacity(0.25), lineWidth: 1)
                    )
            )
            .frame(maxWidth: .infinity)
        }
    }

    private func coverPage(_ page: PianoPage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("PIANO FIELD BOOK")
                .font(.system(size: 11, weight: .bold))
                .tracking(1)
                .foregroundColor(Color(pbHex: "7ec8e3"))
            Text(page.title ?? book.title)
                .font(.system(size: 32, weight: .bold, design: .serif))
                .foregroundColor(Color(pbHex: "e8f1f6"))
            if let subtitle = page.subtitle {
                Text(subtitle)
                    .font(.system(size: 16, design: .rounded))
                    .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.7))
            }
            if let license = page.license {
                Text(license)
                    .font(.system(size: 12))
                    .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.45))
                    .padding(.top, 8)
            }
        }
        // No wrapper accessibilityIdentifier - it swallows child ids
        // (same class of bug as QuestionView's questionPrompt wrapper).
    }

    private func readPage(_ page: PianoPage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(page.title ?? "")
                .font(.system(size: 24, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "e8f1f6"))
            Text(page.body ?? "")
                .font(.system(size: 16))
                .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.85))
                .lineSpacing(4)
        }
    }

    private func pianoPage(_ page: PianoPage) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            Text(page.title ?? "Drill")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "e8f1f6"))
            Text(page.prompt ?? "")
                .font(.system(size: 15))
                .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.75))
            Text("Phrase · \((page.notes ?? []).joined(separator: " "))")
                .font(.system(size: 13, weight: .semibold, design: .monospaced))
                .foregroundColor(Color(pbHex: "7ec8e3"))
                .accessibilityIdentifier("pianoPhrase")

            // No wrapper a11y id on the keyboard - it swallows pianoKey_* child ids.
            PianoKeyboardView(
                highlighted: Set(page.notes ?? []),
                onTap: { note in tones.play(note) }
            )
            .frame(height: 140)

            HStack(spacing: 10) {
                Button {
                    tones.playPhrase(page.notes ?? [])
                } label: {
                    Text("Play phrase")
                        .font(.system(size: 14, weight: .bold, design: .rounded))
                        .foregroundColor(Color(pbHex: "121820"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().fill(Color(pbHex: "7ec8e3")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pianoPlayPhrase")

                Button {
                    book.markPracticed()
                } label: {
                    Text(book.practicedThisPage ? "Practiced ✓" : "Mark practiced")
                        .font(.system(size: 14, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(pbHex: "e8f1f6"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 10)
                        .background(Capsule().stroke(Color(pbHex: "e8f1f6").opacity(0.35), lineWidth: 1))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pianoMarkPracticed")
            }
        }
    }

    private func quizPage(_ page: PianoPage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(page.title ?? "Quiz")
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "e8f1f6"))
            Text(page.q ?? "")
                .font(.system(size: 16))
                .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.85))
            TextField(page.placeholder ?? "Answer", text: $book.quizAnswer)
                .textFieldStyle(.plain)
                .padding(12)
                .background(
                    RoundedRectangle(cornerRadius: 10, style: .continuous)
                        .fill(Color(pbHex: "0c1016"))
                        .overlay(
                            RoundedRectangle(cornerRadius: 10, style: .continuous)
                                .stroke(Color(pbHex: "e8f1f6").opacity(0.2), lineWidth: 1)
                        )
                )
                .foregroundColor(Color(pbHex: "e8f1f6"))
                .accessibilityIdentifier("pianoQuizField")
            if book.quizChecked {
                Text(book.quizLooksRight ? "Nice - that's the five-finger set." : "Try C D E F G (ascending white keys).")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundColor(book.quizLooksRight ? Color(pbHex: "b9e86f") : Color(pbHex: "f0c674"))
                    .accessibilityIdentifier("pianoQuizFeedback")
            }
            Button(book.quizChecked ? "Checked" : "Check") {
                book.checkQuiz()
            }
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundColor(Color(pbHex: "121820"))
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(Capsule().fill(Color(pbHex: "7ec8e3")))
            .disabled(book.quizChecked)
            .accessibilityIdentifier("pianoQuizCheck")
        }
    }

    private func donePage(_ page: PianoPage) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(page.title ?? "Done")
                .font(.system(size: 28, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "e8f1f6"))
            Text(page.body ?? "")
                .font(.system(size: 16))
                .foregroundColor(Color(pbHex: "e8f1f6").opacity(0.8))
            Button("Back to hub") { dismiss() }
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "121820"))
                .padding(.horizontal, 16)
                .padding(.vertical, 10)
                .background(Capsule().fill(Color(pbHex: "b9e86f")))
                .accessibilityIdentifier("pianoBackToHub")
        }
    }

    private var bottomBar: some View {
        HStack {
            Button("Back") { book.goBack() }
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(Color(pbHex: "e8f1f6").opacity(book.pageIndex == 0 ? 0.3 : 0.9))
                .disabled(book.pageIndex == 0)
                .accessibilityIdentifier("pianoPrev")
            Spacer()
            Button(book.pageIndex >= book.pages.count - 1 ? "Finish" : "Next") {
                if book.pageIndex >= book.pages.count - 1 {
                    dismiss()
                } else {
                    book.goNext()
                }
            }
            .font(.system(size: 14, weight: .bold, design: .rounded))
            .foregroundColor(Color(pbHex: "121820"))
            .padding(.horizontal, 18)
            .padding(.vertical, 10)
            .background(Capsule().fill(Color(pbHex: "7ec8e3")))
            .accessibilityIdentifier("pianoNext")
        }
        .padding(.top, 14)
    }
}

// MARK: - Store / seed decode

@MainActor
final class PianoBookStore: ObservableObject {
    @Published private(set) var title = "Piano Field Book"
    @Published private(set) var pages: [PianoPage] = []
    @Published var pageIndex = 0
    @Published var practicedThisPage = false
    @Published var quizAnswer = ""
    @Published var quizChecked = false
    @Published var quizLooksRight = false

    private static let progressKey = "deskOs.bookProgress.piano_seed"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")
    private var practicedPages: Set<Int> = []

    func load() {
        guard
            let url = Bundle.main.url(forResource: "pianoSeed", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let seed = try? JSONDecoder().decode(PianoSeed.self, from: data)
        else { return }
        title = seed.title
        pages = seed.pages
        if !Self.uiTesting, let saved = UserDefaults.standard.object(forKey: Self.progressKey) as? Int {
            pageIndex = min(max(0, saved), max(pages.count - 1, 0))
        } else {
            pageIndex = 0
        }
        practicedThisPage = practicedPages.contains(pageIndex)
        quizAnswer = ""
        quizChecked = false
    }

    func goNext() {
        guard pageIndex < pages.count - 1 else { return }
        pageIndex += 1
        persist()
        practicedThisPage = practicedPages.contains(pageIndex)
        quizAnswer = ""
        quizChecked = false
    }

    func goBack() {
        guard pageIndex > 0 else { return }
        pageIndex -= 1
        persist()
        practicedThisPage = practicedPages.contains(pageIndex)
        quizAnswer = ""
        quizChecked = false
    }

    func markPracticed() {
        practicedPages.insert(pageIndex)
        practicedThisPage = true
    }

    func checkQuiz() {
        let normalized = quizAnswer.uppercased()
            .components(separatedBy: CharacterSet.letters.inverted)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
        quizLooksRight = normalized == "C D E F G"
        quizChecked = true
    }

    private func persist() {
        guard !Self.uiTesting else { return }
        UserDefaults.standard.set(pageIndex, forKey: Self.progressKey)
    }
}

struct PianoSeed: Decodable {
    let id: String
    let title: String
    let pages: [PianoPage]
}

struct PianoPage: Decodable {
    let type: String
    let title: String?
    let subtitle: String?
    let license: String?
    let body: String?
    let notes: [String]?
    let prompt: String?
    let concept: String?
    let q: String?
    let placeholder: String?
}

// MARK: - Keyboard + tones

private struct PianoKeyboardView: View {
    let highlighted: Set<String>
    let onTap: (String) -> Void
    private let whites = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"]

    var body: some View {
        HStack(spacing: 4) {
            ForEach(whites, id: \.self) { note in
                Button {
                    onTap(note)
                } label: {
                    VStack {
                        Spacer()
                        Text(note.replacingOccurrences(of: "4", with: "").replacingOccurrences(of: "5", with: ""))
                            .font(.system(size: 12, weight: .bold, design: .rounded))
                            .foregroundColor(Color(pbHex: "1a2430"))
                            .padding(.bottom, 10)
                    }
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(
                        RoundedRectangle(cornerRadius: 8, style: .continuous)
                            .fill(highlighted.contains(note) ? Color(pbHex: "7ec8e3") : Color(pbHex: "f4efe2"))
                    )
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("pianoKey_\(note)")
            }
        }
    }
}

@MainActor
final class PianoTonePlayer: ObservableObject {
    private let engine = AVAudioEngine()
    private let player = AVAudioPlayerNode()
    private var ready = false
    private var phraseTask: Task<Void, Never>?

    private static let noteHz: [String: Double] = [
        "C4": 261.63, "D4": 293.66, "E4": 329.63, "F4": 349.23,
        "G4": 392.00, "A4": 440.00, "B4": 493.88, "C5": 523.25,
    ]

    private func ensureStarted() {
        guard !ready else { return }
        let sampleRate = 44100.0
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        engine.attach(player)
        engine.connect(player, to: engine.mainMixerNode, format: format)
        engine.mainMixerNode.outputVolume = 0.9
        do {
            try AVAudioSession.sharedInstance().setCategory(.playback, mode: .default)
            try AVAudioSession.sharedInstance().setActive(true)
            try engine.start()
            player.play()
            ready = true
        } catch {
            // Silent - drills still work without audio.
        }
    }

    func play(_ note: String) {
        ensureStarted()
        guard ready, let hz = Self.noteHz[note] else { return }
        let sampleRate = 44100.0
        let duration = 0.28
        let frameCount = Int(duration * sampleRate)
        guard
            let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1),
            let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frameCount))
        else { return }
        buffer.frameLength = AVAudioFrameCount(frameCount)
        if let channel = buffer.floatChannelData?[0] {
            for i in 0..<frameCount {
                let t = Double(i) / sampleRate
                let env = min(1, Double(i) / 200) * max(0, 1 - t / duration)
                channel[i] = Float(sin(2 * Double.pi * hz * t) * 0.28 * env)
            }
        }
        player.scheduleBuffer(buffer, completionHandler: nil)
    }

    func playPhrase(_ notes: [String]) {
        phraseTask?.cancel()
        phraseTask = Task {
            for note in notes {
                if Task.isCancelled { break }
                play(note)
                try? await Task.sleep(nanoseconds: 320_000_000)
            }
        }
    }
}

private extension Color {
    init(pbHex hex: String) {
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
