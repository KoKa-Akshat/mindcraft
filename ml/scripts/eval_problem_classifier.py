#!/usr/bin/env python3
"""Evaluate the deterministic problem classifier with a stratified holdout."""

from __future__ import annotations

import json
import random
import sys
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "ml"))

from mindcraft_graph.problem_classifier import _normalize_rows  # noqa: E402
from mindcraft_graph.representation import embeddings  # noqa: E402
from scripts.build_bank_index import load_bank_rows  # noqa: E402

OUT = REPO / "ml/data/problem_classifier_eval.json"


def _vote(meta: list[dict], scores: np.ndarray, k: int, axis: str) -> tuple[str, list[str]]:
    order = np.argsort(-scores)[:k]
    values = [str(meta[int(i)].get(axis) or "unknown") for i in order]
    return Counter(values).most_common(1)[0][0], values


def main() -> int:
    rows = load_bank_rows()
    by_concept: dict[str, list[int]] = defaultdict(list)
    for idx, row in enumerate(rows):
        by_concept[row["conceptId"]].append(idx)

    rng = random.Random(7)
    holdout: set[int] = set()
    for indices in by_concept.values():
        shuffled = indices[:]
        rng.shuffle(shuffled)
        holdout.update(shuffled[:max(1, int(len(shuffled) * 0.2))])

    train = [idx for idx in range(len(rows)) if idx not in holdout]
    test = sorted(holdout)
    model = embeddings.load_sentence_transformer()
    vectors = _normalize_rows(embeddings.embed_texts(model, [row["text"] for row in rows]))

    concept_hits = 0
    concept_top3_hits = 0
    format_hits = 0
    both_error = 0
    concept_error = 0
    format_error = 0
    concept_confusion: Counter[str] = Counter()
    format_confusion: Counter[str] = Counter()

    train_vectors = vectors[train]
    train_meta = [rows[idx] for idx in train]
    for idx in test:
        row = rows[idx]
        scores = train_vectors @ vectors[idx]
        concept, concept_votes = _vote(train_meta, scores, 10, "conceptId")
        fmt, _ = _vote(train_meta, scores, 10, "format")
        concept_top3 = [value for value, _count in Counter(concept_votes).most_common(3)]
        c_ok = concept == row["conceptId"]
        f_ok = fmt == row["format"]
        concept_hits += int(c_ok)
        concept_top3_hits += int(row["conceptId"] in concept_top3)
        format_hits += int(f_ok)
        concept_error += int(not c_ok)
        format_error += int(not f_ok)
        both_error += int(not c_ok and not f_ok)
        if not c_ok:
            concept_confusion[f"{row['conceptId']} -> {concept}"] += 1
        if not f_ok:
            format_confusion[f"{row['format']} -> {fmt}"] += 1

    n = max(1, len(test))
    result = {
        "bank_count": len(rows),
        "train_count": len(train),
        "test_count": len(test),
        "concept_top1_accuracy": concept_hits / n,
        "concept_top3_accuracy": concept_top3_hits / n,
        "format_accuracy": format_hits / n,
        "error_correlation": {
            "concept_error_rate": concept_error / n,
            "format_error_rate": format_error / n,
            "both_error_rate": both_error / n,
        },
        "concept_confusion_top": concept_confusion.most_common(20),
        "format_confusion_top": format_confusion.most_common(20),
    }
    OUT.write_text(json.dumps(result, indent=2))
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
