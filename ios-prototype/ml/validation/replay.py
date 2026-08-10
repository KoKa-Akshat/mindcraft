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

from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.student_state import ConceptMastery
from mindcraft_graph.engine.update import apply_event_to_mastery
from mindcraft_graph.config import outcome_from, FORMAT_IDS


@dataclass
class ReplayRow:
    timestamp: datetime
    student_id: str
    concept_id: str
    format_id: str | None
    concept_mastery_before: float
    format_mastery_before: float | None
    bridge_conf_before: float | None   # not in the observation log yet — always None
    predicted: float                   # model prediction of success (= concept mastery before)
    actual_outcome: float              # 1.0 correct / 0.0 incorrect


def _mastery(state: dict[str, ConceptMastery], key: str) -> float:
    cm = state.get(key)
    return float(cm.mastery) if cm is not None else 0.0


def _fold(state: dict[str, ConceptMastery], key: str, correct: float, level: int, ts: datetime) -> None:
    """Fold one attempt into a node's mastery via the engine's update path."""
    if key not in state:
        state[key] = ConceptMastery(concept_id=key, mastery=0.0)
    ev = SessionEvent(
        student_id="replay", concept_id=key, event_type="problem_set",
        outcome=outcome_from(correct, level), effort=0.0, duration_minutes=0.0,
        timestamp=ts, exposure_weight=1.0,
    )
    state[key] = apply_event_to_mastery(state[key], ev)


def build_replay_table(observations: list[dict]) -> list[ReplayRow]:
    """Reconstruct (state-before, actual) for each attempt, oldest first.

    Each observation: {student_id, concept_id, format_id|None, level, correct,
    timestamp}. Concept and format mastery are tracked independently, mirroring
    the production split (format nodes never touch the concept path).
    """
    obs = sorted(observations, key=lambda o: o["timestamp"])
    concept_state: dict[str, ConceptMastery] = {}
    format_state: dict[str, ConceptMastery] = {}
    rows: list[ReplayRow] = []

    for o in obs:
        cid = o["concept_id"]
        fid = o.get("format_id")
        fid = fid if fid in FORMAT_IDS else None
        level = int(o.get("level", 1))
        correct = float(o.get("correct", 0.0))
        ts = o["timestamp"]

        cmb = _mastery(concept_state, cid)
        fmb = _mastery(format_state, fid) if fid else None

        rows.append(ReplayRow(
            timestamp=ts,
            student_id=o.get("student_id", ""),
            concept_id=cid,
            format_id=fid,
            concept_mastery_before=cmb,
            format_mastery_before=fmb,
            bridge_conf_before=None,
            predicted=cmb,
            actual_outcome=correct,
        ))

        # Fold AFTER recording the before-state.
        _fold(concept_state, cid, correct, level, ts)
        if fid:
            _fold(format_state, fid, correct, level, ts)

    return rows
