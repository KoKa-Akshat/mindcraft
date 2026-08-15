"""Piece 1 — event replay reader (the core mechanic).

Replays per-question attempt observations in timestamp order. For each attempt it
records the student's mastery state as it was IMMEDIATELY BEFORE that attempt (the
predictor) paired with the actual outcome (the target), THEN folds the attempt in
so the next attempt sees updated state.

State is reconstructed per-attempt via the engine's own apply_event_to_mastery —
this is the harness's replay model (production folds one aggregated event per
session; the harness needs per-attempt granularity to ask "what did we predict
right before this question?"). Get this table right and calibration/separability
are one-liners on top.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime

from mindcraft_graph.config import FORMAT_IDS, outcome_from
from mindcraft_graph.engine.update import apply_event_to_mastery
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.student_state import ConceptMastery

from .predictor import DEFAULT_PARAMS, ItemParams, PredictorParams, ThetaInputs, predict


@dataclass
class ReplayRow:
    timestamp: datetime
    student_id: str
    concept_id: str
    format_id: str | None
    level: int
    item_difficulty: float
    concept_mastery_before: float
    format_mastery_before: float | None
    bridge_conf_before: float | None   # not in the observation log yet — always None
    predicted: float                   # item-aware model prediction of success
    actual_outcome: float              # 1.0 correct / 0.0 incorrect


def _mastery(state: dict[tuple[str, str], ConceptMastery], key: tuple[str, str]) -> float:
    cm = state.get(key)
    return float(cm.mastery) if cm is not None else 0.0


def _fold(
    state: dict[tuple[str, str], ConceptMastery],
    key: tuple[str, str],
    correct: float,
    level: int,
    ts: datetime,
) -> None:
    """Fold one attempt into a node's mastery via the engine's update path."""
    if key not in state:
        state[key] = ConceptMastery(concept_id=key[1], mastery=0.0)
    ev = SessionEvent(
        student_id=key[0], concept_id=key[1], event_type="problem_set",
        outcome=outcome_from(correct, level), effort=0.0, duration_minutes=0.0,
        timestamp=ts, exposure_weight=1.0,
    )
    state[key] = apply_event_to_mastery(state[key], ev)


def build_replay_table(
    observations: list[dict],
    difficulty_by_concept: dict[str, float] | None = None,
    params: PredictorParams = DEFAULT_PARAMS,
) -> list[ReplayRow]:
    """Reconstruct (state-before, actual) for each attempt, oldest first.

    Each observation: {student_id, concept_id, format_id|None, level, correct,
    timestamp}. Concept and format mastery are tracked independently, mirroring
    the production split (format nodes never touch the concept path).
    """
    obs = sorted(observations, key=lambda o: o["timestamp"])
    difficulty_by_concept = difficulty_by_concept or {}
    concept_state: dict[tuple[str, str], ConceptMastery] = {}
    format_state: dict[tuple[str, str], ConceptMastery] = {}
    rows: list[ReplayRow] = []

    for o in obs:
        cid = o["concept_id"]
        sid = o.get("student_id", "")
        fid = o.get("format_id")
        fid = fid if fid in FORMAT_IDS else None
        level = int(o.get("level", 1))
        correct = float(o.get("correct", 0.0))
        ts = o["timestamp"]

        concept_key = (sid, cid)
        format_key = (sid, fid) if fid else None
        cmb = _mastery(concept_state, concept_key)
        fmb = _mastery(format_state, format_key) if format_key else None
        difficulty = float(difficulty_by_concept.get(cid, 0.5))

        rows.append(ReplayRow(
            timestamp=ts,
            student_id=sid,
            concept_id=cid,
            format_id=fid,
            level=level,
            item_difficulty=difficulty,
            concept_mastery_before=cmb,
            format_mastery_before=fmb,
            bridge_conf_before=None,
            predicted=predict(
                ThetaInputs(cmb, fmb), ItemParams(difficulty, level), params
            ),
            actual_outcome=correct,
        ))

        # Fold AFTER recording the before-state.
        _fold(concept_state, concept_key, correct, level, ts)
        if format_key:
            _fold(format_state, format_key, correct, level, ts)

    return rows
