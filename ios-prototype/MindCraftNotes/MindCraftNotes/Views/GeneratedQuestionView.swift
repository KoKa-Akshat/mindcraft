import SwiftUI
import WebKit

/// Renders a single live-generated question (`GeneratedQuestionWire`) - a
/// smaller, separate view rather than an extension of `QuestionView`
/// (1077 lines, tightly coupled to `SampleQuestion`/PencilKit/handwriting/
/// live-tutor-call/calculator, none of which apply to a freshly-generated
/// question). Renders the fields `SampleQuestion` never modeled: hints
/// (revealed one at a time), trap-aware wrong-answer feedback, the
/// microLesson panel, and an inline SVG visual when present.
struct GeneratedQuestionView: View {
    let question: GeneratedQuestionWire
    /// Fires once, right when "check answer" is tapped - the caller records
    /// the outcome (e.g. via `OutcomeClient`, matching `QuestionView`'s own
    /// `/record-outcomes` call) rather than this view owning that network
    /// call itself.
    var onAnswered: ((_ correct: Bool) -> Void)? = nil

    @State private var selectedIndex: Int?
    @State private var checked = false
    @State private var hintsShown = 0

    private let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private let cream = Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)
    private let correctGreen = Color(red: 36 / 255, green: 122 / 255, blue: 77 / 255)
    private let wrongRed = Color(red: 176 / 255, green: 71 / 255, blue: 63 / 255)

    private var isCorrect: Bool { selectedIndex == question.correctIndex }
    private var hitTrap: Bool {
        guard checked, let trap = question.trapChoiceIndex else { return false }
        return selectedIndex == trap
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                header
                if let visualData = question.visualData, question.visualType == "svg", !visualData.isEmpty {
                    InlineSVGView(svg: visualData)
                        .frame(height: 200)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                }
                choiceList
                hintRow
                if checked {
                    feedbackPanel
                } else {
                    checkButton
                }
            }
            .padding(22)
        }
        .background(Color.white)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let examTag = question.examTag {
                Text(examTag.uppercased())
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(1)
                    .foregroundColor(ink.opacity(0.5))
            }
            Text(question.question)
                .font(.system(size: 18, weight: .bold, design: .rounded))
                .foregroundColor(ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var choiceList: some View {
        VStack(spacing: 10) {
            ForEach(Array(question.choices.enumerated()), id: \.offset) { index, choice in
                Button {
                    guard !checked else { return }
                    selectedIndex = index
                } label: {
                    HStack {
                        Text(choice)
                            .font(.system(size: 15, weight: .semibold, design: .rounded))
                            .foregroundColor(choiceTextColor(for: index))
                            .fixedSize(horizontal: false, vertical: true)
                        Spacer(minLength: 0)
                    }
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(choiceBackground(for: index)))
                    .overlay(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(choiceBorder(for: index), lineWidth: 1.5))
                }
                .buttonStyle(.plain)
                .disabled(checked)
            }
        }
    }

    private func choiceBackground(for index: Int) -> Color {
        guard checked else { return selectedIndex == index ? cream : Color.white }
        if index == question.correctIndex { return correctGreen.opacity(0.14) }
        if index == selectedIndex { return wrongRed.opacity(0.12) }
        return Color.white
    }

    private func choiceBorder(for index: Int) -> Color {
        guard checked else { return selectedIndex == index ? ink.opacity(0.4) : ink.opacity(0.12) }
        if index == question.correctIndex { return correctGreen }
        if index == selectedIndex { return wrongRed }
        return ink.opacity(0.08)
    }

    private func choiceTextColor(for index: Int) -> Color {
        guard checked else { return ink }
        if index == question.correctIndex { return correctGreen }
        if index == selectedIndex { return wrongRed }
        return ink.opacity(0.5)
    }

    @ViewBuilder
    private var hintRow: some View {
        if !checked, !question.hints.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                ForEach(0..<hintsShown, id: \.self) { i in
                    Text(question.hints[i])
                        .font(.system(size: 13, weight: .medium, design: .rounded))
                        .foregroundColor(ink.opacity(0.7))
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(cream))
                }
                if hintsShown < question.hints.count {
                    Button("Hint") { hintsShown += 1 }
                        .font(.system(size: 13, weight: .bold, design: .rounded))
                        .foregroundColor(ink.opacity(0.6))
                }
            }
        }
    }

    private var checkButton: some View {
        Button {
            checked = true
            onAnswered?(isCorrect)
        } label: {
            Text("Check answer")
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .foregroundColor(.white)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 13)
                .background(Capsule().fill(selectedIndex == nil ? ink.opacity(0.25) : ink))
        }
        .buttonStyle(.plain)
        .disabled(selectedIndex == nil)
    }

    private var feedbackPanel: some View {
        VStack(alignment: .leading, spacing: 10) {
            if !isCorrect {
                if hitTrap, let trapReasoning = question.trapReasoning {
                    Text(trapReasoning)
                        .font(.system(size: 13.5, weight: .semibold, design: .rounded))
                        .foregroundColor(wrongRed)
                        .fixedSize(horizontal: false, vertical: true)
                }
                Text(question.microLesson)
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(ink)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(14)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(cream))
            } else {
                Text(question.explanation)
                    .font(.system(size: 14, weight: .medium, design: .rounded))
                    .foregroundColor(ink.opacity(0.75))
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .accessibilityIdentifier("generatedQuestionFeedback")
    }
}

/// Inline SVG string rendering, distinct from `SVGImageView` (which only
/// loads a bundled file URL - see its own doc comment for why extending it
/// wasn't the right move here). This content is model-generated at request
/// time, not a developer-authored bundled asset, so JavaScript execution is
/// explicitly disabled - an SVG visual has no legitimate need for it, and
/// `loadHTMLString` with no baseURL already sandboxes into a unique,
/// non-persistent origin with no access to app storage regardless.
/// Not `private` (2026-08-27): BookReaderView reuses this for
/// AssembledBookSection.imageSvg - same "model-generated SVG string, not a
/// bundled asset" shape, no reason to duplicate this view for a second file.
struct InlineSVGView: UIViewRepresentable {
    let svg: String

    func makeUIView(context: Context) -> WKWebView {
        let prefs = WKWebpagePreferences()
        prefs.allowsContentJavaScript = false
        let config = WKWebViewConfiguration()
        config.defaultWebpagePreferences = prefs
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.backgroundColor = .clear
        webView.isUserInteractionEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let html = "<html><body style=\"margin:0;display:flex;align-items:center;justify-content:center;\">\(svg)</body></html>"
        webView.loadHTMLString(html, baseURL: nil)
    }
}
