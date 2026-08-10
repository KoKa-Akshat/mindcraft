import SwiftUI
import WebKit

/// Renders a bundled SVG file inline via a transparent, non-interactive
/// WKWebView. SwiftUI has no native SVG renderer; a real rasterizer
/// (cairosvg) wasn't available on this machine (missing native `libcairo`),
/// and the generated-diagram set keeps growing from a separate, actively-
/// running batch job (Codex/ChatGPT), so re-rasterizing to PNG on every sync
/// would immediately go stale. Loading the SVG file directly means any new
/// file dropped into `Resources/generatedDiagrams/` (a folder reference -
/// see project.pbxproj) just works next build, no conversion step. Content
/// is fully trusted (our own generated pipeline, not user input), so this
/// carries no XSS/injection concern.
struct SVGImageView: UIViewRepresentable {
    let fileURL: URL

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let webView = WKWebView(frame: .zero, configuration: config)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.backgroundColor = .clear
        // The doc comment above always claimed "non-interactive" but this
        // was never actually set. WKWebView keeps its own tap/long-press
        // gesture recognizers by default, which intercept touches meant for
        // a SwiftUI Button drawn behind/around it. Harmless at diagram size
        // (large enough to still register a tap on the view itself) but
        // made the Map tab's small icon nodes ("so hard to touch the
        // icons") nearly untappable. This view only ever renders trusted,
        // static, non-interactive SVGs, so disabling interaction has no
        // downside.
        webView.isUserInteractionEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        webView.loadFileURL(fileURL, allowingReadAccessTo: fileURL.deletingLastPathComponent())
    }
}

/// Looks up a bundled generated-diagram SVG by question id - mirrors
/// `AltDiagramCallout.tsx`'s `generatedDiagramFor()` lookup.
enum GeneratedDiagramLookup {
    static func url(forQuestionId id: String) -> URL? {
        Bundle.main.url(forResource: id, withExtension: "svg", subdirectory: "generatedDiagrams")
    }
}
