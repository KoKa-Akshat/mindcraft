from __future__ import annotations

import sys
from datetime import datetime, timedelta
from pathlib import Path

import pytest

ML_ROOT = Path(__file__).resolve().parents[1]
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from validation.fit_predictor import filter_student_observations, fit, report  # noqa: E402
from validation.predictor import (  # noqa: E402
    IngredientPredictorParams,
    ItemParams,
    PredictorParams,
    ThetaInputs,
    predict,
    predict_ingredient,
)
from validation.replay import (  # noqa: E402
    QuestionIngredients,
    build_replay_table,
    load_question_ingredient_index,
)


def test_predictor_responds_to_ability_difficulty_and_level() -> None:
    params = PredictorParams(discrimination=4, concept_weight=1, format_weight=0, level_scale=0.1)
    easy = predict(ThetaInputs(0.7), ItemParams(0.3, 1), params)
    hard = predict(ThetaInputs(0.7), ItemParams(0.7, 1), params)
    higher_level = predict(ThetaInputs(0.7), ItemParams(0.3, 3), params)

    assert 0 < hard < easy < 1
    assert higher_level < easy


def test_predictor_uses_format_mastery_when_weighted() -> None:
    params = PredictorParams(4, 1, 1, 0)
    without_format = predict(ThetaInputs(0.3, None), ItemParams(0.5), params)
    with_format = predict(ThetaInputs(0.3, 0.6), ItemParams(0.5), params)
    assert with_format > without_format


def test_replay_isolates_student_state_and_carries_item_fields() -> None:
    now = datetime(2026, 1, 1)
    observations = [
        {
            "student_id": "a",
            "concept_id": "c",
            "format_id": None,
            "level": 2,
            "correct": 1,
            "timestamp": now,
        },
        {
            "student_id": "b",
            "concept_id": "c",
            "format_id": None,
            "level": 2,
            "correct": 0,
            "timestamp": now + timedelta(seconds=1),
        },
    ]
    rows = build_replay_table(observations, {"c": 0.65})

    assert rows[0].concept_mastery_before == 0
    assert rows[1].concept_mastery_before == 0
    assert rows[0].level == 2
    assert rows[0].item_difficulty == pytest.approx(0.65)
    assert rows[0].question_id is None
    assert rows[0].ingredient_resolved is False


def test_question_join_resolves_sorted_ingredients_and_llm_provenance(tmp_path) -> None:
    question_path = tmp_path / "questions.json"
    map_path = tmp_path / "map.json"
    question_path.write_text("""[
      {"id":"q1","distractor_taxonomy":[
        {"misconception_id":"m1"},{"misconception_id":"m2"}
      ]},
      {"id":"q2"}
    ]""")
    map_path.write_text("""{"map":{
      "m1":[{"ingredient_id":"i2","provenance":"human"}],
      "m2":[{"ingredient_id":"i1","provenance":"llm"}]
    }}""")

    index = load_question_ingredient_index(question_path, map_path)

    assert index["q1"].ingredient_ids == ("i1", "i2")
    assert index["q1"].provenance == "any_llm"
    assert "q2" not in index


def test_replay_tracks_ingredient_state_before_attempt_and_falls_back_flagged() -> None:
    now = datetime(2026, 1, 1)
    observations = [
        {
            "student_id": "a",
            "question_id": "resolved",
            "concept_id": "c",
            "format_id": None,
            "level": 1,
            "correct": 1,
            "timestamp": now,
        },
        {
            "student_id": "a",
            "question_id": "resolved",
            "concept_id": "c",
            "format_id": None,
            "level": 1,
            "correct": 0,
            "timestamp": now + timedelta(seconds=1),
        },
        {
            "student_id": "a",
            "question_id": "unresolved",
            "concept_id": "c",
            "format_id": None,
            "level": 1,
            "correct": 1,
            "timestamp": now + timedelta(seconds=2),
        },
    ]
    index = {
        "resolved": QuestionIngredients(("i1", "i2"), "human_only"),
    }

    rows = build_replay_table(observations, {"c": 0.5}, question_ingredients_by_id=index)

    assert rows[0].ingredient_mastery_before == (0.0, 0.0)
    assert all(value > 0 for value in rows[1].ingredient_mastery_before)
    assert rows[0].ingredient_provenance == "human_only"
    assert rows[2].ingredient_ids == ()
    assert rows[2].ingredient_resolved is False
    fallback = predict_ingredient(
        ingredient_mastery=rows[2].ingredient_mastery_before,
        concept_mastery_fallback=rows[2].concept_mastery_before,
        item=ItemParams(rows[2].item_difficulty),
        params=IngredientPredictorParams(4.0, 1.0),
        aggregator="min",
    )
    expected = predict(
        ThetaInputs(rows[2].concept_mastery_before),
        ItemParams(rows[2].item_difficulty),
        PredictorParams(4.0, 1.0, 0.0, 0.0),
    )
    assert fallback == pytest.approx(expected)


def test_ingredient_min_is_primary_conjunctive_arm() -> None:
    params = IngredientPredictorParams(discrimination=4, ingredient_weight=1)
    item = ItemParams(0.5)
    minimum = predict_ingredient(
        ingredient_mastery=(0.1, 0.9),
        concept_mastery_fallback=0.7,
        item=item,
        params=params,
        aggregator="min",
    )
    mean = predict_ingredient(
        ingredient_mastery=(0.1, 0.9),
        concept_mastery_fallback=0.7,
        item=item,
        params=params,
        aggregator="mean",
    )
    assert minimum < mean


def test_two_parameter_fit_keeps_preregistered_terms_at_exactly_zero() -> None:
    now = datetime(2026, 1, 1)
    observations = [
        {
            "student_id": f"student-{index % 2}",
            "concept_id": "c",
            "format_id": "table",
            "level": (index % 3) + 1,
            "correct": index % 2,
            "timestamp": now + timedelta(seconds=index),
        }
        for index in range(12)
    ]

    params = fit(build_replay_table(observations, {"c": 0.5}))

    assert params.format_weight == 0.0
    assert params.level_scale == 0.0


def test_report_excludes_smoke_accounts_and_weights_folds_by_observations() -> None:
    now = datetime(2026, 1, 1)
    observations = [
        {
            "student_id": student_id,
            "concept_id": "c",
            "format_id": None,
            "level": 1,
            "correct": correct,
            "timestamp": now + timedelta(seconds=index),
        }
        for index, (student_id, correct) in enumerate(
            [
                ("student-a", 1),
                ("student-a", 0),
                ("student-a", 1),
                ("student-b", 0),
                ("deploy_smoke_1782584817", 1),
            ]
        )
    ]

    kept, excluded = filter_student_observations(observations)
    result = report(observations)

    assert len(kept) == 4
    assert excluded == ["deploy_smoke_1782584817"]
    assert result["observations"] == 4
    assert result["excluded_observations"] == 1
    assert result["held_out_observation_weighted"]["observations"] == 4
    assert result["model"] == "pre_registered_2_parameter"
    assert result["in_sample_params"]["format_weight"] == 0.0
    assert result["in_sample_params"]["level_scale"] == 0.0
    assert set(result["in_sample"]["observation_weighted"]["all_rows"]) == {
        "observations",
        "constant",
        "concept_mastery",
        "ingredient_min",
        "ingredient_mean",
    }
    assert set(result["held_out_observation_weighted"]) >= {
        "all_rows",
        "resolved_rows",
        "human_only",
        "any_llm",
    }


def test_single_student_report_marks_held_out_metrics_unavailable() -> None:
    now = datetime(2026, 1, 1)
    observations = [
        {
            "student_id": "only-student",
            "question_id": "unresolved",
            "concept_id": "c",
            "format_id": None,
            "level": 1,
            "correct": index % 2,
            "timestamp": now + timedelta(seconds=index),
        }
        for index in range(4)
    ]

    result = report(observations)

    assert result["held_out_by_student"] == [
        {"student_id": "only-student", "status": "INSUFFICIENT_TRAINING_STUDENTS"}
    ]
    assert result["held_out_observation_weighted"]["all_rows"]["observations"] == 0
    assert all(value is None for value in result["generalization_gap"].values())
