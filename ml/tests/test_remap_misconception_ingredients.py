from __future__ import annotations

import copy
import json
import sys
from pathlib import Path

import numpy as np
import pytest

ML_ROOT = Path(__file__).resolve().parents[1]
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from scripts.remap_misconception_ingredients import (  # noqa: E402
    Ingredient,
    QuestionContext,
    accept_or_abstain,
    build_query,
    cache_key,
    load_ingredients,
    make_rerank_prompt,
    merge_human_links,
    parse_rerank_response,
    retrieve_global,
)


def ingredient(ingredient_id: str, concept_id: str = "c") -> Ingredient:
    return Ingredient(ingredient_id, concept_id, ingredient_id, "description", "failure", ("negative",))


def test_global_retrieval_uses_every_ingredient_without_concept_filter() -> None:
    ingredients = [ingredient("same", "query_concept"), ingredient("cross", "other_concept")]
    vectors = {
        ingredients[0].retrieval_text: [0.0, 1.0],
        ingredients[1].retrieval_text: [1.0, 0.0],
        "query": [1.0, 0.0],
    }

    ranked = retrieve_global(
        {"mis": "query"}, ingredients, lambda texts: np.asarray([vectors[text] for text in texts]), top_k=2
    )["mis"]

    assert [row["ingredient_id"] for row in ranked] == ["cross", "same"]
    assert {row["ingredient_id"] for row in ranked} == {item.ingredient_id for item in ingredients}


def test_ingredient_inputs_exclude_benchmark_fields() -> None:
    ontology = {
        "concepts": [
            {
                "id": "c",
                "ingredients": [
                    {
                        "id": "i",
                        "label": "label",
                        "description": "description",
                        "failure_mode": "failure",
                        "observable_evidence": {"negative": ["student error"]},
                        "diagnostic_tags": ["SECRET_DIAGNOSTIC"],
                        "canonical_misconception_family": "SECRET_CANONICAL",
                    }
                ],
            }
        ]
    }

    loaded = load_ingredients(ontology)
    prompt = make_rerank_prompt("query", loaded)

    assert "SECRET_DIAGNOSTIC" not in loaded[0].retrieval_text + prompt
    assert "SECRET_CANONICAL" not in loaded[0].retrieval_text + prompt
    assert "student error" in loaded[0].retrieval_text


def test_context_query_uses_specific_distractor_and_no_context_is_text_alone() -> None:
    record = {"eedi_name": "Adds denominators", "concept_ids": ["fractions"]}
    contexts = [QuestionContext("q1", "fractions", "1/2 + 1/3", "5/6", "2/5")]

    enriched, used = build_query("mis_x", record, contexts, use_context=True)
    plain, plain_used = build_query("mis_x", record, contexts, use_context=False)

    assert "Tagged distractor: 2/5" in enriched
    assert "Correct answer: 5/6" in enriched
    assert used == 1
    assert plain == "Misconception: Adds denominators"
    assert plain_used == 0


def test_none_is_reachable_and_reported_as_abstention() -> None:
    ranked = parse_rerank_response(
        '{"ranked":[{"ingredient_id":"none","confidence":0.93,"justification":"No candidate fits."}]}',
        {"i"},
    )
    links, abstention = accept_or_abstain(
        ranked, [{"ingredient_id": "i", "retrieval_rank": 1}], threshold=0.8, contexts_used=3
    )

    assert links == []
    assert abstention and abstention["reason"] == "reranker_none"


def test_acceptance_adds_required_v2_fields() -> None:
    ranked = [{"ingredient_id": "i", "confidence": 0.9, "justification": "Direct match."}]
    links, abstention = accept_or_abstain(
        ranked, [{"ingredient_id": "i", "retrieval_rank": 7}], threshold=0.8, contexts_used=5
    )

    assert abstention is None
    assert links == [
        {
            "ingredient_id": "i",
            "provenance": "rerank_v2",
            "confidence": 0.9,
            "justification": "Direct match.",
            "retrieval_rank": 7,
            "contexts_used": 5,
        }
    ]


def test_cache_key_depends_on_query_and_ordered_candidates() -> None:
    assert cache_key("q", ["a", "b"]) == cache_key("q", ["a", "b"])
    assert cache_key("q", ["a", "b"]) != cache_key("q", ["b", "a"])
    assert cache_key("q", ["a", "b"]) != cache_key("different", ["a", "b"])


def test_human_links_are_copied_byte_for_byte_as_objects() -> None:
    human = {"ingredient_id": "trusted", "provenance": "human", "confidence": 1.0, "alternates": []}
    incumbent = {"map": {"mis": [human, {"ingredient_id": "old", "provenance": "llm"}]}}
    before = copy.deepcopy(incumbent)
    prediction = {"mis": [{"ingredient_id": "new", "provenance": "rerank_v2"}]}

    merged = merge_human_links(incumbent, prediction)

    assert merged["mis"][0] == human
    assert incumbent == before
    assert all(link["provenance"] != "llm" for link in merged["mis"])


def test_invalid_or_out_of_top_k_reranker_choice_is_rejected() -> None:
    raw = json.dumps(
        {"ranked": [{"ingredient_id": "not_allowed", "confidence": 1, "justification": "Because."}]}
    )
    with pytest.raises(ValueError, match="outside top-K"):
        parse_rerank_response(raw, {"allowed"})


def test_reranker_must_return_explicit_none_option() -> None:
    raw = json.dumps(
        {"ranked": [{"ingredient_id": "allowed", "confidence": 0.9, "justification": "Direct."}]}
    )
    with pytest.raises(ValueError, match="explicit none"):
        parse_rerank_response(raw, {"allowed"})
