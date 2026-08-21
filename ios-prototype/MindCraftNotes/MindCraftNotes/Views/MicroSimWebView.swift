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
