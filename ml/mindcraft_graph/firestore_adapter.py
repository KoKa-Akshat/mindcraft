# ml/mindcraft_graph/firestore_adapter.py

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

db = firestore.Client()


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
                timestamp=data.get("timestamp", datetime.now()),
                exposure_weight=float(data.get("exposureWeight", 1.0)),
            ))

        return events
    except Exception:
        # Index may not exist yet or query failed — return empty for new students
        return []


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
