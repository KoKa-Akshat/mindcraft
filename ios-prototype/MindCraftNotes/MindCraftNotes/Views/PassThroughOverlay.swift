import SwiftUI
import UIKit

/// Hosts the desk cards full-screen but claims touches ONLY inside the exact
/// card rectangles SwiftUI reports. Everything else falls through to the
/// Jesse Kitchen WKWebView below.
///
/// Why rects: SwiftUI does not create UIViews per view — heuristic walks of
/// the hosting tree either swallow the whole screen or drop card taps.
/// Explicit rectangles are deterministic. Inside a rect, the default hit-test
/// path runs and SwiftUI handles buttons/drags natively.
///
/// Content is type-erased to `AnyView` so Field Desk's huge card tree does not
/// SIGSEGV Swift runtime demangling.
struct PassThroughOverlay: UIViewRepresentable {
    var solidRects: [CGRect]
    var content: AnyView

    init(solidRects: [CGRect], @ViewBuilder content: () -> some View) {
        self.solidRects = solidRects
        self.content = AnyView(content())
    }

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> PassThroughUIView {
        let container = PassThroughUIView()
        container.backgroundColor = .clear
        container.isOpaque = false
        container.isMultipleTouchEnabled = true
        container.solidRects = solidRects

        let host = UIHostingController(rootView: content)
        host.view.backgroundColor = .clear
        host.view.isOpaque = false
        host.view.isUserInteractionEnabled = true
        host.view.translatesAutoresizingMaskIntoConstraints = false
        host.view.layer.isOpaque = false
        host.view.layer.backgroundColor = UIColor.clear.cgColor
        container.addSubview(host.view)
        NSLayoutConstraint.activate([
            host.view.leadingAnchor.constraint(equalTo: container.leadingAnchor),
            host.view.trailingAnchor.constraint(equalTo: container.trailingAnchor),
            host.view.topAnchor.constraint(equalTo: container.topAnchor),
            host.view.bottomAnchor.constraint(equalTo: container.bottomAnchor),
        ])
        context.coordinator.host = host
        return container
    }

    func updateUIView(_ uiView: PassThroughUIView, context: Context) {
        context.coordinator.host?.rootView = content
        context.coordinator.host?.view.backgroundColor = .clear
        context.coordinator.host?.view.isOpaque = false
        uiView.solidRects = solidRects
        uiView.backgroundColor = .clear
        uiView.isOpaque = false
    }

    final class Coordinator {
        var host: UIHostingController<AnyView>?
    }
}

final class PassThroughUIView: UIView {
    /// Card frames (in this view's coordinates) that should receive touches.
    var solidRects: [CGRect] = []

    override func point(inside point: CGPoint, with event: UIEvent?) -> Bool {
        guard isUserInteractionEnabled, !isHidden, alpha > 0.01 else { return false }
        return solidRects.contains { $0.contains(point) }
    }
}
