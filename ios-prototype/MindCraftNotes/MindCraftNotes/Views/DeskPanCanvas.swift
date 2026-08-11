import SwiftUI
import UIKit

/// Reliable weavy-style desk pan/zoom. UIScrollView under the hood.
/// SwiftUI `DragGesture` + fullScreenCover was eating swipes / bouncing home;
/// UIScrollView pans are native, don't dismiss the cover, and don't snap back.
struct DeskPanCanvas<Content: View>: UIViewRepresentable {
    var worldSize: CGSize
    var minZoom: CGFloat = 0.55
    var maxZoom: CGFloat = 2.2
    /// Slight zoom-out on first land so the Mac-desk home fits neatly.
    var initialZoom: CGFloat = 1
    /// When false, pinch zooms are disabled so a focused card can scale itself.
    var pinchEnabled: Bool = true
    var onOffsetChange: ((CGPoint, CGFloat) -> Void)?
    var content: () -> Content

    init(
        worldSize: CGSize,
        minZoom: CGFloat = 0.55,
        maxZoom: CGFloat = 2.2,
        initialZoom: CGFloat = 1,
        pinchEnabled: Bool = true,
        onOffsetChange: ((CGPoint, CGFloat) -> Void)? = nil,
        @ViewBuilder content: @escaping () -> Content
    ) {
        self.worldSize = worldSize
        self.minZoom = minZoom
        self.maxZoom = maxZoom
        self.initialZoom = initialZoom
        self.pinchEnabled = pinchEnabled
        self.onOffsetChange = onOffsetChange
        self.content = content
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(onOffsetChange: onOffsetChange, initialZoom: initialZoom)
    }

    func makeUIView(context: Context) -> UIScrollView {
        let scroll = UIScrollView()
        scroll.delegate = context.coordinator
        scroll.backgroundColor = .clear
        scroll.showsHorizontalScrollIndicator = false
        scroll.showsVerticalScrollIndicator = false
        scroll.alwaysBounceHorizontal = true
        scroll.alwaysBounceVertical = true
        scroll.bounces = true
        scroll.bouncesZoom = true
        scroll.decelerationRate = .fast
        scroll.contentInsetAdjustmentBehavior = .never
        scroll.minimumZoomScale = minZoom
        scroll.maximumZoomScale = maxZoom
        scroll.pinchGestureRecognizer?.isEnabled = pinchEnabled
        scroll.delaysContentTouches = false
        scroll.canCancelContentTouches = true
        scroll.isDirectionalLockEnabled = false
        scroll.accessibilityIdentifier = "fieldDeskPanSurface"

        let host = UIHostingController(rootView: content())
        host.view.backgroundColor = .clear
        host.view.frame = CGRect(origin: .zero, size: worldSize)
        // Important: hosting view must not clip so cards can receive taps.
        host.view.clipsToBounds = false
        scroll.addSubview(host.view)
        scroll.contentSize = worldSize
        context.coordinator.host = host
        context.coordinator.scrollView = scroll

        let startZoom = min(max(initialZoom, minZoom), maxZoom)
        if abs(startZoom - 1) > 0.01 {
            scroll.setZoomScale(startZoom, animated: false)
            scroll.contentSize = CGSize(
                width: worldSize.width * startZoom,
                height: worldSize.height * startZoom
            )
            context.coordinator.didApplyInitialZoom = true
            onOffsetChange?(scroll.contentOffset, scroll.zoomScale)
        }
        return scroll
    }

    func updateUIView(_ scroll: UIScrollView, context: Context) {
        context.coordinator.onOffsetChange = onOffsetChange
        guard let host = context.coordinator.host else { return }
        host.rootView = content()
        // Keep the untransformed frame at world size; UIScrollView applies zoom.
        if host.view.bounds.size != worldSize {
            host.view.frame = CGRect(origin: .zero, size: worldSize)
        }
        if scroll.zoomScale == 1, scroll.contentSize != worldSize {
            scroll.contentSize = worldSize
        }
        scroll.minimumZoomScale = minZoom
        scroll.maximumZoomScale = maxZoom
        scroll.pinchGestureRecognizer?.isEnabled = pinchEnabled
    }

    final class Coordinator: NSObject, UIScrollViewDelegate {
        var host: UIHostingController<Content>?
        weak var scrollView: UIScrollView?
        var onOffsetChange: ((CGPoint, CGFloat) -> Void)?
        var initialZoom: CGFloat
        var didApplyInitialZoom = false

        init(onOffsetChange: ((CGPoint, CGFloat) -> Void)?, initialZoom: CGFloat) {
            self.onOffsetChange = onOffsetChange
            self.initialZoom = initialZoom
        }

        func viewForZooming(in scrollView: UIScrollView) -> UIView? {
            host?.view
        }

        func scrollViewDidScroll(_ scrollView: UIScrollView) {
            onOffsetChange?(scrollView.contentOffset, scrollView.zoomScale)
        }

        func scrollViewDidZoom(_ scrollView: UIScrollView) {
            onOffsetChange?(scrollView.contentOffset, scrollView.zoomScale)
        }

        func scrollViewDidEndZooming(_ scrollView: UIScrollView, with view: UIView?, atScale scale: CGFloat) {
            // Keep contentSize honest after pinch.
            if let host {
                scrollView.contentSize = CGSize(
                    width: host.view.bounds.width * scale,
                    height: host.view.bounds.height * scale
                )
            }
            onOffsetChange?(scrollView.contentOffset, scrollView.zoomScale)
        }
    }
}
