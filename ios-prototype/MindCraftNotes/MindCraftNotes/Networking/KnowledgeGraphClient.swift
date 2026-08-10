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
}
