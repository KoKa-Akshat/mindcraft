#!/usr/bin/env python3
"""
OpenStax Exercises adapter.

Source: the OpenStax Exercises API —
    GET https://exercises.openstax.org/api/exercises?q=subject:math&per_page=100&page=N

Exercises are CC-BY licensed items from OpenStax textbooks. Each exercise has:

    {uid, tags: [...], stimulus_html,
     questions: [{stem_html, answers: [{content_html, correctness}]}]}

Corpus reality (measured on the 84,923-item cache, 2026-07-07):
- The corpus covers ALL OpenStax subjects (biology, physics, nursing, ...).
  Math books account for ~6,700 items — parse_item() gates on a math book tag
  (MATH_BOOK_TOKENS) so non-math items are rejected up front instead of
  flooding ConceptMapper.llm_map().
- Math exercises are overwhelmingly free-response (~16k of ~17k question
  parts). Only ~64 math items carry a >=4-choice MCQ with a published key
  (`correctness` is withheld on most MCQs). Yield is therefore small by
  design, not by bug.
- Tags are namespaced: `book:stax-cmath`, `book-slug:contemporary-mathematics`,
  `module-slug:contemporary-mathematics:5-5-graphing-linear-equations-...`.
  Concept mapping substring-matches OPENSTAX_TAG_MAP keys against module-slug
  style tags, most-specific key first.
- Math notation lives in `<span data-math="...">` attributes; strip_html()
  would destroy it, so _inline_data_math() lifts it out first.

Offline behavior: CACHE_PATH (ml/data/openstax/exercises.json) is
authoritative when present — fetch() loads it and skips the network entirely
(pass refresh=True to force a re-download). Fetched pages are cached there.
"""

from __future__ import annotations

import html as html_lib
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

# Book tokens (the part after `book:` / `book-slug:`) that mark a MATH item.
# Spanish editions (c-lculo-volumen-N, introducci-n-estad-stica) are
# dual-tagged onto the same exercise records as their English books, so the
# English tokens already cover them.
MATH_BOOK_TOKENS: frozenset[str] = frozenset({
    # book-slug:* values
    "algebra-1",
    "algebra-and-trigonometry", "algebra-and-trigonometry-2e",
    "calculus-volume-1", "calculus-volume-2", "calculus-volume-3",
    "college-algebra", "college-algebra-2e",
    "college-algebra-coreq", "college-algebra-corequisite-support-2e",
    "contemporary-mathematics",
    "elementary-algebra", "intermediate-algebra",
    "introductory-business-statistics", "introductory-business-statistics-2e",
    "introductory-statistics", "introductory-statistics-2e",
    "prealgebra", "prealgebra-2e",
    "precalculus", "precalculus-2e",
    "statistics",
    # book:stax-* values
    "stax-algtrig", "stax-busstats", "stax-calc", "stax-calgebra",
    "stax-cmath", "stax-coreqalgebra", "stax-elemalgebra", "stax-hsstats",
    "stax-interalgebra", "stax-prealgebra", "stax-stats",
})

# OpenStax module-slug substring -> (mindcraft_concept_id, default_level).
# ORDER MATTERS: matched most-specific-first against every tag (dict order).
# Values pass through ConceptMapper.resolve(), so alias IDs here
# (absolute_value, coordinate_geometry, ...) land on canonical slugs.
# A None concept means "recognized but deliberately unmapped" (topics with no
# MindCraft concept — set theory, voting methods, parametric curves, ...);
# matching stops so a later generic key can't mis-claim the item.
OPENSTAX_TAG_MAP: dict[str, tuple[str, int] | None] = {
    # ── deliberate blackholes (no MindCraft concept) ──────────────────────
    "parametric": None,
    "polar-coordinates": None,
    "vector-valued": None,
    "vector-fields": None,
    "second-order-linear": None,
    "differential-equations": None,
    "base-systems": None,
    "voting": None,
    "apportionment": None,
    "truth-tables": None,
    "logical-arguments": None,
    "venn-diagrams": None,
    "set-operations": None,
    "euler-circuits": None,
    "euler-trails": None,
    "hamilton-cycles": None,
    "hamilton-paths": None,
    "traveling-salesperson": None,
    "clock-arithmetic": None,

    # ── inferential statistics ────────────────────────────────────────────
    "central-limit-theorem": ("inferential_statistics", 3),
    "confidence-interval": ("inferential_statistics", 3),
    "hypothes": ("inferential_statistics", 3),
    "null-and-alternative": ("inferential_statistics", 3),
    "chi-square": ("inferential_statistics", 3),
    "anova": ("inferential_statistics", 3),
    "goodness-of-fit": ("inferential_statistics", 3),
    "test-of-a-single-variance": ("inferential_statistics", 3),
    "test-of-two-variances": ("inferential_statistics", 3),
    "two-population-means": ("inferential_statistics", 3),
    "two-independent-population": ("inferential_statistics", 3),
    "f-distribution": ("inferential_statistics", 3),

    # ── probability distributions ─────────────────────────────────────────
    "normal-distribution": ("probability_distributions", 3),
    "probability-density": ("probability_distributions", 3),
    "probability-distribution": ("probability_distributions", 3),
    "continuous-probability": ("probability_distributions", 3),
    "binomial-distribution": ("probability_distributions", 3),
    "hypergeometric": ("probability_distributions", 3),

    # ── descriptive statistics ────────────────────────────────────────────
    "data-sampling": ("descriptive_statistics", 2),
    "levels-of-measurement": ("descriptive_statistics", 2),
    "frequency-tables": ("descriptive_statistics", 2),
    "frequency-frequency": ("descriptive_statistics", 2),
    "experimental-design": ("descriptive_statistics", 2),
    "display-data": ("descriptive_statistics", 2),
    "stem-and-leaf": ("descriptive_statistics", 2),
    "visualizing-data": ("descriptive_statistics", 2),
    "gathering-and-organizing-data": ("descriptive_statistics", 2),
    "mean-median": ("descriptive_statistics", 2),
    "standard-deviation": ("descriptive_statistics", 2),
    "percentiles": ("descriptive_statistics", 2),      # before "percent"
    "scatter-plot": ("descriptive_statistics", 2),
    "correlation": ("descriptive_statistics", 2),
    "residual": ("descriptive_statistics", 2),

    # ── probability & counting ────────────────────────────────────────────
    "expected-value": ("basic_probability", 2),
    "permutations": ("basic_probability", 2),
    "combinations": ("basic_probability", 2),
    "multiplication-rule-for-counting": ("basic_probability", 2),
    "tree-diagrams": ("basic_probability", 2),
    "what-are-the-odds": ("basic_probability", 2),
    "conditional-probability": ("basic_probability", 3),
    "probability": ("basic_probability", 2),

    # ── calculus ──────────────────────────────────────────────────────────
    "fundamental-theorem-of-calculus": ("integrals", 3),
    "approximating-areas": ("integrals", 3),
    "definite-integral": ("integrals", 3),
    "integration-formulas": ("integrals", 3),
    "areas-between-curves": ("applications_of_integrals", 3),
    "integral": ("integrals", 3),
    "related-rates": ("applications_of_derivatives", 3),
    "derivatives-as-rates-of-change": ("applications_of_derivatives", 3),
    "chain-rule": ("derivatives", 3),
    "differentiation": ("derivatives", 3),
    "derivative": ("derivatives", 3),
    "limit-laws": ("limits_continuity", 3),
    "limit": ("limits_continuity", 3),                 # after central-limit-*
    "continuity": ("limits_continuity", 3),
    "preview-of-calculus": ("limits_continuity", 3),

    # ── trigonometry ──────────────────────────────────────────────────────
    "right-triangle-trigonometry": ("right_triangle_geometry", 2),
    "right-triangle": ("right_triangle_geometry", 2),
    "law-of-sines": ("trigonometry_basics", 3),
    "law-of-cosines": ("trigonometry_basics", 3),
    "unit-circle": ("trigonometry_basics", 2),
    "sine-and-cosine": ("trigonometry_basics", 2),
    "trigonometr": ("trigonometry_basics", 2),

    # ── geometry / measurement ────────────────────────────────────────────
    "points-lines-and-planes": ("lines_angles", 1),
    "triangles": ("triangles_congruence", 2),          # before "angles"
    "angles": ("lines_angles", 1),
    "tessellations": ("geometric_transformations", 2),
    "polygons-perimeter": ("area_volume", 2),
    "volume-and-surface-area": ("area_volume", 2),
    "measuring-area": ("area_volume", 2),
    "measuring-volume": ("area_volume", 2),
    "metric-system": ("measurement_units", 1),
    "measuring-weight": ("measurement_units", 1),
    "measuring-temperature": ("measurement_units", 1),
    "systems-of-measurement": ("measurement_units", 1),
    "distance-and-midpoint": ("circles_geometry", 2),
    "circles": ("circles_geometry", 2),
    "ellipse": ("conic_sections", 3),
    "parabola": ("conic_sections", 3),
    "hyperbola": ("conic_sections", 3),
    "conic-sections": ("conic_sections", 3),
    "vectors": ("vectors", 3),
    "area": ("area_volume", 2),

    # ── algebra / precalc ─────────────────────────────────────────────────
    "systems-of-linear-inequalities": ("linear_inequalities", 2),
    "linear-programming": ("linear_inequalities", 3),
    "linear-inequalities": ("linear_inequalities", 1),
    "inequalit": ("linear_inequalities", 2),
    "systems-of-linear-equations": ("systems_of_linear_equations", 2),
    "systems-of-equations": ("systems_of_linear_equations", 2),
    "solve-systems": ("systems_of_linear_equations", 2),
    "quadratic": ("quadratic_equations", 2),
    "factoring-polynomials": ("factoring_polynomials", 2),
    "factor-by-grouping": ("factoring_polynomials", 2),
    "greatest-common-factor": ("factoring_polynomials", 2),
    "polynomial": ("polynomials", 2),
    "rational-expressions": ("rational_expressions", 3),
    "rational-numbers": ("fractions_decimals", 1),
    "fractions": ("fractions_decimals", 1),
    "decimals": ("fractions_decimals", 1),
    "exponents-and-scientific-notation": ("exponent_rules", 2),
    "scientific-notation": ("exponent_rules", 2),
    "compound-interest": ("exponential_functions", 2),
    "exponential": ("exponential_functions", 2),
    "exponent": ("exponent_rules", 2),
    "logarithm": ("logarithmic_functions", 3),
    "radicals": ("radical_expressions", 2),
    "square-root": ("radical_expressions", 2),
    "expressions-with-roots": ("radical_expressions", 2),
    "complex-numbers": ("complex_numbers", 3),
    "matrices": ("matrices", 3),
    "matrix": ("matrices", 3),
    "sequence": ("sequences_series", 3),
    "series": ("sequences_series", 3),
    "absolute-value": ("absolute_value", 1),
    "domain-and-range": ("functions_basics", 2),
    "composition-of-functions": ("functions_basics", 2),
    "inverse-functions": ("functions_basics", 2),
    "transformation-of-functions": ("function_transformations", 2),
    "function": ("functions_basics", 1),
    "linear-equations": ("linear_equations", 1),
    "graphing-linear": ("linear_equations", 1),
    "slope": ("linear_equations", 1),
    "rectangular-coordinate": ("coordinate_geometry", 2),
    "ratios-and-proportions": ("ratios_proportions", 1),
    "ratios": ("ratios_proportions", 1),
    "proportion": ("ratios_proportions", 1),
    "percent": ("percent_ratio", 1),
    "discounts-markups": ("percent_ratio", 1),
    "simple-interest": ("percent_ratio", 2),
    "order-of-operations": ("order_of_operations", 1),
    "real-numbers": ("number_properties", 1),
    "irrational-numbers": ("number_properties", 1),
    "integers": ("number_properties", 1),
    "whole-numbers": ("number_properties", 1),
    "algebraic-expressions": ("algebraic_manipulation", 1),
    "language-of-algebra": ("algebraic_manipulation", 1),
    "equation": ("basic_equations", 1),                # generic fallback
}

COORDINATE_LANGUAGE_RE = re.compile(
    r'\b(coordinate plane|x-axis|y-axis|ordered pair|quadrant|slope of the line|'
    r'graph of the (line|function|equation)|plotted?)\b', re.I)

# Spanish-edition exercises are SEPARATE records that still carry the English
# book tokens (e.g. precalculus + prec-lculo-2ed on the same item), so the
# book gate alone cannot exclude them. DiagramFilter's deixis regexes are
# English-only, so Spanish items must be dropped, not just deprioritized.
SPANISH_RE = re.compile(
    r'[¿¡]|\b(el|la|los|las|una?|función|gráfico|según|resuelva|evalúe|'
    r'muestra|siguiente|ecuación|número|cuál|qué|para|con|del)\b', re.I)

# `<span data-math="f(x)=4x+7"></span>` — the math lives in the ATTRIBUTE;
# generic tag stripping would delete it. Lift it into inline \(...\) first.
DATA_MATH_RE = re.compile(
    r'<(\w+)[^>]*\bdata-math\s*=\s*"([^"]*)"[^>]*>(.*?)</\1>',
    re.S,
)
DATA_MATH_SELFCLOSED_RE = re.compile(
    r'<\w+[^>]*\bdata-math\s*=\s*"([^"]*)"[^>]*/>',
    re.S,
)


# Commands OpenStax uses that base.LaTeXNormalizer (verbatim-locked to the
# Eedi table) does not translate — handled here instead.
EXTRA_LATEX_SUBS = [
    (re.compile(r'\\infty\b'), '∞'),
    (re.compile(r'\\rm\b'), ''),
]

# OpenStax math arrives via data-math attributes, never $...$ delimiters, so
# any remaining "$" is CURRENCY. base.LaTeXNormalizer.wrap_math would pair
# "$20 ... $10" into a bogus \(...\) math span — spell the amounts out.
CURRENCY_RE = re.compile(r'\$\s*(\d[\d,]*(?:\.\d+)?)')


def _spell_currency(text: str) -> str:
    return CURRENCY_RE.sub(r'\1 dollars', text)


def _inline_data_math(raw_html: str) -> str:
    """Replace data-math-carrying elements with inline \\(...\\) math."""
    def repl(m: re.Match) -> str:
        expr = html_lib.unescape(m.group(2)).strip()
        return f' \\({expr}\\) ' if expr else (m.group(3) or '')

    s = DATA_MATH_RE.sub(repl, raw_html)
    s = DATA_MATH_SELFCLOSED_RE.sub(
        lambda m: f' \\({html_lib.unescape(m.group(1)).strip()}\\) ', s)
    for pattern, sub in EXTRA_LATEX_SUBS:
        s = pattern.sub(sub, s)
    return s


class OpenStaxAdapter(SourceAdapter):
    """OpenStax Exercises -> MindCraft Question dicts."""

    def name(self) -> str:
        return "openstax"

    def concept_map(self) -> dict[str, tuple[str, int]]:
        return {k: v for k, v in OPENSTAX_TAG_MAP.items() if v is not None}

    # ------------------------------------------------------------------
    # fetch
    # ------------------------------------------------------------------

    def fetch(self, query: str = "subject:math", *, refresh: bool = False,
              **kwargs) -> list[dict]:
        """Load exercises, offline-first.

        The local cache (ml/data/openstax/exercises.json) is authoritative
        when present — the full corpus is ~85k items / 542MB, so re-fetching
        is expensive. Pass refresh=True to force a re-download from the API.
        """
        if not refresh and CACHE_PATH.exists():
            cached = json.loads(CACHE_PATH.read_text())
            print(f"  [openstax] loaded {len(cached)} exercises from cache "
                  f"({CACHE_PATH})")
            return cached

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
        tags = [str(t).lower() for t in (raw.get("tags") or [])]
        if not self._is_math_book(tags):
            return None  # bio/physics/nursing/... — out of scope

        # Find the first question part that is a keyed >=4-choice MCQ.
        # (Most OpenStax math is free-response; keys are often withheld.)
        q = None
        correct_idx: int | None = None
        answers: list[dict] = []
        for part in (raw.get("questions") or []):
            part_answers = part.get("answers") or []
            if len(part_answers) < 4:
                continue
            idx = next(
                (i for i, a in enumerate(part_answers)
                 if float(a.get("correctness") or 0) == 1.0),
                None,
            )
            if idx is None:
                continue  # no key published for this part
            q, answers, correct_idx = part, part_answers, idx
            break
        if q is None:
            return None

        stem_html = (raw.get("stimulus_html") or raw.get("stimulus") or "") + \
            " " + (q.get("stem_html") or q.get("stem") or "")
        stem_html = _inline_data_math(stem_html)

        # Keep exactly 4 choices: the correct one + the first 3 distractors.
        if len(answers) > 4:
            keep = [answers[correct_idx]] + \
                [a for i, a in enumerate(answers) if i != correct_idx][:3]
            answers = keep
            correct_idx = 0

        choices = [
            _spell_currency(strip_html(_inline_data_math(
                a.get("content_html") or a.get("content") or "")))
            for a in answers
        ]
        question_text = _spell_currency(strip_html(stem_html))
        if not question_text or any(not c for c in choices):
            return None
        if SPANISH_RE.search(question_text) or \
                any(SPANISH_RE.search(c) for c in choices):
            return None  # Spanish edition duplicate — English record exists

        # Concept via tag map; unmatched tags go to the LLM mapper.
        concept_id, level = self._match_tags(tags)

        return {
            "question": question_text,
            "choices": choices,
            "correctIndex": correct_idx,
            "conceptId": concept_id,          # None -> LLM mapping in run_pipeline
            "level": level,
            "format": self._detect_format(stem_html, question_text),
            "_source_concept": ", ".join(
                t for t in tags if t.startswith(("module-slug:", "book-slug:")))[:300],
            "_act_if_tested": True,           # examTag='ACT' if concept is ACT-tested
        }

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _is_math_book(tags: list[str]) -> bool:
        for tag in tags:
            if tag.startswith(("book:", "book-slug:")):
                if tag.split(":", 1)[1] in MATH_BOOK_TOKENS:
                    return True
        return False

    @staticmethod
    def _match_tags(tags: list[str]) -> tuple[str | None, int]:
        """Match module-slug style tags against OPENSTAX_TAG_MAP.

        Keys are checked in dict order (most specific first) across ALL tags,
        so e.g. 'central-limit-theorem' wins before the generic 'limit'.
        A None mapping is a deliberate blackhole: stop, leave unmapped.
        """
        slugs = [t for t in tags if t.startswith("module-slug:")] or tags
        for key, mapping in OPENSTAX_TAG_MAP.items():
            for tag in slugs:
                if key in tag:
                    if mapping is None:
                        return None, 2
                    return mapping
        return None, 2

    @staticmethod
    def _detect_format(raw_html: str, text: str) -> str:
        if "<img" in raw_html:
            return "diagram"
        if COORDINATE_LANGUAGE_RE.search(text):
            return "coordinate_graph"
        return "word_problem"
