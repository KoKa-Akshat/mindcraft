from __future__ import annotations

from datetime import datetime, timedelta

import pytest

from validation.predictor import ItemParams, PredictorParams, ThetaInputs, predict
from validation.replay import build_replay_table


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
        {"student_id": "a", "concept_id": "c", "format_id": None, "level": 2,
         "correct": 1, "timestamp": now},
        {"student_id": "b", "concept_id": "c", "format_id": None, "level": 2,
         "correct": 0, "timestamp": now + timedelta(seconds=1)},
    ]
    rows = build_replay_table(observations, {"c": 0.65})

    assert rows[0].concept_mastery_before == 0
    assert rows[1].concept_mastery_before == 0
    assert rows[0].level == 2
    assert rows[0].item_difficulty == pytest.approx(0.65)
