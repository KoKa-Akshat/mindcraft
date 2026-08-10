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

    private static let paper = Color(red: 247 / 255, green: 248 / 255, blue: 244 / 255)
    private static let ink = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)

    var body: some View {
        ZStack(alignment: .topLeading) {
            Self.paper.ignoresSafeArea()

            DeskWebView()
                .ignoresSafeArea()

            Button(action: onBackToKitchen) {
                HStack(spacing: 7) {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .heavy))
                    Text("Kitchen")
                        .font(.system(size: 13, weight: .heavy, design: .rounded))
                }
                .foregroundColor(Self.ink)
                .padding(.horizontal, 14)
                .padding(.vertical, 9)
                .background(
                    Capsule()
                        .fill(Color.white.opacity(0.95))
                        .shadow(color: .black.opacity(0.16), radius: 10, y: 4)
                )
                .overlay(Capsule().strokeBorder(Self.ink.opacity(0.14), lineWidth: 1))
            }
            .padding(.top, 12)
            .padding(.leading, 16)
            .accessibilityIdentifier("standaloneDeskBackToKitchen")
        }
        .accessibilityIdentifier("standaloneDeskRoot")
    }
}

private struct DeskWebView: UIViewRepresentable {
    static var deskURL: URL {
        if let override = UserDefaults.standard.string(forKey: "deskOs.standaloneDeskURL"),
           let url = URL(string: override) {
            return url
        }
        return URL(string: "\(KitchenSchemeHandler.scheme)://desk/desk.html")!
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.setURLSchemeHandler(KitchenSchemeHandler(), forURLScheme: KitchenSchemeHandler.scheme)

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
        view.load(URLRequest(url: Self.deskURL, cachePolicy: .reloadIgnoringLocalCacheData))
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
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
