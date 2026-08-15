import SwiftUI
import WebKit

/// Jesse archive workflow — live `/desk-os/workflows/archive/`. Textbook
/// cards, story-color workspace boxes, book reader with Dan McCreary's
/// live MicroSims, and a time/interest study plan. Same WKWebView-bridge
/// shape as `ResumeAgentView` - the desk-os HTML/JS is the source of truth,
/// this is just the native shell around it.
struct ArchiveWorkflowView: View {
    var onClose: () -> Void

    // Real `/recommend` (mode: exam) weakness signal - same source
    // DashboardView's "today's spark" badge reads (`RouteClient.fetchExamProfile()`).
    // Threaded into the web agent as soft context only: the deterministic
    // mastery engine stays the source of truth for WHAT is weak, Jesse (the
    // LLM in archive-rag.ts) decides in language whether it's worth
    // mentioning at all, never forced into an unrelated answer.
    @State private var weakness: (id: String, label: String)?

    var body: some View {
        // No wrapper .accessibilityIdentifier on the outer ZStack: applying
        // one to a composite view like this clobbers the identifier of the
        // nested Done button below it (confirmed via a real UI test - the
        // button rendered and worked, but XCUITest queries for either
        // identifier failed until this wrapper identifier was removed; same
        // pattern already documented on SchedulingWorkflowsView).
        ZStack(alignment: .topTrailing) {
            Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255).ignoresSafeArea()
            ArchiveWorkflowWebView(weakness: weakness)
                .ignoresSafeArea()
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 10)
                    .background(Capsule().fill(Color.white.opacity(0.94)))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("archiveWorkflowBack")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
        .task { await loadWeakness() }
    }

    /// Doesn't block or delay the web view's own load - resolves in the
    /// background (HF Space cold start can take seconds) and is injected
    /// into the page whenever it lands, before or after `didFinish`. A
    /// student with no evidence yet, or if the call fails, simply gets the
    /// archive with no weakness context - never a blocking spinner over Jesse.
    private func loadWeakness() async {
        guard let profile = await RouteClient.fetchExamProfile(),
              let worst = profile.topWeaknesses.min(by: { $0.strength < $1.strength })
        else { return }
        let displays = TocDataLoader.loadConceptDisplays()
        let label = displays[worst.conceptId]?.label
            ?? worst.conceptId.replacingOccurrences(of: "_", with: " ").capitalized
        weakness = (id: worst.conceptId, label: label)
    }
}

private struct ArchiveWorkflowWebView: UIViewRepresentable {
    var weakness: (id: String, label: String)?

    static var archiveURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.archiveWorkflowURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/workflows/archive/?v=a2")!
    }

    func makeCoordinator() -> Coord { Coord() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = false
        view.backgroundColor = .clear
        view.scrollView.backgroundColor = .clear
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) { view.isInspectable = true }
        view.navigationDelegate = context.coordinator
        view.uiDelegate = context.coordinator
        view.load(URLRequest(url: Self.archiveURL, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.setWeakness(weakness, webView: uiView)
    }

    final class Coord: NSObject, WKNavigationDelegate, WKUIDelegate {
        private var didFinishLoad = false
        private var pendingWeakness: (id: String, label: String)?
        private var injectedId: String?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didFinishLoad = true
            inject(into: webView)
        }

        /// Called from `updateUIView` on every SwiftUI update - a no-op once
        /// the same concept id has already been injected, so this is safe to
        /// call repeatedly while the page is loading or long after.
        func setWeakness(_ weakness: (id: String, label: String)?, webView: WKWebView) {
            pendingWeakness = weakness
            if didFinishLoad { inject(into: webView) }
        }

        private func inject(into webView: WKWebView) {
            guard let weakness = pendingWeakness, weakness.id != injectedId else { return }
            injectedId = weakness.id
            struct Payload: Encodable { let conceptId: String; let label: String }
            guard
                let data = try? JSONEncoder().encode(Payload(conceptId: weakness.id, label: weakness.label)),
                let json = String(data: data, encoding: .utf8)
            else { return }
            // Read lazily by agent.js at the moment it builds the archive-rag
            // request body, not on a load event - so injection order (before
            // or after the page's own top-level script runs) never matters.
            webView.evaluateJavaScript("window.__mcWeakness = \(json);")
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
    }
}
