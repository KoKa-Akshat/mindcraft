"""
Loader for dynamically-generated, book-derived concept graphs — the
mindcraft-content-engine pipeline's ConceptGraph/ConceptRecord JSON output
(book -> BookSummarizer -> CourseDescription -> generate_concept_graph()).

Concepts are already namespaced "{subject_id}::{slug}" at generation time —
see mindcraft-content-engine/src/mindcraft_content_engine/schema.py's own
ConceptRecord docstring, which was written specifically against MindCraft's
"StudentState.mastery_by_concept has no subject scoping" collision risk.
This loader re-validates that namespacing and the dependency DAG itself
rather than trusting the upstream pipeline's own validation claim — a
generator asserting "this is a valid DAG" is not the same as this loader
having actually checked it.

Converts into the exact same Concept/OntologyEdge shapes the live
42-concept ontology already uses, so nothing downstream (edges.py,
decay.py, pathfinder.py) needs to change — they already take
`ontology: Ontology` as a plain parameter, never a hardcoded global.
merge_ontology() combines a base Ontology with any number of these into one
Ontology; concept-id collisions are caught for free by
Ontology.concept_id_registry() (namespacing is what keeps that from ever
actually firing).
"""

from __future__ import annotations

import json
import logging
import pathlib
from typing import Any

_log = logging.getLogger(__name__)

from mindcraft_graph.models.concept import Concept, Ontology, OntologyEdge

_VALID_LEVELS = {"foundational", "core", "advanced", "cross_cutting"}


class DynamicGraphError(Exception):
    """A book-derived concept graph failed validation - never silently
    dropped or half-loaded. Failing loud here is cheap; a bad concept graph
    silently corrupting the live mastery ontology is not."""


def load_dynamic_concept_graph(path: str | pathlib.Path) -> Ontology:
    """Load and validate one ConceptGraph JSON file, return it as an
    Ontology (a single-subject one — merge_ontology combines several)."""
    data = json.loads(pathlib.Path(path).read_text())
    return _build_ontology(data, source=str(path))


def load_dynamic_concept_graphs(directory: str | pathlib.Path, strict: bool = False) -> list[Ontology]:
    """Load every *.json file in `directory` as a dynamic concept graph. A
    directory that doesn't exist yields an empty list, not an error -
    dynamic graphs are optional; the base 42-concept ontology must never
    depend on this directory existing.

    Per-file validation stays strict either way (a malformed graph is never
    silently half-loaded) - `strict` only controls what happens to the
    BATCH when one file fails: `strict=False` (the default, and what a live
    service startup should use) logs and skips just that file, since this
    directory is fed by a semi-automated pipeline that will keep growing
    and one bad book graph must not take the whole service down on next
    restart. `strict=True` (what tests should use) re-raises immediately,
    since a bad fixture failing loud in a test is exactly the point."""
    directory = pathlib.Path(directory)
    if not directory.exists():
        return []
    graphs: list[Ontology] = []
    for path in sorted(directory.glob("*.json")):
        try:
            graphs.append(load_dynamic_concept_graph(path))
        except (DynamicGraphError, ValueError, KeyError) as exc:
            if strict:
                raise
            _log.error("Skipping invalid dynamic concept graph %s: %s", path, exc)
    return graphs


def _build_ontology(data: dict[str, Any], source: str) -> Ontology:
    subject_id = data.get("subject_id", "")
    raw_concepts = data.get("concepts", [])
    if not raw_concepts:
        raise DynamicGraphError(f"{source}: no concepts")

    ids: set[str] = set()
    concepts: list[Concept] = []
    deps_by_id: dict[str, list[str]] = {}

    for raw in raw_concepts:
        concept_id = raw.get("id", "")
        if "::" not in concept_id:
            raise DynamicGraphError(
                f"{source}: concept id {concept_id!r} is not namespaced (expected 'subject::concept')"
            )
        if concept_id in ids:
            raise DynamicGraphError(f"{source}: duplicate concept id {concept_id!r}")
        ids.add(concept_id)

        level = raw.get("level", "core")
        if level not in _VALID_LEVELS:
            raise DynamicGraphError(f"{source}: concept {concept_id!r} has invalid level {level!r}")

        deps = raw.get("dependencies", [])
        if concept_id in deps:
            raise DynamicGraphError(f"{source}: concept {concept_id!r} lists itself as a dependency")
        deps_by_id[concept_id] = deps

        taxonomy = raw.get("taxonomy_id")
        concepts.append(
            Concept(
                id=concept_id,
                name=raw.get("label", concept_id),
                level=level,
                tags=[taxonomy] if taxonomy and taxonomy != "MISC" else [],
            )
        )

    edges: list[OntologyEdge] = []
    for concept_id, deps in deps_by_id.items():
        for dep in deps:
            # A dangling dependency (references a concept not in this same
            # graph) is either a real generation bug or an attempted
            # cross-book edge this loader doesn't support yet — both fail
            # loud rather than silently dropping the edge.
            if dep not in ids:
                raise DynamicGraphError(f"{source}: concept {concept_id!r} depends on unknown id {dep!r}")
            edges.append(OntologyEdge(**{"from": dep, "to": concept_id}, relation="prerequisite", strength=0.8))

    _assert_dag(deps_by_id, source)

    return Ontology(version=data.get("version", "0.1.0"), domain=subject_id, concepts=concepts, edges=edges)


def _assert_dag(deps_by_id: dict[str, list[str]], source: str) -> None:
    """Standard white/gray/black DFS cycle check, re-run here regardless of
    whatever DAG validation the upstream generator already claims to have
    done — this loader has no way to trust that claim without re-verifying."""
    WHITE, GRAY, BLACK = 0, 1, 2
    color: dict[str, int] = {node: WHITE for node in deps_by_id}

    def visit(node: str, stack: list[str]) -> None:
        color[node] = GRAY
        for dep in deps_by_id.get(node, []):
            if color.get(dep, WHITE) == GRAY:
                raise DynamicGraphError(f"{source}: dependency cycle: {' -> '.join(stack + [dep, node])}")
            if color.get(dep, WHITE) == WHITE:
                visit(dep, stack + [node])
        color[node] = BLACK

    for node in list(deps_by_id):
        if color[node] == WHITE:
            visit(node, [])


def merge_ontology(base: Ontology, additions: list[Ontology]) -> Ontology:
    """Combine a base Ontology with any number of dynamically-loaded ones
    into a single Ontology — the graph "scales organically": each new book
    processed just adds its (already-namespaced, already-DAG-checked)
    concepts and edges into the SAME live graph the mastery engine already
    operates over, rather than living in a separate parallel system. Nothing
    downstream needs to know or care whether a concept came from the fixed
    ACT-math ontology or a student's uploaded book — pathfinder/edges/decay
    already just walk `ontology.concepts`/`ontology.edges` generically.

    A concept-id collision between the base and any addition (or between
    two additions) raises via Ontology.concept_id_registry() below — this
    is the exact multi-subject namespacing collision risk namespacing
    exists to prevent, and it's checked here at merge time, not discovered
    later at first mastery lookup.
    """
    concepts = list(base.concepts)
    edges = list(base.edges)
    for addition in additions:
        concepts.extend(addition.concepts)
        edges.extend(addition.edges)
    merged = Ontology(
        version=base.version,
        domain=base.domain,
        concepts=concepts,
        edges=edges,
        high_priority_concepts=list(base.high_priority_concepts),
    )
    merged.concept_id_registry()  # raises ValueError on any collision
    return merged
