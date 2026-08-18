import SwiftUI
import WebKit

/// Jesse book-creation workflow — live `/desk-os/workflows/book/`. A guided
/// call where a student writes their own short open book with minimal
/// supervision; publishing writes straight to Binder via `BinderStore`, the
/// same native-side-write bridge shape as `ResumeAgentView`'s "apply" - the
/// web page never needs its own Firebase Auth session.
///
/// Rebuilt to the GDoc split (2026-08-17, explicit ask - "add Jesse there
/// since it's our signature on each screen"): the existing web content
/// stays exactly as it was, on the left, untouched; `JesseRailView` (the
/// same shared card Resume/Learn Studio/Presentation all carry) added on
/// the right instead of just a Done button floating over the whole page.
struct BookWorkflowView: View {
    var onClose: () -> Void
    var studentName: String = "there"
    var onPublished: ((String, String) -> Void)? = nil

    var body: some View {
        HStack(spacing: 16) {
            ZStack(alignment: .topLeading) {
                Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)
                BookWorkflowWebView(onPublished: onPublished)
            }
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
            .shadow(color: .black.opacity(0.12), radius: 16, y: 8)
            .frame(maxWidth: .infinity, maxHeight: .infinity)

            JesseRailView(studentName: studentName, context: "book")
                .frame(width: 380)
        }
        .padding(18)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255).ignoresSafeArea())
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("bookWorkflowBack")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
    }
}

private struct BookWorkflowWebView: UIViewRepresentable {
    var onPublished: ((String, String) -> Void)?

    static var bookURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.bookWorkflowURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/workflows/book/?v=b2")!
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
        var onPublished: ((String, String) -> Void)?
        weak var webView: WKWebView?
        private let binder = BinderStore()

        init(onPublished: ((String, String) -> Void)?) { self.onPublished = onPublished }

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
                onPublished?(title, bodyText)
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
