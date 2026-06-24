# ml/mindcraft_graph/firestore_adapter.py

import os

from google.cloud import firestore
from datetime import datetime
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.ingredient import (
    BridgeConfidence,
    IngredientMastery,
    IngredientStudentState,
)
from mindcraft_graph.models.student_state import StudentState, ConceptMastery
from mindcraft_graph.engine.student_graph import PersonalGraph
from mindcraft_graph.engine.edge_weights import EdgeState

# The student data lives in the Firebase project mindcraft-93858 (the frontend +
# webhook write there). On Cloud Run, a bare firestore.Client() would resolve to
# the Cloud Run project instead — which has no database. Pin the project so the
# ML service reads/writes the SAME store as the rest of the app, regardless of
# where it runs. Overridable via FIRESTORE_PROJECT.
FIRESTORE_PROJECT = os.getenv("FIRESTORE_PROJECT") or "mindcraft-93858"

db = firestore.Client(project=FIRESTORE_PROJECT)


def _to_naive(ts):
    """Normalize a Firestore datetime to a plain, naive ``datetime``.

    Firestore returns ``DatetimeWithNanoseconds`` (tz-aware). The engine works
    entirely in naive datetimes (datetime.now(), make_event, decay), so mixing
    them makes decay do ``naive - aware`` and raise TypeError. We rebuild a
    vanilla ``datetime`` from the components rather than calling ``.replace()``:
    ``replace()`` keeps the DatetimeWithNanoseconds subclass but drops its
    ``_nanosecond`` slot, which then crashes when the value is written back to
    Firestore (``timestamp_pb()`` reads ``_nanosecond``).
    """
    if isinstance(ts, datetime):
        return datetime(
            ts.year, ts.month, ts.day,
            ts.hour, ts.minute, ts.second, ts.microsecond,
        )
    return ts


def load_student_events(student_id: str, limit: int = 500) -> list[SessionEvent]:
    """Read events from Firestore interactions collection."""
    try:
        docs = (
            db.collection("interactions")
            .where("studentId", "==", student_id)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )

        events = []
        for doc in docs:
            data = doc.to_dict()
            events.append(SessionEvent(
                student_id=student_id,
                concept_id=data.get("conceptId", ""),
                event_type=data.get("eventType", "session"),
                outcome=float(data.get("outcome", 0)),
                effort=float(data.get("effort", 0.5)),
                duration_minutes=float(data.get("durationMinutes", 30)),
                timestamp=_to_naive(data.get("timestamp", datetime.now())),
                exposure_weight=float(data.get("exposureWeight", 1.0)),
            ))

        return events
    except Exception:
        # Index may not exist yet or query failed — return empty for new students
        return []


def replace_interactions_by_source(student_id: str, events, source: str) -> int:
    """Idempotently replace all interactions for a student that carry ``source``.

    Used by the onboarding self-assessment seed: deletes any prior seed events
    (so re-onboarding overwrites rather than stacking) and writes the new ones.
    Queries by studentId only (single-field, auto-indexed) and filters source in
    Python so this needs no composite index.
    """
    existing = db.collection("interactions").where("studentId", "==", student_id).stream()
    for doc in existing:
        if (doc.to_dict() or {}).get("source") == source:
            doc.reference.delete()

    return append_interactions(student_id, events, source)


def append_interactions(student_id: str, events, source: str) -> int:
    """Append interaction events (no delete). Used by practice/homework outcomes,
    which accumulate over time — unlike the onboarding seed, which replaces."""
    for event in events:
        db.collection("interactions").add({
            "studentId": event.student_id,
            "conceptId": event.concept_id,
            "eventType": event.event_type,
            "outcome": event.outcome,
            "effort": event.effort,
            "durationMinutes": event.duration_minutes,
            "timestamp": event.timestamp,
            "exposureWeight": event.exposure_weight,
            "source": source,
        })
    return len(events)


def load_personal_graph(student_id: str) -> dict | None:
    """Load a saved personal graph from Firestore."""
    doc = db.collection("knowledge_graphs").document(student_id).get()
    if not doc.exists:
        return None
    return doc.to_dict()


def save_personal_graph(student_id: str, graph: PersonalGraph):
    """Save the personal graph state to Firestore."""
    # Convert to a serializable dict
    graph_data = {
        "studentId": student_id,
        "updatedAt": datetime.now(),
        "masteryByConcept": {
            cid: {
                "mastery": cm.mastery,
                "exposureCount": cm.exposure_count,
                "lastInteraction": cm.last_interaction,
                "cumulativeOutcome": cm.cumulative_outcome,
                "attempts": cm.attempts,
            }
            for cid, cm in graph.state.mastery_by_concept.items()
        },
        "edges": {
            key: {
                "fromConcept": edge.from_concept,
                "toConcept": edge.to_concept,
                "relation": edge.relation,
                "alpha": edge.alpha,
                "beta": edge.beta,
                "weight": edge.weight,
                "lastUpdated": edge.last_updated,
            }
            for key, edge in graph.edges.items()
        },
        "ontologyEdgeCount": graph.ontology_edge_count,
        "discoveredEdgeCount": graph.discovered_edge_count,
    }

    db.collection("knowledge_graphs").document(student_id).set(graph_data)


def save_recommendation_result(student_id: str, result: dict):
    """Save the latest recommendation to Firestore for frontend consumption."""
    db.collection("recommendations").document(student_id).set({
        "studentId": student_id,
        "updatedAt": datetime.now(),
        "mode": result.get("mode"),
        "recommendations": result.get("recommendations", []),
        "studentProfile": result.get("studentProfile", {}),
    })


def load_ingredient_state(student_id: str) -> IngredientStudentState:
    """Load ingredient-level student state or return a fresh one."""
    doc = db.collection("ingredient_states").document(student_id).get()
    if not doc.exists:
        return IngredientStudentState(student_id=student_id)

    data = doc.to_dict() or {}

    ingredient_mastery = {
        ingredient_id: IngredientMastery(
            ingredient_id=ingredient_id,
            mastery=float(payload.get("mastery", 0.0)),
            attempts=int(payload.get("attempts", 0)),
            last_outcome=float(payload.get("last_outcome", 0.0)),
            cumulative_outcome=float(payload.get("cumulative_outcome", 0.0)),
        )
        for ingredient_id, payload in data.get("ingredient_mastery", {}).items()
    }

    bridge_confidence = {
        bridge_id: BridgeConfidence(
            bridge_id=bridge_id,
            from_ingredient=payload.get("from_ingredient", ""),
            to_ingredient=payload.get("to_ingredient", ""),
            confidence=float(payload.get("confidence", 0.0)),
            attempts=int(payload.get("attempts", 0)),
            successes=int(payload.get("successes", 0)),
        )
        for bridge_id, payload in data.get("bridge_confidence", {}).items()
    }

    return IngredientStudentState(
        student_id=student_id,
        ingredient_mastery=ingredient_mastery,
        bridge_confidence=bridge_confidence,
        style_scores={
            key: float(value)
            for key, value in data.get("style_scores", {}).items()
        },
    )


def save_ingredient_state(student_id: str, state: IngredientStudentState):
    """Persist ingredient-level student state to Firestore."""
    payload = {
        "studentId": student_id,
        "updatedAt": datetime.now(),
        "ingredient_mastery": {
            ingredient_id: mastery.model_dump()
            for ingredient_id, mastery in state.ingredient_mastery.items()
        },
        "bridge_confidence": {
            bridge_id: confidence.model_dump()
            for bridge_id, confidence in state.bridge_confidence.items()
        },
        "style_scores": state.style_scores,
    }
    db.collection("ingredient_states").document(student_id).set(payload)


def save_ingredient_recommendation_result(student_id: str, result: dict):
    """Save the latest ingredient recommendation bundle."""
    db.collection("ingredient_recommendations").document(student_id).set({
        "studentId": student_id,
        "updatedAt": datetime.now(),
        **result,
    })
