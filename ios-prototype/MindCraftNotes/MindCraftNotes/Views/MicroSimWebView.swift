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
    /// Fires once per real touch-down/drag-start the student makes on the
    /// sim canvas - deliberately sim-agnostic (2026-08-21, sim telemetry):
    /// sims come from three different sources (McCreary's archive, our own
    /// API generator, the cron pipeline) with no shared internal JS
    /// contract to hook a postMessage bridge into, so counting at the
    /// gesture level here is the only signal that works uniformly across
    /// all of them without needing any sim's own code to cooperate. Counts
    /// interaction EPISODES (`.began`/`.recognized`), not raw movement -
    /// a pan's `.changed` state fires many times per drag and would just
    /// inflate the count without adding real signal.
    var onInteraction: (() -> Void)? = nil

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        let view = WKWebView(frame: .zero, configuration: config)
        view.scrollView.isScrollEnabled = true
        view.scrollView.pinchGestureRecognizer?.isEnabled = true
        view.scrollView.minimumZoomScale = 0.5
        view.scrollView.maximumZoomScale = 3.0
        // Real bug fix (2026-08-23, live report across multiple screens:
        // "sims are not loading" / from 2026-08-21's own doc comment above,
        // "I hit the play button, and nothing happens") - confirmed by
        // fetching a real generated sim from the live webhook: every sim
        // here loads p5.js from a remote CDN
        // (`<script src="https://cdn.jsdelivr.net/...">`), not inlined.
        // `loadHTMLString(_:baseURL: nil)` gives the page a null/opaque
        // origin, and WKWebView can silently refuse to load cross-origin
        // remote subresources (the CDN script) from a null-origin document
        // - the container loads fine, the canvas just never initializes
        // because p5's own functions (createCanvas, createSlider) were
        // never defined. A real https baseURL gives the page a real origin
        // that's allowed to fetch the CDN script, exactly the fix already
        // applied one file over in `MicroSimInlineWebView` for the bundled
        // McCreary set - just never carried over to this shared component,
        // which is what Archive/Design Studio/BookReaderView actually use.
        view.loadHTMLString(html, baseURL: URL(string: "https://mindcraft-93858.web.app/"))

        if onInteraction != nil {
            let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.touched(_:)))
            tap.cancelsTouchesInView = false
            tap.delaysTouchesBegan = false
            tap.delegate = context.coordinator
            view.addGestureRecognizer(tap)
            let pan = UIPanGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.touched(_:)))
            pan.cancelsTouchesInView = false
            pan.delaysTouchesBegan = false
            pan.delegate = context.coordinator
            view.addGestureRecognizer(pan)
        }
        return view
    }
    func updateUIView(_ uiView: WKWebView, context: Context) {}
    func makeCoordinator() -> Coordinator { Coordinator(onInteraction: onInteraction) }

    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        let onInteraction: (() -> Void)?
        init(onInteraction: (() -> Void)?) { self.onInteraction = onInteraction }

        @objc func touched(_ recognizer: UIGestureRecognizer) {
            guard recognizer.state == .began || recognizer.state == .recognized else { return }
            onInteraction?()
        }

        // Never blocks the sim's own touch handling or WKWebView's internal
        // pinch/scroll recognizers - this view only ever OBSERVES touches,
        // it must never compete with the sim being actually interactive.
        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }
    }
}
