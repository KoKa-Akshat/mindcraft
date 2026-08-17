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

import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from mindcraft_graph.config import FORMAT_IDS, outcome_from
from mindcraft_graph.engine.update import apply_event_to_mastery
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.student_state import ConceptMastery

from .predictor import DEFAULT_PARAMS, ItemParams, PredictorParams, ThetaInputs, predict


@dataclass
class ReplayRow:
    timestamp: datetime
    student_id: str
    question_id: str | None
    concept_id: str
    format_id: str | None
    level: int
    item_difficulty: float
    concept_mastery_before: float
    format_mastery_before: float | None
    ingredient_ids: tuple[str, ...]
    ingredient_mastery_before: tuple[float, ...]
    ingredient_resolved: bool
    ingredient_provenance: Literal["human_only", "any_llm", "other"] | None
    bridge_conf_before: float | None  # not in the observation log yet — always None
    predicted: float  # item-aware model prediction of success
    actual_outcome: float  # 1.0 correct / 0.0 incorrect


@dataclass(frozen=True)
class QuestionIngredients:
    ingredient_ids: tuple[str, ...]
    provenance: Literal["human_only", "any_llm", "other"]


def load_question_ingredient_index(
    question_path: Path | None = None,
    map_path: Path | None = None,
) -> dict[str, QuestionIngredients]:
    """Resolve bank questions through distractor misconceptions to ingredients."""
    ml_root = Path(__file__).parents[1]
    repo_root = ml_root.parent
    question_path = question_path or repo_root / "app" / "src" / "data" / "eediQuestions.json"
    map_path = map_path or ml_root / "data" / "misconception_ingredient_map.json"
    questions = json.loads(question_path.read_text())
    misconception_map = json.loads(map_path.read_text()).get("map", {})

    index: dict[str, QuestionIngredients] = {}
    for question in questions:
        ingredient_ids: set[str] = set()
        provenances: set[str] = set()
        for distractor in question.get("distractor_taxonomy") or []:
            misconception_id = distractor.get("misconception_id")
            if not misconception_id:
                continue
            for link in misconception_map.get(misconception_id, []):
                ingredient_id = link.get("ingredient_id")
                if ingredient_id:
                    ingredient_ids.add(str(ingredient_id))
                    provenances.add(str(link.get("provenance") or "unknown"))
        if not ingredient_ids:
            continue
        provenance: Literal["human_only", "any_llm", "other"]
        if "llm" in provenances:
            provenance = "any_llm"
        elif provenances == {"human"}:
            provenance = "human_only"
        else:
            provenance = "other"
        index[str(question["id"])] = QuestionIngredients(
            ingredient_ids=tuple(sorted(ingredient_ids)),
            provenance=provenance,
        )
    return index


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
        student_id=key[0],
        concept_id=key[1],
        event_type="problem_set",
        outcome=outcome_from(correct, level),
        effort=0.0,
        duration_minutes=0.0,
        timestamp=ts,
        exposure_weight=1.0,
    )
    state[key] = apply_event_to_mastery(state[key], ev)


def build_replay_table(
    observations: list[dict],
    difficulty_by_concept: dict[str, float] | None = None,
    params: PredictorParams = DEFAULT_PARAMS,
    question_ingredients_by_id: dict[str, QuestionIngredients] | None = None,
) -> list[ReplayRow]:
    """Reconstruct (state-before, actual) for each attempt, oldest first.

    Each observation includes question_id when available. Concept, format, and
    resolved ingredient mastery are tracked independently. Ingredient evidence
    is folded only after its state-before values have been recorded.
    """
    obs = sorted(observations, key=lambda o: o["timestamp"])
    difficulty_by_concept = difficulty_by_concept or {}
    if question_ingredients_by_id is None:
        question_ingredients_by_id = load_question_ingredient_index()
    concept_state: dict[tuple[str, str], ConceptMastery] = {}
    format_state: dict[tuple[str, str], ConceptMastery] = {}
    ingredient_state: dict[tuple[str, str], ConceptMastery] = {}
    rows: list[ReplayRow] = []

    for o in obs:
        cid = o["concept_id"]
        sid = o.get("student_id", "")
        question_id = o.get("question_id")
        question_id = str(question_id) if question_id is not None else None
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
        resolved = question_ingredients_by_id.get(question_id) if question_id else None
        ingredient_ids = resolved.ingredient_ids if resolved else ()
        ingredient_mastery = tuple(
            _mastery(ingredient_state, (sid, ingredient_id)) for ingredient_id in ingredient_ids
        )

        rows.append(
            ReplayRow(
                timestamp=ts,
                student_id=sid,
                question_id=question_id,
                concept_id=cid,
                format_id=fid,
                level=level,
                item_difficulty=difficulty,
                concept_mastery_before=cmb,
                format_mastery_before=fmb,
                ingredient_ids=ingredient_ids,
                ingredient_mastery_before=ingredient_mastery,
                ingredient_resolved=bool(ingredient_ids),
                ingredient_provenance=resolved.provenance if resolved else None,
                bridge_conf_before=None,
                predicted=predict(ThetaInputs(cmb, fmb), ItemParams(difficulty, level), params),
                actual_outcome=correct,
            )
        )

        # Fold AFTER recording the before-state.
        _fold(concept_state, concept_key, correct, level, ts)
        if format_key:
            _fold(format_state, format_key, correct, level, ts)
        for ingredient_id in ingredient_ids:
            _fold(ingredient_state, (sid, ingredient_id), correct, level, ts)

    return rows
