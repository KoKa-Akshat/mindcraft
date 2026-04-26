# mindcraft_graph/engine/decay.py

"""
Temporal decay for mastery and edge evidence.

Evidence should fade over time so the graph reflects current state,
not historical peak. The key principle: decay only the evidence
component, never the prior. Weights asymptote back to the ontology
prior as evidence ages.

Call apply_decay before each update batch.
"""

from __future__ import annotations

import math
from datetime import datetime

from mindcraft_graph.models.student_state import ConceptMastery, StudentState
from mindcraft_graph.engine.edge_weights import EdgeState


# Default decay rates
MASTERY_HALF_LIFE_DAYS = 60.0    # mastery evidence halves every 60 days
EDGE_HALF_LIFE_DAYS = 90.0       # edge evidence halves every 90 days


def _decay_factor(days_elapsed: float, half_life: float) -> float:
    """Exponential decay factor. Returns value in (0, 1]."""
    if days_elapsed <= 0 or half_life <= 0:
        return 1.0
    return math.exp(-0.693 * days_elapsed / half_life)  # ln(2) ≈ 0.693


def decay_concept_mastery(
    cm: ConceptMastery,
    now: datetime,
    half_life_days: float = MASTERY_HALF_LIFE_DAYS,
) -> ConceptMastery:
    """
    Decay a single concept's mastery evidence toward zero.

    cumulative_outcome decays but exposure_count and attempts
    remain as historical record. The mastery score gets recomputed
    from the decayed outcome at query time.
    """
    if cm.last_interaction is None or cm.attempts == 0:
        return cm

    days_elapsed = (now - cm.last_interaction).total_seconds() / 86400.0
    if days_elapsed < 1.0:
        return cm  # less than a day — no meaningful decay

    factor = _decay_factor(days_elapsed, half_life_days)

    return cm.model_copy(update={
        "cumulative_outcome": cm.cumulative_outcome * factor,
    })


def decay_student_state(
    state: StudentState,
    now: datetime,
    half_life_days: float = MASTERY_HALF_LIFE_DAYS,
) -> StudentState:
    """Decay all concept mastery evidence for a student."""
    decayed = {
        concept_id: decay_concept_mastery(cm, now, half_life_days)
        for concept_id, cm in state.mastery_by_concept.items()
    }
    return state.model_copy(update={"mastery_by_concept": decayed})


def decay_edge(
    edge: EdgeState,
    now: datetime,
    half_life_days: float = EDGE_HALF_LIFE_DAYS,
) -> EdgeState:
    """
    Decay edge evidence toward the prior.

    The prior is determined by the relation type and initial strength.
    Evidence (the difference between current alpha/beta and the prior)
    decays, but the prior itself never changes.

    For prerequisite edges with α_prior=18, β_prior=2:
      After decay, α moves back toward 18 and β toward 2.

    For discovered edges with α_prior=1, β_prior=1:
      After decay, α and β both move toward 1 (weight → 0.5).
    """
    if edge.last_updated is None:
        return edge

    days_elapsed = (now - edge.last_updated).total_seconds() / 86400.0
    if days_elapsed < 1.0:
        return edge

    factor = _decay_factor(days_elapsed, half_life_days)

    # Estimate the prior from relation type
    from mindcraft_graph.engine.edge_weights import PRIOR_PSEUDO_COUNTS
    pseudo_total = PRIOR_PSEUDO_COUNTS.get(edge.relation, 2.0)

    # We don't store the original strength, so estimate prior mean
    # from the initial alpha/beta ratio. For edges that haven't moved
    # much, this is close to the ontology strength.
    # For heavily updated edges, the prior is less important anyway.
    prior_mean = 0.5  # fallback for discovered edges

    if edge.relation == "prerequisite":
        prior_mean = 0.9  # most prereqs start high
    elif edge.relation == "related":
        prior_mean = 0.4
    elif edge.relation == "application":
        prior_mean = 0.5

    alpha_prior = prior_mean * pseudo_total
    beta_prior = (1 - prior_mean) * pseudo_total

    # Decay only the evidence (difference from prior)
    alpha_evidence = edge.alpha - alpha_prior
    beta_evidence = edge.beta - beta_prior

    new_alpha = alpha_prior + alpha_evidence * factor
    new_beta = beta_prior + beta_evidence * factor

    # Ensure non-negative
    new_alpha = max(0.1, new_alpha)
    new_beta = max(0.1, new_beta)

    return edge.model_copy(update={
        "alpha": new_alpha,
        "beta": new_beta,
    })


def decay_all_edges(
    edges: dict[str, EdgeState],
    now: datetime,
    half_life_days: float = EDGE_HALF_LIFE_DAYS,
) -> dict[str, EdgeState]:
    """Decay all edge evidence for a student's personal graph."""
    return {
        key: decay_edge(edge, now, half_life_days)
        for key, edge in edges.items()
    }
