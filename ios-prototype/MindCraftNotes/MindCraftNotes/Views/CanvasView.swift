import SwiftUI
import PencilKit

/// How the canvas decides which touches are allowed to draw.
///
/// This maps directly onto `PKCanvasView.drawingPolicy`, which is Apple's
/// own palm rejection, not a hand rolled heuristic:
///
/// - `.pencilOnly` ignores every finger and palm touch outright. Only an
///   Apple Pencil mark ever becomes ink. This is the strongest possible
///   guarantee against a resting palm drawing, because non-pencil touches
///   are never even considered, and it is the default here.
/// - `.anyInput` lets a finger draw too, relying on iPadOS's own
///   pencil-vs-touch disambiguation (the same system GoodNotes/Notability
///   sit on top of) rather than any custom touch-shape/timing heuristic
///   written for this prototype.
///
/// Both options are exposed with a toggle in QuestionView so a real device
/// or simulator test can compare a resting palm's behavior under each
/// policy, per the prototype's verification requirements.
enum PalmRejectionMode: String, CaseIterable, Identifiable {
    case pencilOnly = "Pencil only"
    case anyInput = "Pencil + finger"

    var id: String { rawValue }

    var drawingPolicy: PKCanvasViewDrawingPolicy {
        switch self {
        case .pencilOnly: return .pencilOnly
        case .anyInput: return .anyInput
        }
    }
}

/// A `PKCanvasView` subclass that lets non-pencil touches pass straight
/// through to whatever sits underneath it in z-order, instead of always
/// claiming the touch just because it's the topmost view at that point.
///
/// **Why this exists (round 9)**: `QuestionView` now overlays this canvas
/// transparently across the WHOLE visible page (question card, choices,
/// graph - see `QuestionView`'s top doc comment) instead of confining it to
/// its own boxed column, so a student can write anywhere, GoodNotes-style.
/// That only works if finger touches meant for scrolling, tapping a choice,
/// tapping the check-answer button, or focusing the graph's text field
/// actually reach those views instead of being swallowed by the canvas
/// sitting on top of them. `drawingPolicy = .pencilOnly` does NOT solve
/// this on its own - it only controls whether PencilKit's own drawing
/// gesture recognizes a touch as ink, not whether this VIEW intercepts the
/// touch at the hit-test level; plain UIKit hit-testing resolves whichever
/// view is topmost at a point as the touch's target regardless of
/// `drawingPolicy`. Overriding `hitTest` to return `nil` for any touch that
/// isn't a genuine Apple Pencil (while `.pencilOnly` is selected) makes
/// those touches invisible to this view entirely, so UIKit keeps searching
/// and finds the real underlying target - restoring normal scrolling and
/// normal button/field interaction with a finger, while a real Pencil mark
/// still lands as ink anywhere on the page. Under `.anyInput` (the existing
/// debug toggle for comparing palm-rejection behavior - see
/// `PalmRejectionMode`) this intentionally reverts to normal hit-testing
/// (claims every touch): asking a finger to draw and asking a finger to
/// scroll/tap have always been mutually exclusive on that toggle, a known,
/// accepted tradeoff of deliberately choosing it, not a bug.
final class PassthroughCanvasView: PKCanvasView {
    override func hitTest(_ point: CGPoint, with event: UIEvent?) -> UIView? {
        if drawingPolicy == .pencilOnly {
            let hasPencilTouch = event?.allTouches?.contains { $0.type == .pencil } ?? false
            if !hasPencilTouch { return nil }
        }
        return super.hitTest(point, with: event)
    }
}

/// SwiftUI wrapper around PKCanvasView, PencilKit's own Metal backed,
/// pressure and tilt aware drawing surface. This prototype deliberately
/// does not build a custom Metal renderer: PKCanvasView already is one,
/// tuned by Apple for Apple Pencil latency and predictive stroke smoothing,
/// and reaching past it here would be re-solving an already solved problem.
struct CanvasView: UIViewRepresentable {
    let questionId: String
    let palmRejectionMode: PalmRejectionMode
    @ObservedObject var store: DrawingStore

    /// Bumped externally (see QuestionView's Clear button) to force the
    /// canvas back to an empty drawing without recreating the whole view.
    @Binding var clearSignal: Int

    /// Bumped externally (see QuestionView's Recognize button) to capture
    /// the current drawing for handwriting recognition without needing a
    /// permanent two-way binding to the live PKDrawing.
    @Binding var recognizeSignal: Int

    /// Reports the drawing and the canvas's own on-screen size back up when
    /// recognizeSignal changes, since MyScript's recognition needs real
    /// pixel/point dimensions to correctly scale strokes, not an assumed
    /// constant.
    var onDrawingCaptured: ((PKDrawing, CGSize) -> Void)?

    /// Reports the live stroke count back up to QuestionView, which shows
    /// it as a small "N strokes" label. This exists for two real reasons,
    /// not just as a test hook: it gives the student visible confirmation
    /// that their work is actually being captured, and it doubles as an
    /// accessibility-readable signal an XCTest UI test can assert against
    /// to verify palm rejection with a real simulated touch (see
    /// MindCraftNotesUITests), since the Simulator has no physical Pencil
    /// and cannot otherwise prove a touch was accepted or rejected.
    var onStrokeCountChange: ((Int) -> Void)?

    /// Live "Call" co-working (NATIVE_APP_BUILD_PLAN.md "New product
    /// surfaces since 2026-07-25" §1): fires once per NEWLY COMPLETED stroke
    /// (never for a stroke already reported, never per-point mid-stroke) with
    /// that stroke's points normalized 0...1 against the canvas's own current
    /// bounds - the same wire shape `LiveSessionClient.appendStroke` expects.
    /// nil (the default) is a true no-op: every other caller of `CanvasView`
    /// that doesn't pass this closure pays no cost and sends nothing to
    /// Firestore, matching every other optional callback on this type.
    var onStrokeCompleted: (([LiveStrokePoint]) -> Void)?

    func makeUIView(context: Context) -> PKCanvasView {
        // `PassthroughCanvasView`, not plain `PKCanvasView` - round 9, see
        // its own doc comment above for why: this canvas is now a full-page
        // transparent overlay, not a boxed writing area, and needs the
        // hit-test passthrough to coexist with tappable/scrollable content
        // underneath it.
        let canvasView = PassthroughCanvasView()
        canvasView.delegate = context.coordinator
        canvasView.drawingPolicy = palmRejectionMode.drawingPolicy
        // Round 9: transparent, not the old opaque gray "paper" fill - the
        // canvas overlays real page content (the paper-textured question
        // card, graph, etc.) now, so it must let that show through with ink
        // drawn on top of it, not paint its own separate surface over it.
        canvasView.backgroundColor = .clear
        canvasView.isOpaque = false
        // `PKCanvasView` is itself a `UIScrollView` subclass. Now that it's
        // nested inside an ancestor SwiftUI `ScrollView` (round 9's
        // full-page layout), its own pan/scroll machinery would otherwise
        // compete with that ancestor's for the same finger-drag gesture.
        // Disabling it here hands scrolling entirely to the ancestor
        // `ScrollView`; it has no effect on drawing itself, which works
        // directly off touches within the view's bounds regardless of this
        // flag.
        canvasView.isScrollEnabled = false
        canvasView.accessibilityIdentifier = "drawingCanvas"
        canvasView.isAccessibilityElement = true

        // Claim first responder (needed for the tool picker, see
        // configureToolPickerIfNeeded) only when the canvas is actually
        // touched, not automatically as soon as it appears on screen.
        // cancelsTouchesInView is false so this never competes with
        // PKCanvasView's own drawing gesture recognizers; it only piggybacks
        // on the same touch to claim responder status alongside it.
        let focusTap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.canvasWasTouched))
        focusTap.cancelsTouchesInView = false
        focusTap.delegate = context.coordinator
        canvasView.addGestureRecognizer(focusTap)

        // Round 9 update: the canvas now DOES sit inside a scrolling page
        // (its own `isScrollEnabled = false` above hands that scrolling to
        // the ancestor `ScrollView` rather than doing it itself. PencilKit
        // still renders whatever's currently on screen at full framerate
        // with no custom tiling layer needed for a page this size; a truly
        // enormous multi-page infinite canvas would be the point where
        // tile-based rendering became worth revisiting, not reached here).
        // Zoom stays locked to 1 either way - pinch-to-zoom was never part
        // of this prototype's scope.
        canvasView.minimumZoomScale = 1
        canvasView.maximumZoomScale = 1

        context.coordinator.canvasView = canvasView
        context.coordinator.onStrokeCountChange = onStrokeCountChange
        context.coordinator.onStrokeCompleted = onStrokeCompleted
        context.coordinator.loadInitialDrawing(for: questionId)
        return canvasView
    }

    func updateUIView(_ canvasView: PKCanvasView, context: Context) {
        canvasView.drawingPolicy = palmRejectionMode.drawingPolicy

        // Real fix: `onStrokeCompleted` isn't a fixed closure like the other
        // callbacks here - its very presence (nil vs non-nil) changes over
        // the canvas's lifetime as a Live Call starts/ends, WITHOUT the
        // canvas itself being torn down and recreated (no `.id()` change).
        // `makeUIView` only runs once per canvas instance, so refreshing
        // this here on every `updateUIView` pass is what actually lets a
        // call started mid-session begin forwarding strokes - without this,
        // the coordinator would stay frozen on whatever value (usually nil)
        // was captured when the canvas first appeared.
        context.coordinator.onStrokeCompleted = onStrokeCompleted

        // Note on question switching: QuestionView applies `.id(question.id)`
        // to this view, so SwiftUI tears down and recreates the whole
        // UIViewRepresentable (dismantleUIView then makeUIView) whenever the
        // question changes, rather than this method having to detect and
        // handle an in-place question swap. dismantleUIView below saves the
        // outgoing drawing immediately before the old PKCanvasView goes
        // away; makeUIView loads the new question's saved drawing into the
        // fresh one. That keeps this method's job to exactly two things:
        // reflect the current palm rejection mode, and react to Clear.

        if context.coordinator.lastHandledClearSignal != clearSignal {
            context.coordinator.lastHandledClearSignal = clearSignal
            canvasView.drawing = PKDrawing()
            store.saveNow(drawing: canvasView.drawing, for: questionId)
            // Clearing bypasses canvasViewDrawingDidChange's normal
            // increasing-count path entirely (drawing is replaced directly,
            // not edited via a PencilKit gesture) - reset the live-stroke
            // watermark too, or the next real stroke after a clear would
            // read as "count went from 0 to 1" correctly, but a clear made
            // mid-session after strokes were already live-broadcast would
            // otherwise leave the watermark stuck above 0 with nothing left
            // to compare against.
            context.coordinator.lastKnownStrokeCount = 0
        }

        if context.coordinator.lastHandledRecognizeSignal != recognizeSignal {
            context.coordinator.lastHandledRecognizeSignal = recognizeSignal
            onDrawingCaptured?(canvasView.drawing, canvasView.bounds.size)
        }

        context.coordinator.configureToolPickerIfNeeded(for: canvasView)
    }

    static func dismantleUIView(_ canvasView: PKCanvasView, coordinator: Coordinator) {
        // Belt and suspenders: force a final save if the view is torn down
        // (e.g. navigating away) so nothing sitting in the debounce window
        // is lost.
        coordinator.saveCurrentDrawingImmediately()
    }

    func makeCoordinator() -> Coordinator {
        Coordinator(store: store)
    }

    final class Coordinator: NSObject, PKCanvasViewDelegate, UIGestureRecognizerDelegate {
        private let store: DrawingStore
        weak var canvasView: PKCanvasView?
        var currentQuestionId: String?
        var lastHandledClearSignal = 0
        var lastHandledRecognizeSignal = 0
        var onStrokeCountChange: ((Int) -> Void)?
        var onStrokeCompleted: (([LiveStrokePoint]) -> Void)?
        /// Watermark for the Live Call stroke-completion diff below -
        /// everything at index `< lastKnownStrokeCount` in
        /// `canvasView.drawing.strokes` has already been reported via
        /// `onStrokeCompleted`; only strokes at or past this index are new.
        var lastKnownStrokeCount = 0
        private var toolPickerConfigured = false
        private var toolPicker: PKToolPicker?

        init(store: DrawingStore) {
            self.store = store
        }

        func loadInitialDrawing(for questionId: String) {
            currentQuestionId = questionId
            Task { [weak self] in
                guard let self, let canvasView = self.canvasView else { return }
                let drawing = await self.store.loadDrawing(for: questionId)
                await MainActor.run {
                    // Guard against a question switch that happened while
                    // the background load was in flight.
                    if self.currentQuestionId == questionId {
                        canvasView.drawing = drawing
                        self.onStrokeCountChange?(drawing.strokes.count)
                        // Strokes restored from a PRIOR local save are not
                        // "new" for Live Call purposes - start the watermark
                        // at the already-saved count so only strokes drawn
                        // from this point forward get live-broadcast.
                        self.lastKnownStrokeCount = drawing.strokes.count
                    }
                }
            }
        }

        func saveCurrentDrawingImmediately() {
            guard let canvasView, let questionId = currentQuestionId else { return }
            store.saveNow(drawing: canvasView.drawing, for: questionId)
        }

        /// PKToolPicker gives a full system pen/marker/pencil/eraser
        /// palette for free (per the prototype brief: use it instead of
        /// building a custom tool palette). This is wired up lazily once
        /// the canvas view actually has a window to attach the picker to.
        /// Creating a standalone instance (rather than the older
        /// `PKToolPicker.shared(for:)` per-window registry, deprecated
        /// since iOS 14) is the current recommended approach.
        func configureToolPickerIfNeeded(for canvasView: PKCanvasView) {
            guard !toolPickerConfigured, canvasView.window != nil else { return }
            let picker = PKToolPicker()
            picker.setVisible(true, forFirstResponder: canvasView)
            picker.addObserver(canvasView)
            // Deliberately NOT calling canvasView.becomeFirstResponder() here:
            // this method runs as soon as the canvas has a window (i.e. as
            // soon as it appears on screen), and claiming first responder
            // that early holds it permanently since nothing else ever
            // resigns it, which silently blocks any other field (e.g. the
            // graph's LaTeX text field) from ever getting keyboard focus for
            // the rest of the session. First responder is claimed instead
            // only on an actual touch, see canvasWasTouched below.
            toolPicker = picker
            toolPickerConfigured = true
        }

        /// Claims first responder (and therefore tool picker visibility)
        /// only in response to a real touch on the canvas, so tapping
        /// anywhere else in the app (e.g. the graph's equation field) can
        /// take keyboard focus normally instead of the canvas holding onto
        /// it indefinitely.
        @objc func canvasWasTouched() {
            canvasView?.becomeFirstResponder()
        }

        func gestureRecognizer(_ gestureRecognizer: UIGestureRecognizer, shouldRecognizeSimultaneouslyWith otherGestureRecognizer: UIGestureRecognizer) -> Bool {
            true
        }

        // MARK: PKCanvasViewDelegate

        func canvasViewDrawingDidChange(_ canvasView: PKCanvasView) {
            guard let questionId = currentQuestionId else { return }
            let strokes = canvasView.drawing.strokes
            onStrokeCountChange?(strokes.count)
            // The delegate callback itself fires on the main thread (a
            // UIKit requirement), but everything expensive it triggers,
            // encoding the drawing to Data and writing it to Core Data,
            // happens inside DrawingStore on a background context. This
            // call only schedules that work; it does not do it.
            store.scheduleSave(drawing: canvasView.drawing, for: questionId)

            // Live Call: broadcast only strokes that are genuinely NEW since
            // the last time this fired - `canvasViewDrawingDidChange` can
            // fire more than once per stroke while it's still being drawn,
            // but PencilKit only APPENDS a stroke to `drawing.strokes` once
            // it's finalized, so comparing the array's count (not diffing
            // contents) reliably isolates "strokes completed since we last
            // looked," matching the web app's own one-doc-per-COMPLETED-
            // stroke contract (`liveSession.ts`'s `appendLiveStroke` doc
            // comment: "so two people drawing at once don't clobber each
            // other"). A count that went DOWN (PencilKit undo/eraser) is
            // just resynced, never reported as a negative/invalid diff.
            if let onStrokeCompleted, strokes.count > lastKnownStrokeCount {
                let canvasSize = canvasView.bounds.size
                for stroke in strokes[lastKnownStrokeCount...] {
                    let points = Self.normalizedPoints(from: stroke, canvasSize: canvasSize)
                    if !points.isEmpty {
                        onStrokeCompleted(points)
                    }
                }
            }
            lastKnownStrokeCount = strokes.count
        }

        /// Converts one finalized `PKStroke`'s path into the flat
        /// `LiveStrokePoint` shape `LiveSessionClient.appendStroke` writes to
        /// Firestore, normalized 0...1 against the canvas's OWN current
        /// bounds (not a fixed logical size) so a stroke recorded on any
        /// device's canvas replays at the same RELATIVE position on any
        /// other device's differently-sized canvas/scratchpad - the same
        /// cross-device concern the web `ScratchPad` already has to live
        /// with (its own points are captured in that browser's own pixel
        /// space too), not a new problem this introduces.
        ///
        /// Thinned to at most 200 points per stroke (evenly, not truncated)
        /// so one long, slow stroke can't blow past Firestore's per-document
        /// size limits. PencilKit can report hundreds of points for a
        /// single unhurried stroke.
        private static func normalizedPoints(from stroke: PKStroke, canvasSize: CGSize) -> [LiveStrokePoint] {
            guard canvasSize.width > 0, canvasSize.height > 0 else { return [] }
            let raw: [LiveStrokePoint] = stroke.path.map { strokePoint in
                LiveStrokePoint(
                    x: Double(strokePoint.location.x / canvasSize.width),
                    y: Double(strokePoint.location.y / canvasSize.height),
                    p: max(0, min(1, Double(strokePoint.force)))
                )
            }
            let cap = 200
            guard raw.count > cap else { return raw }
            let stride = Double(raw.count) / Double(cap)
            var thinned: [LiveStrokePoint] = []
            var i = 0.0
            while Int(i) < raw.count {
                thinned.append(raw[Int(i)])
                i += stride
            }
            return thinned
        }
    }
}
