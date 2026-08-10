"""Deterministic bank-neighbor classifier for problem concept and format."""

from __future__ import annotations

import json
import re
from collections import Counter
from pathlib import Path
from typing import Any

import numpy as np

from mindcraft_graph.representation import embeddings

DEFAULT_INDEX_PATH = Path(__file__).resolve().parents[1] / "data" / "bank_index.npz"
DEFAULT_META_PATH = Path(__file__).resolve().parents[1] / "data" / "bank_index_meta.json"


def strip_math_delimiters(text: str) -> str:
    text = re.sub(r"\\\((.*?)\\\)", r"\1", text)
    text = re.sub(r"\\\[(.*?)\\\]", r"\1", text)
    text = re.sub(r"\$\$(.*?)\$\$", r"\1", text)
    text = re.sub(r"\$(.*?)\$", r"\1", text)
    return re.sub(r"\s+", " ", text).strip()


def _normalize_rows(vectors: np.ndarray) -> np.ndarray:
    norms = np.linalg.norm(vectors, axis=1, keepdims=True)
    norms[norms == 0] = 1.0
    return vectors / norms


def _axis_vote(neighbors: list[dict[str, Any]], axis: str) -> tuple[str, float]:
    counts = Counter(str(row.get(axis) or "unknown") for row in neighbors)
    value, count = counts.most_common(1)[0]
    return value, count / max(1, len(neighbors))


class ProblemClassifier:
    def __init__(
        self,
        model: Any,
        index_path: Path = DEFAULT_INDEX_PATH,
        meta_path: Path = DEFAULT_META_PATH,
    ):
        if not index_path.exists() or not meta_path.exists():
            raise FileNotFoundError(
                f"Problem classifier index missing: {index_path} / {meta_path}. "
                "Run ml/scripts/build_bank_index.py first."
            )
        data = np.load(index_path)
        self.embeddings = _normalize_rows(np.asarray(data["embeddings"], dtype=np.float32))
        self.meta = json.loads(meta_path.read_text())
        if len(self.meta) != self.embeddings.shape[0]:
            raise ValueError("bank_index metadata length does not match embeddings")
        self.model = model

    def classify(self, text: str, k: int = 10) -> dict:
        if not text.strip():
            raise ValueError("text is required")
        k = max(1, min(k, len(self.meta)))
        query = embeddings.embed_texts(self.model, [strip_math_delimiters(text)])
        query = _normalize_rows(query)[0]
        scores = self.embeddings @ query
        order = np.argsort(-scores)[:k]
        neighbors = [
            {
                **self.meta[int(i)],
                "similarity": float(scores[int(i)]),
            }
            for i in order
        ]
        concept_id, concept_confidence = _axis_vote(neighbors, "conceptId")
        format_id, format_confidence = _axis_vote(neighbors, "format")
        return {
            "concept_id": concept_id,
            "format": format_id,
            "concept_confidence": concept_confidence,
            "format_confidence": format_confidence,
            "neighbors": neighbors,
        }
