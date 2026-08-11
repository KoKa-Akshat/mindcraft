from mindcraft_graph.engine.features import ConceptProfile
from mindcraft_graph.models.ingredient import Combination


def test_adjusted_strength_is_not_part_of_concept_profile():
    assert not hasattr(ConceptProfile, "adjusted_strength")


def test_combination_tooling_fields_remain_parsed_and_serialized():
    combination = Combination(
        id="combo",
        spans_concepts=["a", "b"],
        captured_by_dependency_or_bridge=True,
    )

    dumped = combination.model_dump()
    assert dumped["spans_concepts"] == ["a", "b"]
    assert dumped["captured_by_dependency_or_bridge"] is True
