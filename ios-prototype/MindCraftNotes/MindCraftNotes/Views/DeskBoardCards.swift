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

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField("Board title", text: $title)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(boardHex: "143a2e"))
                Spacer(minLength: 0)
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
                .gesture(
                    DragGesture(minimumDistance: 0)
                        .onChanged { value in
                            let point = value.location
                            if live == nil {
                                live = Stroke(tool: tool, points: [point])
                            } else {
                                live?.points.append(point)
                            }
                        }
                        .onEnded { _ in
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
            }
            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .strokeBorder(Color(boardHex: "143a2e").opacity(0.10), lineWidth: 1)
            )
            .frame(maxWidth: .infinity, maxHeight: .infinity)
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
        .accessibilityIdentifier("deskWhiteboardCard")
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
