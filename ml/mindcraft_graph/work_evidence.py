"""Apply checked-work evidence to ingredient mastery."""

from __future__ import annotations

from dataclasses import dataclass

from mindcraft_graph.models.ingredient import (
    IngredientMastery,
    IngredientStudentState,
    ensure_posterior,
)


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
    prior_means: dict[str, float] | None = None,
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
                prior_mean = (prior_means or {}).get(ingredient_id, 0.5)
                current = IngredientMastery(ingredient_id=ingredient_id, mastery=prior_mean)
            prior_mean = (prior_means or {}).get(ingredient_id, current.mastery)
            alpha, beta = ensure_posterior(current, prior_mean)
            if weight >= 0:
                alpha += weight
            else:
                beta += abs(weight)
            student_state.ingredient_mastery[ingredient_id] = IngredientMastery(
                ingredient_id=ingredient_id,
                mastery=alpha / (alpha + beta),
                attempts=current.attempts + 1,
                last_outcome=weight,
                cumulative_outcome=current.cumulative_outcome + weight,
                alpha=alpha,
                beta=beta,
            )
            events.append(WorkEvidenceEvent("ingredient", ingredient_id, weight, verdict, rule_id))

    return student_state, events
