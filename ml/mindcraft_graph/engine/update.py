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
BETA_1 = 0.8    # log(effective sessions + 1) — exposure effect
BETA_2 = 1.5    # recency-weighted average outcome — performance effect
BETA_3 = 0.3    # recency — recent activity boost

RECENCY_DECAY_DAYS = 30.0   # how fast the recency boost term fades
# Half-life for the recency weighting of outcome evidence. A session's
# influence on avg_outcome and on the effective sample size halves every
# this-many days, so recent performance dominates and stale evidence fades
# toward the prior. (decay.py imports this; keep it the single source.)
MASTERY_HALF_LIFE_DAYS = 60.0


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


def _time_decay_factor(days: float, half_life: float = MASTERY_HALF_LIFE_DAYS) -> float:
    """Exponential weight in (0, 1] for evidence aged `days`."""
    if days <= 0 or half_life <= 0:
        return 1.0
    return math.exp(-0.693 * days / half_life)


def compute_mastery_score(cm: ConceptMastery, now: datetime) -> float:
    """
    Logistic-regression mastery score with recency-weighted evidence.

    m = σ(β0 + β1·log(W_eff+1) + β2·avg_outcome + β3·recency)

    where avg_outcome = cumulative_outcome / weighted_count is the
    recency-weighted mean of outcomes (recent sessions dominate), and
    W_eff is the effective sample size decayed to `now` (so a long-idle
    concept loses both its average pull AND its exposure floor, fading
    toward the prior σ(β0)).
    """
    if cm.weighted_count <= 0:
        return 0.0

    # The stored accumulators are "as of last_interaction"; age them to `now`.
    # The factor cancels in the ratio (it's a weighted mean) but shrinks the
    # effective count used by the exposure term.
    days_idle = (now - cm.last_interaction).total_seconds() / 86400.0 if cm.last_interaction else 0.0
    factor = _time_decay_factor(max(0.0, days_idle))
    effective_count = cm.weighted_count * factor

    avg_outcome = cm.cumulative_outcome / cm.weighted_count  # in [-1, 1]
    recency = compute_recency_score(cm.last_interaction, now) if cm.last_interaction else 0.0

    z = (
        BETA_0
        + BETA_1 * math.log(effective_count + 1)
        + BETA_2 * avg_outcome
        + BETA_3 * recency
    )
    return sigmoid(z)


def apply_event_to_mastery(cm: ConceptMastery, event: SessionEvent) -> ConceptMastery:
    """
    Fold a single event into a ConceptMastery object. Returns updated copy.

    Outcome evidence is recency-weighted: the existing accumulators are decayed
    by the gap since the last event, then this event is added at full weight.
    Events must be folded in timestamp order (update_student_state sorts them).
    """
    if cm.last_interaction is not None:
        gap_days = (event.timestamp - cm.last_interaction).total_seconds() / 86400.0
        factor = _time_decay_factor(max(0.0, gap_days))
    else:
        factor = 1.0

    new_cumulative = cm.cumulative_outcome * factor + event.outcome * event.exposure_weight
    new_weighted = cm.weighted_count * factor + event.exposure_weight

    updated = cm.model_copy(update={
        "exposure_count": int(cm.exposure_count + event.exposure_weight),
        "cumulative_outcome": new_cumulative,
        "weighted_count": new_weighted,
        "attempts": cm.attempts + 1,
        "last_interaction": event.timestamp,
    })

    # Mastery "as of this event" (recency/decay relative to now applied later).
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