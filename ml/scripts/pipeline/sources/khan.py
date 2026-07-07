#!/usr/bin/env python3
"""
Khan Academy adapter.

Source: Khan Academy's legacy content API —
    GET https://www.khanacademy.org/api/v1/exercises?topic={topic}
    GET https://www.khanacademy.org/api/v1/exercises/{slug}/items

Items arrive in Perseus format. Multiple-choice items look like:

    {"question": {"content": "text with \\(...\\) math and [[☃ radio 1]]"},
     "widgets": {"radio 1": {"options": {"choices": [
         {"content": "...", "correct": true}, ...]}}}}

CAVEAT: Khan Academy has repeatedly moved/retired its public v1 API in favor
of an internal GraphQL surface, so live fetching is best-effort. The adapter
degrades gracefully: any successfully fetched payload is cached to
ml/data/khan/exercises.json and reused; with neither network nor cache it
returns [] and the run reports zero raw items instead of crashing. To ingest
Khan content reliably, place a pre-downloaded exercises dump at the cache
path (list of {exercise, items} records as produced by fetch()).

Concept mapping: KHAN_TAG_MAP keyed on Khan topic/skill slugs, LLM fallback
for unmapped slugs.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from base import (  # noqa: E402
    ML_DATA, SourceAdapter, http_get, strip_html,
)

EXERCISES_URL = "https://www.khanacademy.org/api/v1/exercises"
CACHE_PATH = ML_DATA / "khan" / "exercises.json"

# Khan topic/skill slugs -> (mindcraft_concept_id, default_level).
# Partial map — focused on high-ACT-relevance skills; values pass through
# ConceptMapper.resolve() so alias IDs land on canonical slugs.
KHAN_TAG_MAP: dict[str, tuple[str, int]] = {
    "linear-equations-and-inequalities": ("linear_equations", 1),
    "two-variable-linear-equations-intro": ("linear_equations", 2),
    "systems-of-equations": ("systems_of_linear_equations", 2),
    "quadratics-and-polynomials": ("quadratic_equations", 2),
    "functions": ("functions_basics", 2),
    "rational-exponents-and-radicals": ("radical_expressions", 2),
    "exponential-and-logarithmic-functions": ("logarithmic_functions", 3),
    "right-triangles-trigonometry": ("right_triangle_geometry", 2),
    "statistics-probability": ("descriptive_statistics", 2),
    "counting-probability": ("basic_probability", 2),
    "fractions": ("fractions_decimals", 1),
    "ratios-proportions": ("ratios_proportions", 1),
    "percentages": ("percent_ratio", 1),
    "absolute-value": ("absolute_value", 1),
    "coordinate-plane": ("coordinate_geometry", 1),
}

WIDGET_PLACEHOLDER_RE = re.compile(r'\[\[☃\s*[^\]]*\]\]')  # [[☃ radio 1]]
MARKDOWN_IMG_RE = re.compile(r'!\[[^\]]*\]\([^)]*\)')


class KhanAdapter(SourceAdapter):
    """Khan Academy Perseus exercises -> MindCraft Question dicts."""

    def name(self) -> str:
        return "khan"

    def concept_map(self) -> dict[str, tuple[str, int]]:
        return dict(KHAN_TAG_MAP)

    # ------------------------------------------------------------------
    # fetch
    # ------------------------------------------------------------------

    def fetch(self, topic: str = "algebra", **kwargs) -> list[dict]:
        """Best-effort live fetch with disk cache fallback.

        Output shape (also the expected shape of a manually placed cache
        file): [{"exercise": {slug, tags, ...}, "item": <perseus item>}].
        """
        if CACHE_PATH.exists():
            cached = json.loads(CACHE_PATH.read_text())
            print(f"  [khan] loaded {len(cached)} items from cache "
                  f"({CACHE_PATH}); delete to re-fetch")
            return cached

        exercises = http_get(EXERCISES_URL, params={"topic": topic})
        if not isinstance(exercises, list):
            print("  [khan] exercises API unavailable (Khan's public v1 API is "
                  "frequently gated) and no local cache — nothing to ingest.\n"
                  f"         To ingest Khan content, place a dump at {CACHE_PATH}")
            return []

        items: list[dict] = []
        for ex in exercises:
            slug = ex.get("name") or ex.get("slug")
            if not slug:
                continue
            payload = http_get(f"{EXERCISES_URL}/{slug}/items")
            if not payload:
                continue
            raw_items = payload if isinstance(payload, list) else payload.get("items", [])
            for item in raw_items:
                items.append({"exercise": ex, "item": item})

        if items:
            CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            CACHE_PATH.write_text(json.dumps(items, ensure_ascii=False))
            print(f"  [khan] fetched {len(items)} items (cached to {CACHE_PATH})")
        return items

    # ------------------------------------------------------------------
    # parse
    # ------------------------------------------------------------------

    def parse_item(self, raw: dict) -> dict | None:
        exercise = raw.get("exercise") or {}
        item = raw.get("item") or {}

        # Perseus payloads are sometimes JSON-encoded strings.
        item_data = item.get("item_data") or item.get("itemData") or item
        if isinstance(item_data, str):
            try:
                item_data = json.loads(item_data)
            except json.JSONDecodeError:
                return None

        question = item_data.get("question") or {}
        content = question.get("content") or ""
        widgets = question.get("widgets") or {}

        radio = next((w for k, w in widgets.items() if k.startswith("radio")), None)
        if radio is None:
            return None  # not a multiple-choice item (free response, grapher, ...)

        options = (radio.get("options") or {})
        raw_choices = options.get("choices") or radio.get("choices") or []
        # Filter Perseus "None of the above" synthetic rows
        raw_choices = [c for c in raw_choices if not c.get("isNoneOfTheAbove")]
        if len(raw_choices) < 4:
            return None
        correct_idx = next((i for i, c in enumerate(raw_choices) if c.get("correct")),
                           None)
        if correct_idx is None:
            return None
        if len(raw_choices) > 4:
            keep = [raw_choices[correct_idx]] + \
                [c for i, c in enumerate(raw_choices) if i != correct_idx][:3]
            raw_choices = keep
            correct_idx = 0

        choices = [strip_html(str(c.get("content") or "")) for c in raw_choices]
        question_text = strip_html(WIDGET_PLACEHOLDER_RE.sub('', content)).strip()
        if not question_text or any(not c for c in choices):
            return None

        slug = str(exercise.get("name") or exercise.get("slug") or "")
        tags = [str(t).lower() for t in (exercise.get("tags") or [])] + [slug.lower()]
        concept_id, level = self._match_tags(tags)

        return {
            "question": question_text,
            "choices": choices,
            "correctIndex": correct_idx,
            "conceptId": concept_id,           # None -> LLM mapping
            "level": level,
            "_source_concept": slug or ", ".join(tags[:5]),
            "_act_if_tested": True,
        }

    # ------------------------------------------------------------------

    @staticmethod
    def _match_tags(tags: list[str]) -> tuple[str | None, int]:
        for tag in tags:
            for key, (concept_id, level) in KHAN_TAG_MAP.items():
                if key in tag:
                    return concept_id, level
        return None, 2
