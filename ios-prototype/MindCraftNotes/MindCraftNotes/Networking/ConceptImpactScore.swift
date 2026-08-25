import Foundation

/// Concept Impact Score (2026-08-24, explicit ask: "for displaying the
/// number of content on Gurukul vs Dash... Dan did something remarkable
/// again, look into his repo and draw inspiration"). Ported from Dan
/// McCreary's `learning-graphs` book, chapter 28 ("Concept Impact Score
/// and Predicting Content Length", dmccreary/learning-graphs): a
/// PageRank-style recursive importance measure computed exactly, in one
/// pass, over a learning graph's dependency DAG - CIS(x) = 1 + the sum of
/// CIS(d) for every concept d that directly depends on x. Because a
/// prerequisite graph is acyclic (unlike the open web PageRank was built
/// for), no damping factor or iteration is needed; a plain memoized
/// traversal is exact.
///
/// Dan's chapter applies CIS to CONTENT LENGTH (how many words a concept
/// deserves). This applies the identical idea to MASTERY: a flat
/// "X/Y concepts mastered" count treats a leaf concept and a foundational
/// hub as equally important, which is exactly the blind spot chapter 28
/// calls out for raw indegree. Weighting each mastered concept by
/// log(CIS+1) - the same log-normalized Elaboration Score formula from the
/// chapter - means mastering something everything else depends on moves
/// the number more than mastering a dead-end leaf.
enum ConceptImpactScore {
    /// CIS(x) = 1 + sum(CIS(d)) for every d with a prerequisite edge x -> d
    /// (d depends on x). Memoized recursion, not a strict topological
    /// sort, since KnowledgeGraphNode/Edge already carry no ordering
    /// guarantee - a `visiting` guard makes this safe even if a bad edge
    /// set were ever non-acyclic (defense in depth; the server-side
    /// ontology is validated DAG-only, see `_assert_dag` in
    /// `dynamic_concept_loader.py`), returning 1 for a node caught
    /// mid-cycle rather than recursing forever.
    static func scores(nodes: [KnowledgeGraphNode], edges: [KnowledgeGraphEdge]) -> [String: Int] {
        var dependents: [String: [String]] = [:]
        for edge in edges where edge.relation == "prerequisite" {
            dependents[edge.from, default: []].append(edge.to)
        }

        var memo: [String: Int] = [:]
        var visiting: Set<String> = []

        func cis(_ id: String) -> Int {
            if let cached = memo[id] { return cached }
            if visiting.contains(id) { return 1 }
            visiting.insert(id)
            let value = 1 + (dependents[id] ?? []).reduce(0) { $0 + cis($1) }
            visiting.remove(id)
            memo[id] = value
            return value
        }

        for node in nodes { _ = cis(node.id) }
        return memo
    }

    /// Elaboration Score's own formula (chapter 28), applied to mastery
    /// instead of word count: log(CIS+1) / log(CISmax+1), summed over
    /// mastered concepts and divided by the same sum over every concept.
    /// Returns nil for an empty graph (nothing to weight yet) rather than
    /// a misleading 0%.
    static func impactWeightedMastery(nodes: [KnowledgeGraphNode], edges: [KnowledgeGraphEdge]) -> Double? {
        guard !nodes.isEmpty else { return nil }
        let cisById = scores(nodes: nodes, edges: edges)
        guard let maxCIS = cisById.values.max(), maxCIS > 0 else { return nil }
        let logMax = log(Double(maxCIS) + 1)
        guard logMax > 0 else { return nil }

        func weight(_ id: String) -> Double {
            log(Double(cisById[id] ?? 1) + 1) / logMax
        }

        let totalWeight = nodes.reduce(0.0) { $0 + weight($1.id) }
        guard totalWeight > 0 else { return nil }
        let masteredWeight = nodes.filter { $0.status == "mastered" }.reduce(0.0) { $0 + weight($1.id) }
        return masteredWeight / totalWeight
    }
}
