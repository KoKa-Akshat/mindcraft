#!/usr/bin/env python3
"""
AMC (American Mathematics Competitions) adapter.

Source: the Art of Problem Solving wiki via its public MediaWiki API —
    GET https://artofproblemsolving.com/wiki/api.php
        ?action=parse&format=json&page=2023_AMC_8_Problems

Competitions fetched by default: AMC 8 (2015-2023) and AMC 10A/10B
(2018-2023). Answer keys come from the corresponding "... Answer Key" pages.

AMC problems natively have FIVE choices (A-E). We keep all five — dropping a
real distractor would weaken the item, and the questionBank.ts interface is
`choices: string[]` with no length constraint (the UI renders A-E when 5 are
present). `correctIndex` may therefore be 0-4 on AMC items.
ALLOWED_CHOICE_COUNTS = {4, 5} declares this to the shared validator.

Concept mapping: AMC problems are untagged. A keyword heuristic against
AMC_TOPIC_MAP gives the LLM mapper a hint; final classification is
ConceptMapper.llm_map() (conceptId=None from parse_item()).

Offline behavior: results cached at ml/data/amc/problems.json; loaded from
there when present (delete the file to force a re-fetch).
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from base import (  # noqa: E402
    ML_DATA, SourceAdapter, http_get,
)

API_URL = "https://artofproblemsolving.com/wiki/api.php"
CACHE_PATH = ML_DATA / "amc" / "problems.json"

# AMC topic keywords -> (mindcraft_concept_id, default_level).
# Used as a HINT for the LLM concept mapper (AMC problems are untagged);
# values pass through ConceptMapper.resolve() so alias IDs are fine.
AMC_TOPIC_MAP: dict[str, tuple[str, int]] = {
    # AMC 8 topics (easier, grades 6-8)
    "arithmetic": ("integer_operations", 1),
    "fractions": ("fractions_decimals", 1),
    "percents": ("percent_ratio", 1),
    "ratios": ("ratios_proportions", 2),
    "geometry_area": ("area_volume", 2),
    "counting": ("combinatorics", 2),
    "probability": ("basic_probability", 2),
    "algebra": ("basic_equations", 2),
    "number_theory": ("number_properties", 2),
    # AMC 10/12 topics (harder)
    "polynomials": ("polynomial_operations", 3),
    "sequences": ("sequences_series", 3),
    "logarithms": ("logarithmic_functions", 3),
    "trigonometry": ("trigonometry_basics", 3),
    "complex_numbers": ("complex_numbers", 3),
    "matrices": ("matrices", 3),
    "statistics": ("descriptive_statistics", 2),
}

# Cheap text triggers for the hint lookup above.
TOPIC_TRIGGERS: list[tuple[re.Pattern, str]] = [
    (re.compile(r'\bprobability|randomly|at random|expected\b', re.I), "probability"),
    (re.compile(r'\bhow many ways|arrangements?|permutation|combination|choose\b', re.I), "counting"),
    (re.compile(r'\bpercent|%\b', re.I), "percents"),
    (re.compile(r'\bratio|proportion(al)?\b', re.I), "ratios"),
    (re.compile(r'\bfraction|\\frac\b', re.I), "fractions"),
    (re.compile(r'\barea|perimeter|volume|surface\b', re.I), "geometry_area"),
    (re.compile(r'\bmean|median|mode|average\b', re.I), "statistics"),
    (re.compile(r'\blog(_|\b)|logarithm\b', re.I), "logarithms"),
    (re.compile(r'\bsin|cos|tan\b|\btriangle.*angle\b', re.I), "trigonometry"),
    (re.compile(r'\bsequence|term of|arithmetic progression|geometric progression\b', re.I), "sequences"),
    (re.compile(r'\bpolynomial\b', re.I), "polynomials"),
    (re.compile(r'\bdivisible|divisor|prime|remainder|factor of\b', re.I), "number_theory"),
    (re.compile(r'\bequation|solve for|value of [a-z]\b', re.I), "algebra"),
]

PROBLEM_SPLIT_RE = re.compile(r'==\s*Problem\s+(\d+)\s*==')
# Choice run: \textbf{(A) }text ... \textbf{(E) }text (with \ or ~ spacing)
CHOICE_SPLIT_RE = re.compile(r'\\textbf\s*\{?\s*\(([A-E])\)\s*\}?')
ANSWER_KEY_RE = re.compile(r'^\s*#\s*([A-E])\s*$', re.M)
FIGURE_RE = re.compile(r'\[asy\]|\[\[File:|<asy>', re.I)
SOLUTION_SPLIT_RE = re.compile(r'==\s*Solution', re.I)
WIKI_MARKUP_RE = re.compile(r"\[\[(?:[^|\]]*\|)?([^\]]*)\]\]")


def _default_competitions(years: tuple[int, int] | None) -> list[tuple[str, int]]:
    """(competition, year) pairs: AMC 8 2015-2023, AMC 10A/10B 2018-2023."""
    lo, hi = years or (2015, 2023)
    comps: list[tuple[str, int]] = []
    for year in range(max(lo, 2015), min(hi, 2023) + 1):
        comps.append(("AMC_8", year))
    for year in range(max(lo, 2018), min(hi, 2023) + 1):
        comps.append(("AMC_10A", year))
        comps.append(("AMC_10B", year))
    return comps


class AMCAdapter(SourceAdapter):
    """AoPS wiki AMC problems -> MindCraft Question dicts (5 choices, A-E)."""

    ALLOWED_CHOICE_COUNTS = {4, 5}

    def name(self) -> str:
        return "amc"

    def concept_map(self) -> dict[str, tuple[str, int]]:
        return dict(AMC_TOPIC_MAP)

    # ------------------------------------------------------------------
    # fetch
    # ------------------------------------------------------------------

    def fetch(self, years: tuple[int, int] | None = None, **kwargs) -> list[dict]:
        if CACHE_PATH.exists():
            cached = json.loads(CACHE_PATH.read_text())
            print(f"  [amc] loaded {len(cached)} problems from cache "
                  f"({CACHE_PATH}); delete to re-fetch")
            return cached

        items: list[dict] = []
        for comp, year in _default_competitions(years):
            page = f"{year}_{comp}_Problems"
            wikitext = self._fetch_wikitext(page)
            if not wikitext:
                continue
            key = self._fetch_answer_key(f"{year}_{comp}_Answer_Key")
            problems = self._split_problems(wikitext)
            for number, body in problems:
                items.append({
                    "competition": comp,
                    "year": year,
                    "number": number,
                    "wikitext": body,
                    "answer": key.get(number),
                })
            print(f"  [amc] {page}: {len(problems)} problems, "
                  f"{len(key)} answer-key entries")

        if items:
            CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            CACHE_PATH.write_text(json.dumps(items, ensure_ascii=False))
            print(f"  [amc] cached {len(items)} problems -> {CACHE_PATH}")
        else:
            print("  [amc] nothing fetched and no local cache — nothing to ingest")
        return items

    @staticmethod
    def _fetch_wikitext(page: str) -> str | None:
        data = http_get(API_URL, params={
            "action": "parse", "format": "json", "prop": "wikitext", "page": page,
        })
        if not data or "parse" not in data:
            return None
        return (data["parse"].get("wikitext") or {}).get("*")

    def _fetch_answer_key(self, page: str) -> dict[int, str]:
        """AoPS answer-key pages are a numbered wikitext list: `# A` per line."""
        wikitext = self._fetch_wikitext(page)
        if not wikitext:
            return {}
        letters = ANSWER_KEY_RE.findall(wikitext)
        return {i + 1: letter for i, letter in enumerate(letters)}

    @staticmethod
    def _split_problems(wikitext: str) -> list[tuple[int, str]]:
        """Split a Problems page into (problem_number, body) sections."""
        parts = PROBLEM_SPLIT_RE.split(wikitext)
        # parts = [preamble, '1', body1, '2', body2, ...]
        out: list[tuple[int, str]] = []
        for i in range(1, len(parts) - 1, 2):
            number = int(parts[i])
            body = parts[i + 1]
            # Problem pages sometimes inline solutions — keep text before them.
            body = SOLUTION_SPLIT_RE.split(body)[0]
            out.append((number, body.strip()))
        return out

    # ------------------------------------------------------------------
    # parse
    # ------------------------------------------------------------------

    def parse_item(self, raw: dict) -> dict | None:
        wikitext = raw.get("wikitext") or ""
        answer = raw.get("answer")
        if not wikitext or answer not in ("A", "B", "C", "D", "E"):
            return None
        if FIGURE_RE.search(wikitext):
            return None  # Asymptote / image figure with no text description

        problem_text, choices = self._extract_choices(wikitext)
        if problem_text is None or len(choices) != 5:
            return None
        correct_idx = "ABCDE".index(answer)

        comp = raw.get("competition", "AMC_8")
        year = raw.get("year", 0)
        number = raw.get("number", 0)
        level = self._level(comp, number)

        return {
            "question": problem_text,
            "choices": choices,
            "correctIndex": correct_idx,   # 0-4: AMC keeps 5 choices natively
            "conceptId": None,             # untagged -> LLM classification
            "level": level,
            "examTag": "AMC",
            "_source_concept": self._topic_hint(problem_text)
                               or f"{comp.replace('_', ' ')} {year} problem {number}",
        }

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _extract_choices(wikitext: str) -> tuple[str | None, list[str]]:
        """Split problem body into (stem, [choice A..E]) from the
        `$\\textbf{(A) }...$` run. Returns (None, []) if not found."""
        cleaned = WIKI_MARKUP_RE.sub(r'\1', wikitext)
        cleaned = re.sub(r"'''?", '', cleaned)  # bold/italic wiki quotes

        parts = CHOICE_SPLIT_RE.split(cleaned)
        # parts = [stem, 'A', choiceA, 'B', choiceB, ..., 'E', choiceE]
        if len(parts) < 11:
            return None, []
        stem = parts[0].strip()
        choices: list[str] = []
        for i in range(1, 11, 2):
            letter, text = parts[i], parts[i + 1]
            # Choice text runs until the next letter marker (already split) —
            # trim trailing math-mode glue ($, \qquad, \) etc.
            text = re.sub(r'(\\qquad|\\quad|\\ )+\s*$', '', text)
            text = text.strip().strip('$').strip()
            text = re.sub(r'^\}\s*', '', text)
            if not text:
                return None, []
            choices.append(text)
            if letter == 'E':
                break
        # Stems often end in an opening `$` that belonged to the choice run.
        stem = re.sub(r'\$\s*$', '', stem).strip()
        return (stem or None), choices

    @staticmethod
    def _level(competition: str, number: int) -> int:
        """AMC 8 -> level 2 (3 for the back half); AMC 10/12 -> level 3."""
        if competition == "AMC_8":
            return 3 if number > 15 else 2
        return 3

    @staticmethod
    def _topic_hint(text: str) -> str | None:
        for pattern, topic in TOPIC_TRIGGERS:
            if pattern.search(text):
                concept_id, _ = AMC_TOPIC_MAP[topic]
                return f"{topic} ({concept_id}?)"
        return None
