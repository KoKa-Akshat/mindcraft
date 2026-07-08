"""Apply checked-work evidence to ingredient mastery."""

from __future__ import annotations

from dataclasses import dataclass

from mindcraft_graph.models.ingredient import IngredientMastery, IngredientStudentState


@dataclass(frozen=True)
class WorkEvidenceEvent:
    kind: str
    target_id: str
    delta: float
    verdict: str
    rule_id: str


def apply_work_evidence(
    student_state: IngredientStudentState,
    steps: list[dict],
    concept_id: str,
) -> tuple[IngredientStudentState, list[WorkEvidenceEvent]]:
    valid_steps = [
        step for step in steps
        if step.get("verdict") in {"ok", "wrong"}
        and isinstance(step.get("rule"), dict)
    ]
    per_step_weight = 0.5 / max(1, len(valid_steps))
    events: list[WorkEvidenceEvent] = []
    saw_wrong = False

    for step in valid_steps:
        if saw_wrong:
            continue
        verdict = step["verdict"]
        rule = step["rule"]
        rule_id = str(rule.get("id") or "")
        ingredient_ids = [
            str(ingredient_id)
            for ingredient_id in rule.get("ingredientIds", [])
            if ingredient_id
        ]

        if verdict == "wrong":
            saw_wrong = True
            weight = -0.5
        else:
            weight = per_step_weight

        if not ingredient_ids:
            events.append(WorkEvidenceEvent("concept", concept_id, weight, verdict, rule_id))
            continue

        for ingredient_id in ingredient_ids:
            current = student_state.ingredient_mastery.get(ingredient_id)
            if current is None:
                current = IngredientMastery(ingredient_id=ingredient_id)
            student_state.ingredient_mastery[ingredient_id] = IngredientMastery(
                ingredient_id=ingredient_id,
                mastery=max(0.0, min(1.0, current.mastery + weight)),
                attempts=current.attempts + 1,
                last_outcome=weight,
                cumulative_outcome=current.cumulative_outcome + weight,
            )
            events.append(WorkEvidenceEvent("ingredient", ingredient_id, weight, verdict, rule_id))

    return student_state, events
