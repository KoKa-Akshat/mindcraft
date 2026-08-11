import SwiftUI

/// The Dashboard's "Notes" tab - real tutor-session and homework summaries,
/// ported from `DashboardNotesPanel.tsx` (same two Firestore collections via
/// `SessionNotesClient`). Deliberately a plain list rather than the web's
/// page-flip book leaves - that's a visual flourish the plain list can pick
/// up later; the real data and real gating (published/completed) come first.
/// Styled with the same "canvas desk" ink/paper palette as Home and Map
/// (see those files) rather than plain iOS system colors.
struct NotesListView: View {
    @StateObject private var client = SessionNotesClient()

    // iPad-native layout audit (Phase 5 round 5): this was a single-column
    // `ForEach` list of cards stretched to the full iPad width - exactly the
    // "iPhone layout stretched wider" pattern the build plan calls out,
    // producing awkwardly wide, sparse-looking note/bookmark cards on a
    // real iPad. `DiagnosticGateView`'s `LazyVGrid(.adaptive(...))` is the
    // established reference pattern for this app; both card types already
    // use `.frame(maxWidth: .infinity, alignment: .leading)` internally so
    // they drop into a grid cell cleanly with no further changes needed.
    private let columns = [GridItem(.adaptive(minimum: 320), spacing: 14)]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text("Notes")
                    .font(.system(size: 30, weight: .bold, design: .rounded))
                    .foregroundColor(NotesColor.ink)

                if !client.bookmarkedQuestions.isEmpty {
                    Text("Bookmarked")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(NotesColor.ink)
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(client.bookmarkedQuestions) { q in
                            BookmarkedCard(question: q)
                        }
                    }
                }

                if !client.notes.isEmpty {
                    Text("Session notes")
                        .font(.system(size: 16, weight: .bold, design: .rounded))
                        .foregroundColor(NotesColor.ink)
                    LazyVGrid(columns: columns, spacing: 14) {
                        ForEach(client.notes) { note in
                            NoteCard(note: note)
                        }
                    }
                } else if client.bookmarkedQuestions.isEmpty {
                    emptyState
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 24)
        }
    }

    private var emptyState: some View {
        VStack(spacing: 8) {
            Text("No session notes yet")
                .font(.system(size: 16, weight: .semibold, design: .rounded))
                .foregroundColor(NotesColor.ink)
            Text("Notes from tutor sessions and completed homework will show up here.")
                .font(.system(size: 13, design: .rounded))
                .foregroundColor(NotesColor.inkSoft.opacity(0.72))
                .multilineTextAlignment(.leading)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.top, 40)
    }
}

/// One bookmarked question/equation - real question text via
/// `QuestionBankLoader`, resolved from `users/{uid}.bookmarkedQuestions`.
private struct BookmarkedCard: View {
    let question: SampleQuestion

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            Image(systemName: "bookmark.fill")
                .font(.system(size: 12))
                .foregroundColor(NotesColor.accent)
            Text(question.prompt)
                .font(.system(size: 14, design: .rounded))
                .foregroundColor(NotesColor.ink)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 12, style: .continuous)
                .fill(NotesColor.cardPaper)
        )
    }
}

private struct NoteCard: View {
    let note: SessionNote

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text(note.subject)
                    .font(.system(size: 12, weight: .semibold, design: .rounded))
                    .foregroundColor(NotesColor.accent)
                Spacer()
                if !note.date.isEmpty {
                    Text(note.date)
                        .font(.system(size: 11, design: .rounded))
                        .foregroundColor(NotesColor.inkSoft.opacity(0.6))
                }
            }
            Text("with \(note.tutorName)")
                .font(.system(size: 13, weight: .medium, design: .rounded))
                .foregroundColor(NotesColor.ink)
            ForEach(note.bullets, id: \.self) { bullet in
                HStack(alignment: .top, spacing: 6) {
                    Text("\u{2022}")
                    Text(bullet)
                }
                .font(.system(size: 13, design: .rounded))
                .foregroundColor(NotesColor.ink.opacity(0.85))
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: 14, style: .continuous)
                .fill(NotesColor.cardPaper)
                .overlay(
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .strokeBorder(NotesColor.accent.opacity(0.18), lineWidth: 1)
                )
        )
    }
}

// Phase 5 (2026-08-06): the Notes tab ports `DashboardNotesPanel.tsx`, which
// imports only `DashboardPanels.module.css` - its `--ink-*`/`--paper-*` vars
// cascade from the Dashboard's `.canvasStage` (Dashboard.module.css:1012-1021),
// i.e. the same dark chalkboard tokens DeskColor already uses (verified
// directly, not assumed from DeskColor's file). Real web `.noteEntry` is a
// flat divider-rule list on a transparent background, not a paper card -
// kept the card layout here as a deliberate native/iPad adaptation (a real
// visual surface reads better as a touch target than a bare rule divider)
// but sourced `cardPaper` from `--paper-raised`, the nearest real "raised
// surface" token in the same file, rather than inventing a new color.
private enum NotesColor {
    static let ink = Color(notesHex: "f4efe2")
    static let inkSoft = Color(notesHex: "f4efe2").opacity(0.72)
    static let accent = Color(notesHex: "54b948")
    static let cardPaper = Color(notesHex: "1a2e24")
}

private extension Color {
    init(notesHex hex: String) {
        let cleaned = hex.hasPrefix("#") ? String(hex.dropFirst()) : hex
        var value: UInt64 = 0
        Scanner(string: cleaned).scanHexInt64(&value)
        let r = Double((value >> 16) & 0xFF) / 255
        let g = Double((value >> 8) & 0xFF) / 255
        let b = Double(value & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}
