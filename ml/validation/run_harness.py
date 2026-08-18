"""Predictive-validity harness CLI (the I/O wiring).

Loads per-question attempt observations from Firestore and runs all three pieces,
emitting INSUFFICIENT_DATA gracefully when volume is too low. Firestore is
imported lazily here only — the pure-function core stays offline-testable.

    python -m validation.run_harness <student_id>
    python -m validation.run_harness --all

This is scaffolding: it is correct and ready, but with n~1 student the numbers are
noise. Do not interpret output yet.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from .calibration import calibration_report
from .replay import build_replay_table
from .separability import separability_report


def _difficulty_by_concept() -> dict[str, float]:
    path = Path(__file__).parents[1] / "data" / "ontology_complete.json"
    data = json.loads(path.read_text())
    return {
        concept["id"]: float(concept["population_failure_prior"]["overall"])
        for concept in data["concepts"]
    }


def _brier(rows, prediction) -> float | None:
    if not rows:
        return None
    return round(sum((prediction(row) - row.actual_outcome) ** 2 for row in rows) / len(rows), 4)


def _load_observations(student_ids: list[str] | None) -> list[dict]:
    """Load attempt observations for given students (or all), failing soft."""
    try:
        from mindcraft_graph.firestore_adapter import db, load_attempt_observations
    except Exception as e:  # no creds / no firestore — return nothing, run empty
        print(f"[harness] firestore unavailable ({e}); running on empty data", file=sys.stderr)
        return []

    if student_ids:
        out: list[dict] = []
        for sid in student_ids:
            out.extend(load_attempt_observations(sid))
        return out

    # --all: discover distinct students from the observation collection.
    try:
        ids = {
            (d.to_dict() or {}).get("studentId")
            for d in db.collection("attempt_observations").stream()
        }
        ids.discard(None)
        out = []
        for sid in ids:
            out.extend(load_attempt_observations(sid))
        return out
    except Exception as e:
        print(f"[harness] failed to discover students ({e})", file=sys.stderr)
        return []


def run(student_ids: list[str] | None) -> dict:
    observations = _load_observations(student_ids)
    rows = build_replay_table(observations, _difficulty_by_concept())
    base_rate = sum(r.actual_outcome for r in rows) / len(rows) if rows else None
    # Imported here to avoid a module cycle: fit_predictor reuses the I/O helpers
    # above, while the CLI must expose its complete four-arm evaluation.
    from .fit_predictor import report as predictor_report

    predictor_evaluation = predictor_report(observations)
    return {
        "students": student_ids or "ALL",
        "observations": len(observations),
        "replay_rows": len(rows),
        "base_rate": round(base_rate, 4) if base_rate is not None else None,
        "brier_mastery_baseline": _brier(rows, lambda row: row.concept_mastery_before),
        "brier_constant": _brier(rows, lambda _row: base_rate),
        "brier_predictor": _brier(rows, lambda row: row.predicted),
        "predictor_evaluation": predictor_evaluation,
        "calibration_concept": calibration_report(rows, field="concept"),
        "calibration_format": calibration_report(rows, field="format"),
        "format_separability": separability_report(rows),
    }


def main(argv: list[str]) -> int:
    if not argv:
        print(__doc__)
        return 2
    student_ids = None if argv[0] == "--all" else argv
    print(json.dumps(run(student_ids), indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
