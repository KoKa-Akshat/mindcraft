import Foundation

// Frozen seam (Phase 0, NATIVE_APP_BUILD_PLAN.md §9 step 5). Agent B's
// KnowledgeGraphClient/FirestoreStudentStore and Agent C's
// ContentsRoadmapView both read these types. Do not change without both
// agents' sign-off - see the plan's "Lane ownership" framing applied at file
// granularity for this one seam file.

/// One concept's live mastery/status, keyed by concept id, as read from
/// `GET /knowledge-graph/{uid}`. Mirrors the per-node shape `Dashboard.tsx`'s
/// `conceptProgress` state holds on the web side (see build plan §5).
struct ConceptProgress {
    let mastery: Double
    let status: String
}

/// One of the 4 Contents roadmap lanes (`ACT_TOC_SECTIONS` in
/// `app/src/lib/actToc.ts`), decoded from the bundled `Resources/actToc.json`
/// export (see build plan §8. Agent C owns generating/bundling that JSON).
struct TocSection: Identifiable, Decodable {
    let id: String            // "warmups" | "algebra" | "geometry" | "data"
    let title: String
    let blurb: String
    let washTop: String        // hex, e.g. "fff8f1"
    let washBottom: String
    let accent: String
    let ink: String
    let conceptIds: [String]
}

/// Display label/blurb for one concept node (the `actConceptLabel`/
/// `actConceptBlurb` port), decoded from the same `actToc.json` export
/// (build plan §8 item 2).
struct ConceptDisplay: Decodable {
    let label: String
    let blurb: String
}

/// Visual state a roadmap dot renders in, ported from `Dashboard.tsx`'s
/// `tocDotState()` (build plan §4).
enum TocDotState {
    case complete
    case needs
    case progress
    case locked
}

/// Statuses folded into each `TocDotState` bucket - ported verbatim from
/// `Dashboard.tsx`'s `TOC_MASTERED_STATUSES` / `TOC_STRUGGLING_STATUSES`
/// (build plan §4).
private let tocMasteredStatuses: Set<String> = [
    "mastered", "stable", "comeback_built", "ready_for_challenge",
]
private let tocStrugglingStatuses: Set<String> = [
    "struggling", "open_gap",
]
private let tocProgressStatuses: Set<String> = [
    "in_progress", "repairing",
]

/// Ported verbatim from `Dashboard.tsx`'s `tocDotState()`. Pure and small.
/// Never crashes on an unrecognized status - falls through to `.locked`,
/// matching "everything else (including untouched)" in the web
/// implementation (build plan §4).
func tocDotState(_ status: String) -> TocDotState {
    if tocMasteredStatuses.contains(status) { return .complete }
    if tocStrugglingStatuses.contains(status) { return .needs }
    if tocProgressStatuses.contains(status) { return .progress }
    return .locked
}

/// Mastery status → hex color (no leading "#"), ported verbatim from
/// `STATUS_COLOR` in `app/src/lib/learningPathGraph.ts`. Every screen that
/// renders a mastery dot (Contents roadmap now, Knowledge Map in Phase 3)
/// reads this one dict, so a status never renders a different color on two
/// native screens (build plan §4).
let STATUS_COLOR: [String: String] = [
    "mastered": "A8E063",
    "stable": "A8E063",
    "comeback_built": "A8E063",
    "ready_for_challenge": "A8E063",
    "in_progress": "5B9BD5",
    "repairing": "5B9BD5",
    "struggling": "FF6B6B",
    "open_gap": "FF6B6B",
    "untouched": "8B9BA8",
    "unexplored": "8B9BA8",
]
