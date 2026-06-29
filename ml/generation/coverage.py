"""Static-bank coverage helpers for generation targeting.

The generator owns dynamic content, but it needs to know which canonical ACT
concepts are not fully covered by the static TypeScript bank. This module keeps
that read-only audit local to `ml/generation` so the generation CLI can target
the exact C5 fill-in set without importing app code.
"""
from __future__ import annotations

import json
import pathlib
import re

REPO = pathlib.Path(__file__).resolve().parents[2]
ONTOLOGY_PATH = REPO / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
QUESTION_BANK_PATH = REPO / "app/src/lib/questionBank.ts"

# Keep in sync with the coverage audit script. Dynamic generation should emit
# canonical concept ids, so alias-only rows still count as needing generated
# canonical coverage.
KNOWN_BANK_ALIASES: dict[str, str] = {
    "ratios_proportions": "percent_ratio",
}


def _parse_static_counts(source: str) -> dict[str, dict[int, int]]:
    counts: dict[str, dict[int, int]] = {}
    for match in re.finditer(
        r"\{\s*id:'[^']+',\s*conceptId:'([^']+)',\s*level:([123])",
        source,
    ):
        concept_id, level = match.group(1), int(match.group(2))
        counts.setdefault(concept_id, {1: 0, 2: 0, 3: 0})
        counts[concept_id][level] += 1
    return counts


def _total(counts: dict[str, dict[int, int]], concept_id: str) -> int:
    return sum(counts.get(concept_id, {}).values())


def act_tested_concepts() -> list[str]:
    data = json.loads(ONTOLOGY_PATH.read_text())
    return [c["id"] for c in data["concepts"] if c.get("act_relevance", {}).get("tested")]


def uncovered_concepts(include_partial: bool = True) -> list[str]:
    """Return canonical ACT-tested concept ids needing generated content.

    `include_partial=True` targets concepts missing any of levels 1, 2, or 3.
    `False` limits the list to concepts with zero canonical static items.
    """
    counts = _parse_static_counts(QUESTION_BANK_PATH.read_text())
    out: list[str] = []
    for concept_id in act_tested_concepts():
        row = counts.get(concept_id, {1: 0, 2: 0, 3: 0})
        has_alias_only = _total(counts, concept_id) == 0 and _total(
            counts, KNOWN_BANK_ALIASES.get(concept_id, "")
        ) > 0
        missing_any_level = any(row.get(level, 0) == 0 for level in (1, 2, 3))
        missing_all_canonical = _total(counts, concept_id) == 0
        if has_alias_only or (include_partial and missing_any_level) or missing_all_canonical:
            out.append(concept_id)
    return out
