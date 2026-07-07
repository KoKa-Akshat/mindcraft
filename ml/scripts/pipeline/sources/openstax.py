#!/usr/bin/env python3
"""
OpenStax Exercises adapter.

Source: the OpenStax Exercises API —
    GET https://exercises.openstax.org/api/exercises?q=subject:math&per_page=100&page=N

Exercises are CC-BY licensed items from OpenStax textbooks (Algebra &
Trigonometry, Precalculus, Prealgebra, Statistics). Each exercise has:

    {uid, tags: [...], stimulus_html,
     questions: [{stem_html, answers: [{content_html, correctness}]}]}

Concept mapping: OpenStax tags -> MindCraft canonical IDs via OPENSTAX_TAG_MAP.
Untagged / unmatched items fall through to ConceptMapper.llm_map().

Offline behavior: fetched pages are always cached to
ml/data/openstax/exercises.json; if the API is unreachable the adapter loads
from that cache instead (and returns [] with a warning when neither exists).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Allow running both as a package module and as a loose script
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from base import (  # noqa: E402
    ML_DATA, SourceAdapter, http_get, strip_html,
)

API_URL = "https://exercises.openstax.org/api/exercises"
CACHE_PATH = ML_DATA / "openstax" / "exercises.json"

# OpenStax tags -> (mindcraft_concept_id, default_level).
# Values pass through ConceptMapper.resolve(), so legacy/alias IDs here
# (e.g. polynomial_operations, coordinate_geometry) land on canonical slugs.
OPENSTAX_TAG_MAP: dict[str, tuple[str, int]] = {
    # Algebra and Trigonometry / Precalculus tags
    "linear-equations": ("linear_equations", 1),
    "linear-inequalities": ("linear_inequalities", 1),
    "systems-equations": ("systems_of_linear_equations", 2),
    "quadratic-equations": ("quadratic_equations", 2),
    "polynomial-functions": ("polynomial_operations", 2),
    "rational-expressions": ("rational_expressions", 3),
    "exponential-functions": ("exponent_rules", 2),
    "logarithmic-functions": ("logarithmic_functions", 3),
    "trigonometric-functions": ("trigonometry_basics", 2),
    "statistics": ("descriptive_statistics", 2),
    "probability": ("basic_probability", 2),
    "sequences-series": ("sequences_series", 3),
    "functions": ("functions_basics", 1),
    "function-transformations": ("function_transformations", 2),
    "absolute-value": ("absolute_value", 1),
    "complex-numbers": ("complex_numbers", 3),
    "matrices": ("matrices", 3),
    "coordinate-geometry": ("coordinate_geometry", 2),
    "circles": ("circles_geometry", 2),
    "area": ("area_volume", 2),
    "right-triangle": ("right_triangle_geometry", 2),
    "fractions": ("fractions_decimals", 1),
    "ratios": ("ratios_proportions", 1),
    "percentages": ("percent_ratio", 1),
    "order-operations": ("order_of_operations", 1),
}

COORDINATE_LANGUAGE_RE = re.compile(
    r'\b(coordinate plane|x-axis|y-axis|ordered pair|quadrant|slope of the line|'
    r'graph of the (line|function|equation)|plotted?)\b', re.I)


class OpenStaxAdapter(SourceAdapter):
    """OpenStax Exercises -> MindCraft Question dicts."""

    def name(self) -> str:
        return "openstax"

    def concept_map(self) -> dict[str, tuple[str, int]]:
        return dict(OPENSTAX_TAG_MAP)

    # ------------------------------------------------------------------
    # fetch
    # ------------------------------------------------------------------

    def fetch(self, query: str = "subject:math", **kwargs) -> list[dict]:
        """Paginated download from the Exercises API; cached to disk.

        Falls back to ml/data/openstax/exercises.json when the network path
        fails (no connectivity, API change, rate limit exhaustion).
        """
        items: list[dict] = []
        page = 1
        per_page = 100
        while True:
            data = http_get(API_URL, params={
                "q": query, "per_page": per_page, "page": page,
            })
            if data is None:
                break
            page_items = data.get("items") or data.get("exercises") or []
            items.extend(page_items)
            total = (data.get("meta") or {}).get("total_count", data.get("total_count", 0))
            got = (data.get("meta") or {}).get("per_page", per_page) * page
            if not page_items or (total and got >= total):
                break
            page += 1

        if items:
            CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            CACHE_PATH.write_text(json.dumps(items, ensure_ascii=False))
            print(f"  [openstax] fetched {len(items)} exercises (cached to {CACHE_PATH})")
            return items

        # Network failed — fall back to the local cache.
        if CACHE_PATH.exists():
            cached = json.loads(CACHE_PATH.read_text())
            print(f"  [openstax] API unavailable — loaded {len(cached)} from cache")
            return cached
        print("  [openstax] API unavailable and no local cache at "
              f"{CACHE_PATH} — nothing to ingest")
        return []

    # ------------------------------------------------------------------
    # parse
    # ------------------------------------------------------------------

    def parse_item(self, raw: dict) -> dict | None:
        questions = raw.get("questions") or []
        if not questions:
            return None
        q = questions[0]  # multi-part exercises: use the first MCQ part

        stem_html = (raw.get("stimulus_html") or raw.get("stimulus") or "") + \
            " " + (q.get("stem_html") or q.get("stem") or "")
        answers = q.get("answers") or []
        if len(answers) < 4:
            return None  # not enough distractors for the bank shape

        correct_idx = next(
            (i for i, a in enumerate(answers)
             if float(a.get("correctness") or 0) == 1.0),
            None,
        )
        if correct_idx is None:
            return None  # no key published for this item

        # Keep exactly 4 choices: the correct one + the first 3 distractors.
        if len(answers) > 4:
            keep = [answers[correct_idx]] + \
                [a for i, a in enumerate(answers) if i != correct_idx][:3]
            answers = keep
            correct_idx = 0

        choices = [strip_html(a.get("content_html") or a.get("content") or "")
                   for a in answers]
        question_text = strip_html(stem_html)
        if not question_text or any(not c for c in choices):
            return None

        # Concept via tag map; unmatched tags go to the LLM mapper.
        tags = [str(t).lower() for t in (raw.get("tags") or [])]
        concept_id, level = self._match_tags(tags)

        return {
            "question": question_text,
            "choices": choices,
            "correctIndex": correct_idx,
            "conceptId": concept_id,          # None -> LLM mapping in run_pipeline
            "level": level,
            "format": self._detect_format(stem_html, question_text),
            "_source_concept": ", ".join(tags[:8]),
            "_act_if_tested": True,           # examTag='ACT' if concept is ACT-tested
        }

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _match_tags(tags: list[str]) -> tuple[str | None, int]:
        """Match OpenStax tags against OPENSTAX_TAG_MAP.

        Tags come namespaced (e.g. 'topic:linear-equations', 'lo:stax-alg:2-2-1')
        so we substring-match each map key against each tag.
        """
        for tag in tags:
            for key, (concept_id, level) in OPENSTAX_TAG_MAP.items():
                if key in tag:
                    return concept_id, level
        return None, 2

    @staticmethod
    def _detect_format(raw_html: str, text: str) -> str:
        if "<img" in raw_html:
            return "diagram"
        if COORDINATE_LANGUAGE_RE.search(text):
            return "coordinate_graph"
        return "word_problem"
