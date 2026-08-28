import Foundation

/// Which real store one Archive simulation came from. Provenance is data,
/// not decoration: "MindCraft's own generated sims" and "Dan's extracted
/// sims" are genuinely different things (different quality gates, different
/// licensing paper trails) and the UI is allowed to say so.
enum ArchiveSimSource: Int, Comparable {
    /// Store A - inlined `sim_html` inside a synced Chapter Library book
    /// (`assembled_books` Firestore collection via BookLibraryClient).
    case chapterBook = 0
    /// Store B - the `generated_sims` Firestore library that
    /// generate-sim.ts persists every gate-passed on-demand generation to.
    case generated = 1
    /// Store C - Dan McCreary's extracted MicroSim corpus (bundled Calculus
    /// set + the full 4,013-sim catalog served by /api/microsims).
    case dansArchive = 2

    static func < (lhs: ArchiveSimSource, rhs: ArchiveSimSource) -> Bool {
        lhs.rawValue < rhs.rawValue
    }
}

/// One real, gated simulation, whichever of the three stores it lives in.
/// Shared between the two Archive surfaces this app currently has
/// (`DeskGridDashboardView`'s in-Binder Archive browser, the one actually
/// reachable from the Work dashboard's own dock, and the older standalone
/// `ArchiveWorkflowView`, reachable via the Workflows library) so the
/// fetch/flatten logic exists exactly once.
struct ArchiveSimEntry: Identifiable {
    let id: String
    let bookSubjectId: String
    let bookTitle: String
    let section: AssembledBookSection
    /// Defaults keep the original 4-argument construction sites (the two
    /// generate-sheet merge paths) compiling unchanged - a sim built from a
    /// freshly generated BOOK is a chapter-book sim.
    var source: ArchiveSimSource = .chapterBook
    /// Set only for un-bundled Dan's-archive sims: the /api/microsims
    /// catalog id to fetch full content by, on demand, when the sim is
    /// actually opened (`section.simHtml` is nil until then - 4,013 sims'
    /// html is far too much to prefetch into a list).
    var microSimId: String? = nil
}

/// Explicit live ask, 2026-08-22: "all the simulations we have should also
/// be shown on the archive... the simulations first."
///
/// REAL DATA BUG, fixed 2026-08-23 - the same shape archive-books.ts's doc
/// comment records for books ("there are 113 dan books wdym 18": a narrower
/// derived source silently standing in for a fuller one). The first version
/// of this loader read ONLY Store A (sims inlined into synced Chapter
/// Library books, ~9 subjects' worth), while two entire stores of real,
/// existing sims stayed invisible: every student-generated sim in the
/// `generated_sims` Firestore library (persisted by generate-sim.ts since
/// 2026-08-19, but nothing ever LISTED that collection), and Dan McCreary's
/// full extracted MicroSim corpus (4,013 sims across 95 repos - only the
/// 123-sim Calculus set is bundled into the binary, and even that was never
/// surfaced here). This now loads all three concurrently and returns the
/// union: Store A flattened from books, Store B via /api/list-generated-sims,
/// Store C as bundled records (instant, full content) plus the
/// /api/microsims catalog (metadata now, content fetched per-sim on open),
/// deduped so the bundled Calculus set never shows twice. Sorted
/// MindCraft-first (chapter books, then generated, then Dan's archive), and
/// alphabetically within each store.
enum ArchiveSimsLoader {
    static func loadAll() async -> [ArchiveSimEntry] {
        async let chapterBooks = chapterBookSims()
        async let generated = generatedSims()
        async let dans = dansArchiveSims()
        var sims = await chapterBooks
        sims += await generated
        sims += await dans
        var seen = Set<String>()
        var merged = sims.filter { seen.insert($0.id).inserted }
        merged.sort { lhs, rhs in
            if lhs.source != rhs.source { return lhs.source < rhs.source }
            if lhs.bookTitle != rhs.bookTitle { return lhs.bookTitle < rhs.bookTitle }
            return (lhs.section.simTitle ?? lhs.section.title) < (rhs.section.simTitle ?? rhs.section.title)
        }
        return merged
    }

    /// Store A: fetches every synced book (`BookLibraryClient.listBooks`)
    /// concurrently and flattens whichever sections actually carry a
    /// rendered sim - the original (and previously only) source.
    private static func chapterBookSims() async -> [ArchiveSimEntry] {
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
        return sims
    }

    /// Store B: every gate-passed sim in the generated_sims library.
    private static func generatedSims() async -> [ArchiveSimEntry] {
        await GeneratedSimsListClient.list().map { sim in
            ArchiveSimEntry(
                id: "generated_\(sim.topicSlug)",
                bookSubjectId: sim.topicSlug,
                bookTitle: "Generated on demand",
                section: standaloneSection(
                    conceptId: sim.conceptId,
                    title: sim.title,
                    summary: sim.description,
                    simHtml: sim.html,
                    qualityScore: sim.qualityGateScore
                ),
                source: .generated
            )
        }
    }

    /// Store C: the bundled Calculus set first (local, instant, full
    /// content - kept deliberately as the fast on-device path, not ripped
    /// out), then the full remote catalog minus anything already bundled.
    /// The dedup key is real, not heuristic: bundled records and the
    /// catalog both derive their id from the same (source_repo, sim_dir)
    /// pair the extractor keys the corpus by.
    private static func dansArchiveSims() async -> [ArchiveSimEntry] {
        let bundled = MicroSimLoader.all.map { record -> ArchiveSimEntry in
            let catalogId = record.sourceRepo.replacingOccurrences(of: "/", with: "__") + "__" + record.simDir
            return ArchiveSimEntry(
                id: "microsim_\(catalogId)",
                bookSubjectId: catalogId,
                bookTitle: dansBookTitle(subject: humanize(record.sourceRepo.components(separatedBy: "/").last ?? record.sourceRepo)),
                section: standaloneSection(
                    conceptId: record.simDir,
                    title: record.title,
                    summary: record.microSimDescription,
                    simHtml: record.selfContainedHTML
                ),
                source: .dansArchive
            )
        }
        let bundledIds = Set(bundled.map(\.id))
        let remote = await MicroSimCatalogClient.list()
            .map { entry in
                ArchiveSimEntry(
                    id: "microsim_\(entry.id)",
                    bookSubjectId: entry.id,
                    bookTitle: dansBookTitle(subject: entry.subject),
                    section: standaloneSection(
                        conceptId: entry.id,
                        title: entry.title,
                        summary: entry.description,
                        simHtml: nil
                    ),
                    source: .dansArchive,
                    microSimId: entry.id
                )
            }
            .filter { !bundledIds.contains($0.id) }
        return bundled + remote
    }

    /// A sim that doesn't live inside an assembled book still rides the
    /// existing `AssembledBookSection`-shaped entry (reuse, not a parallel
    /// type) - the Archive surfaces only ever read title/simTitle/simHtml
    /// from it, so the book-structure fields are honestly empty.
    private static func standaloneSection(
        conceptId: String,
        title: String,
        summary: String,
        simHtml: String?,
        qualityScore: Double? = nil
    ) -> AssembledBookSection {
        AssembledBookSection(
            conceptId: conceptId,
            title: title,
            body: summary,
            summary: summary,
            buildsOnLabels: [],
            assumesMissing: [],
            forwardRefs: [],
            simTitle: title,
            simScreenshot: nil,
            simBridge: nil,
            simFilesDir: nil,
            simHtml: simHtml,
            discussionTitle: nil,
            qualityScore: qualityScore,
            imageSvg: nil,
            imageCaption: nil
        )
    }

    private static func dansBookTitle(subject: String) -> String {
        "\(subject) \u{00B7} Dan's Archive"
    }

    /// Same humanization build-microsims-manifest.ts applies to a repo's
    /// tail ("3d-printing-course" -> "3d Printing Course") so bundled and
    /// catalog entries for one subject group under one identical label.
    private static func humanize(_ slug: String) -> String {
        slug.split(whereSeparator: { $0 == "-" || $0 == "_" })
            .map { $0.prefix(1).uppercased() + $0.dropFirst() }
            .joined(separator: " ")
    }
}

/// `GET/POST /api/list-generated-sims` - the list-all read over the
/// generated_sims library that never existed before (see
/// webhook/lib/handlers/list-generated-sims.ts). No auth, same reasoning as
/// `BookLibraryClient`: listing already-gated, already-paid-for content
/// spends nothing (unlike `GeneratedSimClient`, which can bill per call).
enum GeneratedSimsListClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/list-generated-sims")!

    struct LibrarySim {
        let title: String
        let description: String
        let html: String
        let conceptId: String
        let topicSlug: String
        let qualityGateScore: Double?
    }

    /// Every field optional on the wire so one malformed library doc can
    /// never sink the whole list's decode - entries without renderable
    /// html are dropped here, mirroring the handler's own guard.
    private struct Wire: Decodable {
        let title: String?
        let description: String?
        let html: String?
        let conceptId: String?
        let topicSlug: String?
        let qualityGateScore: Double?
    }

    private struct Envelope: Decodable { let sims: [Wire]? }

    static func list() async -> [LibrarySim] {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = 20
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data("{}".utf8)
        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200,
            let decoded = try? JSONDecoder().decode(Envelope.self, from: data)
        else { return [] }
        return (decoded.sims ?? []).compactMap { wire in
            guard let html = wire.html, !html.isEmpty else { return nil }
            let slug = wire.topicSlug ?? ""
            guard !slug.isEmpty else { return nil }
            return LibrarySim(
                title: wire.title ?? slug,
                description: wire.description ?? "",
                html: html,
                conceptId: wire.conceptId ?? slug,
                topicSlug: slug,
                qualityGateScore: wire.qualityGateScore
            )
        }
    }
}

/// `GET/POST /api/microsims` - Dan McCreary's full extracted MicroSim
/// catalog (webhook/lib/handlers/microsims.ts). Two calls, matching the
/// handler's two shapes: `list()` returns the 4,013-entry metadata catalog
/// (~1MB, no sim content), `fetchHTML(id:)` returns one sim assembled
/// server-side into a single self-contained html - same end shape
/// `MicroSimRecord.selfContainedHTML` produces on-device for the bundled
/// set, so `InlineSimWebView` renders both identically.
enum MicroSimCatalogClient {
    private static let endpoint = URL(string: "https://mindcraft-webhook.vercel.app/api/microsims")!

    struct CatalogSim {
        let id: String
        let subject: String
        let title: String
        let description: String
    }

    private struct WireSim: Decodable {
        let id: String?
        let subject: String?
        let title: String?
        let description: String?
    }

    private struct ListEnvelope: Decodable { let sims: [WireSim]? }
    private struct FetchEnvelope: Decodable {
        struct Sim: Decodable { let html: String? }
        let sim: Sim?
    }

    private static func post(_ body: [String: String], timeout: TimeInterval) async -> Data? {
        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.timeoutInterval = timeout
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard
            let (data, response) = try? await URLSession.shared.data(for: request),
            let http = response as? HTTPURLResponse, http.statusCode == 200
        else { return nil }
        return data
    }

    static func list() async -> [CatalogSim] {
        guard
            let data = await post([:], timeout: 30),
            let decoded = try? JSONDecoder().decode(ListEnvelope.self, from: data)
        else { return [] }
        return (decoded.sims ?? []).compactMap { wire in
            guard let id = wire.id, !id.isEmpty else { return nil }
            return CatalogSim(
                id: id,
                subject: wire.subject ?? "Dan's Archive",
                title: wire.title ?? id,
                description: wire.description ?? ""
            )
        }
    }

    /// Generous timeout: the webhook assembles the sim by fetching its real
    /// files from GitHub before answering, which is several round trips.
    static func fetchHTML(id: String) async -> String? {
        guard
            let data = await post(["id": id], timeout: 30),
            let decoded = try? JSONDecoder().decode(FetchEnvelope.self, from: data),
            let html = decoded.sim?.html, !html.isEmpty
        else { return nil }
        return html
    }
}
