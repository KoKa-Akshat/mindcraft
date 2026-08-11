import SwiftUI
import WebKit

/// Spatial Create board — the locked desk-os studio (`?v=spatial2`), opened
/// from Jesse’s via the white polka doorway. Web owns the orbital board;
/// native owns enter/exit.
struct CreateStudioView: View {
    var onClose: () -> Void

    private static let paper = Color(red: 247 / 255, green: 245 / 255, blue: 240 / 255)

    var body: some View {
        ZStack(alignment: .topLeading) {
            Self.paper.ignoresSafeArea()

            // Web owns the polka cream board + Jesse’s topbar capsule.
            CreateStudioWebView(onAction: { action in
                if action == "back" { onClose() }
            })
            .ignoresSafeArea()

            // Hidden a11y / test hook — visual back lives in the studio topbar.
            Button(action: onClose) {
                Color.clear.frame(width: 1, height: 1)
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("createStudioBackJesse")
            .accessibilityLabel("Back to Jesse's")
        }
        .statusBarHidden(true)
        .accessibilityIdentifier("createStudioRoot")
    }
}

private struct CreateStudioWebView: UIViewRepresentable {
    var onAction: ((String) -> Void)?

    static var studioURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.createStudioURL"),
           let url = URL(string: override) {
            return url
        }
        // Bundled spatial board + Jesse embed chrome (`from=jesse`).
        return URL(string: "\(KitchenSchemeHandler.scheme)://studio/index.html?v=spatial2&from=jesse")!
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onAction: onAction)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = []
        config.setURLSchemeHandler(KitchenSchemeHandler(), forURLScheme: KitchenSchemeHandler.scheme)
        config.userContentController.add(context.coordinator, name: "deskAction")

        let view = WKWebView(frame: .zero, configuration: config)
        view.isOpaque = true
        view.backgroundColor = UIColor(red: 247 / 255, green: 245 / 255, blue: 240 / 255, alpha: 1)
        view.scrollView.backgroundColor = view.backgroundColor
        view.scrollView.bounces = false
        view.scrollView.contentInsetAdjustmentBehavior = .never
        if #available(iOS 16.4, *) {
            view.isInspectable = true
        }
        view.accessibilityIdentifier = "createStudioWebView"
        view.navigationDelegate = context.coordinator
        view.load(URLRequest(url: Self.studioURL, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {
        context.coordinator.onAction = onAction
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "deskAction")
        uiView.navigationDelegate = nil
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
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
