import pytest

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.engine.ingredient_runtime import (
    CardRecommendation,
    build_minimal_dag,
    update_ingredient_state,
)
from mindcraft_graph.models.ingredient import (
    Bridge,
    BridgeConfidence,
    Ingredient,
    IngredientOntology,
    IngredientStudentState,
)


def _bridge() -> Bridge:
    return Bridge(
        id="source->target",
        from_ingredient="source",
        to_ingredient="target",
        source_concept="source_concept",
        target_concept="target_concept",
        confidence=0.6,
    )


def _graph(bridge: Bridge) -> IngredientGraph:
    return IngredientGraph(IngredientOntology(
        version="test",
        ingredients=[
            Ingredient(id="source", concept_id="source_concept", name="Source", description=""),
            Ingredient(id="target", concept_id="target_concept", name="Target", description=""),
        ],
        bridges=[bridge],
    ))


def _card() -> CardRecommendation:
    return CardRecommendation(
        card_template_id="bridge-card",
        target_type="bridge",
        target_id="source->target",
        representation_key="default",
        title="",
        body="",
        prompt="",
        need_score=0.0,
        reason="",
    )


def test_unattempted_bridge_uses_ontology_prior_in_dag():
    bridge = _bridge()
    dag = build_minimal_dag(
        ["target"], {"source"}, [bridge], _graph(bridge), IngredientStudentState(student_id="s")
    )

    edge = dag.edges[0]
    assert edge.confidence == pytest.approx(0.6)
    assert edge.need_score == pytest.approx(0.4)


def test_recorded_bridge_confidence_is_unaffected_by_prior():
    bridge = _bridge()
    state = IngredientStudentState(
        student_id="s",
        bridge_confidence={
            "source->target": BridgeConfidence(
                bridge_id="source->target",
                from_ingredient="source",
                to_ingredient="target",
                confidence=0.2,
                attempts=2,
            )
        },
    )
    dag = build_minimal_dag(["target"], {"source"}, [bridge], _graph(bridge), state)

    assert dag.edges[0].confidence == pytest.approx(0.2)


def test_default_update_keeps_legacy_first_attempt_values():
    state = update_ingredient_state(
        IngredientStudentState(student_id="s"), _card(), student_succeeded=True
    )

    bridge_state = state.bridge_confidence["source->target"]
    assert bridge_state.confidence == pytest.approx(0.15)
    assert bridge_state.attempts == 1
    assert bridge_state.successes == 1


def test_update_can_seed_first_bridge_record_from_prior():
    state = update_ingredient_state(
        IngredientStudentState(student_id="s"),
        _card(),
        student_succeeded=True,
        prior_confidence=0.6,
    )

    assert state.bridge_confidence["source->target"].confidence == pytest.approx(0.75)
