from __future__ import annotations

from pathlib import Path
from typing import Any

import numpy as np

from mindcraft_graph.models.concept import Concept, Ontology

DEFAULT_MODEL_NAME = "all-MiniLM-L6-v2"
DEFAULT_EMBEDDING_DIM = 384


def load_sentence_transformer(
    model_name: str = DEFAULT_MODEL_NAME,
    device: str | None = None,
) -> Any:
    """Load a local sentence-transformer model for concept embedding."""
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise ImportError(
            "sentence-transformers is required to build concept embeddings. "
            "Install it in the ml environment: pip install sentence-transformers"
        ) from exc

    if device is None:
        device = _default_device()

    return SentenceTransformer(model_name, device=device)


def _default_device() -> str:
    try:
        import torch

        return "cuda" if torch.cuda.is_available() else "cpu"
    except ImportError:
        return "cpu"


def make_concept_text(concept: Concept) -> str:
    """Build the text prompt for a single concept using name + description."""
    if concept.description:
        return f"{concept.name}. {concept.description.strip()}"
    return concept.name


def embed_texts(
    model: Any,
    texts: list[str],
    batch_size: int = 64,
) -> np.ndarray:
    """Encode a list of texts to dense vectors using the loaded model."""
    embeddings = model.encode(
        texts,
        batch_size=batch_size,
        show_progress_bar=False,
        convert_to_numpy=True,
    )
    return np.asarray(embeddings, dtype=np.float32)


def compute_concept_embeddings(
    ontology: Ontology,
    model: Any,
    batch_size: int = 64,
) -> dict[str, np.ndarray]:
    """Return concept_id → vector for every ontology concept."""
    texts = [make_concept_text(concept) for concept in ontology.concepts]
    embeddings = embed_texts(model, texts, batch_size=batch_size)

    if embeddings.ndim != 2 or embeddings.shape[1] != DEFAULT_EMBEDDING_DIM:
        raise ValueError(
            f"Expected embeddings with shape (N, {DEFAULT_EMBEDDING_DIM}), "
            f"got {embeddings.shape}"
        )

    return {
        concept.id: embedding
        for concept, embedding in zip(ontology.concepts, embeddings)
    }


def compute_pca_axes(
    concept_embeddings: dict[str, np.ndarray],
    n_components: int = 4,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute PCA axes over all concept vectors.

    Returns:
    - components: shape (n_components, embedding_dim)
    - mean_vector: shape (embedding_dim,)
    - explained_variance_ratio: shape (n_components,)
    """
    if not concept_embeddings:
        raise ValueError("concept_embeddings must not be empty")

    matrix = np.stack(list(concept_embeddings.values()))
    if matrix.shape[0] <= n_components:
        raise ValueError(
            f"Need more concepts than PCA components: {matrix.shape[0]} concepts, "
            f"asked for {n_components} components"
        )

    mean_vector = matrix.mean(axis=0)
    centered = matrix - mean_vector

    _, singular_values, vt = np.linalg.svd(centered, full_matrices=False)
    components = vt[:n_components]
    explained_variance_ratio = (singular_values**2) / np.sum(singular_values**2)

    return components, mean_vector, explained_variance_ratio[:n_components]


def project_vectors_onto_axes(
    vectors: np.ndarray,
    pca_components: np.ndarray,
    mean_vector: np.ndarray,
) -> np.ndarray:
    """Project vectors onto previously computed PCA axes."""
    if vectors.ndim == 1:
        vectors = vectors.reshape(1, -1)

    if vectors.shape[1] != mean_vector.shape[0]:
        raise ValueError(
            f"Vectors must have dimension {mean_vector.shape[0]}, got {vectors.shape[1]}"
        )

    centered = vectors - mean_vector
    return centered @ pca_components.T


def project_concept_embeddings(
    concept_embeddings: dict[str, np.ndarray],
    pca_components: np.ndarray,
    mean_vector: np.ndarray,
) -> dict[str, np.ndarray]:
    """Project each concept embedding onto the PCA axes."""
    matrix = np.stack(list(concept_embeddings.values()))
    projected = project_vectors_onto_axes(matrix, pca_components, mean_vector)
    return {
        concept_id: projection
        for concept_id, projection in zip(concept_embeddings.keys(), projected)
    }


def summarize_pca_axes(
    concept_embeddings: dict[str, np.ndarray],
    pca_components: np.ndarray,
    mean_vector: np.ndarray,
    explained_variance_ratio: np.ndarray,
    axis_labels: list[str] | None = None,
    top_n: int = 6,
) -> list[dict[str, Any]]:
    """Summarize PCA axes by top positive and negative concept loadings."""
    axis_labels = axis_labels or [f"Axis {i + 1}" for i in range(pca_components.shape[0])]
    projections = project_vectors_onto_axes(
        np.stack(list(concept_embeddings.values())),
        pca_components,
        mean_vector,
    )

    summary = []
    concept_ids = list(concept_embeddings.keys())

    for idx, label in enumerate(axis_labels):
        axis_scores = projections[:, idx]
        top_pos = sorted(
            zip(concept_ids, axis_scores),
            key=lambda pair: -pair[1],
        )[:top_n]
        top_neg = sorted(
            zip(concept_ids, axis_scores),
            key=lambda pair: pair[1],
        )[:top_n]

        summary.append({
            "axis_index": idx,
            "axis_label": label,
            "explained_variance_ratio": float(explained_variance_ratio[idx]),
            "top_positive_concepts": [
                {"concept_id": cid, "score": float(score)}
                for cid, score in top_pos
            ],
            "top_negative_concepts": [
                {"concept_id": cid, "score": float(score)}
                for cid, score in top_neg
            ],
        })

    return summary


def plot_embedding_space(
    projected_concepts: dict[str, np.ndarray],
    student_projections: dict[str, np.ndarray] | None = None,
    axis_labels: list[str] | None = None,
    output_path: Path | str | None = None,
    label_top_n: int = 20,
) -> None:
    """Plot concept embeddings on the first two PCA axes and optionally student placements."""
    try:
        import matplotlib.pyplot as plt
    except ImportError as exc:
        raise ImportError(
            "matplotlib is required to plot the embedding space. "
            "Install it in the ml environment: pip install matplotlib"
        ) from exc

    projected_matrix = np.stack(list(projected_concepts.values()))
    if projected_matrix.shape[1] < 2:
        raise ValueError("Need at least 2 PCA axes to visualize the embedding space.")

    names = list(projected_concepts.keys())
    x = projected_matrix[:, 0]
    y = projected_matrix[:, 1]

    fig, ax = plt.subplots(figsize=(12, 9))
    ax.scatter(x, y, alpha=0.55, s=40, color="tab:blue", label="Concepts")

    student_projections = student_projections or {}
    student_colors = {
        "mastery": "tab:red",
        "strength": "tab:orange",
    }

    plotted_points: dict[str, tuple[float, float]] = {}
    for label, projection in student_projections.items():
        if projection.ndim == 1:
            sx, sy = float(projection[0]), float(projection[1])
        else:
            sx, sy = float(projection[0, 0]), float(projection[0, 1])

        plotted_points[label] = (sx, sy)
        ax.scatter(
            [sx], [sy],
            color=student_colors.get(label, "tab:red"),
            s=120,
            marker="*",
            label=f"Alice ({label})",
        )
        ax.text(sx, sy, label, fontsize=12, fontweight="bold", va="bottom", ha="right")

    if "mastery" in plotted_points and "strength" in plotted_points:
        mx, my = plotted_points["mastery"]
        sx, sy = plotted_points["strength"]
        ax.annotate(
            "",
            xy=(sx, sy),
            xytext=(mx, my),
            arrowprops={"arrowstyle": "->", "color": "tab:purple", "lw": 2, "alpha": 0.8},
        )
        midx, midy = (mx + sx) / 2, (my + sy) / 2
        ax.text(
            midx,
            midy,
            "effort→strength",
            fontsize=10,
            color="tab:purple",
            ha="center",
            va="center",
            bbox={"facecolor": "white", "alpha": 0.7, "edgecolor": "none", "pad": 0.5},
        )

    distances = np.linalg.norm(projected_matrix[:, :2], axis=1)
    top_indices = np.argsort(distances)[-label_top_n:]
    for idx in top_indices:
        ax.text(x[idx], y[idx], names[idx], fontsize=8, alpha=0.8)

    axis_labels = axis_labels or ["PC 1", "PC 2"]
    ax.set_xlabel(axis_labels[0])
    ax.set_ylabel(axis_labels[1])
    ax.set_title("Concept embedding PCA space")
    ax.grid(True, linestyle="--", alpha=0.3)
    ax.legend(loc="best")

    if output_path is not None:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        fig.savefig(output_path, dpi=150, bbox_inches="tight")
        plt.close(fig)
    else:
        plt.show()


def save_concept_embeddings(
    concept_embeddings: dict[str, np.ndarray],
    path: Path | str,
) -> None:
    """Persist embeddings as compressed numpy arrays with ids metadata."""
    path = Path(path)
    ids = np.array(list(concept_embeddings.keys()), dtype=object)
    vectors = np.stack(list(concept_embeddings.values()))
    np.savez_compressed(path, concept_ids=ids, embeddings=vectors)


def load_concept_embeddings(path: Path | str) -> dict[str, np.ndarray]:
    """Load a saved concept embedding matrix from disk."""
    path = Path(path)
    data = np.load(path, allow_pickle=True)
    ids = list(data["concept_ids"])
    vectors = data["embeddings"]
    return {concept_id: vector for concept_id, vector in zip(ids, vectors)}


def save_pca_axes(
    pca_components: np.ndarray,
    mean_vector: np.ndarray,
    explained_variance_ratio: np.ndarray,
    path: Path | str,
) -> None:
    """Persist PCA axes and mean vector for later explainability."""
    path = Path(path)
    np.savez_compressed(
        path,
        components=pca_components,
        mean_vector=mean_vector,
        explained_variance_ratio=explained_variance_ratio,
    )


def load_pca_axes(path: Path | str) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Load saved PCA axes, mean vector, and variance ratios."""
    path = Path(path)
    data = np.load(path, allow_pickle=True)
    return data["components"], data["mean_vector"], data["explained_variance_ratio"]
