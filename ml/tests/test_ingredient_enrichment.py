from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

import numpy as np
import pytest


SCRIPT = Path(__file__).resolve().parents[1] / "scripts/enrich_ingredient_labels.py"
SPEC = importlib.util.spec_from_file_location("enrich_ingredient_labels", SCRIPT)
assert SPEC and SPEC.loader
enrichment = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = enrichment
SPEC.loader.exec_module(enrichment)


def _ingredient(ingredient_id: str, concept_id: str, family: str | None = None):
    return enrichment.IngredientCandidate(
        ingredient_id=ingredient_id,
        concept_id=concept_id,
        label=ingredient_id,
        description=f"Description for {ingredient_id}",
        failure_mode=f"Failure for {ingredient_id}",
        canonical_family=family,
    )


def test_eedi_scope_resolves_aliases_and_fails_fast_on_unknown_concepts():
    records, question_ids = enrichment.load_eedi_misconceptions(
        [{
            "id": "q1",
            "conceptId": "percent_ratio",
            "misconception_id": "mis_ratios_proportions__additive",
            "misconception_label": "Uses an additive relationship",
        }],
        {"ratios_proportions": "ratios_proportions", "percent_ratio": "ratios_proportions"},
    )
    assert records[0].concept_id == "ratios_proportions"
    assert question_ids == {"mis_ratios_proportions__additive": ["q1"]}

    with pytest.raises(ValueError, match="Unresolved Eedi conceptId"):
        enrichment.load_eedi_misconceptions(
            [{"id": "bad", "conceptId": "not_real", "misconception_id": "mis_x__y"}],
            {"ratios_proportions": "ratios_proportions"},
        )


def test_same_misconception_cannot_cross_concepts():
    with pytest.raises(ValueError, match="crosses concepts"):
        enrichment.load_eedi_misconceptions(
            [
                {"id": "q1", "conceptId": "one", "misconception_id": "mis_shared__error"},
                {"id": "q2", "conceptId": "two", "misconception_id": "mis_shared__error"},
            ],
            {"one": "one", "two": "two"},
        )


def test_proposal_ranking_is_concept_scoped_and_emits_top_three_metrics():
    candidates = {
        "concept_a": [
            _ingredient("a1", "concept_a", "mis_concept_a__target error"),
            _ingredient("a2", "concept_a", "mis_concept_a__other error"),
            _ingredient("a3", "concept_a", "mis_concept_a__third error"),
        ],
        # This would win globally, but cross-concept candidates are forbidden.
        "concept_b": [_ingredient("b1", "concept_b", "mis_concept_b__target error")],
    }

    def fake_embed(texts: list[str]) -> np.ndarray:
        vectors = []
        for text in texts:
            low = text.lower()
            if "target error" in low:
                vectors.append([1.0, 0.0, 0.0])
            elif "other error" in low:
                vectors.append([0.4, 0.9, 0.0])
            else:
                vectors.append([0.1, 0.0, 1.0])
        return np.asarray(vectors, dtype=np.float32)

    proposals, metrics = enrichment.rank_proposals(
        [enrichment.Misconception("mis_concept_a__target", "target error", "concept_a")],
        candidates,
        fake_embed,
    )
    proposal = proposals["mis_concept_a__target"]
    assert [item["ingredient_id"] for item in proposal["candidates"]] == ["a1", "a2", "a3"]
    assert proposal["top1_sim"] == pytest.approx(1.0)
    assert proposal["rank1_2_margin"] > 0
    assert "same_genre_margin_median" in metrics


def test_confidence_gate_routes_low_margin_to_llm_and_rejects_cross_concept_choice():
    misconception = enrichment.Misconception("mis_c__x", "x", "c")
    candidates = {"c": [_ingredient("c1", "c"), _ingredient("c2", "c")]}
    proposal = {
        "concept_id": "c",
        "misconception_label": "x",
        "candidates": [
            {"ingredient_id": "c1", "similarity": 0.80},
            {"ingredient_id": "c2", "similarity": 0.79},
        ],
        "top1_sim": 0.80,
        "rank1_2_margin": 0.01,
        "cross_genre_margin": 0.0,
    }
    seen_prompts: list[str] = []

    def llm(prompt: str) -> str:
        seen_prompts.append(prompt)
        return '{"ingredient_id":"c2","confidence":0.91}'

    confirmed, review = enrichment.confirm_mappings(
        [misconception], candidates, {misconception.misconception_id: proposal},
        similarity_threshold=0.70, margin_threshold=0.15,
        human_decisions={}, llm_complete=llm,
    )
    assert not review
    assert seen_prompts
    assert confirmed[misconception.misconception_id]["ingredient_id"] == "c2"
    assert confirmed[misconception.misconception_id]["provenance"] == "llm"

    with pytest.raises(ValueError, match="out-of-scope"):
        enrichment.parse_llm_choice('{"ingredient_id":"other__bad","confidence":1}', {"c1", "c2"})


def test_high_similarity_and_margin_auto_accepts_with_embedding_provenance():
    misconception = enrichment.Misconception("mis_c__x", "x", "c")
    candidates = {"c": [_ingredient("c1", "c"), _ingredient("c2", "c")]}
    proposal = {
        "concept_id": "c", "misconception_label": "x",
        "candidates": [{"ingredient_id": "c1", "similarity": 0.91}, {"ingredient_id": "c2", "similarity": 0.60}],
        "top1_sim": 0.91, "rank1_2_margin": 0.31, "cross_genre_margin": 0.1,
    }
    confirmed, review = enrichment.confirm_mappings(
        [misconception], candidates, {misconception.misconception_id: proposal},
        similarity_threshold=0.70, margin_threshold=0.15,
        human_decisions={}, llm_complete=None,
    )
    assert not review
    assert confirmed[misconception.misconception_id]["provenance"] == "embedding"


def test_anchor_and_l3_validation_use_confirmed_truth_not_proposal_as_truth():
    family = "mis_c__anchor"
    ingredient = _ingredient("c1", "c", family)
    confirmed = {family: {"ingredient_id": "c1", "provenance": "human"}}
    proposals = {family: {
        "candidates": [{"ingredient_id": "c2"}],
        "top1_sim": 0.8,
        "rank1_2_margin": 0.2,
    }}
    layer3 = {"question_instances": [{"links": {"misconception_ids": [family], "ingredient_ids": ["c1"]}}]}
    report = enrichment.validation_report(
        confirmed, proposals, {"c1": ingredient}, layer3, {"q1": ["c1"]},
        {"same_genre_margin_median": 0.1, "cross_genre_margin_median": 0.05, "margin_lift": 0.05},
    )
    assert report["anchor_self_consistency"]["hit"] == 1
    assert report["anchor_self_consistency"]["eligible_families"] == 1
    assert report["anchor_self_consistency"]["proposal_top1_hit"] == 0
    assert report["l3_reproduction"]["hit"] == 1
    assert report["coverage"]["ingredients_with_1"] == 1


def test_propagation_keeps_frontend_shape_out_of_output():
    questions = [{"id": "eedi_1", "misconception_id": "mis_c__x", "question": "unchanged"}]
    labels = enrichment.propagate_question_labels(
        questions, {"mis_c__x": {"ingredient_id": "c1"}}
    )
    assert labels == {"eedi_1": ["c1"]}
    assert "ingredient_id" not in questions[0]


def test_real_l3_holdout_surface_contains_all_15_labeled_instances():
    from mindcraft_graph.models.concept import Concept, build_concept_id_registry

    ontology = enrichment.load_json(enrichment.ONTOLOGY_PATH)
    layer3 = enrichment.load_json(enrichment.L3_PATH)
    by_concept, by_id = enrichment.load_ingredients(ontology)
    concept_registry = build_concept_id_registry([Concept.model_validate(item) for item in ontology["concepts"]])
    records, expected = enrichment.load_l3_holdouts(layer3, by_id, concept_registry)
    assert len(records) == 15
    assert len(expected) == 15
    assert all(expected[record.misconception_id] for record in records)
