from datetime import datetime, timedelta

from mindcraft_graph.engine.features import compute_concept_profiles
from mindcraft_graph.engine.student_graph import create_personal_graph, update_personal_graph
from mindcraft_graph.models.concept import Concept, Ontology
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.planning.pathfinder import trim_chain


CONCEPT_ID = "concept"
TARGET_ID = "target"
ONTOLOGY = Ontology(
    version="test",
    domain="math",
    concepts=[
        Concept(id=CONCEPT_ID, name="Concept", level="core"),
        Concept(id=TARGET_ID, name="Target", level="core"),
    ],
    edges=[],
)


def _event(kind: str, outcome: float, *, day: int = 0) -> SessionEvent:
    return SessionEvent(
        student_id="s",
        concept_id=CONCEPT_ID,
        event_type=kind,
        outcome=outcome,
        effort=0.3,
        duration_minutes=5.0,
        timestamp=datetime(2026, 1, 1) + timedelta(days=day),
        exposure_weight=0.4 if kind == "assessment" else 1.0,
    )


def _trim(events: list[SessionEvent]) -> list[str]:
    graph = update_personal_graph(create_personal_graph("s", ONTOLOGY), events, ONTOLOGY)
    profiles = compute_concept_profiles(events, ONTOLOGY)
    return trim_chain([CONCEPT_ID, TARGET_ID], profiles, graph)


def test_easy_assessment_alone_cannot_trim_concept():
    assert _trim([_event("assessment", 0.5)]) == [CONCEPT_ID, TARGET_ID]


def test_successful_practice_allows_concept_to_be_trimmed():
    assert _trim([
        _event("assessment", 0.5),
        _event("problem_set", 0.7, day=1),
    ]) == [TARGET_ID]


def test_hard_assessment_remains_struggling_and_survives_trim():
    assert _trim([_event("assessment", -0.4)]) == [CONCEPT_ID, TARGET_ID]


def test_two_easy_assessments_still_cannot_trim_via_mastery_branch():
    assert _trim([
        _event("assessment", 0.5),
        _event("assessment", 0.5, day=1),
    ]) == [CONCEPT_ID, TARGET_ID]
