import SwiftUI

/// Whiteboard-style Gdoc card — type + finger scribble.
struct DeskWhiteboardCard: View {
    private enum Tool: String, CaseIterable {
        case pen, marker, eraser
    }

    private struct Stroke: Identifiable {
        let id = UUID()
        let tool: Tool
        var points: [CGPoint]
    }

    @State private var title = "Untitled board"
    @State private var note = ""
    @State private var strokes: [Stroke] = []
    @State private var live: Stroke?
    @State private var tool: Tool = .pen
    /// Defaults to finger-allowed - this card is "type + finger scribble" by
    /// design (see the type doc comment above), unlike QuestionView's canvas
    /// which defaults to the stricter .pencilOnly. The toggle exists so a
    /// student holding an Apple Pencil can opt into real palm rejection
    /// instead of a resting palm adding stray marks.
    @State private var palmRejectionMode: PalmRejectionMode = .anyInput

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField("Board title", text: $title)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(boardHex: "143a2e"))
                Spacer(minLength: 0)
                Button {
                    palmRejectionMode = palmRejectionMode == .pencilOnly ? .anyInput : .pencilOnly
                } label: {
                    Image(systemName: palmRejectionMode == .pencilOnly ? "pencil.tip.crop.circle.badge.plus" : "hand.draw")
                        .font(.system(size: 11, weight: .bold))
                        .foregroundColor(Color(boardHex: "143a2e").opacity(0.65))
                        .frame(width: 28, height: 28)
                        .background(Circle().fill(Color(boardHex: "f3f0ea")))
                }
                .buttonStyle(.plain)
                .accessibilityIdentifier("deskWhiteboardPalmToggle")
                .accessibilityLabel(palmRejectionMode == .pencilOnly ? "Pencil only" : "Pencil + finger")
                ForEach(Tool.allCases, id: \.self) { t in
                    Button { tool = t } label: {
                        Image(systemName: icon(for: t))
                            .font(.system(size: 11, weight: .bold))
                            .foregroundColor(tool == t ? Color(boardHex: "0c1207") : Color(boardHex: "143a2e").opacity(0.55))
                            .frame(width: 28, height: 28)
                            .background(
                                Circle().fill(tool == t ? Color(boardHex: "c4f547") : Color(boardHex: "f3f0ea"))
                            )
                    }
                    .buttonStyle(.plain)
                }
            }

            TextEditor(text: $note)
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .scrollContentBackground(.hidden)
                .frame(minHeight: 36, maxHeight: 54)
                .padding(8)
                .background(RoundedRectangle(cornerRadius: 10).fill(Color(boardHex: "f7f5f0")))

            ZStack {
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(Color(boardHex: "fbfaf7"))
                Canvas { context, _ in
                    for stroke in strokes { draw(stroke, in: &context) }
                    if let live { draw(live, in: &context) }
                }
                .overlay(
                    // Plain SwiftUI DragGesture has no notion of touch type
                    // at all, so distinguishing a real Apple Pencil mark from
                    // a resting palm/finger has to happen at the UIKit touch
                    // layer - same reason CanvasView.swift's
                    // PassthroughCanvasView overrides hitTest instead of
                    // relying on PKCanvasView.drawingPolicy alone. This card
                    // doesn't use PencilKit (it has its own lightweight
                    // pen/marker/eraser model), so it gets its own minimal
                    // touch-type-aware capture view instead.
                    StrokeTouchCaptureView(
                        palmRejectionMode: palmRejectionMode,
                        onBegan: { point in
                            live = Stroke(tool: tool, points: [point])
                        },
                        onMoved: { point in
                            live?.points.append(point)
                        },
                        onEnded: {
                            if let finished = live {
                                if tool == .eraser {
                                    strokes.removeAll { stroke in
                                        stroke.points.contains { p in
                                            finished.points.contains {
                                                abs($0.x - p.x) < 14 && abs($0.y - p.y) < 14
                                            }
                                        }
                                    }
                                } else {
                                    strokes.append(finished)
                                }
                            }
                            live = nil
                        }
                    )
                )
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color(boardHex: "143a2e").opacity(0.10), lineWidth: 1)
            )
            .overlay(alignment: .topLeading) {
                // Same real-device-testability reason as CanvasView's
                // strokeCountLabel: the Simulator injects every touch as a
                // plain finger touch, so a UI test can't visually distinguish
                // "rejected" from "not tapped yet" - this readable count is
                // what actually proves palmRejectionMode is doing something.
                Text("\(strokes.count) strokes")
                    .font(.system(size: 1)).foregroundColor(.clear)
                    .accessibilityIdentifier("deskWhiteboardStrokeCount")
                    .accessibilityValue("\(strokes.count) strokes")
                    .allowsHitTesting(false)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
        // No wrapper identifier here - confirmed elsewhere in this session
        // (FieldDeskView's Binder card) that one clobbers every nested
        // identifier underneath it, which would take out
        // deskWhiteboardPalmToggle/deskWhiteboardStrokeCount right above.
        // The outer placed-card wrapper already has its own identifier
        // (`fieldDeskCard_gdoc`, see FieldDeskView's movableCard).
    }

    private func icon(for tool: Tool) -> String {
        switch tool {
        case .pen: return "pencil.tip"
        case .marker: return "highlighter"
        case .eraser: return "eraser"
        }
    }

    private func draw(_ stroke: Stroke, in context: inout GraphicsContext) {
        guard stroke.points.count > 1 else { return }
        var path = Path()
        path.move(to: stroke.points[0])
        for point in stroke.points.dropFirst() { path.addLine(to: point) }
        switch stroke.tool {
        case .pen:
            context.stroke(
                path,
                with: .color(Color(boardHex: "143a2e")),
                style: StrokeStyle(lineWidth: 2.6, lineCap: .round, lineJoin: .round)
            )
        case .marker:
            context.stroke(
                path,
                with: .color(Color(boardHex: "c4f547").opacity(0.85)),
                style: StrokeStyle(lineWidth: 12, lineCap: .round, lineJoin: .round)
            )
        case .eraser:
            break
        }
    }
}

/// Minimal UIKit touch-capture layer for `DeskWhiteboardCard`, reusing
/// `PalmRejectionMode` (see CanvasView.swift) so this card's "Pencil only"
/// toggle means exactly the same thing there and here. Only tracks a single
/// touch at a time (this card never needed multi-touch drawing) and reports
/// begin/move/end as plain SwiftUI-space points, keeping `DeskWhiteboardCard`
/// itself unaware this is UIKit underneath.
private struct StrokeTouchCaptureView: UIViewRepresentable {
    var palmRejectionMode: PalmRejectionMode
    var onBegan: (CGPoint) -> Void
    var onMoved: (CGPoint) -> Void
    var onEnded: () -> Void

    func makeUIView(context: Context) -> TouchView {
        let view = TouchView()
        view.backgroundColor = .clear
        view.isMultipleTouchEnabled = false
        view.palmRejectionMode = palmRejectionMode
        view.onBegan = onBegan
        view.onMoved = onMoved
        view.onEnded = onEnded
        return view
    }

    func updateUIView(_ uiView: TouchView, context: Context) {
        uiView.palmRejectionMode = palmRejectionMode
        uiView.onBegan = onBegan
        uiView.onMoved = onMoved
        uiView.onEnded = onEnded
    }

    final class TouchView: UIView {
        var palmRejectionMode: PalmRejectionMode = .anyInput
        var onBegan: ((CGPoint) -> Void)?
        var onMoved: ((CGPoint) -> Void)?
        var onEnded: (() -> Void)?
        private weak var activeTouch: UITouch?

        override func touchesBegan(_ touches: Set<UITouch>, with event: UIEvent?) {
            guard activeTouch == nil, let touch = touches.first else { return }
            if palmRejectionMode == .pencilOnly && touch.type != .pencil { return }
            activeTouch = touch
            onBegan?(touch.location(in: self))
        }

        override func touchesMoved(_ touches: Set<UITouch>, with event: UIEvent?) {
            guard let activeTouch, touches.contains(activeTouch) else { return }
            onMoved?(activeTouch.location(in: self))
        }

        override func touchesEnded(_ touches: Set<UITouch>, with event: UIEvent?) {
            guard let activeTouch, touches.contains(activeTouch) else { return }
            self.activeTouch = nil
            onEnded?()
        }

        override func touchesCancelled(_ touches: Set<UITouch>, with event: UIEvent?) {
            guard let activeTouch, touches.contains(activeTouch) else { return }
            self.activeTouch = nil
            onEnded?()
        }
    }
}

/// Presentation card — real deck with title/body and slide paging.
struct DeskPresentationCard: View {
    private struct Slide: Identifiable {
        let id: UUID
        var title: String
        var body: String

        init(id: UUID = UUID(), title: String, body: String) {
            self.id = id
            self.title = title
            self.body = body
        }
    }

    @State private var slides: [Slide] = [
        Slide(title: "Untitled deck", body: "Your first point goes here."),
        Slide(title: "Next beat", body: "Add what you want the room to remember."),
    ]
    @State private var index = 0

    var body: some View {
        let safeIndex = min(max(0, index), max(0, slides.count - 1))

        return VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Presentation")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(1.0)
                    .foregroundColor(Color.white.opacity(0.45))
                Spacer(minLength: 0)
                Text("\(safeIndex + 1) / \(max(slides.count, 1))")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(Color(boardHex: "c4f547"))
                    .monospacedDigit()
            }

            VStack(alignment: .leading, spacing: 10) {
                TextField(
                    "Slide title",
                    text: Binding(
                        get: { slides[safeIndex].title },
                        set: { slides[safeIndex].title = $0 }
                    )
                )
                .font(.system(size: 16, weight: .bold, design: .rounded))
                .foregroundColor(Color(boardHex: "f4f7f2"))

                TextField(
                    "Talking point",
                    text: Binding(
                        get: { slides[safeIndex].body },
                        set: { slides[safeIndex].body = $0 }
                    ),
                    axis: .vertical
                )
                .font(.system(size: 12, weight: .semibold, design: .rounded))
                .foregroundColor(Color.white.opacity(0.78))
                .lineLimit(3...5)
            }
            .padding(14)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
            .background(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .fill(LinearGradient(
                        colors: [Color(boardHex: "16222c"), Color(boardHex: "0d141b")],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 10, style: .continuous)
                    .strokeBorder(Color.white.opacity(0.14), lineWidth: 1)
            )

            HStack(spacing: 8) {
                Button { index = max(0, index - 1) } label: {
                    Image(systemName: "chevron.left")
                        .font(.system(size: 12, weight: .heavy))
                        .frame(width: 34, height: 30)
                        .background(Capsule().fill(Color.white.opacity(0.10)))
                }
                .buttonStyle(.plain)
                .disabled(safeIndex == 0)
                .opacity(safeIndex == 0 ? 0.35 : 1)

                Button {
                    let insertAt = min(safeIndex + 1, slides.count)
                    slides.insert(Slide(title: "New slide", body: "Say the next thing."), at: insertAt)
                    index = insertAt
                } label: {
                    Text("+ Slide")
                        .font(.system(size: 11, weight: .heavy, design: .rounded))
                        .padding(.horizontal, 12)
                        .frame(height: 30)
                        .background(Capsule().fill(Color(boardHex: "c4f547")))
                        .foregroundColor(Color(boardHex: "0c1207"))
                }
                .buttonStyle(.plain)

                Spacer(minLength: 0)

                Button { index = min(slides.count - 1, index + 1) } label: {
                    Image(systemName: "chevron.right")
                        .font(.system(size: 12, weight: .heavy))
                        .frame(width: 34, height: 30)
                        .background(Capsule().fill(Color.white.opacity(0.10)))
                }
                .buttonStyle(.plain)
                .disabled(safeIndex >= slides.count - 1)
                .opacity(safeIndex >= slides.count - 1 ? 0.35 : 1)
            }
            .foregroundColor(.white)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(boardHex: "101820")))
        .accessibilityIdentifier("deskPresentationCard")
    }
}

private extension Color {
    init(boardHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xff) / 255,
            green: Double((value >> 8) & 0xff) / 255,
            blue: Double(value & 0xff) / 255
        )
    }
}
