import SwiftUI
import WebKit

/// Jesse book-creation workflow — live `/desk-os/workflows/book/`. A guided
/// call where a student writes their own short open book with minimal
/// supervision; publishing writes straight to Binder via `BinderStore`, the
/// same native-side-write bridge shape as `ResumeAgentView`'s "apply" - the
/// web page never needs its own Firebase Auth session.
struct BookWorkflowView: View {
    var onClose: () -> Void
    var onPublished: (() -> Void)? = nil

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255).ignoresSafeArea()
            BookWorkflowWebView(onPublished: onPublished)
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
            .accessibilityIdentifier("bookWorkflowBack")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
        // No wrapper .accessibilityIdentifier on the outer ZStack - see
        // ArchiveWorkflowView for why (clobbers the nested Done button).
    }
}

private struct BookWorkflowWebView: UIViewRepresentable {
    var onPublished: (() -> Void)?

    static var bookURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.bookWorkflowURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/workflows/book/?v=b1")!
    }

    func makeCoordinator() -> Coord { Coord(onPublished: onPublished) }

    func makeUIView(context: Context) -> WKWebView {
        let ucc = WKUserContentController()
        ucc.add(context.coordinator, name: "deskBook")
        let config = WKWebViewConfiguration()
        config.userContentController = ucc
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
        context.coordinator.webView = view
        view.load(URLRequest(url: Self.bookURL, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onPublished = onPublished
    }

    final class Coord: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var onPublished: (() -> Void)?
        weak var webView: WKWebView?
        private let binder = BinderStore()

        init(onPublished: (() -> Void)?) { self.onPublished = onPublished }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "deskBook" else { return }
            let body = message.body as? [String: Any] ?? [:]
            guard body["type"] as? String == "publish" else { return }
            let draft = body["draft"] as? [String: Any] ?? [:]
            let title = (draft["title"] as? String)?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            let chapters = draft["chapters"] as? [[String: Any]] ?? []

            guard !title.isEmpty, !chapters.isEmpty else {
                respond(ok: false, error: "Book needs a title and at least one chapter first")
                return
            }

            let bodyText = chapters.enumerated().map { index, chapter -> String in
                let chapterTitle = (chapter["title"] as? String).flatMap { $0.isEmpty ? nil : $0 } ?? "Chapter \(index + 1)"
                let chapterBody = chapter["body"] as? String ?? ""
                return "## \(chapterTitle)\n\n\(chapterBody)"
            }.joined(separator: "\n\n")

            let itemId = binder.addBook(title: title, body: bodyText)
            if itemId.isEmpty {
                respond(ok: false, error: "Sign in to publish to your Binder")
            } else {
                respond(ok: true, error: nil)
                onPublished?()
            }
        }

        private func respond(ok: Bool, error: String?) {
            let errJs = error.map { "'\($0.replacingOccurrences(of: "'", with: "\\'"))'" } ?? "null"
            let js = "window.__deskBookFromNative && window.__deskBookFromNative({type:'publishResult', ok:\(ok), error:\(errJs)})"
            DispatchQueue.main.async { [weak self] in
                self?.webView?.evaluateJavaScript(js, completionHandler: nil)
            }
        }
    }
}
