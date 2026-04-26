# mindcraft_graph/api/recommend.py

"""
Top-level recommendation API.

Wraps the pathfinder with PCA-based explanations for each recommendation.
This is the function the frontend calls.
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.engine.student_graph import PersonalGraph
from mindcraft_graph.engine.features import ConceptProfile, compute_concept_profiles
from mindcraft_graph.planning.goal import Goal
from mindcraft_graph.planning.pathfinder import find_path
from mindcraft_graph.representation.student_embeddings import (
    compute_student_embedding_from_mastery,
    compute_student_embedding_from_profiles,
)


# ── PCA axis labels derived from embedding analysis ──
DEFAULT_AXIS_LABELS = [
    "applied/geometric ↔ algebraic/symbolic",
    "probabilistic/functional ↔ trigonometric/spatial",
    "calculus/applied ↔ statistical/discrete",
    "analytic/exponential ↔ linear-algebraic/structural",
]


@dataclass
class ConceptRecommendation:
    """One recommended concept with explanation."""
    concept_id: str
    reason: str                          # human-readable explanation
    position_in_chain: int | None        # index in prerequisite chain, None for explore
    is_supplement: bool                  # True if this is an analog, not on the main chain
    supplement_for: str | None           # which chain concept this supplements
    alignment_score: float | None        # cosine sim with strength vector
    pca_profile: dict[str, float]        # projection onto named PCA axes


@dataclass
class StudentProfile:
    """Summary of student's current position for the frontend."""
    mastery_projection: dict[str, float]   # PCA projection of mastery embedding
    strength_projection: dict[str, float]  # PCA projection of strength embedding
    displacement_magnitude: float          # length of mastery→strength arrow
    displacement_direction: dict[str, float]  # which axes the arrow points along
    top_strengths: list[tuple[str, float]]   # (concept_id, strength_score)
    top_weaknesses: list[tuple[str, float]]  # (concept_id, strength_score)


@dataclass
class RecommendationResult:
    """Complete recommendation response."""
    mode: str
    target_concepts: list[str]
    canonical_chain: list[str]
    recommendations: list[ConceptRecommendation]
    student_profile: StudentProfile
    debug: dict = field(default_factory=dict)


def recommend(
    graph: PersonalGraph,
    goal: Goal,
    events: list,
    concept_embeddings: dict[str, np.ndarray],
    pca_components: np.ndarray,
    pca_mean: np.ndarray,
    ontology: Ontology,
    axis_labels: list[str] | None = None,
) -> RecommendationResult:
    """
    Main entry point for the recommendation system.

    Takes a student's personal graph, a goal, and the shared
    representation artifacts. Returns a structured recommendation
    with explanations.
    """
    axis_labels = axis_labels or DEFAULT_AXIS_LABELS

    # ── Compute student representations ──
    profiles = compute_concept_profiles(events)

    mastery_vec = compute_student_embedding_from_mastery(
        graph.state.mastery_by_concept, concept_embeddings,
    )
    strength_vec = compute_student_embedding_from_profiles(
        profiles, concept_embeddings,
    )

    # ── Project student into PCA space ──
    mastery_proj = _project_and_label(mastery_vec, pca_components, pca_mean, axis_labels)
    strength_proj = _project_and_label(strength_vec, pca_components, pca_mean, axis_labels)

    # Displacement vector
    displacement = {
        axis: strength_proj[axis] - mastery_proj[axis]
        for axis in axis_labels
    }
    displacement_mag = float(np.linalg.norm([v for v in displacement.values()]))

    # Top strengths and weaknesses
    sorted_profiles = sorted(profiles.items(), key=lambda x: x[1].strength_score, reverse=True)
    top_strengths = [
        (cid, p.strength_score) for cid, p in sorted_profiles
        if p.strength_score > 0 and p.event_count > 0
    ][:5]
    top_weaknesses = [
        (cid, p.strength_score) for cid, p in reversed(sorted_profiles)
        if p.strength_score < 0 and p.event_count > 0
    ][:5]

    student_profile = StudentProfile(
        mastery_projection=mastery_proj,
        strength_projection=strength_proj,
        displacement_magnitude=displacement_mag,
        displacement_direction=displacement,
        top_strengths=top_strengths,
        top_weaknesses=top_weaknesses,
    )

    # ── Run pathfinder ──
    path_result = find_path(
        graph, goal, concept_embeddings, strength_vec,
        profiles, ontology, events,
    )

    # ── Build recommendations with explanations ──
    recommendations = []

    if goal.mode == "explore":
        # Explore mode: recommendations come from the pathfinder directly
        for i, rec in enumerate(path_result.get("recommendations", [])):
            concept_id = rec["concept_id"]
            alignment = rec["alignment"]
            concept_proj = _project_concept(
                concept_id, concept_embeddings, pca_components, pca_mean, axis_labels,
            )

            reason = _generate_explore_reason(
                concept_id, alignment, concept_proj, profiles,
            )

            recommendations.append(ConceptRecommendation(
                concept_id=concept_id,
                reason=reason,
                position_in_chain=None,
                is_supplement=False,
                supplement_for=None,
                alignment_score=alignment,
                pca_profile=concept_proj,
            ))

    else:
        # Exam / Curriculum: recommendations follow the trimmed chain
        trimmed = path_result.get("trimmed_chain", [])
        supplements = path_result.get("supplements", {})

        for i, concept_id in enumerate(trimmed):
            concept_proj = _project_concept(
                concept_id, concept_embeddings, pca_components, pca_mean, axis_labels,
            )
            alignment = _compute_alignment(
                concept_id, strength_vec, concept_embeddings,
            )

            reason = _generate_chain_reason(
                concept_id, i, len(trimmed), alignment,
                concept_proj, profiles, goal,
            )

            recommendations.append(ConceptRecommendation(
                concept_id=concept_id,
                reason=reason,
                position_in_chain=i,
                is_supplement=False,
                supplement_for=None,
                alignment_score=alignment,
                pca_profile=concept_proj,
            ))

            # Add supplements for this concept if any
            if concept_id in supplements:
                for analog_id, analog_alignment in supplements[concept_id]:
                    analog_proj = _project_concept(
                        analog_id, concept_embeddings, pca_components,
                        pca_mean, axis_labels,
                    )

                    reason = _generate_supplement_reason(
                        analog_id, concept_id, analog_alignment,
                        analog_proj, student_profile,
                    )

                    recommendations.append(ConceptRecommendation(
                        concept_id=analog_id,
                        reason=reason,
                        position_in_chain=i,
                        is_supplement=True,
                        supplement_for=concept_id,
                        alignment_score=analog_alignment,
                        pca_profile=analog_proj,
                    ))

    return RecommendationResult(
        mode=goal.mode,
        target_concepts=goal.target_concepts,
        canonical_chain=path_result.get("canonical_chain", []),
        recommendations=recommendations,
        student_profile=student_profile,
        debug={
            "trimmed_chain": path_result.get("trimmed_chain", []),
            "raw_path_result": path_result,
        },
    )


# ── Explanation generators ──

def _generate_chain_reason(
    concept_id: str,
    position: int,
    chain_length: int,
    alignment: float,
    concept_proj: dict[str, float],
    profiles: dict[str, ConceptProfile],
    goal: Goal,
) -> str:
    """Generate a human-readable reason for a chain recommendation."""
    profile = profiles.get(concept_id)

    # Position context
    if position == 0:
        position_text = "This is your starting point"
    elif position == chain_length - 1:
        position_text = "This is your target"
    else:
        position_text = f"Step {position + 1} of {chain_length}"

    # Student context
    if profile and profile.strength_score < -0.1:
        student_text = "You've struggled with this before — revisiting will strengthen your foundation"
    elif profile and profile.event_count > 0:
        student_text = "You have some exposure here but need more depth"
    else:
        student_text = "This is new territory for you"

    # Alignment context
    if alignment > 0.3:
        align_text = "This aligns well with your learning strengths"
    elif alignment < -0.2:
        align_text = "This may be challenging given your current profile, but it's a necessary prerequisite"
    else:
        align_text = ""

    # Dominant PCA axis
    dominant_axis = max(concept_proj.items(), key=lambda x: abs(x[1]))
    axis_text = f"It sits on the {dominant_axis[0].split(' ↔ ')[0 if dominant_axis[1] > 0 else 1]} side of the concept space"

    parts = [position_text, student_text]
    if align_text:
        parts.append(align_text)
    parts.append(axis_text)

    return ". ".join(parts) + "."


def _generate_explore_reason(
    concept_id: str,
    alignment: float,
    concept_proj: dict[str, float],
    profiles: dict[str, ConceptProfile],
) -> str:
    """Generate a reason for an exploration recommendation."""
    profile = profiles.get(concept_id)

    if profile is None or profile.event_count == 0:
        novelty_text = "You haven't explored this yet"
    else:
        novelty_text = f"You've touched this ({profile.event_count} events) but there's more to discover"

    if alignment > 0.4:
        align_text = "It strongly matches your natural learning style"
    elif alignment > 0.2:
        align_text = "It aligns with your strengths"
    else:
        align_text = "It would broaden your skill set in a new direction"

    dominant_axis = max(concept_proj.items(), key=lambda x: abs(x[1]))
    side = "positive" if dominant_axis[1] > 0 else "negative"
    axis_name = dominant_axis[0].split(" ↔ ")
    axis_text = f"It lives in the {axis_name[0 if side == 'positive' else 1]} region of the concept space"

    return f"{novelty_text}. {align_text}. {axis_text}."


def _generate_supplement_reason(
    analog_id: str,
    chain_concept_id: str,
    alignment: float,
    analog_proj: dict[str, float],
    student_profile: StudentProfile,
) -> str:
    """Generate a reason for a supplement recommendation."""
    # Find which PCA axis the analog aligns with the student's strength
    best_axis = None
    best_match = 0.0
    for axis, student_val in student_profile.strength_projection.items():
        concept_val = analog_proj.get(axis, 0.0)
        match = student_val * concept_val  # same sign = alignment
        if match > best_match:
            best_match = match
            best_axis = axis

    if best_axis:
        axis_name = best_axis.split(" ↔ ")[0 if student_profile.strength_projection[best_axis] > 0 else 1]
        return (
            f"Alternative approach to {chain_concept_id}. "
            f"This concept teaches related skills through a {axis_name} lens, "
            f"which matches your learning profile (alignment: {alignment:.2f})."
        )
    else:
        return (
            f"Alternative approach to {chain_concept_id}. "
            f"This related concept may help build intuition from a different angle "
            f"(alignment: {alignment:.2f})."
        )


# ── Projection helpers ──

def _project_and_label(
    vec: np.ndarray,
    pca_components: np.ndarray,
    pca_mean: np.ndarray,
    axis_labels: list[str],
) -> dict[str, float]:
    """Project a vector onto PCA axes and label the result."""
    if vec.ndim == 1:
        vec = vec.reshape(1, -1)
    centered = vec - pca_mean
    projections = (centered @ pca_components.T).flatten()
    return {label: float(proj) for label, proj in zip(axis_labels, projections)}


def _project_concept(
    concept_id: str,
    concept_embeddings: dict[str, np.ndarray],
    pca_components: np.ndarray,
    pca_mean: np.ndarray,
    axis_labels: list[str],
) -> dict[str, float]:
    """Project a single concept into labeled PCA space."""
    vec = concept_embeddings.get(concept_id)
    if vec is None:
        return {label: 0.0 for label in axis_labels}
    return _project_and_label(vec, pca_components, pca_mean, axis_labels)


def _compute_alignment(
    concept_id: str,
    strength_vec: np.ndarray,
    concept_embeddings: dict[str, np.ndarray],
) -> float:
    """Cosine similarity between a concept and the student's strength vector."""
    concept_vec = concept_embeddings.get(concept_id)
    if concept_vec is None:
        return 0.0
    strength_norm = np.linalg.norm(strength_vec)
    concept_norm = np.linalg.norm(concept_vec)
    if strength_norm < 1e-8 or concept_norm < 1e-8:
        return 0.0
    return float(np.dot(strength_vec, concept_vec) / (strength_norm * concept_norm))
