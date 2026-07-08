#!/usr/bin/env python3
"""
MCQ generation from free-response math items — triple-verified.

The OpenStax math corpus is ~6,000 free-response exercises with no published
answer key. This module turns them into 4-choice MCQs the question bank can
serve, with three layers of defense against the ~30% LLM error rate observed
in the earlier `ml/generation/` run:

    MathSolver          — one step-by-step solve, parses a FINAL ANSWER line
    TripleVerify        — N (default 3) INDEPENDENT re-solves under different
                          personas; requires 2/3 agreement with the proposed
                          answer or the question is dropped
    DistractorGenerator — 3 wrong-but-plausible choices forced through a real
                          student-error taxonomy (sign_error, arithmetic,
                          wrong_formula, unit_confusion)
    MCQFromFreeResponse — orchestrator: solve → verify → distractors →
                          shuffle → story-voiced explanation → Question dict

Every result (success AND verified-failure) is cached in
`ml/data/.mcq_gen_cache.json` keyed by `{uid}:{sha1(stem)[:12]}`, so a
multi-hour run over the full corpus is resumable: re-runs never re-spend an
LLM call on a question that has already been solved or already failed verify.

No-LLM mode (LLM_PROVIDER=none / no key / --no-llm) emits deterministic
template answers so the pipeline structure can be exercised end-to-end
without burning API credits. Template results are NEVER cached.
"""

from __future__ import annotations

import hashlib
import json
import random
import re
import sys
from fractions import Fraction
from pathlib import Path
from typing import Optional

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base import LLMClient, ML_DATA, extract_json_object  # noqa: E402

MCQ_CACHE_PATH = ML_DATA / ".mcq_gen_cache.json"
SKIP_REPORT_PATH = ML_DATA / "pipeline_reports" / "openstax_mcq_skips.json"

ERROR_TYPES = ("sign_error", "arithmetic", "wrong_formula", "unit_confusion")

FINAL_ANSWER_RE = re.compile(r'FINAL ANSWER\s*[:\-]\s*(.+?)\s*$',
                             re.I | re.M)
STEP_LINE_RE = re.compile(
    r'^\s*(?:[-*•]\s*)?(?:\*\*)?(?:step\s*)?\d+(?:\*\*)?[.):\]]*\s*(.+)$',
    re.I | re.M)


# ---------------------------------------------------------------------------
# Answer normalization / equivalence
# ---------------------------------------------------------------------------

_NUM_CLEAN_RE = re.compile(r'[,\s$]')
_UNIT_TAIL_RE = re.compile(
    r'\s*(dollars?|cents?|units?|degrees?|°|%|percent|feet|foot|ft|meters?|m\b|'
    r'cm|km|miles?|mi\b|inches?|in\b|seconds?|sec|s\b|minutes?|min|hours?|hr?s?\b|'
    r'square \w+|cubic \w+)\.?\s*$', re.I)
_LEAD_VAR_RE = re.compile(r'^\s*[a-zA-Z]\w*\s*=\s*')

# Unicode superscripts -> ^n  (LLMs answer "b⁹" as often as "b^9")
_SUP_MAP = str.maketrans('⁰¹²³⁴⁵⁶⁷⁸⁹⁻', '0123456789-')
_SUP_RUN_RE = re.compile(r'[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+')


def normalize_answer(ans: str) -> str:
    """Canonical comparable form of an answer string."""
    s = str(ans).strip().rstrip('.').strip()
    s = _LEAD_VAR_RE.sub('', s)              # "x = 5"  -> "5"
    s = s.replace('\\(', '').replace('\\)', '').replace('$', '')
    s = _SUP_RUN_RE.sub(lambda m: '^' + m.group(0).translate(_SUP_MAP), s)
    s = re.sub(r'\\frac\{([^}]+)\}\{([^}]+)\}', r'\1/\2', s)
    s = re.sub(r'\\(times|cdot)\b', '*', s)
    s = s.replace('{', '').replace('}', '')  # 11^{48} -> 11^48
    s = _UNIT_TAIL_RE.sub('', s)             # "12 dollars" -> "12"
    s = s.strip().strip('()').strip()
    return s.lower()


_MUL_WS_RE = re.compile(r'[\s×·*]|\\,')


def _symbolic_form(ans: str) -> str:
    """Whitespace/multiplication-sign-free form: 'a^6 × b^6' == 'a^6b^6'."""
    return _MUL_WS_RE.sub('', normalize_answer(ans))


# JSON decoding turns an LLM's raw "\times"/"\frac" inside a JSON string into
# control characters (tab + "imes", formfeed + "rac"). Undo that so the LaTeX
# normalizer downstream can translate the commands properly.
_CTRL_REPAIR = str.maketrans({'\t': '\\t', '\f': '\\f',
                              '\b': '\\b', '\n': '\\n', '\r': ''})


def repair_ctrl_chars(s: str) -> str:
    return str(s).translate(_CTRL_REPAIR)


def parse_llm_json(raw: str) -> Optional[dict]:
    """extract_json_object, tolerating LaTeX backslashes in string values.

    An LLM writing `\\(` or `\\frac` inside a JSON string produces invalid
    JSON escapes and the whole reply fails to parse. The second attempt
    escapes every backslash that is not a legal JSON escape.
    """
    data = extract_json_object(raw)
    if data:
        return data
    fixed = re.sub(r'\\(?![\\/"bfnrtu])', r'\\\\', raw or "")
    return extract_json_object(fixed)


def parse_number(s: str) -> Optional[Fraction]:
    """Parse a normalized answer into an exact Fraction, or None."""
    s = _NUM_CLEAN_RE.sub('', normalize_answer(s))
    s = s.rstrip('%')
    if not s:
        return None
    try:
        if '/' in s:
            num, _, den = s.partition('/')
            return Fraction(Fraction(num), Fraction(den))
        return Fraction(s)
    except (ValueError, ZeroDivisionError):
        return None


def answers_match(a: str, b: str) -> bool:
    """True when two answer strings are the same value.

    Numeric answers compare with 0.5% relative tolerance (LLMs round
    differently: 12.57 vs 12.566). Non-numeric answers compare as normalized
    lowercase strings.
    """
    na, nb = normalize_answer(a), normalize_answer(b)
    if na == nb:
        return True
    fa, fb = parse_number(a), parse_number(b)
    if fa is not None and fb is not None:
        if fa == fb:
            return True
        denom = max(abs(fa), abs(fb))
        return denom > 0 and abs(fa - fb) / denom <= Fraction(1, 200)
    if fa is None and fb is None and _symbolic_form(a) == _symbolic_form(b):
        return True  # 'a^6 × b^6' == '$a^6b^6$'
    # "11^48 or 97021..." — a verifier offering equivalent alternative forms.
    parts_b = re.split(r'\s+or\s+|\s*=\s*', str(b))
    if len(parts_b) > 1:
        return any(answers_match(a, p) for p in parts_b if p.strip())
    return False


# ---------------------------------------------------------------------------
# MathSolver
# ---------------------------------------------------------------------------

class MathSolver:
    """Solve one math stem step-by-step; extract a FINAL ANSWER line."""

    BASE_PROMPT = """\
{persona}

Solve this math problem. Show your work as numbered steps — one operation per
step, checking each calculation before moving on. Keep every step short.

Problem:
{stem}

After your steps, end with exactly one line in this exact format:
FINAL ANSWER: <the answer only — a number, expression, or short phrase, \
no units unless the problem demands them, no explanation>

Write the FINAL ANSWER in plain notation (12^21, 3/4, -5, a^8) — \
no LaTeX commands, no dollar signs, no unicode superscripts."""

    DEFAULT_PERSONA = ("You are a precise mathematician. You never skip "
                       "arithmetic and you never guess.")

    def __init__(self, client: LLMClient | None = None) -> None:
        self.client = client or LLMClient()

    def solve(self, stem: str, persona: str | None = None,
              temperature: float = 0.2) -> dict:
        """Returns {"steps": [...], "answer": str, "confidence": float}."""
        if not self.client.available():
            # Structural template (dry runs) — confidence 1.0 so the
            # orchestrator's gates exercise the success path.
            return {"steps": ["(no LLM — template answer)"],
                    "answer": "42", "confidence": 1.0}

        prompt = self.BASE_PROMPT.format(
            persona=persona or self.DEFAULT_PERSONA, stem=stem)
        raw = self.client.complete(prompt, max_tokens=800,
                                   temperature=temperature)
        if not raw:
            return {"steps": [], "answer": "", "confidence": 0.0}

        m = None
        for m in FINAL_ANSWER_RE.finditer(raw):
            pass  # keep the LAST FINAL ANSWER line
        steps = [s.strip() for s in STEP_LINE_RE.findall(raw)][:12]
        if m:
            return {"steps": steps, "answer": m.group(1).strip(),
                    "confidence": 0.9}
        # Fallback: last non-empty line, low confidence.
        lines = [ln.strip() for ln in raw.splitlines() if ln.strip()]
        if lines:
            return {"steps": steps, "answer": lines[-1][:120],
                    "confidence": 0.4}
        return {"steps": [], "answer": "", "confidence": 0.0}


# ---------------------------------------------------------------------------
# TripleVerify
# ---------------------------------------------------------------------------

class TripleVerify:
    """N independent re-solves; 2-of-3 agreement gate on a proposed answer.

    Each verify pass is a FRESH solve (the proposed answer is never shown to
    the verifier — no anchoring), under a different persona so the passes
    don't all reproduce one failure mode.
    """

    PERSONAS = (
        "You are a careful student who double-checks every arithmetic step "
        "before writing it down.",
        "You are a math teacher checking work for an answer key. Be strict: "
        "redo every calculation yourself.",
        "You are a mathematician who prefers unconventional routes. Solve "
        "this using a different method than the most obvious one, then "
        "sanity-check the result.",
        "You are an exam grader estimating first, then computing exactly. "
        "If your estimate and your computation disagree, recompute.",
        "You are a programmer who translates word problems into equations "
        "mechanically and evaluates them exactly.",
    )

    def __init__(self, solver: MathSolver | None = None,
                 verify_count: int = 3) -> None:
        self.solver = solver or MathSolver()
        self.verify_count = max(2, min(verify_count, len(self.PERSONAS)))

    def _threshold(self) -> int:
        # 2/3 agreement, generalized: both for n=2; >= ceil(2n/3) for n >= 3.
        if self.verify_count == 2:
            return 2
        return max(2, -(-2 * self.verify_count // 3))

    def verify(self, stem: str, answer: str) -> dict:
        """Returns {"verified": bool, "agreement": int, "solve_traces": [...]}."""
        if not self.solver.client.available():
            # Structural (no-LLM) mode: pass-through so dry runs flow.
            return {"verified": True, "agreement": self.verify_count,
                    "solve_traces": [{"answer": answer, "template": True}]}

        traces: list[dict] = []
        agreement = 0
        for i in range(self.verify_count):
            trace = self.solver.solve(stem, persona=self.PERSONAS[i],
                                      temperature=0.3)
            match = bool(trace["answer"]) and answers_match(trace["answer"], answer)
            traces.append({"persona": i, "answer": trace["answer"],
                           "match": match})
            if match:
                agreement += 1
            # Early exit either way: outcome already decided.
            remaining = self.verify_count - (i + 1)
            if agreement >= self._threshold() or \
                    agreement + remaining < self._threshold():
                break
        return {"verified": agreement >= self._threshold(),
                "agreement": agreement, "solve_traces": traces}


# ---------------------------------------------------------------------------
# DistractorGenerator
# ---------------------------------------------------------------------------

class DistractorGenerator:
    """3 wrong-but-plausible choices via a forced student-error taxonomy."""

    PROMPT = """\
You design multiple-choice math distractors that mirror REAL student errors.

Problem:
{stem}

Correct answer: {answer}

Write exactly 3 wrong answer choices, each produced by one of these error
types (use 3 DIFFERENT types):
- sign_error: the student flipped a sign somewhere in the work
- arithmetic: an off-by-one or small arithmetic slip
- wrong_formula: a related but incorrect formula or approach
- unit_confusion: correct method, wrong unit or scale (x10, /100, wrong unit)

Rules:
- Every distractor must be a plausible result of ACTUALLY making that mistake
  on THIS problem — trace the wrong work in your head first.
- Every distractor must differ from the correct answer and from each other.
- Match the correct answer's format (same units, same precision style).
- Write values in plain notation (12^21, 3/4, -5, a^8): NO LaTeX commands,
  NO backslashes, NO dollar signs.

Reply with ONLY valid JSON:
{{"distractors": [
  {{"value": "...", "error_type": "...", "student_thinking": "one sentence: the mistake that produces this value"}},
  {{"value": "...", "error_type": "...", "student_thinking": "..."}},
  {{"value": "...", "error_type": "...", "student_thinking": "..."}}
]}}"""

    def __init__(self, client: LLMClient | None = None) -> None:
        self.client = client or LLMClient()

    # -- fallbacks ----------------------------------------------------------

    @staticmethod
    def _numeric_fallback(answer: str) -> Optional[list[dict]]:
        """Deterministic taxonomy-shaped perturbations of a numeric answer."""
        val = parse_number(answer)
        if val is None:
            return None
        is_int = val.denominator == 1

        def fmt(f: Fraction) -> str:
            if f.denominator == 1:
                return str(f.numerator)
            return str(round(float(f), 4)).rstrip('0').rstrip('.')

        candidates = [
            (-val, "sign_error"),
            (val + (1 if is_int else Fraction(1, 10)), "arithmetic"),
            (val * 2, "wrong_formula"),
            (val * 10, "unit_confusion"),
            (val - (1 if is_int else Fraction(1, 10)), "arithmetic"),
            (val / 2 if val else Fraction(5), "wrong_formula"),
        ]
        out: list[dict] = []
        seen = {fmt(val)}
        for v, etype in candidates:
            s = fmt(v)
            if s not in seen:
                seen.add(s)
                out.append({"value": s, "error_type": etype})
            if len(out) == 3:
                return out
        return None

    def _validate(self, items: list, answer: str) -> Optional[list[dict]]:
        if not isinstance(items, list) or len(items) < 3:
            return None
        out: list[dict] = []
        for d in items[:3]:
            if not isinstance(d, dict):
                return None
            value = repair_ctrl_chars(d.get("value", "")).strip()
            etype = str(d.get("error_type", "")).strip()
            if not value or etype not in ERROR_TYPES:
                return None
            if answers_match(value, answer):
                return None  # collides with the correct answer
            if any(answers_match(value, prev["value"]) for prev in out):
                return None  # collides with another distractor
            out.append({"value": value, "error_type": etype})
        return out

    # -- public --------------------------------------------------------------

    def generate(self, stem: str, answer: str) -> Optional[list[dict]]:
        """Returns [{"value","error_type"} x3] or None when unbuildable."""
        if not self.client.available():
            return (self._numeric_fallback(answer)
                    or [{"value": "41", "error_type": "arithmetic"},
                        {"value": "-42", "error_type": "sign_error"},
                        {"value": "84", "error_type": "wrong_formula"}])

        prompt = self.PROMPT.format(stem=stem, answer=answer)
        for attempt, temp in enumerate((0.5, 0.8)):
            raw = self.client.complete(prompt, max_tokens=500, temperature=temp)
            data = parse_llm_json(raw or "")
            validated = self._validate((data or {}).get("distractors"), answer)
            if validated:
                return validated
        return self._numeric_fallback(answer)


# ---------------------------------------------------------------------------
# MCQFromFreeResponse — the orchestrator
# ---------------------------------------------------------------------------

class MCQFromFreeResponse:
    """Free-response stem -> verified 4-choice MCQ (partial Question dict).

    solve → triple-verify → distractors → deterministic shuffle → story-
    voiced explanation (via an injected StoryWrapper, when provided).

    Never raises out of convert(): every failure is caught, cached (when it
    is an LLM verdict, i.e. deterministic-retry would waste money), counted,
    and reported in `self.skips`.
    """

    def __init__(self, client: LLMClient | None = None,
                 story_wrapper=None, verify_count: int = 3,
                 cache_path: Path = MCQ_CACHE_PATH) -> None:
        self.client = client or LLMClient()
        self.solver = MathSolver(self.client)
        self.verifier = TripleVerify(self.solver, verify_count)
        self.distractors = DistractorGenerator(self.client)
        self.story_wrapper = story_wrapper
        self.cache_path = cache_path
        self.cache: dict[str, dict] = {}
        if cache_path.exists():
            try:
                self.cache = json.loads(cache_path.read_text())
            except json.JSONDecodeError:
                self.cache = {}
        self._dirty = 0
        self.skips: list[dict] = []
        self.stats = {"cache_hits": 0, "solved": 0, "verify_failed": 0,
                      "no_answer": 0, "distractor_failed": 0, "errors": 0}

    # -- cache ----------------------------------------------------------------

    @staticmethod
    def cache_key(uid: str, stem: str) -> str:
        return f"{uid}:{hashlib.sha1(stem.encode()).hexdigest()[:12]}"

    def save_cache(self) -> None:
        if self._dirty:
            self.cache_path.parent.mkdir(parents=True, exist_ok=True)
            self.cache_path.write_text(json.dumps(self.cache))
            self._dirty = 0
        if self.skips:
            SKIP_REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
            SKIP_REPORT_PATH.write_text(
                json.dumps(self.skips, indent=1, ensure_ascii=False))

    def _remember(self, key: str, record: dict) -> None:
        # Template (no-LLM) verdicts must never poison a future real run.
        if self.client.available():
            self.cache[key] = record
            self._dirty += 1
            if self._dirty >= 20:
                self.save_cache()

    def _skip(self, uid: str, reason: str, detail: str = "") -> None:
        self.skips.append({"uid": uid, "reason": reason, "detail": detail[:200]})

    # -- conversion ------------------------------------------------------------

    def convert(self, uid: str, stem: str, concept_id: str,
                level: int, concept_name: str = "") -> Optional[dict]:
        """Returns a partial Question dict (question/choices/correctIndex/
        explanation/hints/storyContext) or None when the item is dropped."""
        key = self.cache_key(uid, stem)
        cached = self.cache.get(key)
        if cached is not None:
            self.stats["cache_hits"] += 1
            if cached.get("status") != "ok":
                self._skip(uid, cached.get("status", "failed"), "(cached)")
                return None
            return self._assemble(uid, stem, concept_id, level,
                                  concept_name, cached)
        try:
            return self._convert_uncached(key, uid, stem, concept_id,
                                          level, concept_name)
        except Exception as e:  # noqa: BLE001 — never kill a long run
            self.stats["errors"] += 1
            self._skip(uid, "exception", f"{type(e).__name__}: {e}")
            return None

    def _convert_uncached(self, key: str, uid: str, stem: str,
                          concept_id: str, level: int,
                          concept_name: str) -> Optional[dict]:
        # Step 1: solve
        solved = self.solver.solve(stem)
        answer = solved["answer"]
        if not answer or solved["confidence"] < 0.3:
            self.stats["no_answer"] += 1
            self._remember(key, {"status": "no_answer"})
            self._skip(uid, "no_answer", str(solved.get("answer", ""))[:80])
            return None
        if len(answer) > 80:  # essays/graphs/proofs can't be a choice
            self.stats["no_answer"] += 1
            self._remember(key, {"status": "answer_not_choice_shaped"})
            self._skip(uid, "answer_not_choice_shaped", answer[:80])
            return None

        # Step 2: triple-verify
        verdict = self.verifier.verify(stem, answer)
        if not verdict["verified"]:
            self.stats["verify_failed"] += 1
            self._remember(key, {"status": "verify_failed",
                                 "answer": answer,
                                 "agreement": verdict["agreement"],
                                 "traces": verdict["solve_traces"]})
            self._skip(uid, "verify_failed",
                       f"answer={answer} agreement={verdict['agreement']}"
                       f"/{self.verifier.verify_count}")
            return None

        # Step 3: distractors
        wrong = self.distractors.generate(stem, answer)
        if not wrong:
            self.stats["distractor_failed"] += 1
            self._remember(key, {"status": "distractor_failed", "answer": answer})
            self._skip(uid, "distractor_failed", f"answer={answer}")
            return None

        record = {
            "status": "ok",
            "answer": answer,
            "steps": solved["steps"],
            "distractors": wrong,
            "agreement": verdict["agreement"],
        }
        self.stats["solved"] += 1
        self._remember(key, record)
        return self._assemble(uid, stem, concept_id, level, concept_name, record)

    # -- assembly ---------------------------------------------------------------

    def _assemble(self, uid: str, stem: str, concept_id: str, level: int,
                  concept_name: str, record: dict) -> dict:
        answer = repair_ctrl_chars(record["answer"])
        choices = [answer] + [repair_ctrl_chars(d["value"])
                              for d in record["distractors"]]
        order = list(range(4))
        random.Random(uid).shuffle(order)      # deterministic per exercise
        shuffled = [choices[i] for i in order]
        correct_index = order.index(0)

        story = {"storyContext": "", "explanation": "", "hints": []}
        if self.story_wrapper is not None:
            story = self.story_wrapper.wrap(
                stem, concept_id, answer=answer,
                steps=record.get("steps") or [])

        explanation = story.get("explanation") or ""
        if not explanation:
            steps = [s for s in (record.get("steps") or []) if s][:5]
            steps_text = (" ".join(f"{s.rstrip('.')}." for s in steps))[:400]
            explanation = (f"Trace the path: {steps_text} "
                           f"That lands on {answer} — the answer."
                           if steps_text else
                           f"The answer is {answer}. Rework each step of the "
                           f"setup and confirm you reach the same place.")

        return {
            "question": stem,
            "choices": shuffled,
            "correctIndex": correct_index,
            "conceptId": concept_id,
            "level": level,
            "explanation": explanation,
            "hints": story.get("hints") or [],
            "storyContext": story.get("storyContext") or "",
            "_id": f"openstax_mcq_{uid.replace('@', '_')}",
        }
