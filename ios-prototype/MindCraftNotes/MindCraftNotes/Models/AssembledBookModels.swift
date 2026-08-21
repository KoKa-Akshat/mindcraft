import Foundation

/// Decodes `book_assembler.AssembledBook.to_dict()`'s real JSON shape
/// (mindcraft-content-engine), synced to Firestore by
/// webhook/scripts/sync-assembled-books.ts and served by
/// webhook/lib/handlers/get-book.ts. This is the delivery-side counterpart
/// to `BookGraphLoader`'s concept-graph structs: that loader reads bundled
/// graph STRUCTURE (dependencies/taxonomy, for browsing); this reads the
/// actual gated, dependency-ordered teaching PROSE a student reads, fetched
/// live rather than bundled, since new books get assembled and synced on
/// an ongoing basis, not fixed at app build time.
struct AssembledBookSection: Decodable, Identifiable, Hashable {
    let conceptId: String
    let title: String
    let body: String
    let summary: String
    let buildsOnLabels: [String]
    let assumesMissing: [String]
    let forwardRefs: [String]
    let simTitle: String?
    let simScreenshot: String?
    let simBridge: String?
    let simFilesDir: String?
    /// The sim's actual runnable HTML, inlined by book_assembler.py
    /// (2026-08-21 fix) so `InlineSimWebView` can render it directly - real
    /// gap this closes: `simFilesDir` alone is a local content-engine repo
    /// path, never a URL this app could ever reach.
    let simHtml: String?
    let discussionTitle: String?
    let qualityScore: Double?

    var id: String { conceptId }

    enum CodingKeys: String, CodingKey {
        case conceptId = "concept_id"
        case title, body, summary
        case buildsOnLabels = "builds_on_labels"
        case assumesMissing = "assumes_missing"
        case forwardRefs = "forward_refs"
        case simTitle = "sim_title"
        case simScreenshot = "sim_screenshot"
        case simBridge = "sim_bridge"
        case simFilesDir = "sim_files_dir"
        case simHtml = "sim_html"
        case discussionTitle = "discussion_title"
        case qualityScore = "quality_score"
    }
}

struct AssembledBookChapter: Decodable, Identifiable, Hashable {
    let taxonomyId: String
    let sections: [AssembledBookSection]

    var id: String { taxonomyId }

    enum CodingKeys: String, CodingKey {
        case taxonomyId = "taxonomy_id"
        case sections
    }
}

struct AssembledBook: Decodable, Identifiable, Hashable {
    let subjectId: String
    let title: String
    let created: String
    let totalConcepts: Int
    let coveredConcepts: Int
    let uncovered: [String]
    let forwardReferences: [String]
    let chapters: [AssembledBookChapter]

    var id: String { subjectId }

    /// Same honest framing book_assembler.py's own front matter carries —
    /// a student (or a reviewer) should never mistake partial coverage for
    /// a complete book.
    var coverageLabel: String { "\(coveredConcepts) of \(totalConcepts) concepts" }

    enum CodingKeys: String, CodingKey {
        case subjectId = "subject_id"
        case title, created
        case totalConcepts = "total_concepts"
        case coveredConcepts = "covered_concepts"
        case uncovered
        case forwardReferences = "forward_references"
        case chapters
    }
}

/// Summary row for the library list — what `get-book`'s no-argument (list)
/// request returns, matching `get-book.ts`'s `BookSummary` shape exactly.
struct AssembledBookSummary: Decodable, Identifiable, Hashable {
    let subjectId: String
    let title: String
    let totalConcepts: Int
    let coveredConcepts: Int
    let updatedAt: String

    var id: String { subjectId }
    var coverageLabel: String { "\(coveredConcepts) of \(totalConcepts) concepts" }

    enum CodingKeys: String, CodingKey {
        case subjectId, title, totalConcepts, coveredConcepts, updatedAt
    }
}
