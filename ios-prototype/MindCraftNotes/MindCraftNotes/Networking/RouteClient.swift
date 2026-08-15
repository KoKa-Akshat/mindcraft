import Foundation
import FirebaseAuth

/// One step in a plotted route - mirrors `ConstellationGpsExplorer.tsx`'s
/// `RouteStep` (name/mastery/status resolved from `KnowledgeGraphClient`'s
/// already-loaded nodes, same as the web's `nodeMap` lookup).
struct RouteStep: Identifiable {
    var id: String { conceptId }
    let conceptId: String
    let reason: String
    let isTarget: Bool
}

private struct RecommendResponseWire: Decodable {
    struct Recommendation: Decodable {
        let conceptId: String
        let reason: String?
    }
    struct StudentProfileWire: Decodable {
        struct Weakness: Decodable { let conceptId: String; let strength: Double }
        let topWeaknesses: [Weakness]?
    }
    let canonicalChain: [String]?
    let recommendations: [Recommendation]?
    let studentProfile: StudentProfileWire?
}

/// Real `POST /recommend` (`mode: "exam"`) result - the exam-trimmed
/// curriculum chain plus the student's real, engine-computed top weaknesses
/// (`studentProfile.topWeaknesses` in `ml/serve.py`'s response). Ported
/// 2026-08-06 as part of Phase 2 item 4 (build plan): "Today's spark" and
/// "Weekly Review" previously computed their target concept purely from the
/// already-loaded `/knowledge-graph` mastery map (a real, honest, but
/// LOCAL-ONLY approximation of web's `worstWeakness()` - see that function's
/// doc comment in `app/src/lib/recommendNextConcept.ts` for the full
/// multi-tier algorithm this is a real subset of: this ports its `profile`
/// tier, the single biggest contributor, not the bridge/format/misconception
/// gap tiers layered on top of it on web - those depend on ontology bridge
/// data + format-tagged question coverage that isn't wired natively yet).
struct ExamProfile {
    let canonicalChain: [String]
    /// (conceptId, strength) pairs straight from the engine, in the order
    /// the server returned them (already priority-sorted server-side).
    let topWeaknesses: [(conceptId: String, strength: Double)]
}

/// Real `POST /recommend` client - "Your Next Route" / "See path", the exact
/// call `ConstellationGpsExplorer.tsx`'s `plotRoute()` makes
/// (`mode: "curriculum"`, `target_concepts: [targetId]`). Ported 2026-07-25 as
/// part of porting the Map tab "a to z" from the real web component - the
/// mini interactive route-graph SVG web renders alongside the step list is
/// NOT ported here (see `ACTIVE_TASK.md`'s native Map handoff); this gives
/// the real chain + real per-step reasons, just as a plain list.
enum RouteClient {
    private static let baseURL = "https://joinmindcraft-mindcraft-ml.hf.space"

    static func plotRoute(targetConceptId: String) async -> [RouteStep]? {
        // Test-only seam, same shape as `KnowledgeGraphClient.seedMockGraph`
        // - this call needs a real Firebase ID token, which the
        // `--ui-testing-skip-auth` harness deliberately doesn't have (see
        // that flag's own doc comment), so without this the "See path"
        // reveal animation could never be exercised by an automated test,
        // only the button's mere existence.
        if ProcessInfo.processInfo.arguments.contains("--ui-testing-force-map") {
            try? await Task.sleep(nanoseconds: 300_000_000) // real network calls aren't instant either - let the loading state actually show
            return [
                RouteStep(conceptId: "linear_equations", reason: "Already mastered - the foundation this rests on.", isTarget: false),
                RouteStep(conceptId: targetConceptId, reason: "This is your target. Focus your practice here.", isTarget: true),
            ]
        }
        guard let user = Auth.auth().currentUser,
              let token = try? await user.getIDToken(),
              let url = URL(string: "\(baseURL)/recommend")
        else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "student_id": user.uid,
            "target_concepts": [targetConceptId],
            "mode": "curriculum",
            "exam": "ACT",
        ])

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let decoded = try? JSONDecoder().decode(RecommendResponseWire.self, from: data)
        else { return nil }

        let chain = (decoded.canonicalChain?.isEmpty == false) ? decoded.canonicalChain! : [targetConceptId]
        var reasonById: [String: String] = [:]
        for rec in decoded.recommendations ?? [] {
            if let reason = rec.reason { reasonById[rec.conceptId] = reason }
        }
        return chain.enumerated().map { i, id in
            let isTarget = id == targetConceptId
            let reason = reasonById[id] ?? (isTarget
                ? "This is your target. Focus your practice here."
                : "Step \(i + 1): strengthen this prerequisite first.")
            return RouteStep(conceptId: id, reason: reason, isTarget: isTarget)
        }
    }

    /// Real `POST /recommend` in `exam` mode, empty `target_concepts` - the
    /// same shape CLAUDE.md's PawHub table documents for the "Practice"
    /// (topWeaknesses) and "Learn" (first 0-exposure concept on the
    /// exam-trimmed `canonicalChain`) signals. Returns nil on any failure
    /// (offline, cold-start timeout, auth) so callers can fall back to their
    /// own local heuristic rather than showing an error for what's an
    /// enhancement, not the only path to a usable Dashboard.
    static func fetchExamProfile() async -> ExamProfile? {
        guard let user = Auth.auth().currentUser,
              let token = try? await user.getIDToken(),
              let url = URL(string: "\(baseURL)/recommend")
        else { return nil }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.timeoutInterval = 90 // same HF Space cold-start headroom as KnowledgeGraphClient
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try? JSONSerialization.data(withJSONObject: [
            "student_id": user.uid,
            "target_concepts": [],
            "mode": "exam",
            "exam": "ACT",
        ])

        guard let (data, response) = try? await URLSession.shared.data(for: request),
              let http = response as? HTTPURLResponse, http.statusCode == 200,
              let decoded = try? JSONDecoder().decode(RecommendResponseWire.self, from: data)
        else { return nil }

        let weaknesses = (decoded.studentProfile?.topWeaknesses ?? []).map {
            (conceptId: $0.conceptId, strength: $0.strength)
        }
        return ExamProfile(canonicalChain: decoded.canonicalChain ?? [], topWeaknesses: weaknesses)
    }
}
