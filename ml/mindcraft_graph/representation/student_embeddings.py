# mindcraft_graph/representation/student_embedding.py

import numpy as np
from mindcraft_graph.engine.features import ConceptProfile
from mindcraft_graph.engine.student_graph import PersonalGraph
from mindcraft_graph.models.student_state import ConceptMastery


def compute_student_embedding(
    graph: PersonalGraph,
    concept_embeddings: dict[str, np.ndarray],
) -> np.ndarray:
    """
    Mastery-weighted centroid of concept embeddings.
    
    s = Σ m_i · e_i  (normalized)
    
    Concepts with zero mastery or no embedding are excluded.
    """
    weighted_sum = np.zeros_like(next(iter(concept_embeddings.values())))
    total_weight = 0.0

    for concept_id, cm in graph.state.mastery_by_concept.items():
        if concept_id not in concept_embeddings:
            continue
        if cm.mastery <= 0:
            continue

        weighted_sum += cm.mastery * concept_embeddings[concept_id]
        total_weight += cm.mastery

    if total_weight == 0:
        return weighted_sum  # zero vector — no signal yet

    student_vec = weighted_sum / total_weight
    # Normalize to unit vector for cosine comparisons
    norm = np.linalg.norm(student_vec)
    if norm > 0:
        student_vec = student_vec / norm

    return student_vec


def compute_student_embedding_from_mastery(
    mastery_by_concept: dict[str, ConceptMastery],
    concept_embeddings: dict[str, np.ndarray],
) -> np.ndarray:
    """Build a student embedding from raw mastery values."""
    weighted_sum = np.zeros_like(next(iter(concept_embeddings.values())))
    total_weight = 0.0

    for concept_id, cm in mastery_by_concept.items():
        if concept_id not in concept_embeddings:
            continue
        if cm.mastery <= 0:
            continue

        weighted_sum += cm.mastery * concept_embeddings[concept_id]
        total_weight += cm.mastery

    if total_weight == 0:
        return weighted_sum

    student_vec = weighted_sum / total_weight
    norm = np.linalg.norm(student_vec)
    if norm > 0:
        student_vec = student_vec / norm

    return student_vec


def compute_student_embedding_from_profiles(
    concept_profiles: dict[str, ConceptProfile],
    concept_embeddings: dict[str, np.ndarray],
) -> np.ndarray:
    """Build a student embedding weighted by signed profile strength scores."""
    weighted_sum = np.zeros_like(next(iter(concept_embeddings.values())))
    total_weight = 0.0

    for concept_id, profile in concept_profiles.items():
        if concept_id not in concept_embeddings:
            continue

        weight = profile.strength_score
        if weight == 0:
            continue

        weighted_sum += weight * concept_embeddings[concept_id]
        total_weight += abs(weight)

    if total_weight == 0:
        return weighted_sum

    student_vec = weighted_sum / total_weight
    norm = np.linalg.norm(student_vec)
    if norm > 0:
        student_vec = student_vec / norm

    return student_vec


def project_onto_axes(
    student_vec: np.ndarray,
    pca_components: np.ndarray,  # shape (n_components, embedding_dim)
    axis_labels: list[str],
    mean_vector: np.ndarray | None = None,
) -> dict[str, float]:
    """
    Project the student embedding onto PCA axes.
    
    Returns a dict like:
    {
        "algebraic ↔ geometric": 0.72,
        "procedural ↔ conceptual": -0.31,
        "discrete ↔ continuous": 0.15,
    }
    """
    if mean_vector is not None:
        student_vec = student_vec - mean_vector

    projections = pca_components @ student_vec  # dot product per axis
    return {label: float(proj) for label, proj in zip(axis_labels, projections)}