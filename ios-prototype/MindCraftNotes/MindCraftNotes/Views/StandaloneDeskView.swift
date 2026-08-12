import SwiftUI
import WebKit

/// Full-screen Standalone Desk — the spatial field-desk surface served from
/// the app bundle (`deskweb/desk.html`) over `mcworld://desk/`.
///
/// Clear separation from Jesse's Kitchen: the desk owns every touch while it
/// is up (pan, zoom, drag, resize, notes all live inside the web surface),
/// so none of the overlay hit-testing complexity applies here.
struct StandaloneDeskView: View {
    var onBackToKitchen: () -> Void
    /// Manage button inside the web desk → hub page (instances + map + workflows).
    var onManage: (() -> Void)? = nil
    /// ACT map inside the binder → ACT dash.
    var onOpenAct: (() -> Void)? = nil
    /// Workflows dock → native workflow library / Job OS.
    var onWorkflows: (() -> Void)? = nil
    /// Volume pill inside the web desk → kitchen audio.
    var onSound: ((Bool) -> Void)? = nil

    private static let paper = Color(red: 247 / 255, green: 248 / 255, blue: 244 / 255)
    private static let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)

    var body: some View {
        ZStack(alignment: .topLeading) {
            Self.paper.ignoresSafeArea()

            // Native chrome owns logo / mode toggle; web owns the desk plane.
            DeskWebView(onAction: { action in
                switch action {
                case "manage":
                    onManage?()
                case "back":
                    onBackToKitchen()
                case "act":
                    onOpenAct?()
                case "workflows":
                    onWorkflows?()
                case "soundOn":
                    onSound?(true)
                case "soundOff":
                    onSound?(false)
                default:
                    break
                }
            })
            .ignoresSafeArea()

            // Hidden a11y hook kept for tests that closed the desk by id.
            Button(action: onBackToKitchen) {
                Color.clear.frame(width: 1, height: 1)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("standaloneDeskBackToKitchen")
            .accessibilityLabel("Back to Jesse's")
        }
        .accessibilityIdentifier("standaloneDeskRoot")
    }
}

private struct DeskWebView: UIViewRepresentable {
    var onAction: ((String) -> Void)?

    static var deskURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.standaloneDeskURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "\(KitchenSchemeHandler.scheme)://desk/desk.html")!
    }

    /// Diagnosed: `if showStandaloneDesk { StandaloneDeskView(...) }` in
    /// FieldDeskView fully destroys this `UIViewRepresentable` every time the
    /// user leaves the Desk, so returning used to call `makeUIView` fresh —
    /// a full HTML/CSS/JS cold start (plus the Google Fonts network fetch in
    /// desk.html's `<head>`) on every single visit. That cold start, not the
    /// old `.reloadIgnoringLocalCacheData` policy, was the visible "glitch"
    /// (the top-level `mcworld://` load is served by `KitchenSchemeHandler`
    /// straight from the bundle and never touches the HTTP cache regardless
    /// of policy). Fix: keep one `WKWebView` alive for the process lifetime
    /// and reuse it — the page loads once and later visits just re-parent it.
    private static var cachedWebView: WKWebView?

    func makeCoordinator() -> Coordinator {
        Coordinator(onAction: onAction)
    }

    func makeUIView(context: Context) -> WKWebView {
        if let cached = Self.cachedWebView {
            // Re-bind the native bridge to this mount's coordinator; the
            // page itself (and all its DOM/JS state) stays exactly as the
            // user left it.
            cached.configuration.userContentController.removeScriptMessageHandler(forName: "deskAction")
            cached.configuration.userContentController.add(context.coordinator, name: "deskAction")
            return cached
        }

        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.setURLSchemeHandler(KitchenSchemeHandler(), forURLScheme: KitchenSchemeHandler.scheme)
        // Same `deskAction` bridge shape the kitchen embed uses — the desk
        // page posts {action:'manage'} from its Manage button.
        config.userContentController.add(context.coordinator, name: "deskAction")

        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = true
        view.backgroundColor = UIColor(red: 247 / 255, green: 248 / 255, blue: 244 / 255, alpha: 1)
        view.scrollView.backgroundColor = view.backgroundColor
        view.scrollView.isScrollEnabled = false
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) {
            view.isInspectable = true
        }
        view.accessibilityIdentifier = "standaloneDeskWebView"
        // Standard HTTP caching (was `.reloadIgnoringLocalCacheData`, which
        // forced a no-cache network re-fetch on the debug URL-override path
        // every load — inert for the default bundled `mcworld://` path since
        // the scheme handler never consults the HTTP cache either way).
        view.load(URLRequest(url: Self.deskURL, cachePolicy: .useProtocolCachePolicy))
        Self.cachedWebView = view
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onAction = onAction
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        // Deliberately do NOT remove the script message handler or discard
        // the view here — `cachedWebView` keeps it alive so the next mount
        // reuses the already-loaded page instead of reloading from scratch.
    }

    final class Coordinator: NSObject, WKScriptMessageHandler {
        var onAction: ((String) -> Void)?

        init(onAction: ((String) -> Void)?) {
            self.onAction = onAction
        }

        func userContentController(
            _ userContentController: WKUserContentController,
            didReceive message: WKScriptMessage
        ) {
            guard message.name == "deskAction",
                  let body = message.body as? [String: Any],
                  let action = body["action"] as? String else { return }
            DispatchQueue.main.async { [weak self] in
                self?.onAction?(action)
            }
        }
    }
}

/// White polka dots growing from the center until they merge into a solid
/// sheet — the doorway animation between Jesse's Kitchen and the Desk.
struct PolkaTransitionOverlay: View, Animatable {
    /// 0 = invisible, 1 = solid white sheet.
    var progress: CGFloat

    var animatableData: CGFloat {
        get { progress }
        set { progress = newValue }
    }

    private let spacing: CGFloat = 68

    var body: some View {
        GeometryReader { proxy in
            let size = proxy.size
            let center = CGPoint(x: size.width / 2, y: size.height / 2)
            let maxDist = max(hypot(center.x, center.y), 1)
            Canvas { ctx, canvasSize in
                let cols = Int(ceil(canvasSize.width / spacing)) + 2
                let rows = Int(ceil(canvasSize.height / spacing)) + 2
                for row in 0..<rows {
                    let stagger: CGFloat = row % 2 == 0 ? 0 : spacing / 2
                    for col in 0..<cols {
                        let x = CGFloat(col) * spacing + stagger - spacing / 2
                        let y = CGFloat(row) * spacing - spacing / 2
                        let dist = hypot(x - center.x, y - center.y)
                        // Radial stagger — center dots bloom first.
                        let local = min(1, max(0, progress * 1.9 - (dist / maxDist) * 0.9))
                        guard local > 0.01 else { continue }
                        // 0.78 × spacing overlaps the staggered grid fully.
                        let r = local * spacing * 0.78
                        ctx.fill(
                            Path(ellipseIn: CGRect(x: x - r, y: y - r, width: r * 2, height: r * 2)),
                            with: .color(.white)
                        )
                    }
                }
            }
        }
        .ignoresSafeArea()
        .allowsHitTesting(progress > 0.02)
        .accessibilityHidden(true)
    }
}
