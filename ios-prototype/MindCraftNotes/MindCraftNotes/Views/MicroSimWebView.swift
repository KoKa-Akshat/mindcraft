import SwiftUI
import WebKit

/// Minimal WKWebView wrapper for rendering a live MicroSim URL.
///
/// Split out of the old `TestInstanceView.swift` (2026-08-20 dead code
/// pass): that file's own top-level `TestInstanceView` had zero live
/// callers (`showDocCook`/`showTestInstance` were never set `true`
/// anywhere) and was deleted, but this sibling type in the same file is a
/// real, live call site (`FieldDeskView`'s Binder MicroSim card). Kept here
/// on its own so the dead view could go without taking a still-used one
/// down with it. `MicroSimBrowser` (the other sibling in the old file, a
/// NavigationStack wrapper around this) had no live references itself and
/// was not restored.
struct MicroSimWebView: UIViewRepresentable {
    let url: URL
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.isScrollEnabled = true
        view.load(URLRequest(url: url))
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}

/// Same job as `MicroSimWebView`, for a sim whose content is inline HTML
/// (`AssembledBookSection.simHtml` - book_assembler.py's real fix, 2026-08-21,
/// for a real gap: sim_files_dir was only ever a local path, never a URL
/// anything could load, so "Try it interactively" had nothing behind it -
/// confirmed live, "I hit the play button, and nothing happens"). Pinch-zoom
/// is explicitly enabled (`pinchGestureRecognizer.isEnabled`) since these
/// sims are p5.js canvases at a fixed pixel size (real ones seen: 800x650)
/// that need to scale to fit a Binder card - WKWebView supports pinch-zoom
/// on its internal scrollView by default, but it's off here until turned on.
struct InlineSimWebView: UIViewRepresentable {
    let html: String
    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.isScrollEnabled = true
        view.scrollView.pinchGestureRecognizer?.isEnabled = true
        view.scrollView.minimumZoomScale = 0.5
        view.scrollView.maximumZoomScale = 3.0
        view.loadHTMLString(html, baseURL: nil)
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
