import SwiftUI
import WebKit

/// The Blockly workspace behind a Design Studio `.simulation` box - a
/// `WKWebView` shell in the same pattern as `CreateStudioView`/
/// `ResumeAgentView` (native owns enter/exit + persistence, web owns the
/// editor), loading the new Blockly page whose source of truth is
/// `agent_work/product/desk_os/studio/simulation/` (bundled via a folder
/// reference and served over `mcworld://`, with the deployed Firebase copy
/// as fallback - same dual-source arrangement as Create Studio).
///
/// The workspace state round-trips through the box's own payload:
/// `initialState` is injected after the page loads
/// (`window.mcLoadWorkspace`), and every change the page autosaves comes
/// back through the `deskAction` bridge as `simulationState` → `onSave` →
/// `ContentGraphStore`. Unlike `CreateStudioView` there is deliberately NO
/// static cached WKWebView here: that cache exists to keep ONE global page
/// warm, but this page's content is per-box - reusing a warm instance
/// across different boxes would flash box A's blocks inside box B before
/// the seed script ran.
struct SimulationStudioView: View {
    var boxTitle: String
    var initialState: String
    var referenceURL: String
    var onSave: (String) -> Void
    var onClose: () -> Void

    @Environment(\.openURL) private var openURL

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("SIMULATION WORKSPACE")
                        .font(.system(size: 9, weight: .heavy, design: .rounded))
                        .tracking(1)
                        .foregroundColor(Color(simHex: "143a2e").opacity(0.45))
                    Text(boxTitle.isEmpty ? "Untitled simulation" : boxTitle)
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(Color(simHex: "143a2e"))
                        .lineLimit(1)
                }
                Spacer(minLength: 0)
                if let url = URL(string: referenceURL), !referenceURL.isEmpty {
                    Button {
                        openURL(url)
                    } label: {
                        HStack(spacing: 5) {
                            Image(systemName: "link")
                            Text("Reference")
                        }
                        .font(.system(size: 11.5, weight: .bold, design: .rounded))
                        .foregroundColor(Color(simHex: "5b3e8f"))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 7)
                        .background(Capsule().strokeBorder(Color(simHex: "5b3e8f").opacity(0.4), lineWidth: 1))
                    }
                    .buttonStyle(.plain)
                    .accessibilityIdentifier("simulationStudioReference")
                }
                Button(action: onClose) {
                    Text("Done")
                        .font(.system(size: 12.5, weight: .bold, design: .rounded))
                        .foregroundColor(Color(simHex: "0c1207"))
                        .padding(.horizontal, 16)
                        .padding(.vertical, 8)
                        .background(Capsule().fill(Color(simHex: "c4f547")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("simulationStudioDone")
            }
            .padding(.horizontal, 18)
            .padding(.vertical, 12)
            .background(Color(simHex: "fff8e9"))

            SimulationWebView(initialState: initialState, onSave: onSave, onClose: onClose)
                .ignoresSafeArea(edges: .bottom)
        }
        .background(Color(simHex: "fff8e9").ignoresSafeArea())
        .statusBarHidden(true)
        .accessibilityElement(children: .contain)
        .overlay(alignment: .topLeading) {
            Text(verbatim: "simulation-studio").font(.system(size: 1)).foregroundColor(.clear)
                .accessibilityIdentifier("simulationStudioRoot")
                .allowsHitTesting(false)
        }
    }
}

private struct SimulationWebView: UIViewRepresentable {
    var initialState: String
    var onSave: (String) -> Void
    var onClose: () -> Void

    static var pageURL: URL {
        // Bundled copy first (folder reference at the agent_work source of
        // truth), live deployed page as fallback - same order
        // CreateStudioView resolves its studio page.
        if let root = Bundle.main.resourceURL {
            let bundled = root.appendingPathComponent("simulation/index.html")
            if FileManager.default.fileExists(atPath: bundled.path) {
                return URL(string: "\(KitchenSchemeHandler.scheme)://simulation/index.html")!
            }
        }
        return URL(string: "https://mindcraft-93858.web.app/desk-os/studio/simulation/?v=r1")!
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(initialState: initialState, onSave: onSave, onClose: onClose)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.setURLSchemeHandler(KitchenSchemeHandler(), forURLScheme: KitchenSchemeHandler.scheme)
        config.userContentController.add(context.coordinator, name: "deskAction")

        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = true
        view.backgroundColor = UIColor(red: 255 / 255, green: 248 / 255, blue: 233 / 255, alpha: 1)
        view.scrollView.backgroundColor = view.backgroundColor
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) {
            view.isInspectable = true
        }
        view.accessibilityIdentifier = "simulationStudioWebView"
        view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: Self.pageURL, cachePolicy: .useProtocolCachePolicy))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onSave = onSave
        context.coordinator.onClose = onClose
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        let initialState: String
        var onSave: (String) -> Void
        var onClose: () -> Void

        init(initialState: String, onSave: @escaping (String) -> Void, onClose: @escaping () -> Void) {
            self.initialState = initialState
            self.onSave = onSave
            self.onClose = onClose
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "deskAction",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }
            DispatchQueue.main.async { [weak self] in
                guard let self else { return }
                switch action {
                case "back":
                    self.onClose()
                case "simulationState":
                    if let state = body["state"] as? String {
                        self.onSave(state)
                    }
                default:
                    break
                }
            }
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            guard !initialState.isEmpty else { return }
            // JSON-encode the state string itself so it survives quotes/
            // newlines inside the workspace JSON - the page receives the
            // raw string back and parses it.
            guard let data = try? JSONSerialization.data(withJSONObject: [initialState]),
                  let wrapped = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript(
                "window.mcLoadWorkspace && window.mcLoadWorkspace(\(wrapped)[0]);",
                completionHandler: nil
            )
        }
    }
}

private extension Color {
    init(simHex hex: String) {
        var value: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xff) / 255
        let g = Double((value >> 8) & 0xff) / 255
        let b = Double(value & 0xff) / 255
        self.init(red: r, green: g, blue: b)
    }
}
