"""Outcome/process fusion for worked attempts."""

from __future__ import annotations

from typing import Literal

from mindcraft_graph.models.ingredient import IngredientMastery, IngredientStudentState

Alignment = Literal["confirmed", "partial", "divergent", "ambiguous", "outcome_only"]


def normalize_process_steps(steps: list[dict]) -> list[dict]:
    normalized: list[dict] = []
    for idx, step in enumerate(steps):
        rule = step.get("rule") if isinstance(step.get("rule"), dict) else {}
        ingredient_ids = step.get("ingredientIds")
        if ingredient_ids is None:
            ingredient_ids = rule.get("ingredientIds", [])
        normalized.append({
            "line": step.get("line", idx),
            "rule_id": step.get("rule_id") or rule.get("id") or "",
            "verdict": step.get("verdict", ""),
            "ingredientIds": [str(item) for item in ingredient_ids if item],
        })
    return normalized


def determine_alignment(
    *,
    correct: float | bool | None,
    misconception_id: str | None,
    outcome_ingredient_id: str | None,
    process_steps: list[dict],
) -> Alignment:
    steps = normalize_process_steps(process_steps)
    parsed_steps = [step for step in steps if step["verdict"] in {"ok", "wrong"}]
    wrong_steps = [step for step in parsed_steps if step["verdict"] == "wrong"]
    is_correct = bool(correct) if isinstance(correct, bool) else (correct is not None and float(correct) >= 1.0)

    if not parsed_steps:
        return "outcome_only"
    if is_correct and wrong_steps:
        return "ambiguous"
    if is_correct:
        return "ambiguous" if not parsed_steps else "partial"
    if not wrong_steps:
        return "partial"

    first_wrong = wrong_steps[0]
    wrong_ingredients = set(first_wrong["ingredientIds"])
    if outcome_ingredient_id and outcome_ingredient_id in wrong_ingredients and misconception_id:
        return "confirmed"
    if outcome_ingredient_id and wrong_ingredients and outcome_ingredient_id not in wrong_ingredients:
        return "divergent"
    return "partial"


def fusion_outcome_weight(alignment: Alignment) -> float:
    return {
        "confirmed": -0.75,
        "outcome_only": -0.5,
        "partial": -0.35,
        "divergent": -0.25,
        "ambiguous": -0.1,
    }[alignment]


def apply_fusion_evidence(
    student_state: IngredientStudentState,
    *,
    ingredient_id: str | None,
    alignment: Alignment,
) -> IngredientStudentState:
    if not ingredient_id:
        return student_state
    delta = fusion_outcome_weight(alignment)
    current = student_state.ingredient_mastery.get(ingredient_id)
    if current is None:
        current = IngredientMastery(ingredient_id=ingredient_id)
    student_state.ingredient_mastery[ingredient_id] = IngredientMastery(
        ingredient_id=ingredient_id,
        mastery=max(0.0, min(1.0, current.mastery + delta)),
        attempts=current.attempts + 1,
        last_outcome=delta,
        cumulative_outcome=current.cumulative_outcome + delta,
    )
    return student_state
