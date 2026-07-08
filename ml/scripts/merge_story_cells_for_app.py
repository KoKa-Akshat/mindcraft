#!/usr/bin/env python3
"""Merge story cell batches for app/src/data/storyCells.json.

Priority (highest first — first id wins on duplicate):
  1. batch_ingredient_fable5.json — manual Fable 5 curation; gate_status=approved only
  2. batch_llm_002.json — vetted LLM slot-1 pilot cells (pre-gate legacy)
  3. batch_ingredient_llm.json — ingredient LLM batch (non-template only)

Template fallback cells (identical tank overflow stem) are excluded by default.
Fable 5 cells must pass pedagogy_score + gate checks; legacy batches skip gates.
"""

from __future__ import annotations

import argparse
import json
import re
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
STORY_DIR = ROOT / "ml/data/story_cells"
DEFAULT_OUT = ROOT / "app/src/data/storyCells.json"

TEMPLATE_STEM_MARKER = "The tank is 3/4 full. A helper adds 1/2 tank"
MIN_STEM_CHARS = 40
PEDAGOGY_DIMS = (
    "math_integrity",
    "diagnostic_power",
    "cognitive_load",
    "agency",
    "emotional_safety",
    "representation_options",
    "transfer",
)

BATCH_ORDER: list[tuple[Path, bool]] = [
    (STORY_DIR / "batch_ingredient_fable5.json", True),   # require gate
    (STORY_DIR / "batch_llm_002.json", False),
    (STORY_DIR / "batch_ingredient_llm.json", False),
]

BARE_CHOICE_RE = re.compile(r"^[A-Da-d]$")
SINGLE_WORD_CHOICE_RE = re.compile(r"^\w+$")


def is_template_stem(question: str) -> bool:
    return TEMPLATE_STEM_MARKER in (question or "")


def is_tank_cell(cell: dict) -> bool:
    """Reject undersized stems or placeholder-style choices."""
    q = str(cell.get("question") or "").strip()
    if len(q) < MIN_STEM_CHARS:
        return True
    choices = cell.get("choices") or []
    if not isinstance(choices, list) or len(choices) < 4:
        return True
    for c in choices:
        s = str(c).strip()
        if BARE_CHOICE_RE.match(s) or SINGLE_WORD_CHOICE_RE.match(s):
            return True
    return False


def pedagogy_scored(cell: dict) -> bool:
    scores = cell.get("pedagogy_score")
    if not isinstance(scores, dict):
        return False
    for dim in PEDAGOGY_DIMS:
        val = scores.get(dim)
        if not isinstance(val, (int, float)) or val <= 0:
            return False
    return True


def gate_approved(cell: dict) -> bool:
    if str(cell.get("gate_status") or "") != "approved":
        return False
    if cell.get("gate_passed") is None:
        return False
    return pedagogy_scored(cell)


def load_cells(path: Path) -> list[dict]:
    if not path.exists():
        return []
    raw = json.loads(path.read_text())
    cells = raw.get("cells", raw if isinstance(raw, list) else [])
    return [c for c in cells if isinstance(c, dict) and c.get("id")]


def should_ship(cell: dict, *, require_gate: bool) -> tuple[bool, str | None]:
    q = str(cell.get("question") or "")
    if is_template_stem(q):
        return False, "template_stem"
    if is_tank_cell(cell):
        return False, "tank_template"
    if require_gate and not gate_approved(cell):
        status = cell.get("gate_status", "missing")
        return False, f"gate_{status}"
    return True, None


def merge(include_templates: bool = False) -> tuple[list[dict], dict]:
    by_id: dict[str, dict] = {}
    stats: dict = {
        "loaded": 0,
        "skipped_template": 0,
        "skipped_tank": 0,
        "skipped_gate": 0,
        "skipped_dup_id": 0,
        "sources": {},
    }

    for path, require_gate in BATCH_ORDER:
        src = path.name
        cells = load_cells(path)
        stats["sources"][src] = 0
        for cell in cells:
            stats["loaded"] += 1
            if not include_templates and is_template_stem(str(cell.get("question") or "")):
                stats["skipped_template"] += 1
                continue
            ok, reason = should_ship(cell, require_gate=require_gate)
            if not ok:
                if reason == "tank_template":
                    stats["skipped_tank"] += 1
                elif reason and reason.startswith("gate_"):
                    stats["skipped_gate"] += 1
                elif reason == "template_stem":
                    stats["skipped_template"] += 1
                continue
            cid = str(cell.get("id") or "")
            if not cid or cid in by_id:
                stats["skipped_dup_id"] += 1
                continue
            by_id[cid] = cell
            stats["sources"][src] += 1

    merged = list(by_id.values())
    merged.sort(key=lambda c: (c.get("conceptId", ""), c.get("id", "")))
    return merged, stats


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--include-templates", action="store_true")
    args = parser.parse_args()

    cells, stats = merge(include_templates=args.include_templates)
    payload = {
        "_meta": {
            "merged_at": datetime.now(timezone.utc).isoformat(),
            "total": len(cells),
            "include_templates": args.include_templates,
            "stats": stats,
        },
        "cells": cells,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")
    print(
        f"Wrote {args.out} — {len(cells)} cells "
        f"(skipped {stats['skipped_template']} templates, "
        f"{stats['skipped_tank']} tank, "
        f"{stats['skipped_gate']} gate)"
    )


if __name__ == "__main__":
    main()
