# ml/mindcraft_graph/engine/edges.py

from mindcraft_graph.models.concept import Ontology, OntologyEdge
from mindcraft_graph.models.events import SessionEvent
from pydantic import BaseModel
from datetime import datetime


# Prior strength per relation type. Higher = more confidence in the ontology.
# Prerequisite edges are domain facts; related/application are softer.
PRIOR_PSEUDO_COUNTS = {
    "prerequisite": 20.0,   # strong prior — takes lots of evidence to overturn
    "related":       8.0,   # moderate prior
    "application":   5.0,   # weak prior — more easily shifted by student data
}


class EdgeState(BaseModel):
    """Per-student state for one edge in the concept graph."""
    from_concept: str
    to_concept: str
    relation: str
    alpha: float  # pseudo-successes (evidence for this edge)
    beta: float   # pseudo-failures
    last_updated: datetime | None = None

    @property
    def weight(self) -> float:
        """Posterior mean — the scalar edge weight used by graph algorithms."""
        return self.alpha / (self.alpha + self.beta)


def initialize_edge_from_ontology(edge: OntologyEdge) -> EdgeState:
    """
    Convert a static ontology edge into a Beta-Binomial prior.

    The ontology's `strength` ∈ [0, 1] is the prior mean.
    The relation type determines how many pseudo-counts back that mean.
    """
    pseudo_total = PRIOR_PSEUDO_COUNTS[edge.relation]
    alpha_prior = edge.strength * pseudo_total
    beta_prior = (1.0 - edge.strength) * pseudo_total

    return EdgeState(
        from_concept=edge.from_concept,
        to_concept=edge.to_concept,
        relation=edge.relation,
        alpha=alpha_prior,
        beta=beta_prior,
    )


def build_initial_graph(ontology: Ontology) -> dict[tuple[str, str], EdgeState]:
    """
    Create the per-student graph, seeded entirely by the ontology prior.

    Keyed by (from_id, to_id) for fast lookup.
    """
    return {
        (e.from_concept, e.to_concept): initialize_edge_from_ontology(e)
        for e in ontology.edges
    }



def update_edges_from_events(
    graph: dict[tuple[str, str], EdgeState],
    events: list[SessionEvent],
    ontology: Ontology,          # NEW: needed to check valid concepts
    window_hours: float = 2.0,
) -> dict[tuple[str, str], EdgeState]:

    sorted_events = sorted(events, key=lambda e: e.timestamp)
    updated = dict(graph)
    valid_concepts = {c.id for c in ontology.concepts}

    for i, e1 in enumerate(sorted_events):
        for e2 in sorted_events[i+1:]:
            dt_hours = (e2.timestamp - e1.timestamp).total_seconds() / 3600.0
            if dt_hours > window_hours:
                break
            if e1.concept_id == e2.concept_id:
                continue

            for key in [(e1.concept_id, e2.concept_id), (e2.concept_id, e1.concept_id)]:
                if key not in updated:
                    # Create discovered edge if both concepts are valid
                    if key[0] in valid_concepts and key[1] in valid_concepts:
                        updated[key] = EdgeState(
                            from_concept=key[0],
                            to_concept=key[1],
                            relation="discovered",
                            alpha=1.0,
                            beta=1.0,
                        )
                    else:
                        continue

                edge = updated[key]
                joint_outcome = (e1.outcome + e2.outcome) / 2.0
                success = (joint_outcome + 1) / 2   # map to [0, 1]

                updated[key] = edge.model_copy(update={
                    "alpha": edge.alpha + success,
                    "beta": edge.beta + (1 - success),
                    "last_updated": e2.timestamp,
                })

    return updated