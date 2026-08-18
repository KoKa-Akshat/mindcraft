import json
from pathlib import Path

import pytest

from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology
from mindcraft_graph.loaders.dynamic_concept_loader import (
    DynamicGraphError,
    load_dynamic_concept_graph,
    load_dynamic_concept_graphs,
    merge_ontology,
)
from mindcraft_graph.planning.pathfinder import get_prerequisite_chain

DYNAMIC_GRAPHS_DIR = Path(__file__).resolve().parents[1] / "data" / "dynamic_graphs"
STANDARDIZED_ONTOLOGY_PATH = (
    Path(__file__).resolve().parents[1]
    / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
)


def _write(tmp_path: Path, name: str, data: dict) -> Path:
    path = tmp_path / name
    path.write_text(json.dumps(data))
    return path


def _graph(subject_id: str, concepts: list[dict]) -> dict:
    return {"subject_id": subject_id, "title": subject_id, "version": "0.1.0", "concepts": concepts}


# ── Real, already-generated book graphs (mindcraft-content-engine output) ──


def test_loads_real_euclid_graph():
    ontology = load_dynamic_concept_graph(DYNAMIC_GRAPHS_DIR / "euclid_elements.json")
    assert ontology.domain == "euclid_elements"
    assert len(ontology.concepts) == 47
    assert all(c.id.startswith("euclid_elements::") for c in ontology.concepts)
    assert all(e.relation == "prerequisite" for e in ontology.edges)
    # Real content, not placeholders.
    assert any("point" in c.name.lower() for c in ontology.concepts)


def test_loads_all_real_book_graphs_in_directory():
    graphs = load_dynamic_concept_graphs(DYNAMIC_GRAPHS_DIR)
    assert len(graphs) == 4
    subjects = {g.domain for g in graphs}
    assert subjects == {
        "euclid_elements",
        "adam_smith_wealth_of_nations",
        "darwin_origin_of_species",
        "marcus_aurelius_meditations",
    }


def test_missing_directory_yields_empty_list_not_error():
    assert load_dynamic_concept_graphs(DYNAMIC_GRAPHS_DIR / "does_not_exist") == []


def test_one_bad_file_is_skipped_not_fatal_to_the_batch(tmp_path):
    """A live service startup calling this must not go down because one
    book graph (out of what will become many, fed by a semi-automated
    pipeline) is malformed."""
    _write(tmp_path, "good.json", _graph("good", [
        {"id": "good::x", "label": "X", "subject_id": "good", "dependencies": [], "level": "core"},
    ]))
    _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "not_namespaced", "label": "Y", "subject_id": "bad", "dependencies": [], "level": "core"},
    ]))
    graphs = load_dynamic_concept_graphs(tmp_path)  # strict=False by default
    assert len(graphs) == 1
    assert graphs[0].domain == "good"


def test_strict_mode_raises_on_the_same_bad_file(tmp_path):
    _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "not_namespaced", "label": "Y", "subject_id": "bad", "dependencies": [], "level": "core"},
    ]))
    with pytest.raises(DynamicGraphError):
        load_dynamic_concept_graphs(tmp_path, strict=True)


# ── Validation: each real failure mode a bad generator run could produce ──


def test_rejects_unnamespaced_concept_id(tmp_path):
    path = _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "not_namespaced", "label": "X", "subject_id": "bad", "dependencies": [], "level": "core"},
    ]))
    with pytest.raises(DynamicGraphError, match="not namespaced"):
        load_dynamic_concept_graph(path)


def test_rejects_duplicate_concept_id(tmp_path):
    path = _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "bad::x", "label": "X", "subject_id": "bad", "dependencies": [], "level": "core"},
        {"id": "bad::x", "label": "X again", "subject_id": "bad", "dependencies": [], "level": "core"},
    ]))
    with pytest.raises(DynamicGraphError, match="duplicate"):
        load_dynamic_concept_graph(path)


def test_rejects_self_loop_dependency(tmp_path):
    path = _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "bad::x", "label": "X", "subject_id": "bad", "dependencies": ["bad::x"], "level": "core"},
    ]))
    with pytest.raises(DynamicGraphError, match="itself as a dependency"):
        load_dynamic_concept_graph(path)


def test_rejects_dangling_dependency(tmp_path):
    path = _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "bad::x", "label": "X", "subject_id": "bad", "dependencies": ["bad::ghost"], "level": "core"},
    ]))
    with pytest.raises(DynamicGraphError, match="unknown id"):
        load_dynamic_concept_graph(path)


def test_rejects_invalid_level(tmp_path):
    path = _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "bad::x", "label": "X", "subject_id": "bad", "dependencies": [], "level": "expert"},
    ]))
    with pytest.raises(DynamicGraphError, match="invalid level"):
        load_dynamic_concept_graph(path)


def test_rejects_dependency_cycle(tmp_path):
    # a -> b -> c -> a (each "depends on" the next, forming a real cycle)
    path = _write(tmp_path, "bad.json", _graph("bad", [
        {"id": "bad::a", "label": "A", "subject_id": "bad", "dependencies": ["bad::c"], "level": "core"},
        {"id": "bad::b", "label": "B", "subject_id": "bad", "dependencies": ["bad::a"], "level": "core"},
        {"id": "bad::c", "label": "C", "subject_id": "bad", "dependencies": ["bad::b"], "level": "core"},
    ]))
    with pytest.raises(DynamicGraphError, match="cycle"):
        load_dynamic_concept_graph(path)


def test_valid_diamond_dependency_loads_clean(tmp_path):
    # a is a prerequisite for both b and c; d depends on both - a real DAG
    # shape (diamond), not a cycle, must NOT raise.
    path = _write(tmp_path, "ok.json", _graph("ok", [
        {"id": "ok::a", "label": "A", "subject_id": "ok", "dependencies": [], "level": "foundational"},
        {"id": "ok::b", "label": "B", "subject_id": "ok", "dependencies": ["ok::a"], "level": "core"},
        {"id": "ok::c", "label": "C", "subject_id": "ok", "dependencies": ["ok::a"], "level": "core"},
        {"id": "ok::d", "label": "D", "subject_id": "ok", "dependencies": ["ok::b", "ok::c"], "level": "advanced"},
    ]))
    ontology = load_dynamic_concept_graph(path)
    assert len(ontology.concepts) == 4
    # a->b, a->c, b->d, c->d - four real prerequisite edges, not three.
    assert len(ontology.edges) == 4


# ── Merge: the actual "graph scales organically" mechanism ──


def test_merge_combines_concepts_and_edges(tmp_path):
    base = load_dynamic_concept_graph(_write(tmp_path, "base.json", _graph("base", [
        {"id": "base::x", "label": "X", "subject_id": "base", "dependencies": [], "level": "core"},
    ])))
    addition = load_dynamic_concept_graph(_write(tmp_path, "add.json", _graph("add", [
        {"id": "add::y", "label": "Y", "subject_id": "add", "dependencies": [], "level": "core"},
    ])))
    merged = merge_ontology(base, [addition])
    assert {c.id for c in merged.concepts} == {"base::x", "add::y"}


def test_merge_raises_on_concept_id_collision(tmp_path):
    base = load_dynamic_concept_graph(_write(tmp_path, "base.json", _graph("same", [
        {"id": "same::x", "label": "X", "subject_id": "same", "dependencies": [], "level": "core"},
    ])))
    addition = load_dynamic_concept_graph(_write(tmp_path, "add.json", _graph("same", [
        {"id": "same::x", "label": "X duplicated", "subject_id": "same", "dependencies": [], "level": "core"},
    ])))
    with pytest.raises(ValueError):
        merge_ontology(base, [addition])


def test_merge_of_all_four_real_book_graphs_has_no_collisions():
    graphs = load_dynamic_concept_graphs(DYNAMIC_GRAPHS_DIR)
    base, _ = load_complete_ontology(STANDARDIZED_ONTOLOGY_PATH)
    merged = merge_ontology(base, graphs)
    total_added = sum(len(g.concepts) for g in graphs)
    assert len(merged.concepts) == len(base.concepts) + total_added
    # Every book concept resolves through the SAME registry the live
    # 42-concept ontology's own concepts do - proof this is one graph, not
    # four separate systems living side by side.
    assert merged.canonical_concept_id("euclid_elements::point-line-plane-def") == "euclid_elements::point-line-plane-def"


def test_merged_book_concept_resolves_through_the_real_pathfinder():
    """The actual point of all this: a book-derived concept must flow
    through the SAME prerequisite-chain logic the live 42-concept ontology
    already uses, with zero changes to pathfinder.py itself."""
    graphs = load_dynamic_concept_graphs(DYNAMIC_GRAPHS_DIR)
    base, _ = load_complete_ontology(STANDARDIZED_ONTOLOGY_PATH)
    merged = merge_ontology(base, graphs)

    euclid = next(g for g in graphs if g.domain == "euclid_elements")
    # Find a concept with at least one dependency, so the chain is non-trivial.
    with_deps = [e for e in euclid.edges]
    assert with_deps, "expected at least one prerequisite edge in the real Euclid graph"
    target = with_deps[0].to_concept

    chain = get_prerequisite_chain(target, merged)
    assert target in chain
    assert len(chain) >= 2  # target plus at least its one real prerequisite
