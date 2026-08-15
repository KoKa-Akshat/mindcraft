import SwiftUI
import WebKit

/// Jesse resume agent — live `/desk-os/workflows/resume/`.
/// Native bridge: Drive folder read (PDFKit) + Apply today ingest.
struct ResumeAgentView: View {
    var onClose: () -> Void
    var onApply: (() -> Void)? = nil

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255).ignoresSafeArea()
            ResumeAgentWebView(onApply: onApply)
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
            .accessibilityIdentifier("resumeAgentBack")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
        .accessibilityIdentifier("resumeAgentRoot")
    }
}

private struct ResumeAgentWebView: UIViewRepresentable {
    var onApply: (() -> Void)?

    static var resumeURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.resumeAgentURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/workflows/resume/?v=r6")!
    }

    func makeCoordinator() -> Coord { Coord(onApply: onApply) }

    func makeUIView(context: Context) -> WKWebView {
        let ucc = WKUserContentController()
        ucc.add(context.coordinator, name: "deskResume")
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
        view.load(URLRequest(url: Self.resumeURL, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onApply = onApply
    }

    final class Coord: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler {
        var onApply: (() -> Void)?
        weak var webView: WKWebView?

        init(onApply: (() -> Void)?) { self.onApply = onApply }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            decisionHandler(.allow)
        }

        func webView(_ webView: WKWebView, requestMediaCapturePermissionFor origin: WKSecurityOrigin, initiatedByFrame frame: WKFrameInfo, type: WKMediaCaptureType, decisionHandler: @escaping (WKPermissionDecision) -> Void) {
            decisionHandler(.grant)
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "deskResume" else { return }
            let body = message.body as? [String: Any] ?? [:]
            let type = body["type"] as? String ?? ""
            if type == "drive" {
                Task { @MainActor in
                    let files = await DriveClient.shared.connectAndReadFolder()
                    let payload: [[String: String]] = files.map { ["name": $0.name, "text": $0.text] }
                    let data = (try? JSONSerialization.data(withJSONObject: payload)) ?? Data("[]".utf8)
                    let json = String(data: data, encoding: .utf8) ?? "[]"
                    let err = DriveClient.shared.lastError ?? ""
                    let js = "window.__deskResumeFromNative && window.__deskResumeFromNative({type:'driveFiles', files:\(json), error:\(Self.jsString(err))})"
                    self.webView?.evaluateJavaScript(js, completionHandler: nil)
                }
            } else if type == "apply" {
                let fileName = body["fileName"] as? String ?? "Jesse draft"
                let linkedin = body["linkedinUrl"] as? String ?? ""
                let raw = body["suggestions"] as? [[String: Any]] ?? []
                let suggestions: [(company: String, role: String, why: String, query: String)] = raw.map {
                    (
                        company: $0["company"] as? String ?? "",
                        role: $0["role"] as? String ?? "",
                        why: $0["why"] as? String ?? "",
                        query: $0["query"] as? String ?? ""
                    )
                }
                Task { @MainActor in
                    let store = JobOSStore()
                    store.ingestFromJesse(fileName: fileName, linkedinUrl: linkedin, suggestions: suggestions)
                    self.onApply?()
                }
            }
        }

        private static func jsString(_ s: String) -> String {
            let escaped = s
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "'", with: "\\'")
                .replacingOccurrences(of: "\n", with: "\\n")
            return "'\(escaped)'"
        }
    }
}
