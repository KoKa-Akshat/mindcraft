"""Fit and evaluate the item-aware predictor with leave-one-student-out CV.

Usage: ``python -m validation.fit_predictor --all`` or pass student IDs.
"""

from __future__ import annotations

import json
import sys
from collections.abc import Iterable

import numpy as np

from .predictor import (
    IngredientAggregator,
    IngredientPredictorParams,
    ItemParams,
    PredictorParams,
    ThetaInputs,
    predict,
    predict_ingredient,
)
from .replay import ReplayRow, build_replay_table
from .run_harness import _difficulty_by_concept, _load_observations

# Harness-only and deployment-smoke identities are not learners. Keep this
# policy explicit and report exclusions so evaluation data never disappears
# silently. Add known non-student prefixes here as they are introduced.
NON_STUDENT_ID_PREFIXES = ("deploy_smoke_",)


def is_student_observation(observation: dict) -> bool:
    """Return whether an observation belongs in the learner evaluation corpus."""
    student_id = str(observation.get("student_id") or "")
    return bool(student_id) and not student_id.startswith(NON_STUDENT_ID_PREFIXES)


def filter_student_observations(observations: Iterable[dict]) -> tuple[list[dict], list[str]]:
    """Remove known non-student identities and return their IDs for reporting."""
    kept: list[dict] = []
    excluded: set[str] = set()
    for observation in observations:
        if is_student_observation(observation):
            kept.append(observation)
        else:
            excluded.add(str(observation.get("student_id") or "<missing>"))
    return kept, sorted(excluded)


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
        )
        ** 2
        for row in rows
    ) / len(rows)


def ingredient_brier(
    rows: list[ReplayRow],
    params: IngredientPredictorParams,
    aggregator: IngredientAggregator,
) -> float:
    if not rows:
        return float("nan")
    return sum(
        (
            predict_ingredient(
                ingredient_mastery=row.ingredient_mastery_before,
                concept_mastery_fallback=row.concept_mastery_before,
                item=ItemParams(row.item_difficulty, row.level),
                params=params,
                aggregator=aggregator,
            )
            - row.actual_outcome
        )
        ** 2
        for row in rows
    ) / len(rows)


def fit(rows: list[ReplayRow]) -> PredictorParams:
    """Fit the pre-registered two-parameter model by Brier minimization.

    Format weight and level scale are fixed at exactly zero. They are not
    bounded nuisance parameters: Stage 1 showed that neither is identified at
    the current data volume and that global format mastery is mis-specified as
    a per-concept ability input.
    """
    try:
        from scipy.optimize import minimize
    except ImportError as exc:  # scipy is part of the project's ml extra
        raise RuntimeError("fit_predictor requires scipy (install the ml extra)") from exc

    def objective(values: np.ndarray) -> float:
        discrimination, concept_weight = map(float, values)
        return brier(
            rows,
            PredictorParams(
                discrimination=discrimination,
                concept_weight=concept_weight,
                format_weight=0.0,
                level_scale=0.0,
            ),
        )

    result = minimize(
        objective,
        x0=np.array([4.0, 1.0]),
        method="L-BFGS-B",
        bounds=[(0.05, 20.0), (-5.0, 5.0)],
    )
    if not result.success:
        raise RuntimeError(f"predictor fit failed: {result.message}")
    discrimination, concept_weight = map(float, result.x)
    return PredictorParams(
        discrimination=discrimination,
        concept_weight=concept_weight,
        format_weight=0.0,
        level_scale=0.0,
    )


def fit_ingredient(
    rows: list[ReplayRow], aggregator: IngredientAggregator
) -> IngredientPredictorParams:
    """Fit one deterministic, two-parameter ingredient comparison arm."""
    try:
        from scipy.optimize import minimize
    except ImportError as exc:
        raise RuntimeError("fit_predictor requires scipy (install the ml extra)") from exc

    def objective(values: np.ndarray) -> float:
        return ingredient_brier(
            rows,
            IngredientPredictorParams(*map(float, values)),
            aggregator,
        )

    result = minimize(
        objective,
        x0=np.array([4.0, 1.0]),
        method="L-BFGS-B",
        bounds=[(0.05, 20.0), (-5.0, 5.0)],
    )
    if not result.success:
        raise RuntimeError(f"ingredient {aggregator} fit failed: {result.message}")
    return IngredientPredictorParams(*map(float, result.x))


ARMS = ("constant", "concept_mastery", "ingredient_min", "ingredient_mean")
SCOPES = ("all_rows", "resolved_rows", "human_only", "any_llm", "other")


def _scope_rows(rows: list[ReplayRow], scope: str) -> list[ReplayRow]:
    if scope == "all_rows":
        return rows
    if scope == "resolved_rows":
        return [row for row in rows if row.ingredient_resolved]
    return [row for row in rows if row.ingredient_provenance == scope]


def _scores(
    rows: list[ReplayRow],
    *,
    constant: float,
    concept_params: PredictorParams,
    min_params: IngredientPredictorParams,
    mean_params: IngredientPredictorParams,
) -> dict:
    if not rows:
        return {"observations": 0, **{arm: None for arm in ARMS}}
    return {
        "observations": len(rows),
        "constant": round(sum((constant - row.actual_outcome) ** 2 for row in rows) / len(rows), 4),
        "concept_mastery": round(brier(rows, concept_params), 4),
        "ingredient_min": round(ingredient_brier(rows, min_params, "min"), 4),
        "ingredient_mean": round(ingredient_brier(rows, mean_params, "mean"), 4),
    }


def _scoped_scores(
    rows: list[ReplayRow],
    *,
    constant: float,
    concept_params: PredictorParams,
    min_params: IngredientPredictorParams,
    mean_params: IngredientPredictorParams,
) -> dict:
    return {
        scope: _scores(
            _scope_rows(rows, scope),
            constant=constant,
            concept_params=concept_params,
            min_params=min_params,
            mean_params=mean_params,
        )
        for scope in SCOPES
    }


def _losses(
    row: ReplayRow,
    *,
    constant: float,
    concept_params: PredictorParams,
    min_params: IngredientPredictorParams,
    mean_params: IngredientPredictorParams,
) -> dict[str, float]:
    actual = row.actual_outcome
    concept_prediction = predict(
        ThetaInputs(row.concept_mastery_before, row.format_mastery_before),
        ItemParams(row.item_difficulty, row.level),
        concept_params,
    )
    min_prediction = predict_ingredient(
        ingredient_mastery=row.ingredient_mastery_before,
        concept_mastery_fallback=row.concept_mastery_before,
        item=ItemParams(row.item_difficulty, row.level),
        params=min_params,
        aggregator="min",
    )
    mean_prediction = predict_ingredient(
        ingredient_mastery=row.ingredient_mastery_before,
        concept_mastery_fallback=row.concept_mastery_before,
        item=ItemParams(row.item_difficulty, row.level),
        params=mean_params,
        aggregator="mean",
    )
    return {
        "constant": (constant - actual) ** 2,
        "concept_mastery": (concept_prediction - actual) ** 2,
        "ingredient_min": (min_prediction - actual) ** 2,
        "ingredient_mean": (mean_prediction - actual) ** 2,
    }


def report(observations: list[dict]) -> dict:
    student_observations, excluded_student_ids = filter_student_observations(observations)
    rows = build_replay_table(student_observations, _difficulty_by_concept())
    if not rows:
        return {
            "status": "INSUFFICIENT_DATA",
            "observations": 0,
            "excluded_observations": len(observations),
            "excluded_student_ids": excluded_student_ids,
        }
    students = sorted({row.student_id for row in rows})
    all_params = fit(rows)
    all_min_params = fit_ingredient(rows, "min")
    all_mean_params = fit_ingredient(rows, "mean")
    base_rate = sum(row.actual_outcome for row in rows) / len(rows)
    in_sample = _scoped_scores(
        rows,
        constant=base_rate,
        concept_params=all_params,
        min_params=all_min_params,
        mean_params=all_mean_params,
    )
    in_sample_per_student = {
        student_id: _scoped_scores(
            [row for row in rows if row.student_id == student_id],
            constant=base_rate,
            concept_params=all_params,
            min_params=all_min_params,
            mean_params=all_mean_params,
        )
        for student_id in students
    }
    folds = []
    held_out_losses: dict[str, dict[str, list[float]]] = {
        scope: {arm: [] for arm in ARMS} for scope in SCOPES
    }
    for student_id in students:
        held_out = [row for row in rows if row.student_id == student_id]
        training = [row for row in rows if row.student_id != student_id]
        if not training:
            folds.append({"student_id": student_id, "status": "INSUFFICIENT_TRAINING_STUDENTS"})
            continue
        params = fit(training)
        min_params = fit_ingredient(training, "min")
        mean_params = fit_ingredient(training, "mean")
        training_rate = sum(r.actual_outcome for r in training) / len(training)
        training_scores = _scoped_scores(
            training,
            constant=training_rate,
            concept_params=params,
            min_params=min_params,
            mean_params=mean_params,
        )
        held_out_scores = _scoped_scores(
            held_out,
            constant=training_rate,
            concept_params=params,
            min_params=min_params,
            mean_params=mean_params,
        )
        for scope in SCOPES:
            for row in _scope_rows(held_out, scope):
                for arm, loss in _losses(
                    row,
                    constant=training_rate,
                    concept_params=params,
                    min_params=min_params,
                    mean_params=mean_params,
                ).items():
                    held_out_losses[scope][arm].append(loss)
        folds.append(
            {
                "student_id": student_id,
                "train_n": len(training),
                "held_out_n": len(held_out),
                "training": training_scores,
                "held_out": held_out_scores,
                "generalization_gap_all_rows": {
                    arm: round(
                        held_out_scores["all_rows"][arm] - training_scores["all_rows"][arm], 4
                    )
                    for arm in ARMS
                },
                "params": {
                    "concept_mastery": params.__dict__,
                    "ingredient_min": min_params.__dict__,
                    "ingredient_mean": mean_params.__dict__,
                },
            }
        )

    held_out_weighted = {
        scope: {
            "observations": len(held_out_losses[scope]["constant"]),
            **{
                arm: (
                    round(sum(held_out_losses[scope][arm]) / len(held_out_losses[scope][arm]), 4)
                    if held_out_losses[scope][arm]
                    else None
                )
                for arm in ARMS
            },
        }
        for scope in SCOPES
    }
    resolution_rate = sum(row.ingredient_resolved for row in rows) / len(rows)
    return {
        "observations": len(rows),
        "excluded_observations": len(observations) - len(student_observations),
        "excluded_student_ids": excluded_student_ids,
        "students": len(students),
        "model": "pre_registered_2_parameter",
        "ingredient_models": ["min_primary", "mean_secondary"],
        "resolution": {
            "resolved": sum(row.ingredient_resolved for row in rows),
            "total": len(rows),
            "rate": round(resolution_rate, 4),
            "informative": resolution_rate >= 0.5,
            "warning": (
                None
                if resolution_rate >= 0.5
                else "Resolution is below 50%; model comparisons are uninformative."
            ),
        },
        "in_sample_brier": round(brier(rows, all_params), 4),
        "in_sample_params": all_params.__dict__,
        "in_sample": {
            "observation_weighted": in_sample,
            "per_student": in_sample_per_student,
            "params": {
                "concept_mastery": all_params.__dict__,
                "ingredient_min": all_min_params.__dict__,
                "ingredient_mean": all_mean_params.__dict__,
            },
        },
        "held_out_by_student": folds,
        "held_out_observation_weighted": {
            **held_out_weighted,
            "observations": held_out_weighted["all_rows"]["observations"],
        },
        "generalization_gap": {
            arm: (
                round(held_out_weighted["all_rows"][arm] - in_sample["all_rows"][arm], 4)
                if held_out_weighted["all_rows"][arm] is not None
                else None
            )
            for arm in ARMS
        },
        "warning": (
            "This pre-registered run is plumbing at founder-dominated n; no win is "
            "promotion evidence. Per-student folds and resolved/provenance scopes are primary."
        ),
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
