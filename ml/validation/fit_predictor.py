"""Fit and evaluate the item-aware predictor with leave-one-student-out CV.

Usage: ``python -m validation.fit_predictor --all`` or pass student IDs.
"""
from __future__ import annotations

import json
import sys

import numpy as np

from .predictor import ItemParams, PredictorParams, ThetaInputs, predict
from .replay import ReplayRow, build_replay_table
from .run_harness import _difficulty_by_concept, _load_observations


def brier(rows: list[ReplayRow], params: PredictorParams) -> float:
    if not rows:
        return float("nan")
    return sum(
        (
            predict(
                ThetaInputs(row.concept_mastery_before, row.format_mastery_before),
                ItemParams(row.item_difficulty, row.level),
                params,
            )
            - row.actual_outcome
        ) ** 2
        for row in rows
    ) / len(rows)


def fit(rows: list[ReplayRow]) -> PredictorParams:
    """Fit four bounded global parameters by Brier minimization."""
    try:
        from scipy.optimize import minimize
    except ImportError as exc:  # scipy is part of the project's ml extra
        raise RuntimeError("fit_predictor requires scipy (install the ml extra)") from exc

    def objective(values: np.ndarray) -> float:
        return brier(rows, PredictorParams(*map(float, values)))

    result = minimize(
        objective,
        x0=np.array([4.0, 1.0, 0.0, 0.1]),
        method="L-BFGS-B",
        bounds=[(0.05, 20.0), (-5.0, 5.0), (-5.0, 5.0), (-2.0, 2.0)],
    )
    if not result.success:
        raise RuntimeError(f"predictor fit failed: {result.message}")
    return PredictorParams(*map(float, result.x))


def report(observations: list[dict]) -> dict:
    rows = build_replay_table(observations, _difficulty_by_concept())
    students = sorted({row.student_id for row in rows})
    all_params = fit(rows)
    folds = []
    for student_id in students:
        held_out = [row for row in rows if row.student_id == student_id]
        training = [row for row in rows if row.student_id != student_id]
        if not training:
            folds.append({"student_id": student_id, "status": "INSUFFICIENT_TRAINING_STUDENTS"})
            continue
        params = fit(training)
        train_brier = brier(training, params)
        held_out_brier = brier(held_out, params)
        gap = held_out_brier - train_brier
        training_rate = sum(r.actual_outcome for r in training) / len(training)
        constant_brier = sum(
            (training_rate - r.actual_outcome) ** 2 for r in held_out
        ) / len(held_out)
        folds.append({
            "student_id": student_id,
            "train_n": len(training),
            "held_out_n": len(held_out),
            "train_brier": round(train_brier, 4),
            "held_out_brier": round(held_out_brier, 4),
            "generalization_gap": round(gap, 4),
            "held_out_constant_brier": round(constant_brier, 4),
            "beats_constant_held_out": held_out_brier < constant_brier,
            "assessment": (
                "Held-out performance is substantially worse than in-sample; likely overfit."
                if gap > 0.05
                else "No wide in-sample/held-out gap in this fold."
            ),
            "params": params.__dict__,
        })
    return {
        "observations": len(rows),
        "students": len(students),
        "in_sample_brier": round(brier(rows, all_params), 4),
        "in_sample_params": all_params.__dict__,
        "held_out_by_student": folds,
        "warning": "Held-out results are intentionally per student and are not pooled.",
    }


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    student_ids = None if argv[0] == "--all" else argv
    observations = _load_observations(student_ids)
    if not observations:
        print(json.dumps({"status": "INSUFFICIENT_DATA", "observations": 0}, indent=2))
        return 0
    print(json.dumps(report(observations), indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
