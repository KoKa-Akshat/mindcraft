import random

import pytest

from mindcraft_graph.models.concept import Concept, estimate_difficulty


def _concept(concept_id: str, failure_rate: float, order: int) -> Concept:
    return Concept(
        id=concept_id,
        name=concept_id,
        level="core",
        typical_order=order,
        population_failure_rate=failure_rate,
    )


def test_difficulty_uses_failure_rate_and_stays_in_range():
    low = _concept("low", 0.1, 100)
    high = _concept("high", 0.9, 0)

    assert estimate_difficulty(high) > estimate_difficulty(low)
    assert estimate_difficulty(_concept("zero", 0.0, 0)) == pytest.approx(0.1)
    assert estimate_difficulty(_concept("one", 1.0, 0)) == pytest.approx(1.0)


def test_difficulty_is_independent_of_concept_ordering():
    concepts = [_concept("a", 0.2, 0), _concept("b", 0.8, 1), _concept("c", 0.4, 2)]
    before = {concept.id: estimate_difficulty(concept) for concept in concepts}

    random.Random(7).shuffle(concepts)
    for index, concept in enumerate(concepts):
        concept.typical_order = index
    after = {concept.id: estimate_difficulty(concept) for concept in concepts}

    assert after == before
