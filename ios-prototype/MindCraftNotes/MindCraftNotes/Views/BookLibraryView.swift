import SwiftUI

/// List + reader for assembled, gated chapter content
/// (mindcraft-content-engine's book_assembler output, fetched live via
/// BookLibraryClient — see CONTENT_VOICE_PLATFORM_ARCHITECTURE.md for the
/// full pipeline this is the app-side end of). Presented as a sheet from
/// DeskGridDashboardView's "Library" dock chip, deliberately NOT another
/// FieldDeskView full-screen overlay — that overlay system has a real,
/// documented touch-swallowing bug class (see CLAUDE.md's FieldDeskView
/// section) that a plain SwiftUI `.sheet` sidesteps entirely by using
/// UIKit's own presentation controller instead of the custom ZStack/zIndex
/// overlay stack.
///
/// Same ink/cream palette as DeskGridDashboardView (`gridHex: "143a2e"`
/// dark-green ink, `"fff8e9"` cream, `"c4f547"` lime) so the sheet reads as
/// part of the same product, not a bolted-on screen.
struct BookLibraryView: View {
    @Environment(\.dismiss) private var dismiss
    @State private var summaries: [AssembledBookSummary] = []
    @State private var isLoading = true
    @State private var loadError: String?
    @State private var openBook: AssembledBook?

    private let ink = Color(gridHex: "143a2e")
    private let cream = Color(gridHex: "fff8e9")
    private let lime = Color(gridHex: "c4f547")

    var body: some View {
        NavigationStack {
            ZStack {
                cream.ignoresSafeArea()
                content
            }
            .navigationTitle("Chapter Library")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
        .task { await load() }
        .fullScreenCover(item: $openBook) { book in
            BookReaderView(book: book, ink: ink, cream: cream, lime: lime)
        }
    }

    @ViewBuilder
    private var content: some View {
        if isLoading {
            ProgressView().tint(ink)
        } else if let loadError {
            VStack(spacing: 10) {
                Text("Couldn't load the library").font(.system(size: 16, weight: .bold, design: .rounded))
                Text(loadError).font(.system(size: 13, design: .rounded)).foregroundColor(ink.opacity(0.6))
                Button("Try again") { Task { await load() } }
                    .font(.system(size: 13, weight: .bold, design: .rounded))
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(Capsule().fill(lime))
                    .foregroundColor(ink)
            }
            .padding()
        } else if summaries.isEmpty {
            VStack(spacing: 6) {
                Text("No chapters yet").font(.system(size: 16, weight: .bold, design: .rounded))
                Text("Assembled chapters show up here once they're ready.")
                    .font(.system(size: 13, design: .rounded)).foregroundColor(ink.opacity(0.6))
            }
        } else {
            List(summaries) { summary in
                Button {
                    Task { await openBookTapped(summary) }
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(summary.title).font(.system(size: 16, weight: .bold, design: .rounded)).foregroundColor(ink)
                        Text(summary.coverageLabel)
                            .font(.system(size: 12, weight: .semibold, design: .rounded))
                            .foregroundColor(ink.opacity(0.55))
                    }
                    .padding(.vertical, 4)
                }
                .listRowBackground(cream)
            }
            .listStyle(.plain)
            .scrollContentBackground(.hidden)
        }
    }

    private func load() async {
        isLoading = true
        loadError = nil
        do {
            summaries = try await BookLibraryClient.listBooks()
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    private func openBookTapped(_ summary: AssembledBookSummary) async {
        do {
            openBook = try await BookLibraryClient.getBook(subjectId: summary.subjectId)
        } catch {
            loadError = error.localizedDescription
        }
    }
}

// Same per-file convention every other view in this codebase follows
// (DeskGridDashboardView, ConceptChapterView, etc. each define their own —
// none is shared/internal) rather than a single shared extension.
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

/// The reader itself — one scrollable chapter/section flow. Sim/discussion
/// links render as informational rows for now (title + coverage note), not
/// tappable launches into MicroSimView — the sim HTML files
/// (data/companion_units/sims/.../main.html) aren't deployed anywhere this
/// app can reach yet, a separate, real follow-up (see the sync script's own
/// doc comment) rather than something to fake here.
struct BookReaderView: View {
    let book: AssembledBook
    let ink: Color
    let cream: Color
    let lime: Color
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 28) {
                    header
                    ForEach(book.chapters) { chapter in
                        chapterView(chapter)
                    }
                }
                .padding(20)
            }
            .background(cream.ignoresSafeArea())
            .navigationTitle(book.title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            // Same honest-coverage framing book_assembler.py's own markdown
            // front matter carries — never let a partial book read as
            // finished.
            Text(book.coverageLabel.uppercased())
                .font(.system(size: 11, weight: .bold, design: .rounded))
                .foregroundColor(ink.opacity(0.5))
            if !book.uncovered.isEmpty {
                Text("Not yet covered: " + book.uncovered.prefix(6).joined(separator: ", ")
                     + (book.uncovered.count > 6 ? ", …" : ""))
                    .font(.system(size: 12, design: .rounded))
                    .foregroundColor(ink.opacity(0.45))
            }
        }
    }

    private func chapterView(_ chapter: AssembledBookChapter) -> some View {
        VStack(alignment: .leading, spacing: 20) {
            Text(chapter.taxonomyId)
                .font(.system(size: 13, weight: .bold, design: .rounded))
                .foregroundColor(ink)
                .padding(.horizontal, 10).padding(.vertical, 5)
                .background(Capsule().fill(lime))
            ForEach(chapter.sections) { section in
                sectionView(section)
            }
        }
    }

    private func sectionView(_ section: AssembledBookSection) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            Text(section.title)
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(ink)

            let present = section.buildsOnLabels.filter { !section.assumesMissing.contains($0) }
            if !present.isEmpty || !section.assumesMissing.isEmpty {
                VStack(alignment: .leading, spacing: 2) {
                    if !present.isEmpty {
                        Text("Builds on " + present.joined(separator: ", "))
                    }
                    if !section.assumesMissing.isEmpty {
                        Text("Also assumes (not yet in this book): " + section.assumesMissing.joined(separator: ", "))
                    }
                }
                .font(.system(size: 12, design: .rounded).italic())
                .foregroundColor(ink.opacity(0.55))
            }

            // Native Markdown rendering (bold/italic) via AttributedString —
            // the prose gate's own generation prompt keeps body text to
            // plain paragraphs, no headings, so this is enough without a
            // full Markdown library.
            Text((try? AttributedString(markdown: section.body)) ?? AttributedString(section.body))
                .font(.system(size: 16, design: .rounded))
                .foregroundColor(ink.opacity(0.85))
                .lineSpacing(5)

            if let simTitle = section.simTitle {
                simRow(title: simTitle, bridge: section.simBridge)
            }
            if let discussionTitle = section.discussionTitle {
                HStack(spacing: 6) {
                    Image(systemName: "bubble.left.and.bubble.right.fill")
                    Text("Talk it through with Jesse: \(discussionTitle)")
                }
                .font(.system(size: 13, weight: .semibold, design: .rounded))
                .foregroundColor(ink.opacity(0.7))
            }
        }
        .padding(16)
        .background(RoundedRectangle(cornerRadius: 16).fill(Color.white))
        .overlay(RoundedRectangle(cornerRadius: 16).strokeBorder(ink.opacity(0.08)))
    }

    private func simRow(title: String, bridge: String?) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 6) {
                Image(systemName: "play.circle.fill")
                Text("Try it interactively: \(title)")
            }
            .font(.system(size: 13, weight: .semibold, design: .rounded))
            if let bridge, !bridge.isEmpty {
                Text(bridge).font(.system(size: 12, design: .rounded)).foregroundColor(ink.opacity(0.6))
            }
        }
        .foregroundColor(ink.opacity(0.8))
        .padding(10)
        .background(RoundedRectangle(cornerRadius: 10).fill(lime.opacity(0.25)))
    }
}
