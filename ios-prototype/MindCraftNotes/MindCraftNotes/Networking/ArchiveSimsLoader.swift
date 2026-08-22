import Foundation

/// One real, gated simulation, flattened out of whichever Chapter Library
/// book it belongs to. Shared between the two Archive surfaces this app
/// currently has (`DeskGridDashboardView`'s in-Binder Archive browser, the
/// one actually reachable from the Work dashboard's own dock, and the
/// older standalone `ArchiveWorkflowView`, reachable via the Workflows
/// library) so the fetch/flatten logic exists exactly once.
struct ArchiveSimEntry: Identifiable {
    let id: String
    let bookSubjectId: String
    let bookTitle: String
    let section: AssembledBookSection
}

/// Explicit live ask, 2026-08-22: "all the simulations we have should also
/// be shown on the archive... the simulations first." Real sims live
/// per-concept inside Chapter Library books (`AssembledBookSection.simHtml`),
/// not as their own top-level collection — this fetches every synced book
/// (`BookLibraryClient.listBooks`) concurrently and flattens whichever
/// sections actually carry a rendered sim.
enum ArchiveSimsLoader {
    static func loadAll() async -> [ArchiveSimEntry] {
        guard let summaries = try? await BookLibraryClient.listBooks() else { return [] }
        var sims: [ArchiveSimEntry] = []
        await withTaskGroup(of: AssembledBook?.self) { group in
            for summary in summaries {
                group.addTask { try? await BookLibraryClient.getBook(subjectId: summary.subjectId) }
            }
            for await book in group {
                guard let book else { continue }
                let newOnes = book.chapters.flatMap(\.sections)
                    .filter { $0.simHtml != nil }
                    .map { ArchiveSimEntry(id: "\(book.subjectId)_\($0.conceptId)", bookSubjectId: book.subjectId, bookTitle: book.title, section: $0) }
                sims.append(contentsOf: newOnes)
            }
        }
        sims.sort { $0.bookTitle == $1.bookTitle ? $0.section.title < $1.section.title : $0.bookTitle < $1.bookTitle }
        return sims
    }
}
