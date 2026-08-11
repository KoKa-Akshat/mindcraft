from datetime import datetime, timedelta
import math

import pytest

from mindcraft_graph.engine.decay import decay_edge
from mindcraft_graph.engine.edge_weights import EdgeState, initialize_edge_from_ontology
from mindcraft_graph.models.concept import OntologyEdge


def test_ontology_edge_decays_to_its_real_prior():
    edge = initialize_edge_from_ontology(
        OntologyEdge.model_validate({
            "from": "a",
            "to": "b",
            "relation": "prerequisite",
            "strength": 0.45,
        })
    ).model_copy(update={"alpha": 109.0, "last_updated": datetime(2026, 1, 1)})

    assert edge.model_dump()["prior_mean"] == pytest.approx(0.45)
    decayed = decay_edge(edge, datetime(2026, 1, 1) + timedelta(days=900))

    assert decayed.weight == pytest.approx(0.45, abs=0.02)


def test_legacy_edge_uses_relation_fallback_exactly():
    edge = EdgeState(
        from_concept="a",
        to_concept="b",
        relation="prerequisite",
        alpha=28.0,
        beta=12.0,
        last_updated=datetime(2026, 1, 1),
    )

    decayed = decay_edge(edge, datetime(2026, 4, 1), half_life_days=90.0)

    factor = math.exp(-0.693)
    assert decayed.alpha == pytest.approx(18.0 + 10.0 * factor)
    assert decayed.beta == pytest.approx(2.0 + 10.0 * factor)
    assert decayed.prior_mean is None


def test_discovered_edge_decays_to_half():
    edge = EdgeState(
        from_concept="a",
        to_concept="b",
        relation="discovered",
        alpha=20.0,
        beta=2.0,
        prior_mean=0.5,
        last_updated=datetime(2026, 1, 1),
    )

    decayed = decay_edge(edge, datetime(2028, 6, 19))

    assert decayed.weight == pytest.approx(0.5, abs=0.02)
