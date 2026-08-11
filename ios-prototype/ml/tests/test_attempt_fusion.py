from mindcraft_graph.attempt_fusion import (
    apply_fusion_evidence,
    determine_alignment,
    fusion_outcome_weight,
)
from mindcraft_graph.models.ingredient import IngredientStudentState


def _step(verdict: str, ingredients: list[str] | None = None) -> dict:
    return {
        "verdict": verdict,
        "rule": {
            "id": "rule",
            "ingredientIds": ingredients or [],
        },
    }


def test_alignment_confirmed():
    assert determine_alignment(
        correct=0,
        misconception_id="mis_ratio",
        outcome_ingredient_id="ratios_proportions__unit_rate",
        process_steps=[_step("wrong", ["ratios_proportions__unit_rate"])],
    ) == "confirmed"


def test_alignment_partial():
    assert determine_alignment(
        correct=0,
        misconception_id="mis_ratio",
        outcome_ingredient_id="ratios_proportions__unit_rate",
        process_steps=[_step("ok", ["ratios_proportions__unit_rate"])],
    ) == "partial"


def test_alignment_divergent():
    assert determine_alignment(
        correct=0,
        misconception_id="mis_ratio",
        outcome_ingredient_id="ratios_proportions__unit_rate",
        process_steps=[_step("wrong", ["linear_equations__inverse_operations"])],
    ) == "divergent"


def test_alignment_ambiguous():
    assert determine_alignment(
        correct=1,
        misconception_id=None,
        outcome_ingredient_id="ratios_proportions__unit_rate",
        process_steps=[_step("wrong", ["ratios_proportions__unit_rate"])],
    ) == "ambiguous"


def test_alignment_outcome_only():
    assert determine_alignment(
        correct=0,
        misconception_id="mis_ratio",
        outcome_ingredient_id="ratios_proportions__unit_rate",
        process_steps=[],
    ) == "outcome_only"


def test_confirmed_negative_weight_exceeds_outcome_only_and_ambiguous_is_minimal():
    ingredient = "ratios_proportions__unit_rate"
    confirmed = IngredientStudentState(student_id="s")
    outcome_only = IngredientStudentState(student_id="s")
    ambiguous = IngredientStudentState(student_id="s")

    apply_fusion_evidence(confirmed, ingredient_id=ingredient, alignment="confirmed")
    apply_fusion_evidence(outcome_only, ingredient_id=ingredient, alignment="outcome_only")
    apply_fusion_evidence(ambiguous, ingredient_id=ingredient, alignment="ambiguous")

    assert fusion_outcome_weight("confirmed") < fusion_outcome_weight("outcome_only")
    assert abs(fusion_outcome_weight("ambiguous")) < abs(fusion_outcome_weight("outcome_only"))
    assert confirmed.ingredient_mastery[ingredient].cumulative_outcome == -0.75
    assert outcome_only.ingredient_mastery[ingredient].cumulative_outcome == -0.5
    assert ambiguous.ingredient_mastery[ingredient].cumulative_outcome == -0.1
