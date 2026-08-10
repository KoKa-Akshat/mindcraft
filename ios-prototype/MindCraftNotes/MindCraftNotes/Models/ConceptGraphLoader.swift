import Foundation

/// Looks up a bundled per-concept badge icon (`Resources/conceptIcons/`, 30
/// hand-authored SVGs exported from `app/scripts/generateConceptIconsSvg.mjs`
/// - the SAME set the web Dashboard's Contents roadmap and Map use, replacing
/// the old per-concept emoji). Falls back to `icon-fallback.svg` for the ~12
/// concepts with no bespoke icon yet (mostly advanced/cross-cutting), same
/// disclosed-safety-net behavior as the web's `conceptIconUrl()`.
///
/// (This file used to also hold a synthetic `ConceptGraphLoader` - a
/// deterministic cluster-angle/level-radius layout used before the Map tab
/// was ported to real data. `KnowledgeMapView` now reads real PCA positions
/// and edges straight from `KnowledgeGraphClient`/`GET /knowledge-graph/{uid}`,
/// so that synthetic layout was deleted rather than left as dead code. The
/// bundled `Resources/conceptGraph.json` it read is now unused too but was
/// left in place - see `ACTIVE_TASK.md`'s native Map handoff.)
enum ConceptIconLookup {
    static func url(forConceptId id: String) -> URL? {
        Bundle.main.url(forResource: "icon-\(id)", withExtension: "svg", subdirectory: "conceptIcons")
            ?? Bundle.main.url(forResource: "icon-fallback", withExtension: "svg", subdirectory: "conceptIcons")
    }
}
