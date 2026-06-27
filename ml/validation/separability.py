"""Piece 3 — format-separability check (the KPI-defining test).

THE number that says whether the format feature is real. For each (student,
concept) seen in >=2 distinct formats, does format mastery vary independently of
concept mastery? Reports the correlation between concept-mastery and
format-mastery across qualifying attempts:

  r ~ 1.0  -> format axis is redundant (measuring nothing new)
  r << 1.0 -> format carries independent signal (the feature is real)

Interpretation is deliberately NOT done here — with n~1 student this is noise.
Returns INSUFFICIENT_DATA (with needed n) until volume arrives.
"""
from __future__ import annotations

from collections import defaultdict

from . import INSUFFICIENT_DATA
from .replay import ReplayRow

# A (student, concept) cell only qualifies if seen in >=2 formats. Below these
# the correlation is noise.
MIN_QUALIFYING_CELLS = 5
MIN_ROWS = 30


def _pearson(xs: list[float], ys: list[float]) -> float | None:
    n = len(xs)
    if n < 2:
        return None
    mx, my = sum(xs) / n, sum(ys) / n
    sxx = sum((x - mx) ** 2 for x in xs)
    syy = sum((y - my) ** 2 for y in ys)
    if sxx == 0 or syy == 0:   # no variance in one axis -> correlation undefined
        return None
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    return sxy / (sxx ** 0.5 * syy ** 0.5)


def separability_report(
    rows: list[ReplayRow],
    min_cells: int = MIN_QUALIFYING_CELLS,
    min_rows: int = MIN_ROWS,
) -> dict:
    """Correlation between concept- and format-mastery on shared (student, concept)
    cells observed across >=2 formats."""
    formatted = [r for r in rows if r.format_id is not None and r.format_mastery_before is not None]

    # Which (student, concept) cells span >=2 distinct formats?
    formats_per_cell: dict[tuple[str, str], set] = defaultdict(set)
    for r in formatted:
        formats_per_cell[(r.student_id, r.concept_id)].add(r.format_id)
    qualifying = {cell for cell, fmts in formats_per_cell.items() if len(fmts) >= 2}

    sample = [r for r in formatted if (r.student_id, r.concept_id) in qualifying]

    if len(qualifying) < min_cells or len(sample) < min_rows:
        return {"status": INSUFFICIENT_DATA,
                "qualifying_cells": len(qualifying), "cells_needed": min_cells,
                "rows": len(sample), "rows_needed": min_rows}

    r = _pearson(
        [row.concept_mastery_before for row in sample],
        [row.format_mastery_before for row in sample],
    )
    if r is None:
        return {"status": INSUFFICIENT_DATA, "reason": "no variance in one axis",
                "qualifying_cells": len(qualifying), "rows": len(sample)}

    return {"status": "OK",
            "qualifying_cells": len(qualifying), "rows": len(sample),
            "concept_format_correlation": round(r, 4)}
