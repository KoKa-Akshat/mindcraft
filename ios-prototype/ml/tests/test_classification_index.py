from __future__ import annotations

import numpy as np

from mindcraft_graph.engine.ingredient_runtime import classify_problem, select_target_ingredients
from mindcraft_graph.models.concept import Concept, Ontology
from mindcraft_graph.models.ingredient import Ingredient, IngredientOntology
from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.representation.classification_index import (
    ClassificationEntry,
    ClassificationIndex,
    cache_matches,
    load_classification_index,
    save_classification_index,
    build_classification_index,
)


def _vec(axis: int, weight: float = 1.0) -> np.ndarray:
    vector = np.zeros(384, dtype=np.float32)
    vector[axis] = weight
    return vector


def _empty_ontology() -> Ontology:
    return Ontology(version="test", domain="math", concepts=[], edges=[])


def test_archetype_classification_uses_max_exemplar_and_hands_off_ingredients():
    index = ClassificationIndex(entries=(
        ClassificationEntry(
            entry_id="sequence-shape",
            archetype_id="sequence-next",
            concept_ids=("sequences_series",),
            required_ingredient_ids=("sequences__nth_term_formula",),
            bridge_concept_ids=(),
            vector=_vec(0, 0.1),
        ),
        ClassificationEntry(
            entry_id="sequence-seed",
            archetype_id="sequence-next",
            concept_ids=("sequences_series",),
            required_ingredient_ids=("sequences__nth_term_formula",),
            bridge_concept_ids=(),
            vector=_vec(1),
        ),
        ClassificationEntry(
            entry_id="numbers-shape",
            archetype_id="factor-count",
            concept_ids=("number_properties",),
            required_ingredient_ids=("number_properties__factor_definition",),
            bridge_concept_ids=(),
            vector=_vec(0),
        ),
    ), source_hash="hash")

    result = classify_problem(
        "sequence",
        {},
        lambda _text: _vec(1),
        _empty_ontology(),
        classification_index=index,
        classifier_mode="archetype",
        secondary_margin=0.01,
    )

    assert result.primary_concept == "sequences_series"
    assert result.archetype_ids == ["sequence-next"]
    assert result.required_ingredient_ids == ["sequences__nth_term_formula"]


def test_secondary_margin_dedupes_concepts_and_uses_winning_archetype():
    index = ClassificationIndex(entries=(
        ClassificationEntry("a", "a", ("linear_equations",), ("linear-a",), ("functions_basics",), _vec(0)),
        ClassificationEntry("a-worse", "a-worse", ("linear_equations",), ("linear-worse",), (), _vec(0, 0.8)),
        ClassificationEntry("b", "b", ("functions_basics",), ("function-b",), (), _vec(0, 0.98)),
        ClassificationEntry("c", "c", ("number_properties",), ("number-c",), (), _vec(1)),
    ), source_hash="hash")

    result = classify_problem(
        "problem", {}, lambda _text: _vec(0), _empty_ontology(),
        classification_index=index, classifier_mode="bank", emit_secondary_concepts=True,
    )

    assert result.primary_concept == "linear_equations"
    assert result.secondary_concepts == ["functions_basics"]
    assert result.required_ingredient_ids == ["linear-a", "function-b"]


def test_required_ingredients_override_concept_wide_selection():
    graph = IngredientGraph(IngredientOntology(
        version="test",
        ingredients=[
            Ingredient(id="keep", concept_id="c", name="Keep", description="", tags=[]),
            Ingredient(id="other", concept_id="c", name="Other", description="", tags=[]),
        ],
    ))
    assert select_target_ingredients("c", [], graph, ["keep", "missing"]) == ["keep"]


def test_classification_cache_round_trip_and_hash_check(tmp_path):
    index = ClassificationIndex(entries=(
        ClassificationEntry("a", "arch", ("concept",), ("ingredient",), (), _vec(2)),
    ), source_hash="source")
    path = tmp_path / "classification.npz"
    save_classification_index(index, path)
    loaded = load_classification_index(path)
    assert cache_matches(loaded, "source")
    assert not cache_matches(loaded, "changed")
    assert loaded.entries[0].concept_ids == ("concept",)
    np.testing.assert_array_equal(loaded.entries[0].vector, _vec(2))


def test_bank_knn_places_concept_then_extracts_from_its_archetype():
    index = ClassificationIndex(entries=(
        ClassificationEntry("b1", "", ("sequences_series",), (), (), _vec(0), "bank"),
        ClassificationEntry("b2", "", ("sequences_series",), (), (), _vec(0), "bank"),
        ClassificationEntry("b3", "", ("number_properties",), (), (), _vec(0), "bank"),
        ClassificationEntry("a1", "sequence-next", ("sequences_series",), ("sequence-step",), (), _vec(1)),
    ), source_hash="hash")

    result = classify_problem(
        "sequence", {}, lambda _text: _vec(0), _empty_ontology(),
        classification_index=index, classifier_mode="bank", knn_k=3,
    )

    assert result.primary_concept == "sequences_series"
    assert result.archetype_ids == ["sequence-next"]
    assert result.required_ingredient_ids == ["sequence-step"]


class _FakeModel:
    def encode(self, texts, **_kwargs):
        return np.stack([_vec(index % 4) for index, _text in enumerate(texts)])


def test_bank_build_normalizes_alias_and_fails_fast_on_unknown(tmp_path):
    ontology = Ontology(version="test", domain="math", concepts=[
        Concept(id="ratios_proportions", name="Ratios", level="core", aliases=["percent_ratio"]),
    ], edges=[])
    ingredients = IngredientOntology(version="test")
    layer2 = tmp_path / "l2.json"
    layer3 = tmp_path / "l3.json"
    bank = tmp_path / "bank.json"
    layer2.write_text('{"archetypes": []}')
    layer3.write_text('{"question_instances": []}')
    bank.write_text('[{"id":"q1","conceptId":"percent_ratio","question":"What is 20% of 50?"}]')

    index = build_classification_index(
        ontology, ingredients, layer2, layer3, _FakeModel(), bank_paths=[bank]
    )
    bank_entry = next(entry for entry in index.entries if entry.kind == "bank")
    assert bank_entry.concept_ids == ("ratios_proportions",)
    assert bank_entry.required_ingredient_ids == ()

    bank.write_text('[{"id":"q2","conceptId":"not_real","question":"Unknown"}]')
    import pytest
    with pytest.raises(ValueError, match="Unresolved bank conceptId"):
        build_classification_index(
            ontology, ingredients, layer2, layer3, _FakeModel(), bank_paths=[bank]
        )
