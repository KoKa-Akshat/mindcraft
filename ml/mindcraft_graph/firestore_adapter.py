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
from mindcraft_graph.models.affective_state import AffectiveState
from mindcraft_graph.models.student_state import StudentState, ConceptMastery
from mindcraft_graph.engine.student_graph import PersonalGraph
from mindcraft_graph.engine.edge_weights import EdgeState
from mindcraft_graph.models.learning_world import (
    AgentSkill,
    ExecutionTrace,
    LearningEvent,
    MemoryRecord,
    ReflexionRecord,
)

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


def append_format_interactions(student_id: str, records: list[dict], now: datetime) -> int:
    """Append representation/format outcomes to a SEPARATE collection.

    Kept out of `interactions` on purpose: format events must never reach the
    concept edge/feature/difficulty path (a HARD invariant). They feed format
    nodes only, via load_format_events + fold_format_events. Each record:
    {format_id, outcome, level}.
    """
    for r in records:
        db.collection("format_interactions").add({
            "studentId": student_id,
            "formatId": r["format_id"],
            "outcome": float(r["outcome"]),
            "level": int(r.get("level", 1)),
            "exposureWeight": float(r.get("exposure_weight", 1.0)),
            "timestamp": now,
        })
    return len(records)


def append_attempt_observations(student_id: str, observations: list[dict], now: datetime) -> int:
    """Append PER-QUESTION attempt records for the predictive harness.

    Structurally separate from the update events (interactions/format_interactions
    hold one aggregated event per node per session). Observations keep full
    granularity — one row per question — and are NEVER folded into mastery; the
    harness replays them to reconstruct state-before-attempt vs actual outcome.
    Each obs: {concept_id, format_id|None, level, correct (0/1), question_id|None}.
    """
    for o in observations:
        db.collection("attempt_observations").add({
            "studentId": student_id,
            "conceptId": o.get("concept_id"),
            "formatId": o.get("format_id"),
            "level": int(o.get("level", 1)),
            "correct": float(o.get("correct", 0.0)),
            "questionId": o.get("question_id"),
            "selectedChoiceIndex": o.get("selected_choice_index"),
            "misconceptionId": o.get("misconception_id"),
            "errorType": o.get("error_type"),
            "timestamp": now,
        })
    return len(observations)


def load_attempt_observations(student_id: str, limit: int = 2000) -> list[dict]:
    """Read per-question attempt observations in ascending timestamp order.

    Returns plain dicts (the harness's replay source) — not SessionEvents, since
    these are never folded into mastery.
    """
    try:
        docs = (
            db.collection("attempt_observations")
            .where("studentId", "==", student_id)
            .order_by("timestamp", direction=firestore.Query.ASCENDING)
            .limit(limit)
            .stream()
        )
        out = []
        for doc in docs:
            d = doc.to_dict()
            out.append({
                "student_id": student_id,
                "concept_id": d.get("conceptId"),
                "format_id": d.get("formatId"),
                "level": int(d.get("level", 1)),
                "correct": float(d.get("correct", 0.0)),
                "question_id": d.get("questionId"),
                "selected_choice_index": d.get("selectedChoiceIndex"),
                "misconception_id": d.get("misconceptionId"),
                "error_type": d.get("errorType"),
                "timestamp": _to_naive(d.get("timestamp", datetime.now())),
            })
        return out
    except Exception:
        return []


def load_recent_attempt_observations(student_id: str, limit: int = 200) -> list[dict]:
    """Read recent per-question observations with outcome-stream fields."""
    try:
        docs = (
            db.collection("attempt_observations")
            .where("studentId", "==", student_id)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        out = []
        for doc in docs:
            d = doc.to_dict()
            out.append({
                "student_id": student_id,
                "concept_id": d.get("conceptId"),
                "format_id": d.get("formatId"),
                "level": int(d.get("level", 1)),
                "correct": float(d.get("correct", 0.0)),
                "question_id": d.get("questionId"),
                "selected_choice_index": d.get("selectedChoiceIndex"),
                "misconception_id": d.get("misconceptionId"),
                "error_type": d.get("errorType"),
                "timestamp": _to_naive(d.get("timestamp", datetime.now())),
            })
        return out
    except Exception:
        return []


def append_attempt_fusion(student_id: str, fusion: dict, now: datetime) -> str:
    """Append one joined outcome/process attempt record."""
    payload = {
        "studentId": student_id,
        "questionId": fusion.get("questionId"),
        "conceptId": fusion.get("conceptId"),
        "formatId": fusion.get("formatId"),
        "level": int(fusion.get("level", 1)),
        "correct": float(fusion.get("correct", 0.0)),
        "selectedChoiceIndex": fusion.get("selectedChoiceIndex"),
        "misconceptionId": fusion.get("misconceptionId"),
        "errorType": fusion.get("errorType"),
        "ingredientId": fusion.get("ingredientId"),
        "processSteps": fusion.get("processSteps", []),
        "alignment": fusion.get("alignment"),
        "firstBrokenLine": fusion.get("firstBrokenLine"),
        "timestamp": now,
    }
    _, ref = db.collection("attempt_fusions").add(payload)
    return ref.id


def load_format_events(student_id: str, limit: int = 500) -> list[SessionEvent]:
    """Read format outcomes as SessionEvents keyed by format_id (in concept_id).

    Returned events are meant ONLY for fold_format_events — never pass them to
    update_personal_graph (that would feed edges/features). effort is irrelevant
    to mastery and left at 0.
    """
    try:
        docs = (
            db.collection("format_interactions")
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
                concept_id=data.get("formatId", ""),
                event_type="problem_set",
                outcome=float(data.get("outcome", 0)),
                effort=0.0,
                duration_minutes=0.0,
                timestamp=_to_naive(data.get("timestamp", datetime.now())),
                exposure_weight=float(data.get("exposureWeight", 1.0)),
            ))
        return events
    except Exception:
        return []


def learning_events_as_session_events(student_id: str, subject_id: str = "math") -> list[SessionEvent]:
    """Convert diagnostic/practice learning_events into SessionEvents for the PCA graph."""
    converted: list[SessionEvent] = []
    for raw in load_learning_events(student_id, subject_id):
        outcome = raw.get("outcome")
        if outcome is None:
            continue
        concept_id = raw.get("conceptId") or ""
        if not concept_id or concept_id == "diagnostic":
            continue
        valence = float(outcome) * 2.0 - 1.0  # map 0/1 → -1..1
        duration_ms = raw.get("durationMs") or 0
        converted.append(SessionEvent(
            student_id=student_id,
            concept_id=concept_id,
            event_type="problem_set",
            outcome=valence,
            effort=0.6,
            duration_minutes=max(duration_ms / 60000.0, 0.5),
            timestamp=raw.get("timestamp", datetime.now()),
            exposure_weight=1.0,
        ))
    return converted


def load_student_events_with_learning(student_id: str, limit: int = 500) -> list[SessionEvent]:
    """Interactions + diagnostic learning_events — feeds constellation / knowledge graph."""
    events = load_student_events(student_id, limit=limit)
    events.extend(learning_events_as_session_events(student_id))
    return events


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
                "weightedCount": cm.weighted_count,
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
        "misconceptionGaps": result.get("misconceptionGaps", []),
    })


def append_displacement_snapshot(
    student_id: str,
    magnitude: float,
    direction: dict[str, float],
    now: datetime | None = None,
):
    """Append a displacement reading to a per-student time series.

    Displacement (strength centroid - mastery centroid in PCA space) is the
    learning-efficiency vector. save_recommendation_result OVERWRITES the latest
    snapshot, so the KPI value — the trend over time — would be lost. This writes
    an append-only point, mirroring the interactions log, so magnitude/direction
    can be charted across sessions.
    """
    db.collection("students").document(student_id).collection("metrics").add({
        "magnitude": float(magnitude),
        "direction": {k: float(v) for k, v in direction.items()},
        "timestamp": now or datetime.now(),
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
        misconception_counts={
            k: int(v)
            for k, v in data.get("misconception_counts", {}).items()
        },
    )


def load_affective_state(student_id: str) -> AffectiveState | None:
    """Load a recent pre-session check-in, or None when absent/stale/invalid."""
    try:
        doc = db.collection("affective_state").document(student_id).get()
        if not doc.exists:
            return None

        data = (doc.to_dict() or {}).get("latest")
        if not data:
            return None

        state = AffectiveState(**data)
        now_ms = int(datetime.now().timestamp() * 1000)
        if now_ms - state.captured_at > 4 * 60 * 60 * 1000:
            return None
        return state
    except Exception:
        return None


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
        "misconception_counts": state.misconception_counts,
    }
    db.collection("ingredient_states").document(student_id).set(payload)


def save_ingredient_recommendation_result(student_id: str, result: dict):
    """Save the latest ingredient recommendation bundle."""
    db.collection("ingredient_recommendations").document(student_id).set({
        "studentId": student_id,
        "updatedAt": datetime.now(),
        **result,
    })


def save_learning_event(event: LearningEvent):
    """Persist a cross-subject learning-world event."""
    db.collection("learning_events").add({
        "studentId": event.student_id,
        "subjectId": event.subject_id,
        "conceptId": event.concept_id,
        "ingredientId": event.ingredient_id,
        "eventType": event.event_type,
        "outcome": event.outcome,
        "durationMs": event.duration_ms,
        "clueUsed": event.clue_used,
        "hintLevel": event.hint_level,
        "source": event.source,
        "metadata": event.metadata,
        "timestamp": datetime.now(),
    })


def load_learning_events(student_id: str, subject_id: str, limit: int = 500) -> list[dict]:
    """Read cross-subject learning events for a student and subject."""
    try:
        docs = (
            db.collection("learning_events")
            .where("studentId", "==", student_id)
            .where("subjectId", "==", subject_id)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
            .stream()
        )
        return [doc.to_dict() for doc in docs]
    except Exception:
        return []


def save_agent_skill(skill: AgentSkill):
    """Persist a reusable code-as-policy teaching skill."""
    db.collection("agent_skills").document(skill.id).set({
        **skill.model_dump(),
        "updatedAt": datetime.now(),
    })


def load_agent_skills(subject_id: str, concept_id: str | None = None, limit: int = 50) -> list[dict]:
    """Load reusable teaching skills for a subject, optionally narrowed to a concept."""
    try:
        query = (
            db.collection("agent_skills")
            .where("subject_id", "==", subject_id)
            .limit(limit)
        )
        docs = query.stream()
        skills = [doc.to_dict() for doc in docs]
        if concept_id:
            skills = [
                skill for skill in skills
                if skill.get("concept_id") in {concept_id, None, ""}
            ]
        return skills
    except Exception:
        return []


def save_memory_record(memory: MemoryRecord):
    """Append a memory-stream record for a student or subject graph."""
    db.collection("agent_memory").add({
        **memory.model_dump(),
        "timestamp": datetime.now(),
    })


def load_memory_records(
    subject_id: str,
    student_id: str | None = None,
    concept_id: str | None = None,
    limit: int = 100,
) -> list[dict]:
    """Read recent memory-stream records relevant to a planning context."""
    try:
        query = (
            db.collection("agent_memory")
            .where("subject_id", "==", subject_id)
            .order_by("timestamp", direction=firestore.Query.DESCENDING)
            .limit(limit)
        )
        records = [doc.to_dict() for doc in query.stream()]
        if student_id:
            records = [
                record for record in records
                if record.get("student_id") in {student_id, None, ""}
            ]
        if concept_id:
            records = [
                record for record in records
                if record.get("concept_id") in {concept_id, None, ""}
            ]
        return records
    except Exception:
        return []


def save_execution_trace(trace: ExecutionTrace) -> str:
    """Persist one agent harness execution result."""
    doc_ref = db.collection("agent_execution_traces").document()
    doc_ref.set({
        **trace.model_dump(),
        "timestamp": datetime.now(),
    })
    return doc_ref.id


def save_reflexion_record(reflexion: ReflexionRecord):
    """Persist a verbal reinforcement constraint after a failure."""
    db.collection("agent_reflexions").add({
        **reflexion.model_dump(),
        "timestamp": datetime.now(),
    })
