import json
from datetime import datetime, timedelta
from pathlib import Path

from mindcraft_graph.misconception_gaps import (
    build_misconception_gaps,
    build_misconception_ingredient_reverse_map,
)


def _obs(misconception_id: str | None, *, days_ago: int = 0, choice: int | None = 1) -> dict:
    return {
        "concept_id": "fractions_decimals",
        "misconception_id": misconception_id,
        "selected_choice_index": choice,
        "timestamp": datetime(2026, 7, 8) - timedelta(days=days_ago),
    }


def test_two_hits_out_of_three_without_priors_emits_severity_point_four():
    gaps = build_misconception_gaps(
        [_obs("mis_a"), _obs("mis_a"), _obs("mis_b", choice=2)],
        misconception_to_ingredient={"mis_a": "fractions_decimals__place_value_ladder"},
        now=datetime(2026, 7, 8),
    )

    assert gaps == [{
        "conceptId": "fractions_decimals",
        "ingredientId": "fractions_decimals__place_value_ladder",
        "misconceptionId": "mis_a",
        "distractorChoiceIndex": 1,
        "personalHitRate": 0.6667,
        "populationHitRate": None,
        "nObservations": 0,
        "severity": 0.4,
    }]


def test_one_hit_one_attempt_without_priors_is_not_emitted():
    gaps = build_misconception_gaps(
        [_obs("mis_a")],
        misconception_to_ingredient={"mis_a": "fractions_decimals__place_value_ladder"},
        now=datetime(2026, 7, 8),
    )

    assert gaps == []


def test_observation_older_than_sixty_days_is_ignored():
    gaps = build_misconception_gaps(
        [_obs("mis_a", days_ago=61), _obs("mis_a", days_ago=1)],
        misconception_to_ingredient={"mis_a": "fractions_decimals__place_value_ladder"},
        now=datetime(2026, 7, 8),
    )

    assert gaps == []


def test_known_eedi_misconception_maps_to_ingredient_and_unknown_stays_null():
    ontology_path = (
        Path(__file__).resolve().parents[1]
        / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
    )
    reverse_map = build_misconception_ingredient_reverse_map(json.loads(ontology_path.read_text()))
    known_misconception, ingredient_id = next(iter(reverse_map.items()))
    known_concept = ingredient_id.split("__", 1)[0]
    now = datetime(2026, 7, 8)

    gaps = build_misconception_gaps(
        [
            {
                "concept_id": known_concept,
                "misconception_id": known_misconception,
                "selected_choice_index": 3,
                "timestamp": now,
            },
            {
                "concept_id": known_concept,
                "misconception_id": known_misconception,
                "selected_choice_index": 3,
                "timestamp": now,
            },
            {
                "concept_id": known_concept,
                "misconception_id": "mis_unknown__trap",
                "selected_choice_index": 2,
                "timestamp": now,
            },
            {
                "concept_id": known_concept,
                "misconception_id": "mis_unknown__trap",
                "selected_choice_index": 2,
                "timestamp": now,
            },
        ],
        misconception_to_ingredient=reverse_map,
        now=now,
    )

    by_id = {gap["misconceptionId"]: gap for gap in gaps}
    assert by_id[known_misconception]["ingredientId"] == ingredient_id
    assert by_id["mis_unknown__trap"]["ingredientId"] is None
