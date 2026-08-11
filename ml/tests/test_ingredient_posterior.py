import pytest

from mindcraft_graph.attempt_fusion import apply_fusion_evidence
from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.engine.ingredient_runtime import (
    CardRecommendation,
    build_minimal_dag,
    update_ingredient_state,
)
from mindcraft_graph.models.ingredient import (
    Ingredient,
    IngredientMastery,
    IngredientOntology,
    IngredientStudentState,
)
from mindcraft_graph.work_evidence import apply_work_evidence


def _card() -> CardRecommendation:
    return CardRecommendation(
        card_template_id="card",
        target_type="ingredient",
        target_id="ingredient",
        representation_key="default",
        title="",
        body="",
        prompt="",
        need_score=0.0,
        reason="",
    )


def test_alternating_results_converge_to_half_instead_of_ratchet():
    state = IngredientStudentState(student_id="s")
    for attempt in range(40):
        state = update_ingredient_state(
            state, _card(), student_succeeded=attempt % 2 == 0, prior_mean=0.7
        )

    mastery = state.ingredient_mastery["ingredient"]
    assert mastery.mastery == pytest.approx(0.5, abs=0.03)
    assert mastery.alpha is not None and mastery.beta is not None


def test_unattempted_ingredient_reads_ontology_prior_in_dag():
    ingredient = Ingredient(
        id="ingredient",
        concept_id="concept",
        name="Ingredient",
        description="",
        failure_prior=0.3,
    )
    graph = IngredientGraph(IngredientOntology(version="test", ingredients=[ingredient]))

    dag = build_minimal_dag(
        ["ingredient"], set(), [], graph, IngredientStudentState(student_id="s")
    )

    assert dag.nodes["ingredient"].mastery == pytest.approx(0.7)


def test_legacy_record_reconstructs_without_jump():
    state = IngredientStudentState(
        student_id="s",
        ingredient_mastery={
            "ingredient": IngredientMastery(
                ingredient_id="ingredient", mastery=0.6, attempts=4
            )
        },
    )
    updated = update_ingredient_state(
        state, _card(), student_succeeded=True, prior_mean=0.7
    ).ingredient_mastery["ingredient"]

    assert updated.alpha / (updated.alpha + updated.beta) == pytest.approx(4.6 / 7.0)
    assert updated.mastery > 0.6


def test_work_and_fusion_writes_preserve_posterior_counts():
    ingredient_id = "ingredient"
    state = IngredientStudentState(
        student_id="s",
        ingredient_mastery={
            ingredient_id: IngredientMastery(
                ingredient_id=ingredient_id,
                mastery=0.6,
                attempts=2,
                alpha=2.4,
                beta=1.6,
            )
        },
    )
    state, _ = apply_work_evidence(
        state,
        [{"verdict": "ok", "rule": {"id": "r", "ingredientIds": [ingredient_id]}}],
        "concept",
        prior_means={ingredient_id: 0.7},
    )
    after_work = state.ingredient_mastery[ingredient_id]
    assert after_work.alpha == pytest.approx(2.9)
    assert after_work.beta == pytest.approx(1.6)

    state = apply_fusion_evidence(
        state, ingredient_id=ingredient_id, alignment="outcome_only", prior_mean=0.7
    )
    after_fusion = state.ingredient_mastery[ingredient_id]
    assert after_fusion.alpha == pytest.approx(2.9)
    assert after_fusion.beta == pytest.approx(2.1)
