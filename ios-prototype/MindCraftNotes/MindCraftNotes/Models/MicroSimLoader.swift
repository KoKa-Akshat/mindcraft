import Foundation

/// One real, extracted Dan McCreary MicroSim - genuine interactive p5.js
/// simulations (not descriptions of simulations), extracted by the sibling
/// `mindcraft-content-engine` repo's `microsim_extractor.py` from Dan's own
/// open-source book repos on GitHub. Decoded directly from the real
/// extraction JSON (`dmccreary__{subject}__{sim}.json`), same "real data,
/// not a mock" rule `BookGraphLoader`'s own doc comment already states.
///
/// Licensing (2026-08-18): originally CC BY-NC-SA 4.0 (non-commercial) -
/// explicit authorization given to use this in the commercial app via
/// MindCraft's advisor relationship with Dan McCreary (the content's own
/// creator), overriding the default non-commercial term. Not silently
/// assumed - this comment is the paper trail for that decision.
struct MicroSimRecord: Decodable, Identifiable, Hashable {
    let sourceRepo: String
    let simDir: String
    let title: String
    let microSimDescription: String
    let creator: String
    let concepts: [String]
    let subjects: [String]
    /// Raw file contents keyed by filename (`main.html`, one or more
    /// `*.js` files, `index.md`) - exactly what the extractor pulled from
    /// the real repo, no transformation.
    let files: [String: String]

    var id: String { "\(sourceRepo)/\(simDir)" }

    enum CodingKeys: String, CodingKey {
        case sourceRepo = "source_repo"
        case simDir = "sim_dir"
        case title
        case microSimDescription = "description"
        case creator
        case dublinCore = "dublin_core"
        case files
    }

    private enum DublinCoreKeys: String, CodingKey {
        case concepts, subject
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        sourceRepo = try container.decode(String.self, forKey: .sourceRepo)
        simDir = try container.decode(String.self, forKey: .simDir)
        title = try container.decode(String.self, forKey: .title)
        microSimDescription = try container.decodeIfPresent(String.self, forKey: .microSimDescription) ?? ""
        creator = try container.decodeIfPresent(String.self, forKey: .creator) ?? "Dan McCreary"
        files = try container.decode([String: String].self, forKey: .files)
        let dublinCore = try container.nestedContainer(keyedBy: DublinCoreKeys.self, forKey: .dublinCore)
        concepts = try dublinCore.decodeIfPresent([String].self, forKey: .concepts) ?? []
        subjects = try dublinCore.decodeIfPresent([String].self, forKey: .subject) ?? []
    }

    static func == (lhs: MicroSimRecord, rhs: MicroSimRecord) -> Bool { lhs.id == rhs.id }
    func hash(into hasher: inout Hasher) { hasher.combine(id) }

    /// A single, self-contained HTML document a `WKWebView` can load
    /// directly with `loadHTMLString(_:baseURL:)` - the real extracted
    /// `main.html` references its sibling `.js` file(s) by a relative
    /// `<script src="...">` path, which only resolves if both files sit
    /// in the same real directory. Rather than standing up a local file
    /// server just to preserve that relative reference, this inlines
    /// each referenced `.js` file's real content directly into the HTML
    /// (p5.js itself stays a normal CDN `<script>` tag already in the
    /// HTML - that's a real absolute URL, no bundling needed for it).
    var selfContainedHTML: String {
        guard var html = files["main.html"] else { return "" }
        for (name, content) in files where name.hasSuffix(".js") {
            let tag = "<script src=\"\(name)\"></script>"
            if html.contains(tag) {
                html = html.replacingOccurrences(of: tag, with: "<script>\n\(content)\n</script>")
            }
        }
        return html
    }
}

/// Loads every bundled MicroSim from `Resources/MicroSims/` - same
/// `Bundle.main.urls(forResourcesWithExtension:subdirectory:)` pattern as
/// `BookGraphLoader`, so a new subject's extracted sims just need to be
/// dropped in and registered in Xcode, no Swift change needed. Only the
/// real Calculus set (123 sims, `dmccreary/calculus`) is bundled today -
/// the sibling repo has ~30 subjects' worth (`microsim_extracts/`), not
/// all shipped yet.
enum MicroSimLoader {
    static let all: [MicroSimRecord] = {
        guard let urls = Bundle.main.urls(forResourcesWithExtension: "json", subdirectory: "MicroSims") else {
            return []
        }
        let decoder = JSONDecoder()
        return urls.compactMap { url in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return try? decoder.decode(MicroSimRecord.self, from: data)
        }.sorted { $0.title < $1.title }
    }()

    /// Simple, honest keyword match against real concept/subject/title
    /// text - no embeddings, no fuzzy scoring, same directness
    /// `BookGraphLoader`-driven matching in `askJesseWorkDashboard`
    /// already uses. Caps at 3 - a lesson doesn't need every matching sim,
    /// just enough to be genuinely useful.
    ///
    /// Ranked by specificity, not just "first 3 alphabetically" (real bug,
    /// found via live testing 2026-08-21: asking about ANY broad subject
    /// like "Calculus" returned the identical 3 sims every time, regardless
    /// of which specific concept was actually asked about - `all` is sorted
    /// alphabetically by title and the old code took a blind `.prefix(3)`
    /// of the filtered set, which just re-produces that same ordering). A
    /// title match is the strongest, most specific signal a sim is
    /// actually about what was asked (a subject/concept tag match can be
    /// shared by dozens of sims in one broad set); ties within a tier fall
    /// back to title order for determinism, not randomness.
    static func matching(topic: String, limit: Int = 3) -> [MicroSimRecord] {
        let lowered = topic.lowercased()
        func matchStrength(_ sim: MicroSimRecord) -> Int {
            if sim.title.lowercased().contains(lowered) { return 2 }
            let conceptHit = sim.concepts.contains { $0.lowercased().contains(lowered) || lowered.contains($0.lowercased()) }
            let subjectHit = sim.subjects.contains { $0.lowercased().contains(lowered) || lowered.contains($0.lowercased()) }
            if conceptHit { return 1 }
            if subjectHit { return 0 }
            return -1
        }
        let ranked = all
            .map { ($0, matchStrength($0)) }
            .filter { $0.1 >= 0 }
            .sorted { $0.1 != $1.1 ? $0.1 > $1.1 : $0.0.title < $1.0.title }
        return Array(ranked.prefix(limit).map(\.0))
    }
}
