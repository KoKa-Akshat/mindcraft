import SwiftUI
import PencilKit

/// Blank Google-Docs-style scribble page from Field Desk `+`.
/// Student writes with Pencil; after pen lift, strokes recognize to notes /
/// LaTeX (same MyScript path as the question desk) and the ink clears.
///
/// `embedded: true` keeps the page in the current desk window (no new route).
struct BlankDeskPageView: View {
    var embedded: Bool = false
    var onFile: ((String, String) -> Void)?
    var onClose: () -> Void

    @StateObject private var drawingStore = DrawingStore()
    @State private var clearSignal = 0
    @State private var recognizeSignal = 0
    @State private var pageTitle = "Untitled page"
    @State private var notes = ""
    @State private var latexLines: [String] = []
    @State private var isRecognizing = false
    @State private var recognizeError: String?
    @State private var strokeCount = 0
    @State private var idleWorkItem: DispatchWorkItem?

    var body: some View {
        Group {
            if embedded {
                pageChrome
                    .accessibilityIdentifier("blankDeskPage")
            } else {
                NavigationStack {
                    pageChrome
                        .navigationTitle("Blank page")
                        .navigationBarTitleDisplayMode(.inline)
                        .toolbar { toolbarItems }
                        .accessibilityIdentifier("blankDeskPage")
                }
            }
        }
    }

    @ToolbarContentBuilder
    private var toolbarItems: some ToolbarContent {
        ToolbarItem(placement: .topBarTrailing) {
            Button("Close", action: onClose)
        }
        ToolbarItem(placement: .topBarTrailing) {
            Button("File to Binder", action: fileToBinder)
                .font(.system(size: 14, weight: .bold, design: .rounded))
                .disabled(composedBody().isEmpty)
        }
    }

    private var pageChrome: some View {
        ZStack {
            Color(blankHex: "f7f3ee")

            VStack(spacing: 0) {
                if embedded {
                    HStack {
                        Text("Blank page · this window")
                            .font(.system(size: 13, weight: .heavy, design: .rounded))
                            .foregroundColor(Color(blankHex: "6f6a61"))
                        Spacer()
                        Button("File", action: fileToBinder)
                            .font(.system(size: 14, weight: .bold, design: .rounded))
                            .disabled(composedBody().isEmpty)
                        Button("Close", action: onClose)
                            .font(.system(size: 14, weight: .semibold, design: .rounded))
                    }
                    .padding(.horizontal, 16)
                    .padding(.top, 12)
                    .padding(.bottom, 4)
                }

                TextField("Page title", text: $pageTitle)
                    .font(.system(size: 22, weight: .semibold, design: .serif))
                    .padding(.horizontal, 20)
                    .padding(.top, embedded ? 4 : 8)
                    .padding(.bottom, 6)

                ZStack {
                    RoundedRectangle(cornerRadius: 16, style: .continuous)
                        .fill(Color.white)
                        .shadow(color: .black.opacity(0.08), radius: 12, y: 4)

                    VStack(spacing: 28) {
                        ForEach(0..<12, id: \.self) { _ in
                            Rectangle()
                                .fill(Color(blankHex: "d9e4f0").opacity(0.7))
                                .frame(height: 1)
                        }
                        Spacer(minLength: 0)
                    }
                    .padding(.horizontal, 24)
                    .padding(.top, 40)
                    .allowsHitTesting(false)

                    CanvasView(
                        questionId: "blank-desk-page",
                        palmRejectionMode: .pencilOnly,
                        store: drawingStore,
                        clearSignal: $clearSignal,
                        recognizeSignal: $recognizeSignal,
                        onDrawingCaptured: { drawing, size in
                            recognize(drawing: drawing, canvasSize: size)
                        },
                        onStrokeCountChange: { count in
                            strokeCount = count
                            scheduleIdleRecognize()
                        }
                    )
                    .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
                }
                .padding(.horizontal, 16)
                .frame(maxHeight: .infinity)

                notesPanel
                    .padding(.horizontal, 16)
                    .padding(.vertical, 12)
            }
        }
    }

    private var notesPanel: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Notes · lifts clear the page")
                    .font(.system(size: 12, weight: .bold, design: .rounded))
                    .foregroundColor(Color(blankHex: "8a8478"))
                Spacer()
                if isRecognizing {
                    ProgressView().controlSize(.mini)
                } else if strokeCount > 0 {
                    Text("\(strokeCount) stroke\(strokeCount == 1 ? "" : "s")")
                        .font(.system(size: 11, weight: .semibold, design: .rounded))
                        .foregroundColor(Color(blankHex: "8a8478"))
                }
            }

            if !latexLines.isEmpty {
                ForEach(latexLines, id: \.self) { line in
                    Text(line)
                        .font(.system(size: 15, weight: .medium, design: .monospaced))
                        .foregroundColor(Color(blankHex: "143a2e"))
                        .padding(8)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(
                            RoundedRectangle(cornerRadius: 10)
                                .fill(Color(blankHex: "c4f547").opacity(0.22))
                        )
                }
            }

            TextEditor(text: $notes)
                .font(.system(size: 15, weight: .medium, design: .rounded))
                .frame(minHeight: 72, maxHeight: 110)
                .scrollContentBackground(.hidden)
                .padding(8)
                .background(
                    RoundedRectangle(cornerRadius: 12)
                        .fill(Color.white.opacity(0.85))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .stroke(Color(blankHex: "d9d2c5"), lineWidth: 1)
                        )
                )

            if let recognizeError {
                Text(recognizeError)
                    .font(.system(size: 11, weight: .medium, design: .rounded))
                    .foregroundColor(Color(blankHex: "b3261e"))
            }
        }
    }

    private func fileToBinder() {
        let body = composedBody()
        let title = pageTitle.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Untitled page" : pageTitle
        onFile?(title, body)
        onClose()
    }

    private func scheduleIdleRecognize() {
        idleWorkItem?.cancel()
        guard strokeCount > 0, !isRecognizing else { return }
        let work = DispatchWorkItem {
            recognizeSignal += 1
        }
        idleWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.85, execute: work)
    }

    private func recognize(drawing: PKDrawing, canvasSize: CGSize) {
        guard !drawing.strokes.isEmpty else { return }
        isRecognizing = true
        recognizeError = nil
        Task {
            defer { isRecognizing = false }
            do {
                let latex = try await MyScriptRecognizer.recognizeLatex(
                    drawing: drawing,
                    canvasSize: canvasSize
                )
                let trimmed = latex.trimmingCharacters(in: .whitespacesAndNewlines)
                guard !trimmed.isEmpty else { return }
                if looksLikeMath(trimmed) {
                    latexLines.append(trimmed)
                } else if notes.isEmpty {
                    notes = trimmed
                } else {
                    notes += "\n" + trimmed
                }
                clearSignal += 1
                strokeCount = 0
            } catch {
                recognizeError = error.localizedDescription
            }
        }
    }

    private func looksLikeMath(_ text: String) -> Bool {
        text.contains("\\") || text.contains("=") || text.contains("^") || text.contains("_")
    }

    private func composedBody() -> String {
        var parts: [String] = []
        let n = notes.trimmingCharacters(in: .whitespacesAndNewlines)
        if !n.isEmpty { parts.append(n) }
        if !latexLines.isEmpty {
            parts.append(latexLines.map { "$$ \($0) $$" }.joined(separator: "\n"))
        }
        return parts.joined(separator: "\n\n")
    }
}

private extension Color {
    init(blankHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        self.init(
            red: Double((value >> 16) & 0xFF) / 255,
            green: Double((value >> 8) & 0xFF) / 255,
            blue: Double(value & 0xFF) / 255
        )
    }
}
