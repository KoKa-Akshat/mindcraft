import SwiftUI

/// "Create a new book" full-page flow (2026-08-22, reference images +
/// explicit ask: tapping "+ New" on the Work dashboard opens this instead
/// of a compact sheet). Modeled directly on `ArchiveGenerateSimSheet`
/// (`ArchiveWorkflowView.swift`) - same real call
/// (`BookGenerationClient.generate(topic:)`), bigger chrome matching the
/// reference's form.
///
/// Honest scope note: "Add sources" (Books/Archives/Files) and "Choose a
/// starting format" (Course/Book/Study guide) are decorative for v1 -
/// `BookGenerationClient.generate(topic:)` takes only a topic string today,
/// no source or format parameter exists to wire either row up for real.
/// Deliberately built with no `JesseCallSession` reference at all - matches
/// the explicit ask ("it does not speak, it creates the lessons on the
/// binder again"): this view only ever shows text/progress, never TTS.
struct CreateBookView: View {
    var onClose: () -> Void
    var onFiled: (_ subjectId: String, _ title: String) -> Void

    @State private var topic = ""
    @State private var selectedFormat = "Book"
    @State private var isGenerating = false
    @State private var chaptersReady = 0
    @State private var totalChapters = 0
    @State private var errorMessage: String?
    @State private var didFile = false

    private let cover = Color(red: 20 / 255, green: 58 / 255, blue: 46 / 255)
    private let lime = Color(red: 196 / 255, green: 245 / 255, blue: 71 / 255)

    var body: some View {
        ZStack {
            Color(gridHex: "faf6ea").ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 22) {
                    HStack {
                        Text("Create a new book")
                            .font(.mcContent(size: 26, weight: .semibold))
                            .foregroundColor(cover)
                        Spacer(minLength: 0)
                        Button(action: onClose) {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 22))
                                .foregroundColor(cover.opacity(0.5))
                        }
                        .buttonStyle(.plain)
                        .accessibilityIdentifier("createBookClose")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("What do you want to learn or write?")
                            .font(.mcChrome(size: 13, weight: .heavy))
                            .foregroundColor(cover)
                        TextField("e.g. \u{201c}Newton's laws for 9th grade\u{201d}", text: $topic, axis: .vertical)
                            .lineLimit(3, reservesSpace: true)
                            .padding(12)
                            .background(RoundedRectangle(cornerRadius: 12, style: .continuous).fill(Color.white))
                            .disabled(isGenerating)
                            .accessibilityIdentifier("createBookTopicField")
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Add sources")
                            .font(.mcChrome(size: 13, weight: .heavy))
                            .foregroundColor(cover)
                        HStack(spacing: 10) {
                            decorativeChip("Books", system: "books.vertical.fill")
                            decorativeChip("Archives", system: "archivebox.fill")
                            decorativeChip("Files", system: "doc.fill")
                        }
                    }

                    VStack(alignment: .leading, spacing: 8) {
                        Text("Choose a starting format")
                            .font(.mcChrome(size: 13, weight: .heavy))
                            .foregroundColor(cover)
                        HStack(spacing: 10) {
                            formatChip("Course")
                            formatChip("Book")
                            formatChip("Study guide")
                        }
                    }

                    Button {
                        Task { await generate() }
                    } label: {
                        HStack {
                            Image(systemName: "sparkle")
                            Text(isGenerating ? "Building\u{2026}" : "Build in Binder")
                        }
                        .font(.system(size: 15, weight: .heavy, design: .rounded))
                        .foregroundColor(cover)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 14)
                        .background(Capsule().fill(lime))
                    }
                    .buttonStyle(.plain)
                    .disabled(topic.trimmingCharacters(in: .whitespaces).isEmpty || isGenerating || didFile)
                    .accessibilityIdentifier("createBookBuildInBinder")

                    if let errorMessage {
                        Text(errorMessage)
                            .font(.system(size: 12, design: .rounded))
                            .foregroundColor(.red)
                    }

                    if isGenerating || totalChapters > 0 {
                        VStack(alignment: .leading, spacing: 10) {
                            Text("Your book will include these lessons")
                                .font(.mcChrome(size: 13, weight: .heavy))
                                .foregroundColor(cover)
                            ForEach(0..<max(totalChapters, 3), id: \.self) { index in
                                HStack(spacing: 10) {
                                    Circle()
                                        .fill(index < chaptersReady ? lime : Color.black.opacity(0.15))
                                        .frame(width: 8, height: 8)
                                    Text("Lesson \(index + 1)")
                                        .font(.system(size: 13, weight: .semibold, design: .rounded))
                                        .foregroundColor(cover.opacity(0.8))
                                    Rectangle()
                                        .fill(Color.black.opacity(0.08))
                                        .frame(height: 6)
                                        .clipShape(Capsule())
                                }
                            }
                        }
                        .padding(14)
                        .background(RoundedRectangle(cornerRadius: 14, style: .continuous).fill(Color.white))
                        .accessibilityIdentifier("createBookLessonPreview")
                    }

                    if didFile {
                        Text("Filed in your Binder.")
                            .font(.system(size: 13, weight: .semibold, design: .rounded))
                            .foregroundColor(cover)
                    }
                }
                .padding(24)
            }
        }
    }

    private func decorativeChip(_ title: String, system: String) -> some View {
        VStack(spacing: 6) {
            Image(systemName: system)
            Text(title).font(.system(size: 12, weight: .semibold, design: .rounded))
        }
        .foregroundColor(cover.opacity(0.55))
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(RoundedRectangle(cornerRadius: 12, style: .continuous).strokeBorder(cover.opacity(0.2), style: StrokeStyle(lineWidth: 1, dash: [4, 4])))
    }

    private func formatChip(_ title: String) -> some View {
        Text(title)
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            .foregroundColor(selectedFormat == title ? .white : cover.opacity(0.7))
            .frame(maxWidth: .infinity)
            .padding(.vertical, 10)
            .background(
                Capsule().fill(selectedFormat == title ? cover : Color.white)
            )
            .onTapGesture { selectedFormat = title }
    }

    /// No `speak()`/`JesseCallSession` anywhere in this function - the
    /// explicit ask this view exists to satisfy ("it does not speak, it
    /// creates the lessons on the binder again"). Filing reuses
    /// `onOpenBinderChapterBook`'s exact real path already wired end-to-end
    /// (`FieldDeskView.openChapterBookFromBinder` -> `BookReaderView`).
    private func generate() async {
        isGenerating = true
        errorMessage = nil
        // Activity feed (2026-08-27) - same log-only shape as
        // JesseCallSession's own BookGenerationClient call sites.
        let activityId = UUID().uuidString
        GenerationActivityBus.shared.logStart(id: activityId, title: topic, phase: "generating")
        let verdict = await BookGenerationClient.generate(topic: topic) { ready, total in
            chaptersReady = ready
            totalChapters = total
        }
        isGenerating = false
        switch verdict {
        case .verified(let book, _, _, _):
            chaptersReady = book.chapters.count
            totalChapters = book.chapters.count
            onFiled(book.subjectId, book.title)
            didFile = true
            GenerationActivityBus.shared.logFinish(id: activityId, title: topic)
        case .noGoodResult(let reason):
            errorMessage = reason ?? "Couldn't build a good lesson from that topic \u{2014} try rephrasing it."
            GenerationActivityBus.shared.logFail(id: activityId, title: topic, reason: reason ?? "no good result")
        case .rateLimited(let reason):
            errorMessage = reason ?? "Generation is rate-limited right now \u{2014} try again shortly."
            GenerationActivityBus.shared.logFail(id: activityId, title: topic, reason: reason ?? "rate limited")
        case .unavailable(let reason):
            errorMessage = reason ?? "Couldn't reach the generation service."
            GenerationActivityBus.shared.logFail(id: activityId, title: topic, reason: reason ?? "unavailable")
        }
    }
}

private extension Color {
    init(gridHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
