import CoreGraphics
import Foundation

// MARK: - Content graph model

/// The four content-authoring box types on the Design Studio canvas
/// (2026-08-19 rework). Replaces the original find/ask/make/output workflow
/// vocabulary wholesale - those four were a dead end nobody used (three of
/// them were inert placeholders that said so on-screen; only Ask made a real
/// call). These four each map to something the app can already really do:
/// `.chapter` reuses the Jesse book-agent loop, `.simulation` opens a real
/// Blockly workspace, `.checkpoint` is a small native form, `.branch` is
/// pure structure (its outgoing edge labels carry the choices).
enum DesignBoxType: String, Codable, CaseIterable, Identifiable {
    case chapter, simulation, checkpoint, branch
    var id: String { rawValue }

    var label: String {
        switch self {
        case .chapter: return "Chapter"
        case .simulation: return "Simulation"
        case .checkpoint: return "Checkpoint"
        case .branch: return "Branch"
        }
    }

    var glyph: String {
        switch self {
        case .chapter: return "book.fill"
        case .simulation: return "slider.horizontal.below.square.filled.and.square"
        case .checkpoint: return "checkmark.seal.fill"
        case .branch: return "arrow.triangle.branch"
        }
    }
}

/// One box on the content canvas. `title`/`subtitle` are the on-canvas
/// card text; the payload fields below are type-specific and only the
/// fields for `type` are ever shown/edited (the rest stay empty strings -
/// one flat Codable struct instead of an enum-with-associated-values
/// payload, because UserDefaults round-tripping and per-field SwiftUI
/// bindings both get significantly simpler and the wasted bytes are nil).
struct DesignBox: Identifiable, Codable, Equatable {
    let id: String
    var type: DesignBoxType
    var title: String
    var subtitle: String
    var position: CGPoint

    /// `.chapter` - the chapter's prose. Together with `title` this IS a
    /// `BookAgentChapter` (title, body), the exact shape the Jesse book
    /// agent already speaks - no new schema, see `asChapter`/`applyChapter`.
    var chapterBody: String
    /// `.simulation` - the Blockly workspace state
    /// (`Blockly.serialization.workspaces.save` JSON), opaque to Swift.
    var workspaceState: String
    /// `.simulation` - an optional reference URL the sim is based on.
    var referenceURL: String
    /// `.simulation` - the AI-generation prompt (2026-08-21 addition,
    /// alongside the pre-existing Blockly path, not a replacement for it -
    /// both are real, working ways to fill a simulation box). What the
    /// student typed asking for a sim; combined with any connected
    /// upstream `.chapter` box's body as context before calling
    /// `GeneratedSimClient`, same "ground the request in real material
    /// when it's available" instinct `LessonOutlineClient`'s
    /// `referenceMaterial` param already uses server-side.
    var simPrompt: String
    /// `.simulation` - the self-contained, gate-passed HTML from a
    /// successful AI generation (`GeneratedSimResult.html` - already the
    /// same shape `InlineSimWebView` renders, no new rendering path
    /// needed). Empty until a generation succeeds.
    var generatedSimHTML: String
    /// `.simulation` - the title/description that came back with
    /// `generatedSimHTML`, kept alongside it purely for display (the
    /// on-canvas card and the inspector preview both want a human label,
    /// and re-deriving it from the prompt text would drift from what was
    /// actually generated).
    var generatedSimTitle: String
    /// `.checkpoint` - the question the student poses at this point.
    var checkpointQuestion: String
    /// `.checkpoint` - the expected-answer shape ("a number in cm",
    /// "one sentence naming the theorem", ...), not a graded key.
    var checkpointAnswer: String

    static let size = CGSize(width: 210, height: 104)

    init(
        id: String,
        type: DesignBoxType,
        title: String,
        subtitle: String = "",
        position: CGPoint,
        chapterBody: String = "",
        workspaceState: String = "",
        referenceURL: String = "",
        simPrompt: String = "",
        generatedSimHTML: String = "",
        generatedSimTitle: String = "",
        checkpointQuestion: String = "",
        checkpointAnswer: String = ""
    ) {
        self.id = id
        self.type = type
        self.title = title
        self.subtitle = subtitle
        self.position = position
        self.chapterBody = chapterBody
        self.workspaceState = workspaceState
        self.referenceURL = referenceURL
        self.simPrompt = simPrompt
        self.generatedSimHTML = generatedSimHTML
        self.generatedSimTitle = generatedSimTitle
        self.checkpointQuestion = checkpointQuestion
        self.checkpointAnswer = checkpointAnswer
    }

    enum CodingKeys: String, CodingKey {
        case id, type, title, subtitle, position
        case chapterBody, workspaceState, referenceURL
        case simPrompt, generatedSimHTML, generatedSimTitle
        case checkpointQuestion, checkpointAnswer
    }

    /// Payload fields decode leniently (same `decodeIfPresent` + default
    /// convention as `FieldDeskStore.FiledItem`) so adding a field later
    /// never silently drops a student's whole saved canvas.
    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        type = try c.decode(DesignBoxType.self, forKey: .type)
        title = try c.decode(String.self, forKey: .title)
        subtitle = try c.decodeIfPresent(String.self, forKey: .subtitle) ?? ""
        position = try c.decode(CGPoint.self, forKey: .position)
        chapterBody = try c.decodeIfPresent(String.self, forKey: .chapterBody) ?? ""
        workspaceState = try c.decodeIfPresent(String.self, forKey: .workspaceState) ?? ""
        referenceURL = try c.decodeIfPresent(String.self, forKey: .referenceURL) ?? ""
        simPrompt = try c.decodeIfPresent(String.self, forKey: .simPrompt) ?? ""
        generatedSimHTML = try c.decodeIfPresent(String.self, forKey: .generatedSimHTML) ?? ""
        generatedSimTitle = try c.decodeIfPresent(String.self, forKey: .generatedSimTitle) ?? ""
        checkpointQuestion = try c.decodeIfPresent(String.self, forKey: .checkpointQuestion) ?? ""
        checkpointAnswer = try c.decodeIfPresent(String.self, forKey: .checkpointAnswer) ?? ""
    }

    /// This box's chapter payload in the book agent's own wire shape.
    var asChapter: BookAgentChapter {
        BookAgentChapter(title: title, body: chapterBody)
    }

    mutating func applyChapter(_ chapter: BookAgentChapter) {
        if !chapter.title.isEmpty { title = chapter.title }
        chapterBody = chapter.body
    }

    /// One line of real payload state for the on-canvas card - never a
    /// fake "ready" badge on an empty box.
    var statusLine: String {
        switch type {
        case .chapter:
            let words = chapterBody.split(whereSeparator: \.isWhitespace).count
            return words == 0 ? "Not written yet" : "\(words) word\(words == 1 ? "" : "s")"
        case .simulation:
            if !generatedSimHTML.isEmpty { return "AI sim ready" }
            return workspaceState.isEmpty ? "Workspace empty" : "Workspace saved"
        case .checkpoint:
            return checkpointQuestion.isEmpty ? "No question yet" : "Question set"
        case .branch:
            return "Paths split here"
        }
    }
}

/// A directed connection between two boxes. `label == nil` means plain
/// "comes next"; a populated label is a branch's choice text (the student
/// names each path leaving a `.branch` box).
struct DesignEdge: Identifiable, Codable, Equatable {
    // String id (not the previous `let id = UUID()`) so an edge keeps ONE
    // identity across encode/decode - an auto-minted UUID would re-mint on
    // every load and break "remove this edge" against a persisted graph.
    let id: String
    let from: String
    let to: String
    var label: String?

    init(from: String, to: String, label: String? = nil) {
        self.id = UUID().uuidString
        self.from = from
        self.to = to
        self.label = label
    }
}

// MARK: - Store

/// Local-first persistence for the Design Studio content canvas - the
/// student's *draft* graph (boxes + edges + working title), autosaved on
/// every mutation. Same UserDefaults `deskOs.*` pattern as
/// `FieldDeskStore` (including the `--ui-testing-in-memory` guard, so UI
/// test runs can't leak a canvas into each other across the suite's single
/// shared app install - the exact cross-test-state bug class documented on
/// the test class itself). Deliberately NOT Firestore: this is the private
/// scratch draft; the durable, published artifact is still
/// `BinderStore.addBook`, which `assembleBook()` feeds.
@MainActor
final class ContentGraphStore: ObservableObject {
    @Published private(set) var boxes: [DesignBox]
    @Published private(set) var edges: [DesignEdge]
    /// Working title for the book this canvas will publish.
    @Published private(set) var title: String

    private static let boxesKey = "deskOs.contentGraph.boxes"
    private static let edgesKey = "deskOs.contentGraph.edges"
    private static let titleKey = "deskOs.contentGraph.title"
    private static let uiTesting = ProcessInfo.processInfo.arguments.contains("--ui-testing-in-memory")

    init() {
        boxes = Self.decode([DesignBox].self, key: Self.boxesKey) ?? []
        edges = Self.decode([DesignEdge].self, key: Self.edgesKey) ?? []
        title = Self.decode(String.self, key: Self.titleKey) ?? ""
        // Edges are only meaningful between boxes that still exist - a
        // decode drift (e.g. a box that failed to decode after a schema
        // change) must not leave dangling connectors pointing at nothing.
        let ids = Set(boxes.map(\.id))
        let pruned = edges.filter { ids.contains($0.from) && ids.contains($0.to) }
        if pruned.count != edges.count {
            edges = pruned
            Self.encode(edges, key: Self.edgesKey)
        }
    }

    // MARK: Boxes

    @discardableResult
    func addBox(_ type: DesignBoxType, at position: CGPoint) -> DesignBox {
        let box = DesignBox(
            id: "box_\(UUID().uuidString.prefix(8))",
            type: type,
            title: "New \(type.label)",
            position: position
        )
        boxes.append(box)
        saveBoxes()
        return box
    }

    func box(_ id: String) -> DesignBox? {
        boxes.first { $0.id == id }
    }

    func updateBox(_ id: String, mutate: (inout DesignBox) -> Void) {
        guard let i = boxes.firstIndex(where: { $0.id == id }) else { return }
        mutate(&boxes[i])
        saveBoxes()
    }

    /// Live drag positions go through here every gesture frame - update the
    /// published array (so connectors track the box) but only persist on
    /// `commitPosition` at drag end, matching `FieldDeskStore.saveLayout`'s
    /// own "commits are discrete user actions, not per-frame updates" rule.
    func setPosition(_ id: String, _ position: CGPoint) {
        guard let i = boxes.firstIndex(where: { $0.id == id }) else { return }
        boxes[i].position = position
    }

    func commitPosition() {
        saveBoxes()
    }

    func removeBox(_ id: String) {
        boxes.removeAll { $0.id == id }
        edges.removeAll { $0.from == id || $0.to == id }
        saveBoxes()
        saveEdges()
    }

    // MARK: Edges

    /// The call the old canvas never had - `edges` could render but nothing
    /// appended to it. Rejects self-loops and exact duplicates; a second
    /// distinct edge between the same pair IS allowed when the source is a
    /// `.branch` (two differently-labeled choices may genuinely converge on
    /// the same next box).
    @discardableResult
    func addEdge(from: String, to: String, label: String? = nil) -> DesignEdge? {
        guard from != to,
              boxes.contains(where: { $0.id == from }),
              boxes.contains(where: { $0.id == to }) else { return nil }
        let isBranch = box(from)?.type == .branch
        if !isBranch, edges.contains(where: { $0.from == from && $0.to == to }) {
            return nil
        }
        let edge = DesignEdge(from: from, to: to, label: label)
        edges.append(edge)
        saveEdges()
        return edge
    }

    func removeEdge(_ id: String) {
        edges.removeAll { $0.id == id }
        saveEdges()
    }

    func setEdgeLabel(_ id: String, label: String?) {
        guard let i = edges.firstIndex(where: { $0.id == id }) else { return }
        edges[i].label = (label?.isEmpty == true) ? nil : label
        saveEdges()
    }

    func edgesFrom(_ boxId: String) -> [DesignEdge] {
        edges.filter { $0.from == boxId }
    }

    func edgesInto(_ boxId: String) -> [DesignEdge] {
        edges.filter { $0.to == boxId }
    }

    /// The title of any directly-connected upstream `.chapter` box - real
    /// grounding for a `.simulation` box's AI generation call, and the
    /// "connect it to another box" mechanic actually doing something (a
    /// sim wired to a chapter gets generated in that chapter's context,
    /// not a bare prompt in isolation).
    ///
    /// HONEST LIMIT: title only, not the chapter's full body.
    /// `GeneratedSimClient.requestSim(topic:)` caches results keyed by a
    /// slug of `topic` (`generate-sim.ts`'s whole "reuse before
    /// regenerate" design) - folding a full chapter body into that string
    /// would either produce an unstable, garbage-long cache key or
    /// silently defeat the cache for every call. Threading real grounding
    /// text through to the generation backend properly (the
    /// `prose_brief`/`referenceMaterial` shape `LessonOutlineClient`
    /// already uses server-side) needs a webhook contract change this
    /// pass doesn't make - title-level context is what's honestly
    /// available today without touching that contract.
    func upstreamChapterTitle(for simulationBoxId: String) -> String? {
        for edge in edgesInto(simulationBoxId) {
            guard let source = box(edge.from), source.type == .chapter else { continue }
            let trimmed = source.title.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty { return trimmed }
        }
        return nil
    }

    // MARK: Title

    func setTitle(_ next: String) {
        title = next
        Self.encode(next, key: Self.titleKey)
    }

    // MARK: Graph walk / publish

    /// Boxes with no incoming edges - the natural starting points of the
    /// book. Ordered top-to-bottom then left-to-right so the walk is
    /// deterministic regardless of creation order.
    var startBoxes: [DesignBox] {
        let targets = Set(edges.map(\.to))
        return boxes
            .filter { !targets.contains($0.id) }
            .sorted { ($0.position.y, $0.position.x) < ($1.position.y, $1.position.x) }
    }

    /// The full reading order, start box(es) first, following edges. Each
    /// box appears at most once (diamond shapes converge; cycles can't
    /// loop). This single walk backs BOTH the timeline strip's live
    /// preview and `assembleBook` - they can never disagree about order.
    var walkOrder: [DesignBox] {
        var visited = Set<String>()
        var order: [DesignBox] = []
        func visit(_ box: DesignBox) {
            guard !visited.contains(box.id) else { return }
            visited.insert(box.id)
            order.append(box)
            for edge in edgesFrom(box.id) {
                if let next = self.box(edge.to) { visit(next) }
            }
        }
        for start in startBoxes { visit(start) }
        // A pure cycle (no start box at all) still deserves a defined
        // order rather than an empty book - fall back to the topmost box.
        if order.isEmpty, let fallback = boxes.sorted(by: { ($0.position.y, $0.position.x) < ($1.position.y, $1.position.x) }).first {
            visit(fallback)
        }
        return order
    }

    /// True once there is something real to publish - at least one chapter
    /// with actual prose. Simulations/checkpoints alone don't make a book.
    var canPublish: Bool {
        boxes.contains { $0.type == .chapter && !$0.chapterBody.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty }
    }

    /// One rendered stop on the assembled reading path. Backs BOTH the
    /// in-studio book preview (which shows placeholders for unwritten
    /// boxes, because a draft preview should show the gaps) and the
    /// published markdown (which filters placeholders out - publish only
    /// ships real content). One walk, so the two can't drift.
    struct BookSection: Identifiable, Equatable {
        let id: String
        let type: DesignBoxType
        let title: String
        let body: String
        /// True when the box has no real content yet - preview renders it
        /// honestly as unwritten; publish drops it.
        let isPlaceholder: Bool
    }

    /// The graph walked into linear sections, `startBoxes` first, DFS
    /// along edges (same traversal as `walkOrder`).
    ///
    /// HONEST LIMIT, stated rather than hidden: `.branch` boxes flatten
    /// into a section that NAMES each choice and the section it leads to -
    /// the Binder's book body is a flat string, and no reader in the app
    /// today can walk a branching structure (`StudySessionView`, the only
    /// book reader, renders a flat chapter list; the Binder popup itself
    /// shows a two-line preview and has no reader at all). A real
    /// choose-your-path reader is a scoped-out gap this flatten does not
    /// pretend to solve.
    /// One box rendered into its `BookSection` shape - factored out of
    /// `assembleSections()` (2026-08-24) so the branching-aware preview
    /// (`BookPreviewTree`) can render one box at a time while walking the
    /// real graph structure itself, instead of only ever consuming the
    /// pre-flattened array. Same exact per-type text this always produced;
    /// no behavior change for `assembleSections()`'s own callers.
    func section(for box: DesignBox) -> BookSection {
        let heading = box.title.isEmpty ? "Untitled \(box.type.label.lowercased())" : box.title
        switch box.type {
        case .chapter:
            let body = box.chapterBody.trimmingCharacters(in: .whitespacesAndNewlines)
            return BookSection(
                id: box.id, type: .chapter, title: heading,
                body: body.isEmpty ? "This chapter hasn't been written yet." : body,
                isPlaceholder: body.isEmpty
            )
        case .checkpoint:
            var lines: [String] = []
            if !box.checkpointQuestion.isEmpty { lines.append("**\(box.checkpointQuestion)**") }
            if !box.checkpointAnswer.isEmpty { lines.append("_What a good answer looks like: \(box.checkpointAnswer)_") }
            return BookSection(
                id: box.id, type: .checkpoint, title: "Checkpoint · \(heading)",
                body: lines.isEmpty ? "No question written yet." : lines.joined(separator: "\n\n"),
                isPlaceholder: lines.isEmpty
            )
        case .simulation:
            var lines: [String] = []
            if !box.subtitle.isEmpty { lines.append(box.subtitle) }
            if !box.referenceURL.isEmpty { lines.append("Reference: \(box.referenceURL)") }
            // HONEST LIMIT, stated rather than hidden (same convention
            // as the .branch flatten note below): a generated sim's
            // HTML is real and playable INSIDE Design Studio
            // (InlineSimWebView, same rendering path BookReaderView
            // uses), but the published Binder book body is a flat
            // markdown string rendered by StudySessionView as plain
            // Text, not HTML - embedding the sim's markup there would
            // just show broken raw tags, not a working sim. Until the
            // Binder reader gains a structured "embedded sim" surface
            // (StudySessionView already has one for voice-flow
            // generated sims - GENERATED SIM section - this box's
            // result isn't wired into it yet), publish can only name
            // what exists, not embed it.
            if !box.generatedSimHTML.isEmpty {
                let label = box.generatedSimTitle.isEmpty ? heading : box.generatedSimTitle
                lines.append("_AI-generated simulation ready: \u{201c}\(label)\u{201d} - open this box in Design Studio to run it. (Published books can't embed it yet - open the draft canvas instead.)_")
            } else {
                lines.append("_Built as a block workspace in Design Studio - open the canvas to run it._")
            }
            return BookSection(
                id: box.id, type: .simulation, title: "Simulation · \(heading)",
                body: lines.joined(separator: "\n\n"),
                isPlaceholder: false
            )
        case .branch:
            let outgoing = edgesFrom(box.id)
            let choiceLines = outgoing.enumerated().map { index, edge -> String in
                let choice = edge.label ?? "Choice \(index + 1)"
                let target = self.box(edge.to).map { $0.title.isEmpty ? "Untitled" : $0.title } ?? "?"
                return "- If you choose **\(choice)**: continue at \u{201c}\(target)\u{201d}"
            }
            return BookSection(
                id: box.id, type: .branch, title: heading,
                body: choiceLines.isEmpty
                    ? "No paths connected yet."
                    : "Choose a path:\n\n" + choiceLines.joined(separator: "\n"),
                isPlaceholder: choiceLines.isEmpty
            )
        }
    }

    func assembleSections() -> [BookSection] {
        var visited = Set<String>()
        var sections: [BookSection] = []

        func render(_ box: DesignBox) {
            guard !visited.contains(box.id) else { return }
            visited.insert(box.id)
            sections.append(section(for: box))
            for edge in edgesFrom(box.id) {
                if let next = self.box(edge.to) { render(next) }
            }
        }

        for start in startBoxes { render(start) }
        // Same pure-cycle fallback as walkOrder.
        if sections.isEmpty, let fallback = boxes.sorted(by: { ($0.position.y, $0.position.x) < ($1.position.y, $1.position.x) }).first {
            render(fallback)
        }
        return sections
    }

    /// The publishable book title - the student's own working title, else
    /// the first named chapter on the path, else honest "Untitled book".
    var resolvedTitle: String {
        let trimmed = title.trimmingCharacters(in: .whitespacesAndNewlines)
        if !trimmed.isEmpty { return trimmed }
        if let firstChapter = walkOrder.first(where: { $0.type == .chapter && !$0.title.isEmpty }) {
            return firstChapter.title
        }
        return "Untitled book"
    }

    /// Walks the graph into the linear markdown `BinderStore.addBook`
    /// expects - the same `## Chapter\n\nbody` shape `BookWorkflowView.
    /// publish()` already writes, so published canvases and published
    /// straight-line books are indistinguishable to the Binder.
    /// Placeholder (unwritten) sections are dropped: publish ships only
    /// real content, while the preview shows the draft's gaps.
    func assembleBook() -> (title: String, body: String)? {
        guard canPublish else { return nil }
        let real = assembleSections().filter { !$0.isPlaceholder }
        guard !real.isEmpty else { return nil }
        let body = real.map { "## \($0.title)\n\n\($0.body)" }.joined(separator: "\n\n")
        return (resolvedTitle, body)
    }

    func clearAllForTesting() {
        boxes = []
        edges = []
        title = ""
        saveBoxes()
        saveEdges()
        Self.encode(title, key: Self.titleKey)
    }

    // MARK: Persistence plumbing (FieldDeskStore's exact shape)

    private func saveBoxes() {
        Self.encode(boxes, key: Self.boxesKey)
    }

    private func saveEdges() {
        Self.encode(edges, key: Self.edgesKey)
    }

    private static func decode<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard !uiTesting, let data = UserDefaults.standard.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    private static func encode<T: Encodable>(_ value: T, key: String) {
        guard !uiTesting else { return }
        if let data = try? JSONEncoder().encode(value) {
            UserDefaults.standard.set(data, forKey: key)
        }
    }
}
