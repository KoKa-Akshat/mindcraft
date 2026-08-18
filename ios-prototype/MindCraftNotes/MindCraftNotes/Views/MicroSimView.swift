import SwiftUI
import WebKit

/// Thin `WKWebView` wrapper loading a `MicroSimRecord`'s real, self-contained
/// HTML directly (`loadHTMLString`, no server round trip needed - the sim's
/// own JS is already inlined by `MicroSimRecord.selfContainedHTML`). Same
/// `UIViewRepresentable` shape as `HomeworkDocumentPicker`/`EventEditView`
/// elsewhere in this app.
private struct MicroSimInlineWebView: UIViewRepresentable {
    let html: String

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.bounces = false
        view.load(html: html)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

private extension WKWebView {
    func load(html: String) {
        loadHTMLString(html, baseURL: URL(string: "https://dmccreary.github.io/"))
    }
}

/// Real, interactive p5.js simulation viewer - opened from a matched
/// `MicroSimRecord` (see `MicroSimLoader.matching`). Credits Dan McCreary
/// directly on screen, same spirit as `archive-rag`'s own "credit Dan"
/// rule for the chapter-excerpt archive.
struct MicroSimView: View {
    let sim: MicroSimRecord
    var onClose: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(sim.title)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                    Text("MicroSim by \(sim.creator)")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(.secondary)
                }
                Spacer(minLength: 0)
                Button(action: onClose) {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 22))
                        .foregroundColor(.secondary)
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("microSimClose")
            }
            .padding(14)
            MicroSimInlineWebView(html: sim.selfContainedHTML)
        }
        .background(Color.white)
        .accessibilityIdentifier("microSimView")
    }
}
