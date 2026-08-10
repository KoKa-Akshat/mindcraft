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

from .replay import build_replay_table
from .calibration import calibration_report
from .separability import separability_report


def _load_observations(student_ids: list[str] | None) -> list[dict]:
    """Load attempt observations for given students (or all), failing soft."""
    try:
        from mindcraft_graph.firestore_adapter import load_attempt_observations, db
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
        ids = {(d.to_dict() or {}).get("studentId")
               for d in db.collection("attempt_observations").stream()}
        ids.discard(None)
        out = []
        for sid in ids:
            out.extend(load_attempt_observations(sid))
        return out
    except Exception:
        return []


def run(student_ids: list[str] | None) -> dict:
    observations = _load_observations(student_ids)
    rows = build_replay_table(observations)
    return {
        "students": student_ids or "ALL",
        "observations": len(observations),
        "replay_rows": len(rows),
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
