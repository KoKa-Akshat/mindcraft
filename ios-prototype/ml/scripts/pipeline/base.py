#!/usr/bin/env python3
"""
MindCraft multi-source question-bank ingestion pipeline — shared infrastructure.

This module generalizes the proof-of-concept `ml/scripts/ingest_eedi.py` into
reusable building blocks:

    DiagramFilter     — diagram-deictic detection + `![alt]()` alt-text recovery
    LaTeXNormalizer   — the exact LATEX_SUBS translation table from ingest_eedi
    LLMAnnotator      — provider-agnostic explanation/hint generation (cached)
    ConceptMapper     — canonical-ID validation, aliasing, LLM concept mapping
    QuestionValidator — structural checks against the questionBank.Question shape
    PipelineReport    — per-run stats
    SourceAdapter     — abstract base for a question source
    run_pipeline()    — the shared fetch → parse → filter → annotate → write loop

The output Question schema must match `app/src/lib/questionBank.ts` exactly:

    { id, conceptId, level (1|2|3), question, choices[], correctIndex,
      explanation, hints[3], examTag?, format?, misconception_id?,
      misconception_label? }

Note on choice counts: the bank convention is 4 choices, but the TS interface
is `choices: string[]` with no length constraint. AMC problems natively have
5 choices (A–E); the AMC adapter keeps all 5 (dropping a real distractor would
weaken the item) and declares `ALLOWED_CHOICE_COUNTS = {4, 5}`.
"""

from __future__ import annotations

import hashlib
import html as html_lib
import json
import os
import re
import time
from abc import ABC, abstractmethod
from collections import Counter
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

import requests

# ---------------------------------------------------------------------------
# Paths / constants
# ---------------------------------------------------------------------------

REPO = Path(__file__).resolve().parents[3]
ML_DATA = REPO / "ml" / "data"
ONTOLOGY_PATH = ML_DATA / "5_level_ontology" / "01_mindcraft_concept_ontology_v2_6_with_combinations.json"
EXPLAIN_CACHE_PATH = ML_DATA / ".explain_cache.json"
CONCEPT_MAP_CACHE_PATH = ML_DATA / ".concept_map_cache.json"

PIPELINE_VERSION = "2.0"

# C2 contract — must stay in sync with questionBank.FormatId
FORMAT_IDS = (
    "word_problem",
    "diagram",
    "number_line",
    "symbolic_expression",
    "coordinate_graph",
    "table",
)

EXAM_TAGS = ("ACT", "SAT", "IB", "AP", "GCSE", "AMC")

HTTP_TIMEOUT = 10  # seconds
HTTP_RETRIES = 3


# ---------------------------------------------------------------------------
# HTTP helper — requests with timeout + exponential-backoff retry
# ---------------------------------------------------------------------------

def http_get(url: str, params: dict | None = None, *, as_json: bool = True,
             retries: int = HTTP_RETRIES, timeout: int = HTTP_TIMEOUT) -> Any | None:
    """GET with 10s timeout and 3x exponential backoff. Returns parsed JSON
    (or text when as_json=False), or None after exhausting retries."""
    last_err: Exception | None = None
    for attempt in range(retries):
        try:
            resp = requests.get(url, params=params, timeout=timeout,
                                headers={"User-Agent": "mindcraft-ingest/2.0"})
            if resp.status_code == 429:
                retry_after = int(resp.headers.get("retry-after", 2 ** (attempt + 1)))
                time.sleep(min(retry_after, 30))
                continue
            resp.raise_for_status()
            return resp.json() if as_json else resp.text
        except Exception as e:  # noqa: BLE001 — network layer, retry everything
            last_err = e
            time.sleep(2 ** attempt)
    print(f"  [http] GET {url} failed after {retries} attempts: {last_err}")
    return None


# ---------------------------------------------------------------------------
# DiagramFilter
# ---------------------------------------------------------------------------

class DiagramFilter:
    """Diagram-dependence detection + alt-text recovery.

    The regexes here are copied VERBATIM from ml/scripts/ingest_eedi.py —
    they encode a season of tuning against the Eedi corpus. Do not simplify.
    """

    # ── Diagram-deictic regex (identical to ingest_eedi.DIAGRAM_RE) ────────
    DIAGRAM_RE = re.compile(
        r'\b(diagram|the image|picture|shown (below|above)|as shown|the shape\b|'
        r'the graph\b|on the grid|in the grid|the grid\b|the spinner|the scale\b|'
        r'number line (below|above)|shaded (region|area|shape)|'
        r'which (of these )?(shapes|graphs|diagrams|lines)\b|'
        r'the figure\b|drawn below|the arrow|draw (the|a )|mark (the|a )|'
        r'reflect|rotate|translate|enlarge|the image below|'
        r'bar chart|histogram|stem.?and.?leaf|scatter (graph|plot)|'
        r'venn diagram|tree diagram|the table below)\b',
        re.I,
    )

    # Deictic language that alt text cannot resolve (identical to ingest_eedi)
    STILL_VISUAL_RE = re.compile(
        r'\b(the highlighted|the shaded|the marked|the coloured|'
        r'this angle\b|the angle\b|these angles\b|those angles\b|'
        r'the region\b|as plotted|as drawn|in the figure\b)\b',
        re.I,
    )

    EMBEDDED_FIGURE_RE = re.compile(r'\\includegraphics|\[image\]|\[img\]', re.I)

    IMG_FULL = re.compile(r'!\[([^\]]*)\]\([^)]*\)')   # ![alt](url)
    IMG_BARE = re.compile(r'!\[([^\]]*)\](?!\()')      # ![alt] with no parens

    MIN_ALT_LEN = 30  # chars — below this an alt text is not a usable description

    # ── Subjects that may have visual-deictic language but aren't always
    # diagrams. Identical to ingest_eedi.HIGH_ATTRITION_SUBJECTS. ───────────
    HIGH_ATTRITION_SUBJECTS = {
        "Basic Angle Facts (straight line, opposite, around a point, etc)",
        "Angle Facts with Parallel Lines",
        "Angles in Triangles",
        "Angles in Polygons",
        "Measuring Angles",
        "Properties of Triangles",
        "Properties of Quadrilaterals",
        "Properties of Polygons",
        "Area of Simple Shapes",
        "Compound Area",
        "Perimeter",
        "Parts of a Circle",
    }

    def is_diagram_dependent(self, text: str) -> bool:
        """True if the text references a visual the reader cannot see."""
        return bool(self.DIAGRAM_RE.search(text))

    def still_visual(self, text: str) -> bool:
        """True if, even after alt recovery, deictic references remain."""
        if self.STILL_VISUAL_RE.search(text):
            return True
        return bool(self.EMBEDDED_FIGURE_RE.search(text))

    def recover_alt_text(self, text: str) -> tuple[str, bool]:
        """Replace `![alt](url)` / `![alt]` with `(Diagram: alt)`.

        This is the technique that recovered 465 extra Eedi questions:
        accessibility descriptions embedded in image markdown are often full
        textual descriptions of the figure. If EVERY image in the text has a
        description >= 30 chars, the question becomes text-solvable.

        Returns (rewritten_text, ok). ok=False means at least one image had
        no usable description — the question is unresolvable.
        """
        alts = self.IMG_FULL.findall(text) + self.IMG_BARE.findall(text)
        if not alts:
            return text, True
        if any(len(a.strip()) < self.MIN_ALT_LEN for a in alts):
            return text, False
        result = self.IMG_FULL.sub(lambda m: f'(Diagram: {m.group(1).strip()})', text)
        result = self.IMG_BARE.sub(lambda m: f'(Diagram: {m.group(1).strip()})', result)
        return result, True


# ---------------------------------------------------------------------------
# LaTeXNormalizer
# ---------------------------------------------------------------------------

class LaTeXNormalizer:
    """Flattens LaTeX to renderable plain text / minimal math notation.

    LATEX_SUBS is copied VERBATIM from ml/scripts/ingest_eedi.py.
    Order matters: e.g. \\left( must resolve before the bare-brace stripper.
    """

    LATEX_SUBS = [
        (re.compile(r'\\left\s*\('), '('),
        (re.compile(r'\\right\s*\)'), ')'),
        (re.compile(r'\\left\s*\['), '['),
        (re.compile(r'\\right\s*\]'), ']'),
        (re.compile(r'\\left\s*\{'), '{'),
        (re.compile(r'\\right\s*\}'), '}'),
        (re.compile(r'\\\['), ''),
        (re.compile(r'\\\]'), ''),
        (re.compile(r'\\\('), ''),
        (re.compile(r'\\\)'), ''),
        (re.compile(r'\\frac\{([^}]+)\}\{([^}]+)\}'), r'\1/\2'),
        (re.compile(r'\\dfrac\{([^}]+)\}\{([^}]+)\}'), r'\1/\2'),
        (re.compile(r'\\sqrt\{([^}]+)\}'), r'√(\1)'),
        (re.compile(r'\\sqrt\b'), r'√'),
        (re.compile(r'\^{\s*(-?\d+)\s*}'), r'^\1'),
        (re.compile(r'_{\s*(-?\w+)\s*}'), r'_\1'),
        (re.compile(r'\\times\b'), '×'),
        (re.compile(r'\\div\b'), '÷'),
        (re.compile(r'\\pm\b'), '±'),
        (re.compile(r'\\leq?\b'), '≤'),
        (re.compile(r'\\geq?\b'), '≥'),
        (re.compile(r'\\neq\b'), '≠'),
        (re.compile(r'\\approx\b'), '≈'),
        (re.compile(r'\\circ\b'), '°'),
        (re.compile(r'\\pi\b'), 'π'),
        (re.compile(r'\\%'), '%'),
        (re.compile(r'\\text\{([^}]+)\}'), r'\1'),
        (re.compile(r'\\textbf\{([^}]+)\}'), r'\1'),
        (re.compile(r'\\textit\{([^}]+)\}'), r'\1'),
        (re.compile(r'\\mathbf\{([^}]+)\}'), r'\1'),
        (re.compile(r'\\mathrm\{([^}]+)\}'), r'\1'),
        (re.compile(r'\\mathit\{([^}]+)\}'), r'\1'),
        (re.compile(r'\\ldots\b'), '...'),
        (re.compile(r'\\cdots\b'), '...'),
        (re.compile(r'\\cdot\b'), '·'),
        (re.compile(r'\\!'), ''),
        (re.compile(r'\\,'), ' '),
        (re.compile(r'\\;'), ' '),
        (re.compile(r'\\quad\b'), '  '),
        (re.compile(r'\\qquad\b'), '   '),
        (re.compile(r'\{([^{}]+)\}'), r'\1'),  # strip remaining bare braces
        (re.compile(r'~'), ' '),  # LaTeX non-breaking space
        (re.compile(r'\s{2,}'), ' '),
        (re.compile(r'^\s+|\s+$'), ''),
    ]

    RESIDUAL_LATEX_RE = re.compile(r'\\[a-zA-Z]+')
    DOLLAR_MATH_RE = re.compile(r'\$([^$\n]+)\$')

    def normalize(self, text: str) -> str:
        """Apply the full LATEX_SUBS translation table."""
        s = text
        for pattern, repl in self.LATEX_SUBS:
            s = pattern.sub(repl, s)
        return s

    def has_residual_latex(self, text: str) -> bool:
        """True if untranslated LaTeX commands (\\foo) survive normalization."""
        return bool(self.RESIDUAL_LATEX_RE.search(text))

    def wrap_math(self, text: str) -> str:
        r"""Standardize inline math delimiters: `$...$` -> `\(...\)`.

        Existing `\(...\)` spans pass through unchanged. The Question schema
        allows either delimiter; the bank renderer treats `\(...\)` as the
        canonical inline form, so we converge on it.
        """
        return self.DOLLAR_MATH_RE.sub(lambda m: f'\\({m.group(1).strip()}\\)', text)


# ---------------------------------------------------------------------------
# LLM client (shared by LLMAnnotator + ConceptMapper)
# ---------------------------------------------------------------------------

class LLMClient:
    """Provider-agnostic completion. Provider chosen by LLM_PROVIDER env var:
    groq | openai | anthropic | none.  Missing key => behaves like `none`.

    Enforces >= 1s between calls; exponential backoff (3 attempts) on 429.
    """

    MIN_INTERVAL = 1.0  # seconds between calls

    def __init__(self) -> None:
        self.provider = os.environ.get("LLM_PROVIDER", "").strip().lower()
        if not self.provider:
            # Sensible default: groq if a key is present, else off.
            self.provider = "groq" if os.environ.get("GROQ_API_KEY", "") else "none"
        self._last_call = 0.0
        self._anthropic_client = None
        self._groq_client = None

    # -- availability -------------------------------------------------------

    def available(self) -> bool:
        if self.provider == "groq":
            return bool(os.environ.get("GROQ_API_KEY", ""))
        if self.provider == "openai":
            return bool(os.environ.get("OPENAI_API_KEY", ""))
        if self.provider == "anthropic":
            return bool(os.environ.get("ANTHROPIC_API_KEY", ""))
        return False

    # -- internals ----------------------------------------------------------

    def _throttle(self) -> None:
        elapsed = time.monotonic() - self._last_call
        if elapsed < self.MIN_INTERVAL:
            time.sleep(self.MIN_INTERVAL - elapsed)
        self._last_call = time.monotonic()

    def _complete_groq(self, prompt: str, max_tokens: int, temperature: float) -> str:
        import groq  # type: ignore
        if self._groq_client is None:
            self._groq_client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
        r = self._groq_client.chat.completions.create(
            model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature, max_tokens=max_tokens,
        )
        return (r.choices[0].message.content or "").strip()

    def _complete_openai(self, prompt: str, max_tokens: int, temperature: float) -> str:
        # Raw HTTP — keeps the pipeline dependency-light for this provider.
        resp = requests.post(
            "https://api.openai.com/v1/chat/completions",
            timeout=HTTP_TIMEOUT * 3,
            headers={
                "Authorization": f"Bearer {os.environ.get('OPENAI_API_KEY', '')}",
                "Content-Type": "application/json",
            },
            json={
                "model": os.environ.get("OPENAI_MODEL", "gpt-4o-mini"),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": temperature,
                "max_tokens": max_tokens,
            },
        )
        resp.raise_for_status()
        return resp.json()["choices"][0]["message"]["content"].strip()

    def _complete_anthropic(self, prompt: str, max_tokens: int, temperature: float) -> str:
        import anthropic  # official SDK
        if self._anthropic_client is None:
            self._anthropic_client = anthropic.Anthropic()
        # Default model claude-opus-4-8; override via ANTHROPIC_MODEL (e.g.
        # claude-haiku-4-5 for cheap bulk annotation runs — the user's call).
        # NOTE: temperature is intentionally not passed — removed on Opus
        # 4.7+/Fable 5 (returns 400 there).
        r = self._anthropic_client.messages.create(
            model=os.environ.get("ANTHROPIC_MODEL", "claude-opus-4-8"),
            max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return next((b.text for b in r.content if b.type == "text"), "").strip()

    # -- public -------------------------------------------------------------

    def complete(self, prompt: str, *, max_tokens: int = 400,
                 temperature: float = 0.3) -> Optional[str]:
        """One completion. Returns None on failure or when no provider."""
        if not self.available():
            return None
        for attempt in range(3):
            self._throttle()
            try:
                if self.provider == "groq":
                    return self._complete_groq(prompt, max_tokens, temperature)
                if self.provider == "openai":
                    return self._complete_openai(prompt, max_tokens, temperature)
                if self.provider == "anthropic":
                    return self._complete_anthropic(prompt, max_tokens, temperature)
                return None
            except Exception as e:  # noqa: BLE001
                msg = str(e).lower()
                is_rate = "429" in msg or "rate" in msg or type(e).__name__ == "RateLimitError"
                if is_rate and attempt < 2:
                    time.sleep(2 ** (attempt + 1))
                    continue
                if attempt < 2:
                    time.sleep(2 ** attempt)
                    continue
                return None
        return None


def extract_json_object(raw: str) -> Optional[dict]:
    """Parse a JSON object from an LLM reply, tolerating fences/preamble."""
    if not raw:
        return None
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    m = re.search(r'\{[\s\S]*\}', raw)
    if m:
        try:
            obj = json.loads(m.group(0))
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    return None


# ---------------------------------------------------------------------------
# LLMAnnotator
# ---------------------------------------------------------------------------

class LLMAnnotator:
    """Generates `explanation` + `hints[3]` per question via the configured
    LLM provider, with a persistent SHA-keyed disk cache.

    Cache key: sha1(f"{question}||{','.join(choices)}||{correct_idx}")
    Cache file: ml/data/.explain_cache.json  (same format as ingest_eedi —
    {key: {"explanation": ..., "hints": [...]}}).
    """

    def __init__(self, cache_path: Path = EXPLAIN_CACHE_PATH,
                 client: LLMClient | None = None) -> None:
        self.cache_path = cache_path
        self.client = client or LLMClient()
        self.cache: dict[str, dict] = {}
        if cache_path.exists():
            try:
                self.cache = json.loads(cache_path.read_text())
            except json.JSONDecodeError:
                self.cache = {}
        self.calls_made = 0
        self.cache_hits = 0
        self._dirty = False

    @staticmethod
    def cache_key(question: str, choices: list[str], correct_idx: int) -> str:
        return hashlib.sha1(
            f"{question}||{','.join(choices)}||{correct_idx}".encode()
        ).hexdigest()

    def annotate(self, question: str, choices: list[str], correct_idx: int,
                 concept_id: str, difficulty: str) -> dict:
        """Returns {"explanation": str, "hints": list[str], "used_llm": bool}.

        Graceful no-LLM mode: with LLM_PROVIDER=none (or key missing) returns
        empty strings — the caller applies template fallbacks.
        """
        key = self.cache_key(question, choices, correct_idx)
        if key in self.cache:
            cached = self.cache[key]
            self.cache_hits += 1
            return {"explanation": cached.get("explanation", ""),
                    "hints": cached.get("hints", []), "used_llm": True}

        if not self.client.available():
            return {"explanation": "", "hints": [], "used_llm": False}

        correct = choices[correct_idx]
        concept_label = concept_id.replace("_", " ")
        prompt = (
            f"Math question ({concept_label}, difficulty {difficulty}):\n{question}\n\n"
            "Choices:\n"
            + "\n".join(f"{chr(65 + i)}. {c}" for i, c in enumerate(choices))
            + f"\n\nCorrect answer: {correct}\n\n"
            "Voice: warm, direct, genuinely excited to help a student who has struggled "
            "with math before. Never stilted or corporate-sounding. NEVER use an em dash "
            "(—) anywhere in the reply; use a period, colon, or comma instead.\n\n"
            "Reply with ONLY valid JSON: "
            '{"explanation": "2-3 sentence clear solution walkthrough that ends by naming '
            'the correct answer. If there is a common mistake, briefly say why it is wrong.", '
            '"hints": ["strategy nudge", "first concrete step", "setup without giving the answer"]}'
        )

        raw = self.client.complete(prompt, max_tokens=400, temperature=0.3)
        self.calls_made += 1
        data = extract_json_object(raw or "")
        if not data:
            return {"explanation": "", "hints": [], "used_llm": False}

        explanation = str(data.get("explanation", "")).strip()
        hints = [str(h).strip() for h in data.get("hints", [])][:3]

        # Guard (same as ingest_eedi): reject an explanation that references a
        # wrong answer without ever naming the correct one — likely a bad key claim.
        for i, c in enumerate(choices):
            if (i != correct_idx and c and c.lower() in explanation.lower()
                    and correct.lower() not in explanation.lower()):
                return {"explanation": "", "hints": [], "used_llm": False}

        if explanation:
            self.cache[key] = {"explanation": explanation, "hints": hints}
            self._dirty = True
        return {"explanation": explanation, "hints": hints, "used_llm": bool(explanation)}

    def save_cache(self) -> None:
        if self._dirty:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps(self.cache))
            self._dirty = False


# ---------------------------------------------------------------------------
# ConceptMapper
# ---------------------------------------------------------------------------

class ConceptMapper:
    """Canonical concept-ID authority.

    Loads the live Layer-1 ontology (the SAME file serve.py loads) and derives
    CANONICAL_IDS from it — the ontology is the source of truth, not any
    hard-coded list. Non-canonical IDs commonly used by source taxonomies are
    resolved through ALIASES (mirrors app/src/lib/questionBank.ts BANK_ALIASES
    plus the extra IDs used by the source concept maps in sources/).
    """

    # Non-canonical id -> canonical ontology id.
    ALIASES: dict[str, str] = {
        # mirrors questionBank.ts BANK_ALIASES
        "percent_ratio": "ratios_proportions",
        "data_interpretation": "descriptive_statistics",
        "statistics_data": "descriptive_statistics",
        "statistics_graphs": "descriptive_statistics",
        "probability_statistics": "basic_probability",
        "absolute_value": "linear_inequalities",
        "function_transformations": "functions_basics",
        "trigonometric_identities": "trigonometry_basics",
        "polynomial_operations": "polynomials",
        "systems_linear_equations": "systems_of_linear_equations",
        "geometry_of_circles": "circles_geometry",
        "lines_and_angles": "lines_angles",
        "area_and_volume": "area_volume",
        "sequences_and_series": "sequences_series",
        "triangles_and_congruence": "triangles_congruence",
        # extra source-taxonomy ids used by the adapters in sources/
        "integer_operations": "number_properties",
        "coordinate_geometry": "linear_equations",
        "combinatorics": "basic_probability",
        "proportional_reasoning": "ratios_proportions",
        "number_patterns": "sequences_series",
        "inequalities_systems": "linear_inequalities",
        "plane_geometry": "lines_angles",
        "solid_geometry": "area_volume",
        "analytic_geometry": "linear_equations",
        "right_triangle": "right_triangle_geometry",
        "quadratics": "quadratic_equations",
    }

    def __init__(self, ontology_path: Path = ONTOLOGY_PATH,
                 client: LLMClient | None = None) -> None:
        self.ontology_path = ontology_path
        self.client = client or LLMClient()
        ontology = json.loads(ontology_path.read_text())
        concepts = ontology.get("concepts", [])
        self.CANONICAL_IDS: set[str] = {c["id"] for c in concepts}
        self._names: dict[str, str] = {c["id"]: c.get("name", c["id"]) for c in concepts}
        self._act_tested: set[str] = {
            c["id"] for c in concepts
            if (c.get("act_relevance") or {}).get("tested")
        }
        # ontology-declared aliases join the table too
        for c in concepts:
            for alias in c.get("aliases") or []:
                self.ALIASES.setdefault(alias, c["id"])
        self._map_cache: dict[str, str] = {}
        if CONCEPT_MAP_CACHE_PATH.exists():
            try:
                self._map_cache = json.loads(CONCEPT_MAP_CACHE_PATH.read_text())
            except json.JSONDecodeError:
                self._map_cache = {}
        self._cache_dirty = False

    def validate(self, concept_id: str) -> bool:
        return concept_id in self.CANONICAL_IDS

    def resolve(self, concept_id: str) -> Optional[str]:
        """Canonical id for `concept_id` (identity or alias), else None."""
        if concept_id in self.CANONICAL_IDS:
            return concept_id
        return self.ALIASES.get(concept_id)

    def concept_name(self, concept_id: str) -> str:
        return self._names.get(concept_id, concept_id.replace("_", " "))

    def act_tested_ids(self) -> set[str]:
        """Concepts with act_relevance.tested == true (~29 for ACT)."""
        return set(self._act_tested)

    def llm_map(self, source_concept: str, context: str) -> Optional[str]:
        """Map an unknown source concept/tag to a MindCraft concept via LLM.

        Returns a canonical concept id, or None when there is no good match
        (or no LLM). Results cached at ml/data/.concept_map_cache.json keyed
        by sha1 of source_concept + a context snippet.
        """
        cache_key = hashlib.sha1(
            f"{source_concept}||{context[:200]}".encode()
        ).hexdigest()
        if cache_key in self._map_cache:
            cached = self._map_cache[cache_key]
            return cached if cached in self.CANONICAL_IDS else None

        if not self.client.available():
            return None

        id_list = "\n".join(sorted(self.CANONICAL_IDS))
        prompt = (
            "You classify math questions into a fixed concept ontology.\n\n"
            f"Source topic label: {source_concept or '(none)'}\n"
            f"Question text:\n{context[:800]}\n\n"
            "Valid concept IDs (choose exactly one, or NONE if nothing fits):\n"
            f"{id_list}\n\n"
            "Reply with ONLY the single best concept ID from the list above, "
            "or the word NONE. No explanation."
        )
        raw = self.client.complete(prompt, max_tokens=30, temperature=0.0)
        if raw is None:
            return None
        answer = raw.strip().strip("`'\"").split()[0] if raw.strip() else "NONE"
        resolved = self.resolve(answer) if answer != "NONE" else None
        self._map_cache[cache_key] = resolved or "NONE"
        self._cache_dirty = True
        return resolved

    def save_cache(self) -> None:
        if self._cache_dirty:
            CONCEPT_MAP_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            CONCEPT_MAP_CACHE_PATH.write_text(json.dumps(self._map_cache, indent=1))
            self._cache_dirty = False


# ---------------------------------------------------------------------------
# QuestionValidator
# ---------------------------------------------------------------------------

class QuestionValidator:
    """Structural validation against the questionBank.Question contract (C5)."""

    def __init__(self, mapper: ConceptMapper,
                 allowed_choice_counts: set[int] | None = None) -> None:
        self.mapper = mapper
        self.allowed_choice_counts = allowed_choice_counts or {4}

    def validate(self, q: dict) -> list[str]:
        """Returns a list of error strings; empty list == valid."""
        errors: list[str] = []
        if not str(q.get("id", "")).strip():
            errors.append("id_empty")
        if q.get("conceptId") not in self.mapper.CANONICAL_IDS:
            errors.append(f"conceptId_invalid:{q.get('conceptId')}")
        if q.get("level") not in (1, 2, 3):
            errors.append(f"level_invalid:{q.get('level')}")
        if not str(q.get("question", "")).strip():
            errors.append("question_empty")
        choices = q.get("choices")
        if not isinstance(choices, list) or len(choices) not in self.allowed_choice_counts:
            errors.append(f"choices_count:{len(choices) if isinstance(choices, list) else 'none'}")
        elif any(not str(c).strip() for c in choices):
            errors.append("choice_empty")
        # correctIndex: 0-3 for 4-choice items; 0-(n-1) for larger allowed
        # choice counts (AMC keeps 5 choices natively).
        ci = q.get("correctIndex")
        n_choices = len(choices) if isinstance(choices, list) else 0
        if not (isinstance(ci, int) and 0 <= ci < max(n_choices, 1)):
            errors.append(f"correctIndex_invalid:{ci}")
        fmt = q.get("format")
        if fmt is not None and fmt not in FORMAT_IDS:
            errors.append(f"format_invalid:{fmt}")
        tag = q.get("examTag")
        if tag is not None and tag not in EXAM_TAGS:
            errors.append(f"examTag_invalid:{tag}")
        return errors

    @staticmethod
    def has_valid_key(q: dict) -> bool:
        ci = q.get("correctIndex")
        choices = q.get("choices") or []
        return isinstance(ci, int) and 0 <= ci < len(choices)


# ---------------------------------------------------------------------------
# PipelineReport
# ---------------------------------------------------------------------------

@dataclass
class PipelineReport:
    source: str
    total_raw: int = 0
    accepted: int = 0
    rejected_by_reason: dict[str, int] = field(default_factory=dict)
    concept_distribution: dict[str, int] = field(default_factory=dict)
    level_distribution: dict[int, int] = field(default_factory=dict)
    llm_calls_made: int = 0
    llm_cache_hits: int = 0

    @property
    def rejected(self) -> int:
        return sum(self.rejected_by_reason.values())

    def summary(self) -> str:
        lines = [
            "=" * 60,
            f"Ingestion summary — source: {self.source}",
            "=" * 60,
            f"  Raw items:  {self.total_raw:,}",
            f"  Accepted:   {self.accepted:,}"
            + (f"  ({self.accepted / max(1, self.total_raw):.1%})" if self.total_raw else ""),
            f"  Rejected:   {self.rejected:,}",
        ]
        if self.rejected_by_reason:
            lines.append("\nReject reasons:")
            for reason, n in sorted(self.rejected_by_reason.items(), key=lambda x: -x[1]):
                lines.append(f"  {reason:<38} {n:5d}")
        if self.concept_distribution:
            lines.append("\nAccepted by concept (top 15):")
            top = sorted(self.concept_distribution.items(), key=lambda x: -x[1])[:15]
            for cid, n in top:
                lines.append(f"  {cid:<40} {n:5d}")
        if self.level_distribution:
            lvl = " ".join(f"L{k}={v}" for k, v in sorted(self.level_distribution.items()))
            lines.append(f"\nLevel distribution: {lvl}")
        lines.append(f"LLM calls: {self.llm_calls_made:,}  cache hits: {self.llm_cache_hits:,}")
        return "\n".join(lines)

    def to_json(self) -> dict:
        return {
            "source": self.source,
            "total_raw": self.total_raw,
            "accepted": self.accepted,
            "rejected": self.rejected,
            "rejected_by_reason": self.rejected_by_reason,
            "concept_distribution": self.concept_distribution,
            "level_distribution": {str(k): v for k, v in self.level_distribution.items()},
            "llm_calls_made": self.llm_calls_made,
            "llm_cache_hits": self.llm_cache_hits,
        }


# ---------------------------------------------------------------------------
# SourceAdapter
# ---------------------------------------------------------------------------

class SourceAdapter(ABC):
    """One question source. Subclass, implement name/fetch/parse_item.

    parse_item() may additionally set these underscore-prefixed hint fields
    (consumed and stripped by run_pipeline, never written to output):
        _source_concept : str  — raw source topic label, for LLM concept mapping
        _act_if_tested  : bool — set examTag='ACT' when the resolved concept
                                 is in the ontology's ACT tested set
    """

    # Override in subclasses that legitimately deviate (AMC: {4, 5}).
    ALLOWED_CHOICE_COUNTS: set[int] = {4}

    def __init__(self, mapper: ConceptMapper | None = None) -> None:
        self.mapper = mapper  # injected by run_pipeline when None

    @abstractmethod
    def name(self) -> str:
        """Short source slug used in question IDs, e.g. 'openstax'."""

    @abstractmethod
    def fetch(self, **kwargs) -> list[dict]:
        """Fetch raw items from source. Returns list of raw dicts."""

    @abstractmethod
    def parse_item(self, raw: dict) -> dict | None:
        """Parse one raw item -> partial Question dict, or None to reject.

        Must set: question, choices, correctIndex, conceptId (may be None to
        request LLM mapping), level.
        May set:  examTag, format, misconception_id, misconception_label.
        Does NOT set: id (generated), explanation, hints (LLM fills these).
        """

    def concept_map(self) -> dict[str, tuple[str, int]]:
        """Source taxonomy -> (mindcraft_concept_id, default_level).
        Return empty dict to use LLM mapping for all source concepts."""
        return {}


# ---------------------------------------------------------------------------
# Format detection + template fallbacks (shared)
# ---------------------------------------------------------------------------

WORD_PROBLEM_RE = re.compile(
    r'\b(buys?|sells?|travels?|costs?|each|per\b|earns?|shares?|spends?|'
    r'has\b|have\b|gives?|takes?|needs?|plans?|makes?)\b', re.I)


def detect_format(question: str, choices: list[str]) -> str:
    """Same heuristic as ingest_eedi.assign_format."""
    all_text = ' '.join([question] + choices)
    q_lower = question.lower()
    if '(diagram:' in q_lower:
        if re.search(r'number line|number-line', q_lower):
            return 'number_line'
        if re.search(r'graph with|coordinate|axes|x-axis|y-axis|grid', q_lower):
            return 'coordinate_graph'
        return 'diagram'
    if re.search(r'\btable\b|\brow\b.*\bcolumn\b|\|.*\|', all_text, re.I):
        return 'table'
    if len(question) > 120 and WORD_PROBLEM_RE.search(question):
        return 'word_problem'
    return 'symbolic_expression'


def build_template_explanation(choices: list[str], correct_idx: int,
                               concept_label: str) -> str:
    correct = choices[correct_idx]
    return (f"The correct answer is {correct}. "
            f"Review the key steps for {concept_label.lower()} to confirm your reasoning.")


def build_template_hints(concept_label: str) -> list[str]:
    return [
        "Read the question again. What is it specifically asking you to find?",
        f"Think about the key property of {concept_label.lower()} that applies here.",
        "Set up the calculation step by step before combining terms.",
    ]


def strip_html(raw_html: str) -> str:
    """Strip HTML tags / entities into plain text (for OpenStax/Perseus stems)."""
    s = re.sub(r'<br\s*/?>', '\n', raw_html)
    s = re.sub(r'</(p|div|li|tr)>', '\n', s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = html_lib.unescape(s)
    s = re.sub(r'[ \t]+', ' ', s)
    s = re.sub(r'\s*\n\s*', '\n', s)
    return s.strip()


# ---------------------------------------------------------------------------
# run_pipeline
# ---------------------------------------------------------------------------

def run_pipeline(
    adapter: SourceAdapter,
    out_path: str | Path,
    annotate: bool = True,
    dry_run: bool = False,
    limit: int | None = None,
    concept_filter: set[str] | None = None,
    fetch_kwargs: dict | None = None,
) -> PipelineReport:
    """The shared ingestion loop. See module docstring for stage order."""
    report = PipelineReport(source=adapter.name())
    mapper = adapter.mapper or ConceptMapper()
    adapter.mapper = mapper
    diagram = DiagramFilter()
    latex = LaTeXNormalizer()
    annotator = LLMAnnotator() if annotate else None
    validator = QuestionValidator(mapper, adapter.ALLOWED_CHOICE_COUNTS)

    def reject(reason: str) -> None:
        report.rejected_by_reason[reason] = report.rejected_by_reason.get(reason, 0) + 1

    raw_items = adapter.fetch(**(fetch_kwargs or {}))
    if limit:
        raw_items = raw_items[:limit]
    report.total_raw = len(raw_items)

    questions: list[dict] = []
    seen_ids: set[str] = set()

    for raw in raw_items:
        parsed = adapter.parse_item(raw)
        if parsed is None:
            reject("R0_parse_failed")
            continue

        source_concept = parsed.pop("_source_concept", "")
        act_if_tested = parsed.pop("_act_if_tested", False)

        # ── R1: concept mapping (static map, alias table, then LLM fallback)
        concept_id = parsed.get("conceptId")
        if concept_id:
            concept_id = mapper.resolve(concept_id)
        if not concept_id:
            concept_id = mapper.llm_map(source_concept, parsed.get("question", ""))
        if not concept_id:
            reject("R1_concept_unmapped")
            continue
        parsed["conceptId"] = concept_id
        if concept_filter and concept_id not in concept_filter:
            reject("R1_concept_filter")
            continue

        # ── R2: diagram filter (alt-text recovery first, then deixis checks)
        q_text, alts_ok = diagram.recover_alt_text(str(parsed["question"]))
        if not alts_ok:
            reject("R2_diagram_no_alt")
            continue
        if diagram.still_visual(q_text):
            reject("R2_diagram_ambiguous")
            continue
        if "(diagram:" not in q_text.lower() and diagram.is_diagram_dependent(q_text):
            reject("R2_diagram_dependent")
            continue

        # ── R3: structural pre-checks
        choices = [str(c) for c in (parsed.get("choices") or [])]
        if len(choices) not in adapter.ALLOWED_CHOICE_COUNTS:
            reject("R3_choice_count")
            continue
        if not QuestionValidator.has_valid_key({"correctIndex": parsed.get("correctIndex"),
                                                "choices": choices}):
            reject("R3_bad_key")
            continue
        if len(q_text.strip()) < 15:
            reject("R3_too_short")
            continue

        # ── R4: LaTeX normalization
        q_norm = latex.wrap_math(latex.normalize(q_text))
        choices_norm = [latex.wrap_math(latex.normalize(c)) for c in choices]
        choices_norm = [re.sub(r'\s+', ' ', c).strip() for c in choices_norm]
        if latex.has_residual_latex(q_norm) or any(latex.has_residual_latex(c)
                                                   for c in choices_norm):
            reject("R4_latex_residual")
            continue
        # dedupe of the correct answer against other choices
        ci = int(parsed["correctIndex"])
        norm_lower = [c.strip().lower() for c in choices_norm]
        if sum(1 for c in norm_lower if c == norm_lower[ci]) > 1:
            reject("R4_duplicate_correct")
            continue

        # ── ID + dedupe (adapters may supply a stable `_id`, e.g. the
        # MCQ-conversion path uses openstax_mcq_{uid})
        qid = parsed.pop("_id", None) or \
            f"{adapter.name()}_{hashlib.sha1(q_norm.encode()).hexdigest()[:8]}"
        if qid in seen_ids:
            reject("R5_duplicate_question")
            continue
        seen_ids.add(qid)

        # ── Assemble
        level = int(parsed.get("level") or 2)
        level = max(1, min(3, level))
        fmt = parsed.get("format") or detect_format(q_norm, choices_norm)
        concept_label = mapper.concept_name(concept_id)

        entry: dict = {
            "id": qid,
            "conceptId": concept_id,
            "level": level,
            "question": q_norm,
            "choices": choices_norm,
            "correctIndex": ci,
        }

        # ── LLM annotation (explanation + hints), with template fallback.
        # Adapters that already produced these (MCQ conversion writes a
        # protagonist-voiced explanation) pre-empt the annotator.
        explanation = str(parsed.get("explanation") or "")
        hints = [str(h) for h in (parsed.get("hints") or [])]
        if annotator is not None and not explanation:
            result = annotator.annotate(q_norm, choices_norm, ci,
                                        concept_id, f"L{level}")
            explanation, hints = result["explanation"], result["hints"]
        if not explanation:
            explanation = build_template_explanation(choices_norm, ci, concept_label)
        if len(hints) < 3:
            hints = build_template_hints(concept_label)
        entry["explanation"] = explanation
        entry["hints"] = hints[:3]

        if parsed.get("examTag"):
            entry["examTag"] = parsed["examTag"]
        elif act_if_tested and concept_id in mapper.act_tested_ids():
            entry["examTag"] = "ACT"
        if fmt:
            entry["format"] = fmt
        if parsed.get("misconception_id"):
            entry["misconception_id"] = parsed["misconception_id"]
        if parsed.get("misconception_label"):
            entry["misconception_label"] = parsed["misconception_label"]
        if parsed.get("storyContext"):
            # Narrative scene-setter rendered above the stem (WORLD_VISION).
            entry["storyContext"] = str(parsed["storyContext"]).strip()

        # ── Final validation
        errors = validator.validate(entry)
        if errors:
            reject("R6_" + errors[0].split(":")[0])
            continue

        questions.append(entry)
        report.accepted += 1
        report.concept_distribution[concept_id] = \
            report.concept_distribution.get(concept_id, 0) + 1
        report.level_distribution[level] = report.level_distribution.get(level, 0) + 1

    if annotator is not None:
        report.llm_calls_made = annotator.calls_made
        report.llm_cache_hits = annotator.cache_hits
        annotator.save_cache()
    mapper.save_cache()

    # ── Write output ─────────────────────────────────────────────────────
    if not dry_run:
        out_path = Path(out_path)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "_meta": {
                "source": adapter.name(),
                "ingested_at": datetime.now(timezone.utc).isoformat(),
                "total": len(questions),
                "pipeline_version": PIPELINE_VERSION,
            },
            "questions": questions,
        }
        out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

        report_dir = ML_DATA / "pipeline_reports"
        report_dir.mkdir(parents=True, exist_ok=True)
        (report_dir / f"{adapter.name()}_report.json").write_text(
            json.dumps(report.to_json(), indent=2) + "\n")
        print(f"\nWrote {len(questions)} questions -> {out_path}")

    print(report.summary())
    return report
