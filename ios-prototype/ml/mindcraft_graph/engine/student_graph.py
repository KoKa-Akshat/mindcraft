# ml/mindcraft_graph/engine/student_graph.py

from datetime import datetime
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.student_state import StudentState
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.engine.update import update_student_state
from mindcraft_graph.engine.edge_weights import (
    build_initial_graph, update_edges_from_events, EdgeState,
)
from pydantic import BaseModel


class PersonalGraph(BaseModel):
    """
    A student's complete graph state: mastery (nodes) + edges.

    This is what the recommender queries.
    The ontology is the prior; this is the posterior.
    """
    student_id: str
    state: StudentState           # per-concept mastery (node values)
    edges: dict[str, EdgeState]   # keyed by "from::to" for serialization
    ontology_edge_count: int      # how many edges came from the ontology
    discovered_edge_count: int    # how many edges the student created
    created_at: datetime
    updated_at: datetime

    def get_edge(self, from_id: str, to_id: str) -> EdgeState | None:
        return self.edges.get(f"{from_id}::{to_id}")

    def get_neighbors(self, concept_id: str, min_weight: float = 0.1) -> list[EdgeState]:
        """All edges touching this concept above weight threshold."""
        result = []
        for key, edge in self.edges.items():
            if edge.weight < min_weight:
                continue
            if edge.from_concept == concept_id or edge.to_concept == concept_id:
                result.append(edge)
        return sorted(result, key=lambda e: -e.weight)

    def get_ontology_edges(self) -> list[EdgeState]:
        return [e for e in self.edges.values() if e.relation != "discovered"]

    def get_discovered_edges(self) -> list[EdgeState]:
        return [e for e in self.edges.values() if e.relation == "discovered"]


def create_personal_graph(
    student_id: str,
    ontology: Ontology,
) -> PersonalGraph:
    """Initialize a personal graph from the ontology prior. No student data yet."""
    initial_edges = build_initial_graph(ontology)

    # Convert tuple keys to string keys for serialization
    edges_serializable = {
        f"{k[0]}::{k[1]}": v for k, v in initial_edges.items()
    }

    return PersonalGraph(
        student_id=student_id,
        state=StudentState(
            student_id=student_id,
            mastery_by_concept={},
            created_at=datetime.now(),
            updated_at=datetime.now(),
        ),
        edges=edges_serializable,
        ontology_edge_count=len(initial_edges),
        discovered_edge_count=0,
        created_at=datetime.now(),
        updated_at=datetime.now(),
    )


def update_personal_graph(
    graph: PersonalGraph,
    events: list[SessionEvent],
    ontology: Ontology,
) -> PersonalGraph:
    """
    Full update: fold events into both mastery (nodes) and edges.
    Returns a new PersonalGraph with updated state.
    """
    # Update mastery
    new_state = update_student_state(graph.state, events)

    # Convert string keys back to tuple keys for edge update
    edges_tuple = {
        (k.split("::")[0], k.split("::")[1]): v
        for k, v in graph.edges.items()
    }

    # Update edges (this now creates discovered edges too)
    updated_edges = update_edges_from_events(edges_tuple, events, ontology)

    # Convert back to string keys
    edges_serializable = {
        f"{k[0]}::{k[1]}": v for k, v in updated_edges.items()
    }

    # Count edge types
    discovered = sum(1 for e in edges_serializable.values() if e.relation == "discovered")

    return graph.model_copy(update={
        "state": new_state,
        "edges": edges_serializable,
        "discovered_edge_count": discovered,
        "updated_at": datetime.now(),
    })