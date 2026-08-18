import SwiftUI
import WebKit

/// Jesse resume agent (Assignment H, 2026-08-18 rebuild) - the native call
/// now drives a real profile draft (`JesseCallSession.askJesseResume`,
/// `context == "resume"`, hits the same `/api/resume-agent` webhook the old
/// web page's own `askJesse()` used). Explicit ask: "as you talk your
/// profile gets created on the left." Content box defaults to that native
/// panel; the old web page (LinkedIn paste / Drive folder / PDF upload -
/// real extraction the native voice-only path doesn't do yet) stays reachable
/// via the "Import" toggle rather than deleted, same pattern Applications
/// already uses. `JesseRailView` on the right, same shared card every
/// screen with Jesse carries.
///
/// Apply Today/JobOS folded in here rather than staying a separate
/// top-level Flow (explicit ask - "that box should be in the resume box").
/// `JobOSStore`/`JobOSShellView` themselves are untouched - full
/// role/contact/application-tracking depth stays real, just reached from
/// inside Resume now instead of as a peer entry point. The web page's own
/// "apply" ingest message still feeds `JobOSStore` when reached via Import;
/// nothing about that pipe changed, only how a student gets to it.
struct ResumeAgentView: View {
    var onClose: () -> Void
    var studentName: String = "there"
    /// Fires once, right when the web page's own "apply" message has
    /// finished ingesting into JobOSStore (real side effect the caller may
    /// still want - e.g. filing a resume-draft artifact) - Resume itself
    /// stays open and shows Apply Today as a nested cover rather than
    /// closing, unlike the old flow this replaces.
    var onApply: (() -> Void)? = nil

    private enum ContentMode { case profile, applications, importWeb }

    @State private var mode: ContentMode = .profile
    @StateObject private var jobOSStore = JobOSStore()
    @EnvironmentObject private var jesseCall: JesseCallSession

    private var draft: ResumeAgentDraft { jesseCall.resumeDraft ?? .empty }

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
            switch mode {
            case .profile:
                resumePanel
            case .applications:
                JobOSShellView(onClose: { mode = .profile }, fillsAvailableSpace: true)
            case .importWeb:
                ResumeAgentWebView(onApply: {
                    onApply?()
                    mode = .applications
                })
            }
            if mode == .profile {
                VStack {
                    Spacer()
                    HStack {
                        importToggle
                        Spacer()
                        applicationsToggle
                    }
                    .padding(16)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .shadow(color: .black.opacity(0.12), radius: 16, y: 8)
    }

    // MARK: - Native profile panel (Assignment H)

    private var resumePanel: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                resumeHeader
                resumeTools
                resumeProfile
            }
            .padding(22)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
                .fill(Color.white)
                .shadow(color: .black.opacity(0.08), radius: 14, y: 6)
        )
        .accessibilityIdentifier("resumeAgentProfilePanel")
    }

    private var resumeHeader: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("YOUR RESUME")
                .font(.system(size: 11, weight: .heavy, design: .rounded))
                .tracking(1.1)
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.5))
            Text(draft.name.isEmpty ? "Your name" : draft.name)
                .font(.system(size: 22, weight: .bold, design: .rounded))
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
            Text("Talk to Jesse on the right - tell them about your school, skills, and roles, and this fills in as you go.")
                .font(.system(size: 12, weight: .medium, design: .rounded))
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.6))
        }
    }

    private var resumeTools: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("WHAT WE NEED FROM YOU")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.45))
            resumeToolRow(
                done: !draft.name.isEmpty && !draft.headline.isEmpty,
                title: "Who you are",
                detail: draft.headline.isEmpty ? "Your name and a line that sounds like you." : draft.headline
            )
            resumeToolRow(
                done: !draft.skills.isEmpty,
                title: "Skills",
                detail: draft.skills.isEmpty ? "What you're good at - even the small stuff counts." : draft.skills.joined(separator: ", ")
            )
            resumeToolRow(
                done: !draft.roles.isEmpty,
                title: "Experience",
                detail: draft.roles.isEmpty ? "A job, project, or club - anything you did the work for." : "\(draft.roles.count) role\(draft.roles.count == 1 ? "" : "s") so far"
            )
        }
        .padding(14)
        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)))
    }

    private func resumeToolRow(done: Bool, title: String, detail: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: done ? "checkmark.circle.fill" : "circle")
                .foregroundColor(done ? Color(red: 36 / 255, green: 122 / 255, blue: 77 / 255) : Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.3))
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                Text(detail)
                    .font(.system(size: 12, weight: .medium, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.6))
                    .fixedSize(horizontal: false, vertical: true)
            }
            Spacer(minLength: 0)
        }
    }

    private var resumeProfile: some View {
        VStack(alignment: .leading, spacing: 10) {
            Text("DRAFT")
                .font(.system(size: 10, weight: .heavy, design: .rounded))
                .tracking(0.8)
                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.45))
            if draft.roles.isEmpty && draft.skills.isEmpty {
                Text("Nothing yet - jump on a call and start talking.")
                    .font(.system(size: 13, weight: .medium, design: .rounded))
                    .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.5))
            } else {
                if !draft.skills.isEmpty {
                    // Plain wrapped text, not an HStack of chips - an HStack
                    // doesn't wrap onto a second line in SwiftUI and this
                    // list can grow past one row width.
                    Text(draft.skills.joined(separator: "  \u{00b7}  "))
                        .font(.system(size: 12, weight: .bold, design: .rounded))
                        .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                        .padding(10)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .fixedSize(horizontal: false, vertical: true)
                        .background(RoundedRectangle(cornerRadius: 10, style: .continuous).fill(Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255).opacity(0.35)))
                }
                ForEach(Array(draft.roles.enumerated()), id: \.offset) { _, role in
                    VStack(alignment: .leading, spacing: 4) {
                        Text([role.title, role.org].filter { !$0.isEmpty }.joined(separator: " \u{00b7} "))
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255))
                        ForEach(role.bullets, id: \.self) { bullet in
                            Text("\u{2022} \(bullet)")
                                .font(.system(size: 12.5, weight: .medium, design: .rounded))
                                .foregroundColor(Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255).opacity(0.75))
                        }
                    }
                    .padding(12)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color(red: 244 / 255, green: 239 / 255, blue: 230 / 255)))
                }
            }
        }
        .accessibilityIdentifier("resumeAgentDraft")
    }

    private var applicationsToggle: some View {
        Button {
            mode = mode == .applications ? .profile : .applications
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "briefcase.fill")
                Text(mode == .applications ? "Back to draft" : (jobOSStore.state.roles.isEmpty ? "Applications" : "\(jobOSStore.state.roles.count) tracked roles"))
                Image(systemName: mode == .applications ? "arrow.uturn.left" : "chevron.right")
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

    /// LinkedIn paste / Drive folder / PDF upload - real extraction the
    /// native voice-only path above doesn't do yet (see CURSOR_HANDOFF.md
    /// Assignment H). Kept reachable, not deleted, same toggle shape as
    /// Applications.
    private var importToggle: some View {
        Button {
            mode = .importWeb
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "square.and.arrow.down")
                Text("Import (LinkedIn, Drive, PDF)")
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
        .accessibilityIdentifier("resumeOpenImport")
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
