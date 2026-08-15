import Foundation
import FirebaseAuth

/// One node from `GET /knowledge-graph/{uid}`'s `nodes[]` array - now models
/// the FULL real payload (see `ml/serve.py`'s `knowledge_graph_endpoint`,
/// ~line 1330): `x`/`y` are real PCA-projected concept-embedding coordinates
/// (NOT a synthetic layout), `eventCount`/`strengthScore` drive the Map's
/// radius/ring treatment, mirroring `ConstellationGpsExplorer.tsx`'s `MLNode`
/// exactly (2026-07-25 "port it a to z from the dashboard" pass). Superset of
/// the earlier Phase-1 `mastery`/`status`-only model - `ConceptProgress`
/// below stays for Home/Contents roadmap callers that only need those two.
struct KnowledgeGraphNode: Decodable, Identifiable {
    let id: String
    let name: String?
    let level: String?
    let x: Double?
    let y: Double?
    let mastery: Double?
    let strengthScore: Double?
    let eventCount: Int?
    let status: String?
}

/// One ontology edge with its real Beta-Binomial posterior weight and
/// relation type - mirrors `ConstellationGpsExplorer.tsx`'s `MLEdge`.
struct KnowledgeGraphEdge: Decodable {
    let from: String
    let to: String
    let weight: Double
    let relation: String
}

struct KnowledgeGraphStudentPoint: Decodable {
    let x: Double
    let y: Double
    let label: String
}

struct KnowledgeGraphStudentPoints: Decodable {
    let mastery: KnowledgeGraphStudentPoint
    let strength: KnowledgeGraphStudentPoint
}

struct KnowledgeGraphAxisLabels: Decodable {
    let x: String
    let y: String
}

private struct KnowledgeGraphResponseWire: Decodable {
    let nodes: [KnowledgeGraphNode]
    let edges: [KnowledgeGraphEdge]?
    let studentPoints: KnowledgeGraphStudentPoints?
    let axisLabels: KnowledgeGraphAxisLabels?
}

enum KnowledgeGraphError: Error, LocalizedError {
    case notSignedIn
    case server(Int)
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notSignedIn:
            return "Not signed in."
        case .server(let statusCode):
            return "Knowledge graph service returned HTTP \(statusCode)."
        case .invalidResponse:
            return "Knowledge graph service returned a response that couldn't be read."
        }
    }
}

/// One-shot `GET {ML_API_URL}/knowledge-graph/{uid}` client, mirroring
/// `graphCache.ts`'s `fetchKnowledgeGraph`: same base URL (the live HF Spaces
/// bridge, not the dormant Cloud Run URL - see CLAUDE.md Deployment), same
/// `Authorization: Bearer <Firebase ID token>` header. Now exposes the FULL
/// real payload (`nodes`, `edges`, `studentPoints`, `axisLabels`) alongside
/// the original `[String: ConceptProgress]` map Home/Contents roadmap already
/// depend on - extending the wire model rather than replacing it, so no
/// existing caller needed to change.
///
/// Exposed as an `ObservableObject` (not a plain async func) specifically so
/// `DashboardView` can drive a loading UI across the HF Space free-tier's
/// real cold-start wake time - up to ~60s after ~48h idle - without that
/// wait reading as a stuck or broken screen. The request timeout below is
/// set generously above that so the client never times out early or
/// surfaces an error while the Space is still legitimately waking.
@MainActor
final class KnowledgeGraphClient: ObservableObject {
    @Published private(set) var progress: [String: ConceptProgress] = [:]
    @Published private(set) var nodes: [KnowledgeGraphNode] = []
    @Published private(set) var edges: [KnowledgeGraphEdge] = []
    @Published private(set) var studentPoints: KnowledgeGraphStudentPoints?
    @Published private(set) var axisLabels: KnowledgeGraphAxisLabels?
    @Published private(set) var isLoading = false
    @Published private(set) var lastError: Error?

    private static let baseURL = "https://joinmindcraft-mindcraft-ml.hf.space"

    /// Generous headroom above the documented ~60s cold-start wake so a real
    /// wake-up is never mistaken for a timeout/failure.
    private static let coldStartTimeout: TimeInterval = 90

    private let session: URLSession = {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest = coldStartTimeout
        config.timeoutIntervalForResource = coldStartTimeout
        return URLSession(configuration: config)
    }()

    /// Fetches the signed-in student's live per-concept mastery/status/
    /// position/edges. Safe to call repeatedly (e.g. pull-to-refresh later)
    /// - each call is independent, no caching layer here (unlike the web's
    /// `graphCache.ts`, which dedupes concurrent callers across two
    /// different screens; this client only has one caller today, so that
    /// complexity isn't needed yet).
    func load() async {
        // Test-only seam (same pattern as `GmailClient.seedForTesting`) - the
        // Map screen has no UI test coverage yet and needs real node/edge
        // shapes (mastered, in-progress, struggling, AND untouched-with-
        // prerequisites-met vs. untouched-and-blocked) to actually exercise
        // the ZPD ready/locked split, which real backend data can't be
        // relied on to contain in any given run.
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-force-map") {
            seedMockGraph()
            return
        }
        guard let user = Auth.auth().currentUser else {
            lastError = KnowledgeGraphError.notSignedIn
            return
        }

        isLoading = true
        lastError = nil
        defer { isLoading = false }

        do {
            let token = try await user.getIDToken()

            guard let url = URL(string: "\(Self.baseURL)/knowledge-graph/\(user.uid)") else {
                throw KnowledgeGraphError.invalidResponse
            }
            var request = URLRequest(url: url)
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

            let (data, response) = try await session.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw KnowledgeGraphError.invalidResponse
            }
            guard httpResponse.statusCode == 200 else {
                throw KnowledgeGraphError.server(httpResponse.statusCode)
            }

            let decoded = try JSONDecoder().decode(KnowledgeGraphResponseWire.self, from: data)

            var map: [String: ConceptProgress] = [:]
            for node in decoded.nodes {
                map[node.id] = ConceptProgress(
                    mastery: min(1, max(0, node.mastery ?? 0)),
                    status: node.status ?? "untouched"
                )
            }
            progress = map
            nodes = decoded.nodes
            edges = decoded.edges ?? []
            studentPoints = decoded.studentPoints
            axisLabels = decoded.axisLabels
        } catch {
            lastError = error
        }
    }

    /// `--ui-testing-force-map` only. A small, real prerequisite chain -
    /// mastered `linear_equations` unlocks `quadratic_equations` (in
    /// progress) and `systems_of_linear_equations` (struggling) plus
    /// `functions_basics` (untouched, but ZPD-ready since its only
    /// prerequisite is mastered); `polynomial_functions` needs the
    /// not-yet-mastered `quadratic_equations` too, so it's untouched-and-
    /// locked, and `derivatives` sits two hops past that, also locked.
    private func seedMockGraph() {
        nodes = [
            KnowledgeGraphNode(id: "linear_equations", name: "Linear Equations", level: "foundational", x: 0.08, y: 0.5, mastery: 0.94, strengthScore: 0.8, eventCount: 14, status: "mastered"),
            KnowledgeGraphNode(id: "quadratic_equations", name: "Quadratic Equations", level: "core", x: 0.38, y: 0.3, mastery: 0.5, strengthScore: 0.35, eventCount: 6, status: "in_progress"),
            KnowledgeGraphNode(id: "systems_of_linear_equations", name: "Systems of Linear Equations", level: "core", x: 0.4, y: 0.72, mastery: 0.22, strengthScore: 0.1, eventCount: 5, status: "struggling"),
            KnowledgeGraphNode(id: "functions_basics", name: "Functions Basics", level: "core", x: 0.36, y: 0.5, mastery: 0, strengthScore: nil, eventCount: 0, status: "untouched"),
            KnowledgeGraphNode(id: "polynomial_functions", name: "Polynomial Functions", level: "advanced", x: 0.68, y: 0.35, mastery: 0, strengthScore: nil, eventCount: 0, status: "untouched"),
            KnowledgeGraphNode(id: "derivatives", name: "Derivatives", level: "advanced", x: 0.92, y: 0.42, mastery: 0, strengthScore: nil, eventCount: 0, status: "untouched"),
        ]
        edges = [
            KnowledgeGraphEdge(from: "linear_equations", to: "quadratic_equations", weight: 0.6, relation: "prerequisite"),
            KnowledgeGraphEdge(from: "linear_equations", to: "systems_of_linear_equations", weight: 0.5, relation: "prerequisite"),
            KnowledgeGraphEdge(from: "linear_equations", to: "functions_basics", weight: 0.4, relation: "prerequisite"),
            KnowledgeGraphEdge(from: "quadratic_equations", to: "polynomial_functions", weight: 0.55, relation: "prerequisite"),
            KnowledgeGraphEdge(from: "functions_basics", to: "polynomial_functions", weight: 0.3, relation: "prerequisite"),
            KnowledgeGraphEdge(from: "polynomial_functions", to: "derivatives", weight: 0.5, relation: "prerequisite"),
        ]
        var map: [String: ConceptProgress] = [:]
        for node in nodes { map[node.id] = ConceptProgress(mastery: node.mastery ?? 0, status: node.status ?? "untouched") }
        progress = map
        studentPoints = nil
        axisLabels = KnowledgeGraphAxisLabels(x: "applied \u{2194} symbolic", y: "probabilistic \u{2194} spatial")
    }
}
