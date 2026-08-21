import SwiftUI

/// Catalog of assembled, gated chapter content
/// (mindcraft-content-engine's book_assembler output, fetched live via
/// BookLibraryClient — see CONTENT_VOICE_PLATFORM_ARCHITECTURE.md for the
/// full pipeline this is the app-side end of). Presented as a sheet from
/// DeskGridDashboardView's "Library" dock chip, deliberately NOT another
/// FieldDeskView full-screen overlay — that overlay system has a real,
/// documented touch-swallowing bug class (see CLAUDE.md's FieldDeskView
/// section) that a plain SwiftUI `.sheet` sidesteps entirely.
///
/// Real fix, 2026-08-21, from direct live feedback: this used to be BOTH
/// the catalog AND the reading destination — a student would open Library
/// to read, and the book existed nowhere else. That's wrong: "I'm assuming
/// this library is the place where everything I've learned gets stored...
/// no, this should be stored in the binder as its own book." Now this is
/// a catalog ONLY — opening a book here files a durable `BinderItem`
/// (`BinderStore.addChapterBook`) so it lives in the Binder like every
/// other filed item, then opens the same reader that reopening it from the
/// Binder later will use.
///
/// Same ink/cream palette as DeskGridDashboardView so the sheet reads as
/// part of the same product, not a bolted-on screen.
struct BookLibraryView: View {
    // Callback, not a direct BinderStore reference - matches this
    // codebase's own established pattern for reaching Binder from a view
    // that doesn't otherwise hold it (DeskGridDashboardView, which
    // presents this sheet, already does the same thing for filing
    // homework help via `onFileHomeworkToBinder`). FieldDeskView (the
    // real owner of `@StateObject private var binderStore`) supplies the
    // real implementation down the chain.
    var onFileChapterBook: (_ title: String, _ subjectId: String) -> Void = { _, _ in }
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
            BookReaderView(book: book, onClose: { openBook = nil })
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
            let book = try await BookLibraryClient.getBook(subjectId: summary.subjectId)
            onFileChapterBook(book.title, book.subjectId)
            openBook = book
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
