import SwiftUI
import WebKit

/// Jesse archive workflow — live `/desk-os/workflows/archive/`. Textbook
/// cards, story-color workspace boxes, book reader with Dan McCreary's
/// live MicroSims, and a time/interest study plan. Same WKWebView-bridge
/// shape as `ResumeAgentView` - the desk-os HTML/JS is the source of truth,
/// this is just the native shell around it.
struct ArchiveWorkflowView: View {
    var onClose: () -> Void

    var body: some View {
        // No wrapper .accessibilityIdentifier on the outer ZStack: applying
        // one to a composite view like this clobbers the identifier of the
        // nested Done button below it (confirmed via a real UI test - the
        // button rendered and worked, but XCUITest queries for either
        // identifier failed until this wrapper identifier was removed; same
        // pattern already documented on SchedulingWorkflowsView).
        ZStack(alignment: .topTrailing) {
            Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255).ignoresSafeArea()
            ArchiveWorkflowWebView()
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
    }
}

private struct ArchiveWorkflowWebView: UIViewRepresentable {
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

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    final class Coord: NSObject, WKNavigationDelegate, WKUIDelegate {
        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }
    }
}
