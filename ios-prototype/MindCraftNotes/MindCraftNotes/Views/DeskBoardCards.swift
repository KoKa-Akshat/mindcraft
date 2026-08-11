import SwiftUI
import PencilKit

/// Whiteboard-style Gdoc card — type + Apple Pencil / finger scribble.
struct DeskWhiteboardCard: View {
    @State private var title = "Untitled board"
    @State private var note = ""
    @State private var canvas = PKCanvasView()
    @State private var tool: BoardTool = .pen

    private enum BoardTool: String, CaseIterable {
        case pen, marker, eraser
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                TextField("Board title", text: $title)
                    .font(.system(size: 13, weight: .heavy, design: .rounded))
                    .foregroundColor(Color(boardHex: "143a2e"))
                Spacer(minLength: 0)
                ForEach(BoardTool.allCases, id: \.self) { t in
                    Button {
                        tool = t
                        applyTool()
                    } label: {
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

            BoardCanvasRepresentable(canvas: $canvas)
                .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                .overlay(
                    RoundedRectangle(cornerRadius: 12, style: .continuous)
                        .strokeBorder(Color(boardHex: "143a2e").opacity(0.10), lineWidth: 1)
                )
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .onAppear { applyTool() }
        }
        .padding(12)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color.white))
        .accessibilityIdentifier("deskWhiteboardCard")
    }

    private func icon(for tool: BoardTool) -> String {
        switch tool {
        case .pen: return "pencil.tip"
        case .marker: return "highlighter"
        case .eraser: return "eraser"
        }
    }

    private func applyTool() {
        canvas.drawingPolicy = .anyInput
        canvas.backgroundColor = .clear
        canvas.isOpaque = false
        switch tool {
        case .pen:
            canvas.tool = PKInkingTool(.pen, color: UIColor(red: 0.08, green: 0.12, blue: 0.10, alpha: 1), width: 3.2)
        case .marker:
            canvas.tool = PKInkingTool(.marker, color: UIColor(red: 0.77, green: 0.96, blue: 0.28, alpha: 0.85), width: 14)
        case .eraser:
            canvas.tool = PKEraserTool(.vector)
        }
    }
}

private struct BoardCanvasRepresentable: UIViewRepresentable {
    @Binding var canvas: PKCanvasView

    func makeUIView(context: Context) -> PKCanvasView {
        canvas.backgroundColor = UIColor(red: 0.99, green: 0.99, blue: 0.97, alpha: 1)
        canvas.drawingPolicy = .anyInput
        canvas.isOpaque = false
        return canvas
    }

    func updateUIView(_ uiView: PKCanvasView, context: Context) {}
}

/// Presentation card — real deck with title/body and slide paging.
struct DeskPresentationCard: View {
    @State private var slides: [DeckSlide] = [
        DeckSlide(title: "Untitled deck", body: "Your first point goes here."),
        DeckSlide(title: "Next beat", body: "Add what you want the room to remember."),
    ]
    @State private var index = 0

    private var slide: Binding<DeckSlide> {
        Binding(
            get: { slides[min(max(0, index), slides.count - 1)] },
            set: { slides[min(max(0, index), slides.count - 1)] = $0 }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 8) {
                Text("Presentation")
                    .font(.system(size: 10, weight: .heavy, design: .rounded))
                    .tracking(1.0)
                    .foregroundColor(Color.white.opacity(0.45))
                Spacer(minLength: 0)
                Text("\(index + 1) / \(slides.count)")
                    .font(.system(size: 11, weight: .bold, design: .rounded))
                    .foregroundColor(Color(boardHex: "c4f547"))
                    .monospacedDigit()
            }

            VStack(alignment: .leading, spacing: 10) {
                TextField("Slide title", text: slide.title)
                    .font(.system(size: 16, weight: .bold, design: .rounded))
                    .foregroundColor(Color(boardHex: "f4f7f2"))
                TextField("Talking point", text: slide.body, axis: .vertical)
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
                .disabled(index == 0)
                .opacity(index == 0 ? 0.35 : 1)

                Button {
                    slides.insert(DeckSlide(title: "New slide", body: "Say the next thing."), at: index + 1)
                    index += 1
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
                .disabled(index >= slides.count - 1)
                .opacity(index >= slides.count - 1 ? 0.35 : 1)
            }
            .foregroundColor(.white)
        }
        .padding(10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(RoundedRectangle(cornerRadius: 12).fill(Color(boardHex: "101820")))
        .accessibilityIdentifier("deskPresentationCard")
    }
}

private struct DeckSlide: Identifiable, Equatable {
    let id = UUID()
    var title: String
    var body: String
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
