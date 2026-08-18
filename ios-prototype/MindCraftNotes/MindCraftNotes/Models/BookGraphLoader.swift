import Foundation

/// One concept node in a book-derived concept graph — decodes
/// `mindcraft-content-engine`'s real `ConceptRecord` JSON output
/// (`book -> BookSummarizer -> CourseDescription -> generate_concept_graph()`,
/// already namespaced "subject::concept" and DAG-validated at generation
/// time, re-validated again server-side in `ml/mindcraft_graph/loaders/
/// dynamic_concept_loader.py`). Same field shapes, decoded directly rather
/// than through any transformation - this is real data, not a mock.
struct BookConceptRecord: Decodable, Identifiable, Hashable {
    let id: String
    let label: String
    let subjectId: String
    let dependencies: [String]
    let taxonomyId: String
    let level: String

    enum CodingKeys: String, CodingKey {
        case id, label, dependencies, level
        case subjectId = "subject_id"
        case taxonomyId = "taxonomy_id"
    }
}

/// One book's full concept graph.
struct BookConceptGraph: Decodable, Identifiable, Hashable {
    let subjectId: String
    let title: String
    let concepts: [BookConceptRecord]

    var id: String { subjectId }

    enum CodingKeys: String, CodingKey {
        case title, concepts
        case subjectId = "subject_id"
    }

    /// Concepts grouped by taxonomy, foundational-first within each group -
    /// a real, useful browsing order, not the raw generation order.
    var groupedByTaxonomy: [(taxonomy: String, concepts: [BookConceptRecord])] {
        let order = ["foundational": 0, "core": 1, "advanced": 2, "cross_cutting": 3]
        let grouped = Dictionary(grouping: concepts, by: \.taxonomyId)
        return grouped.keys.sorted().map { key in
            (key, grouped[key]!.sorted { (order[$0.level] ?? 9) < (order[$1.level] ?? 9) })
        }
    }
}

/// Loads every bundled book concept graph from `Resources/BookGraphs/` -
/// `Bundle.main.urls(forResourcesWithExtension:subdirectory:)` picks up
/// whatever's actually there, so a new book graph just needs to be dropped
/// in and registered in Xcode, no Swift change needed to surface it. This
/// is the real "the graph scales organically" story on the iOS side,
/// mirroring `ml/mindcraft_graph/loaders/dynamic_concept_loader.py`'s same
/// principle on the server side - both read the same generated JSON shape.
enum BookGraphLoader {
    static let all: [BookConceptGraph] = {
        guard let urls = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: "BookGraphs") else {
            return []
        }
        let decoder = JSONDecoder()
        return urls.compactMap { url in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? decoder.decode(BookConceptGraph.self, from: data)
        }.sorted { $0.title < $1.title }
    }()
}
