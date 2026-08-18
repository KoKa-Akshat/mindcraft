import SwiftUI
import WebKit

/// Jesse resume agent — live `/desk-os/workflows/resume/`.
/// Native bridge: Drive folder read (PDFKit) + Apply Today ingest.
/// Rebuilt to the GDoc split (2026-08-17, explicit ask - "uniform platform
/// experience," not five screens each inventing their own Jesse chrome):
/// content on the left, the same `JesseRailView` every screen with Jesse
/// carries on the right, inline auto-transcribe instead of a separate
/// full-screen call sheet. The web page still has its own separate voice
/// call (browser SpeechRecognition/speechSynthesis, dies with this view) -
/// untouched, out of scope here; `JesseRailView`'s native call is the real
/// alternative, running via the shared `JesseCallSession` independent of
/// the web view.
///
/// Apply Today/JobOS folded in here rather than staying a separate
/// top-level Flow (explicit ask - "that box should be in the resume box").
/// `JobOSStore`/`JobOSShellView` themselves are untouched - full
/// role/contact/application-tracking depth stays real, just reached from
/// inside Resume now instead of as a peer entry point. The web page's own
/// "apply" ingest message already fed `JobOSStore` before this change; nothing
/// about that pipe changed, only how a student gets to see the result.
struct ResumeAgentView: View {
    var onClose: () -> Void
    var studentName: String = "there"
    /// Fires once, right when the web page's own "apply" message has
    /// finished ingesting into JobOSStore (real side effect the caller may
    /// still want - e.g. filing a resume-draft artifact) - Resume itself
    /// stays open and shows Apply Today as a nested cover rather than
    /// closing, unlike the old flow this replaces.
    var onApply: (() -> Void)? = nil

    @State private var showApplyToday = false
    @StateObject private var jobOSStore = JobOSStore()

    private let artboard = CGSize(width: 1440, height: 810)

    var body: some View {
        GeometryReader { geo in
            let scale = min(geo.size.width / artboard.width, geo.size.height / artboard.height)
            ZStack {
                Color.white.ignoresSafeArea()
                ZStack(alignment: .topLeading) {
                    pin(ResumeArtboard.content, scale: scale) { contentBox }
                    pin(ResumeArtboard.jesseRail, scale: scale) {
                        JesseRailView(studentName: studentName, context: "resume")
                    }
                }
                .frame(width: artboard.width * scale, height: artboard.height * scale)
            }
            .frame(width: geo.size.width, height: geo.size.height)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .ignoresSafeArea()
        .overlay(alignment: .topTrailing) {
            Button(action: onClose) {
                Text("Done")
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 12 / 255, green: 18 / 255, blue: 7 / 255))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 8)
                    .background(Capsule().fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)))
            }
            .buttonStyle(.plain)
            .padding(.top, 12)
            .padding(.trailing, 16)
            .accessibilityIdentifier("resumeAgentBack")
            .accessibilityLabel("Done")
        }
        .statusBarHidden(true)
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "resume").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("resumeAgentRoot")
                .allowsHitTesting(false)
        }
    }

    private var contentBox: some View {
        ZStack(alignment: .topLeading) {
            Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)
            // Applications swaps in HERE, in place of the web view - not a
            // .fullScreenCover (explicit ask: "the box that opens should be
            // on the left in resume"). JesseRailView stays mounted the
            // whole time either way, same as every other content swap.
            if showApplyToday {
                JobOSShellView(onClose: { showApplyToday = false }, fillsAvailableSpace: true)
            } else {
                ResumeAgentWebView(onApply: {
                    onApply?()
                    showApplyToday = true
                })
            }
            VStack {
                Spacer()
                HStack {
                    Spacer()
                    applicationsToggle
                        .padding(16)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 8)
    }

    private var applicationsToggle: some View {
        Button {
            showApplyToday.toggle()
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "briefcase.fill")
                Text(showApplyToday ? "Back to draft" : (jobOSStore.state.roles.isEmpty ? "Applications" : "\(jobOSStore.state.roles.count) tracked roles"))
                Image(systemName: showApplyToday ? "arrow.uturn.left" : "chevron.right")
            }
            .font(.system(size: 13, weight: .bold, design: .rounded))
            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(
                Capsule().fill(Color.white)
                    .shadow(color: .black.opacity(0.14), radius: 10, y: 4)
            )
        }
        .buttonStyle(.plain)
        .accessibilityIdentifier("resumeOpenApplyToday")
    }

    private func pin<Content: View>(_ box: CGRect, scale: CGFloat, @ViewBuilder content: () -> Content) -> some View {
        content()
            .frame(width: box.width * scale, height: box.height * scale)
            .position(
                x: (box.minX + box.width / 2) * scale,
                y: (box.minY + box.height / 2) * scale
            )
    }
}

/// Same content/jesseRail proportions as `CreateCanvasView`'s GDoc idle
/// state (`CreateArtboard.idleStage`/`.jesseRailIdle`) - explicit ask:
/// "Jesse occupies same space as in GDoc... left space box... occupying
/// same space as it does currently." Values duplicated rather than shared
/// cross-file, same convention as `DottedLearnGrid`/`DottedDesignGrid`.
private enum ResumeArtboard {
    static let content = CGRect(x: 28, y: 48, width: 920, height: 560)
    static let jesseRail = CGRect(x: 980, y: 48, width: 432, height: 560)
}

private struct ResumeAgentWebView: UIViewRepresentable {
    var onApply: (() -> Void)?

    static var resumeURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.resumeAgentURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/workflows/resume/?v=r8")!
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
