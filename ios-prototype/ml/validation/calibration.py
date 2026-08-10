"""Piece 2 — calibration scorer (validity test for any mastery metric).

Bins attempts by predicted mastery, compares to empirical success rate per bin
(a reliability table), and reports a scalar Brier score. Parameterizable by which
mastery field is the predictor (concept vs format) so the SAME scorer validates
both axes.

A well-calibrated mastery means: of attempts where we predicted ~0.7 mastery, ~70%
should succeed. Until enough attempts exist this returns INSUFFICIENT_DATA — never
a fabricated curve.
"""
from __future__ import annotations

from . import INSUFFICIENT_DATA
from .replay import ReplayRow

# Below this many usable attempts, a reliability curve is noise.
MIN_ATTEMPTS = 50
DEFAULT_BINS = 10


def calibration_report(
    rows: list[ReplayRow],
    field: str = "concept",
    bins: int = DEFAULT_BINS,
    min_attempts: int = MIN_ATTEMPTS,
) -> dict:
    """Reliability table + Brier score for `field` in {"concept", "format"}.

    Reads concept_mastery_before or format_mastery_before as the predictor; rows
    where the chosen predictor is missing are dropped (e.g. untagged-format rows
    for field="format").
    """
    attr = "concept_mastery_before" if field == "concept" else "format_mastery_before"
    usable = [(getattr(r, attr), r.actual_outcome) for r in rows if getattr(r, attr) is not None]

    if len(usable) < min_attempts:
        return {"status": INSUFFICIENT_DATA, "field": field,
                "have": len(usable), "need": min_attempts}

    edges = [i / bins for i in range(bins + 1)]
    table = []
    for b in range(bins):
        lo, hi = edges[b], edges[b + 1]
        # include the top edge in the last bin
        cell = [(p, a) for (p, a) in usable if (lo <= p < hi or (b == bins - 1 and p == hi))]
        if not cell:
            table.append({"bin": [round(lo, 2), round(hi, 2)], "n": 0,
                          "predicted_mean": None, "empirical_success": None})
            continue
        pred_mean = sum(p for p, _ in cell) / len(cell)
        emp = sum(a for _, a in cell) / len(cell)
        table.append({"bin": [round(lo, 2), round(hi, 2)], "n": len(cell),
                      "predicted_mean": round(pred_mean, 4),
                      "empirical_success": round(emp, 4)})

    brier = sum((p - a) ** 2 for p, a in usable) / len(usable)
    return {"status": "OK", "field": field, "n": len(usable),
            "brier_score": round(brier, 4), "reliability_table": table}
