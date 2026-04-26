"""
Update engine: consume session events, update per-concept mastery state.
"""
from __future__ import annotations
import math
from datetime import datetime
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.student_state import ConceptMastery, StudentState


# Hand-tuned coefficients for the mastery logistic regression.
# These get fit from data later; for now we pick reasonable values.
BETA_0 = -2.0   # intercept — low mastery by default
BETA_1 = 0.8    # log(sessions + 1) — exposure effect
BETA_2 = 1.5    # average outcome — performance effect
BETA_3 = 0.3    # recency — recent activity boost
BETA_4 = 0.2    # avg time spent per event — engagement depth

RECENCY_DECAY_DAYS = 30.0  # how fast recency score fades


def sigmoid(x: float) -> float:
    """Numerically stable sigmoid."""
    if x >= 0:
        return 1.0 / (1.0 + math.exp(-x))
    e = math.exp(x)
    return e / (1.0 + e)


def compute_recency_score(last_interaction: datetime, now: datetime) -> float:
    """Exponential decay: 1.0 when just happened, 0 far in the past."""
    days_ago = (now - last_interaction).total_seconds() / 86400.0
    return math.exp(-days_ago / RECENCY_DECAY_DAYS)


def compute_mastery_score(cm: ConceptMastery, now: datetime) -> float:
    """
    Not complete need to add summary based input 
    Logistic regression mastery score. 

    m = σ(β0 + β1·log(sessions+1) + β2·avg_outcome + β3·recency + β4·avg_time)
    """
    if cm.attempts == 0:
        return 0.0

    avg_outcome = cm.cumulative_outcome / cm.attempts  # in [-1, 1]
    recency = compute_recency_score(cm.last_interaction, now) if cm.last_interaction else 0.0

    # You'd need to add avg_duration to ConceptMastery if you want β4 to work.
    # For now, drop it:
    z = (
        BETA_0
        + BETA_1 * math.log(cm.exposure_count + 1)
        + BETA_2 * avg_outcome
        + BETA_3 * recency
    )
    return sigmoid(z)


def apply_event_to_mastery(cm: ConceptMastery, event: SessionEvent) -> ConceptMastery:
    """
    Fold a single event into a ConceptMastery object. Returns updated copy.
    """
    new_exposure = cm.exposure_count + event.exposure_weight
    new_cumulative = cm.cumulative_outcome + event.outcome
    new_attempts = cm.attempts + 1
    new_last = event.timestamp

    updated = cm.model_copy(update={
        "exposure_count": int(new_exposure),
        "cumulative_outcome": new_cumulative,
        "attempts": new_attempts,
        "last_interaction": new_last,
    })

    # Recompute derived mastery score using the aggregation
    updated.mastery = compute_mastery_score(updated, event.timestamp)
    return updated


def update_student_state(
    state: StudentState,
    events: list[SessionEvent],
) -> StudentState:
    """
    Fold a batch of events into the student state.

    Events are applied in timestamp order. For each event, locate the
    corresponding ConceptMastery (create if missing) and update it.
    """
    sorted_events = sorted(events, key=lambda e: e.timestamp)
    new_mastery = dict(state.mastery_by_concept)

    for event in sorted_events:
        if event.concept_id not in new_mastery:
            new_mastery[event.concept_id] = ConceptMastery(
                concept_id=event.concept_id,
                mastery=0.0,
                exposure_count=0,
                last_interaction=None,
                cumulative_outcome=0.0,
                attempts=0,
            )
        new_mastery[event.concept_id] = apply_event_to_mastery(
            new_mastery[event.concept_id],
            event,
        )

    return state.model_copy(update={
        "mastery_by_concept": new_mastery,
        "updated_at": sorted_events[-1].timestamp if sorted_events else state.updated_at,
    })