#!/usr/bin/env python3
"""
fix_em_dashes.py — remove em dashes from our authored/generated copy
(hints, storyContext, explanation, world_feedback, narrative fields) across
the data files, without touching raw sourced exam question/choice text.

Two passes:
1. Template substitution — the `questionBridge` library (shared narrative
   punchlines baked into many storyContext fields), the fixed diagnostic hint
   template, and the polygon-scene templates are each a SINGLE wording
   decision reused verbatim dozens/thousands of times. Fix the template once,
   substring-replace everywhere it is embedded.
2. Groq LLM rewrite (cached by content hash) for everything left over: bespoke
   per-line narrative prose (storyContext not covered by a template, hints,
   explanations, world_feedback, katha_voice_sample, synopsis, narrative_need,
   correct_reasoning, distractor_taxonomy.student_thinking, storyIntro,
   introTemplates, misconception_label, and the rare sourced-adjacent `choices`
   copy that is actually our own phrasing e.g. "Cannot be determined — no data
   provided").

Cache: ml/data/.em_dash_rewrite_cache.json (key = sha1 of the original line).

Run: cd ml && source mindcraft/bin/activate && python3 scripts/fix_em_dashes.py
     [--dry-run] [--file path/to/one.json]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
CACHE_PATH = REPO / "ml" / "data" / ".em_dash_rewrite_cache.json"
ENV_PATH = REPO / "ml" / ".env.local"


def load_dotenv() -> None:
    """Fill in missing env vars from ml/.env.local. Never overwrites a var the
    shell/caller already set (e.g. `GROQ_MODEL=... python3 fix_em_dashes.py`
    must win over whatever ml/.env.local says)."""
    if not ENV_PATH.exists():
        return
    try:
        from dotenv import dotenv_values  # type: ignore
        for k, v in dotenv_values(ENV_PATH).items():
            if v is not None and str(v).strip() and k not in os.environ:
                os.environ[k] = str(v).strip()
        return
    except ImportError:
        pass
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        k, v = k.strip(), v.strip()
        if v and k not in os.environ:
            os.environ[k] = v

DASH = "—"  # —

# ---------------------------------------------------------------------------
# Pass 1: template fixes (one wording decision, applied uniformly)
# ---------------------------------------------------------------------------

HINT_TEMPLATE_OLD = "Re-read the question carefully — what is it specifically asking you to find?"
HINT_TEMPLATE_NEW = "Read the question again. What is it specifically asking you to find?"

# questionBridge fixes: app/src/data/questionContextFrames.json `questionBridge`
# field per concept. These strings are embedded verbatim (settingLine + ". " +
# protagonist beat + ". " + questionBridge) into storyContext across
# eediQuestions.json, actMasterQuestionBank.generated.json,
# ml/data/promotion_queue.json, and app/src/data/openstaxMCQ.json. Fix once,
# apply everywhere the exact substring appears.
BRIDGE_FIXES = {
    "Break the whole into parts — every tenth counts.":
        "Break the whole into parts. Every tenth counts.",
    "Do the steps in the right order — the machine forgives nothing.":
        "Do the steps in the right order. The machine forgives nothing.",
    "A number is hiding — undo each step until you find it.":
        "A number is hiding. Undo each step until you find it.",
    "Feed it a number — watch what comes out.":
        "Feed it a number and watch what comes out.",
    "Two sides fix the third — the right angle keeps its promise.":
        "Two sides fix the third, and the right angle keeps its promise.",
    "Angles and sides are bound together — use one to find the other.":
        "Angles and sides are bound together. Use one to find the other.",
    "The answer isn't one number — it's a range. Find where the limit lies.":
        "The answer isn't one number. It's a range. Find where the limit lies.",
    "Two unknowns, two conditions — make them agree at once.":
        "Two unknowns, two conditions. Make them agree at once.",
    "Repeated multiplication has its own rules — use them.":
        "Repeated multiplication has its own rules. Use them.",
    "Many terms, one expression — read what it does.":
        "Many terms, one expression. Read what it does.",
    "It was built from factors — take it apart.":
        "It was built from factors. Take it apart.",
    "Some numbers hide under the root sign — handle them exactly.":
        "Some numbers hide under the root sign. Handle them exactly.",
    "Growth that feeds on itself — track how fast it runs.":
        "Growth that feeds on itself. Track how fast it runs.",
    "There is a pattern in the terms — find it before you count.":
        "There is a pattern in the terms. Find it before you count.",
    "Every angle here is related to another — reason it out.":
        "Every angle here is related to another. Reason it out.",
    "Show they are the same — every side, every angle.":
        "Show they are the same: every side, every angle.",
    "Every point is the same distance from the center — build from that.":
        "Every point is the same distance from the center. Build from that.",
    "Space and substance — measure what's inside.":
        "Space and substance. Measure what's inside.",
    "Slide it, flip it, turn it — and ask what stays the same.":
        "Slide it, flip it, turn it, and ask what stays the same.",
    "A fraction of expressions — treat the top and bottom with equal rigor.":
        "A fraction of expressions. Treat the top and bottom with equal rigor.",
    "Follow the rules anyway — they still hold.":
        "Follow the rules anyway. They still hold.",
    "Magnitude and direction — both matter here.":
        "Magnitude and direction both matter here.",
    "The grid itself obeys algebra — work it row by column.":
        "The grid itself obeys algebra. Work it row by column.",
    "Slice the cone — the curve tells you which cut was made.":
        "Slice the cone. The curve tells you which cut was made.",
    "Chance has a shape — read the whole distribution.":
        "Chance has a shape. Read the whole distribution.",
    "How fast, and exactly when — the rate of change answers both.":
        "How fast, and exactly when: the rate of change answers both.",
    "Add up the small pieces — the total is exact.":
        "Add up the small pieces. The total is exact.",
    "Accumulate the small pieces — the whole must hold.":
        "Accumulate the small pieces. The whole must hold.",
    "One sample proves nothing — test what the evidence can bear.":
        "One sample proves nothing. Test what the evidence can bear.",
    "Convert precisely — the measurement must be exact.":
        "Convert precisely. The measurement must be exact.",
    "Rearrange the symbols — keep both sides in balance.":
        "Rearrange the symbols. Keep both sides in balance.",
    "Every second is a choice — pick your approach and commit.":
        "Every second is a choice. Pick your approach and commit.",
    "Distance from zero — direction doesn't matter here.":
        "Distance from zero: direction doesn't matter here.",
    "Like with like — simplify until it's clean.":
        "Like with like. Simplify until it's clean.",
    "Out of every hundred — what portion is this?":
        "Out of every hundred: what portion is this?",
    "The data is telling a story — read it.":
        "The data is telling a story. Read it.",
}

# Polygon-scene templates: ml/scripts/patch_story_contexts.py POLYGON_SCENE +
# the generic fallback in polygon_scene(). "the shape"/"the regular figure" get
# substituted with "a regular N-gon" by the script, so fix the base text and
# also cover the already-baked N-gon variants directly.
POLYGON_FIXES = {
    "Euclid traces the shape in the sand at Alexandria — equal sides, equal corners, every angle waiting to be named.":
        "Euclid traces the shape in the sand at Alexandria. Equal sides, equal corners, every angle waiting to be named.",
    "The mason's template shows the regular polygon — each side matched, each corner identical.":
        "The mason's template shows the regular polygon. Each side matched, each corner identical.",
    "The scholar sketches a regular polygon — every side equal, every corner matching.":
        "The scholar sketches a regular polygon. Every side equal, every corner matching.",
}
POLYGON_FIXES.update({
    f"Euclid traces a regular {n}-gon in the sand at Alexandria — equal sides, equal corners, every angle waiting to be named.":
        f"Euclid traces a regular {n}-gon in the sand at Alexandria. Equal sides, equal corners, every angle waiting to be named."
    for n in (5, 6, 7, 8, 9, 10)
})

TEMPLATE_FIXES: dict[str, str] = {HINT_TEMPLATE_OLD: HINT_TEMPLATE_NEW, **BRIDGE_FIXES, **POLYGON_FIXES}


def apply_templates(s: str) -> str:
    for old, new in TEMPLATE_FIXES.items():
        if old in s:
            s = s.replace(old, new)
    return s


# ---------------------------------------------------------------------------
# Pass 2: Groq rewrite for whatever still has an em dash
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You rewrite one line of copy for MindCraft, an ACT/GCSE math tutoring product.

Voice (non-negotiable): cinematic, electric, certain, human, unflinching. Second
person or scene-narration as appropriate. Active voice, verbs first, short
declarative sentences. Warm and genuinely excited to help, never corporate,
never stilted, never a greeting-card. No hedging ("might", "consider maybe").

Task: rewrite the given line to remove EVERY em dash (—), replacing each with
a period, colon, comma, or "and"/"so"/"because" as natural phrasing demands.
Keep the same meaning, the same characters/names/setting, and roughly the same
length. Do NOT change any number, unit, math fact, variable name, or the
correct answer. Do NOT add hedging or exclamation points. Do NOT add quotation
marks around the whole line. Reply with ONLY the rewritten line, nothing else."""


def load_cache() -> dict:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False) + "\n")


def key_of(s: str) -> str:
    return hashlib.sha1(s.encode("utf-8")).hexdigest()


_groq_client = None


def _looks_truncated(original: str, out: str) -> bool:
    """Heuristic: flag completions that were cut off mid-sentence rather than
    genuinely ending on a shorter, complete line."""
    if not out:
        return True
    tail = out.rstrip()
    if tail[-1:] in ".!?)✓’'”\":]":
        return False
    # Numbers/units/checkmarks are valid legitimate endings; a bare word
    # (esp. a stopword-ish connector) is not.
    last_word = tail.split()[-1].lower().strip(",;:") if tail.split() else ""
    if last_word in {"the", "a", "an", "and", "or", "so", "because", "that",
                      "to", "for", "is", "are", "with", "as", "of", "in",
                      "not", "but", "than", "which", "who"}:
        return True
    # Much shorter than the original with no terminal punctuation at all is
    # also suspicious (long multi-step explanations especially).
    return len(original) > 220 and len(out) < len(original) * 0.6


_last_call = 0.0
MIN_INTERVAL = 0.6  # seconds between Groq calls, avoids tripping rate limits on long batches


def _throttle() -> None:
    global _last_call
    elapsed = time.monotonic() - _last_call
    if elapsed < MIN_INTERVAL:
        time.sleep(MIN_INTERVAL - elapsed)
    _last_call = time.monotonic()


class RateLimited(Exception):
    """Raised once and only once per groq_rewrite call on a 429 — callers must
    NOT retry-loop on top of this (nested retries would multiply backoff time
    across rewrite_once's own retry layers). One short wait, one retry, done."""


def groq_rewrite(line: str, budget: int) -> tuple[str, bool]:
    """One completion attempt. Returns (text, hit_hard_length_limit).
    Retries only non-rate-limit errors internally; a 429 gets ONE short wait
    and ONE retry, then raises RateLimited so callers stop fast instead of
    stacking exponential backoff across every nested retry layer."""
    global _groq_client
    import groq  # type: ignore
    if _groq_client is None:
        _groq_client = groq.Groq(api_key=os.environ.get("GROQ_API_KEY", ""))
    last_err: Exception | None = None
    rate_limit_retried = False
    for attempt in range(3):
        _throttle()
        try:
            r = _groq_client.chat.completions.create(
                model=os.environ.get("GROQ_MODEL", "llama-3.3-70b-versatile"),
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": line},
                ],
                temperature=0.4,
                max_tokens=budget,
            )
            out = (r.choices[0].message.content or "").strip().strip('"')
            if not out:
                raise ValueError("empty completion")
            return out, r.choices[0].finish_reason == "length"
        except Exception as e:  # noqa: BLE001
            last_err = e
            msg = str(e).lower()
            if "429" in msg or "rate" in msg:
                if rate_limit_retried:
                    raise RateLimited(str(e)) from e
                rate_limit_retried = True
                time.sleep(5)
                continue
            time.sleep(min(5, 2 ** attempt))
    raise RuntimeError(f"groq_rewrite failed after retries for: {line[:80]!r} — last error: {last_err!r}")


def rewrite_once(line: str) -> tuple[str, bool]:
    """Rewrite one line, retrying only on a REAL API-level token cutoff
    (finish_reason == 'length'). Returns (text, flagged_for_manual_review) —
    flagged is set when the heuristic thinks the ending looks awkward but the
    API says the completion was NOT hard-truncated (e.g. the source line
    itself was already cut off mid-sentence in the original data)."""
    budget = min(1600, max(400, len(line) // 2 + 250))
    out, hit_limit = groq_rewrite(line, budget)
    tries = 0
    while hit_limit and tries < 3:
        budget = min(2000, budget * 2)
        out, hit_limit = groq_rewrite(line, budget)
        tries += 1
    flagged = _looks_truncated(line, out)
    if flagged and tries == 0:
        # One extra nudge for a cleaner ending before accepting + flagging.
        retry_line = f"{line}\n\n(Make sure your rewrite ends as a complete sentence.)"
        out2, hit_limit2 = groq_rewrite(retry_line, budget)
        if not hit_limit2 and not _looks_truncated(line, out2):
            return out2, False
    return out, flagged


def rewrite_line(s: str, cache: dict, stats: dict, review: list) -> str:
    """Apply template fixes, then Groq-rewrite anything still containing a dash."""
    s2 = apply_templates(s)
    if DASH not in s2:
        if s2 != s:
            stats["template"] += 1
        return s2
    k = key_of(s2)
    if k in cache:
        stats["cache_hit"] += 1
        return cache[k]
    try:
        rewritten, flagged = rewrite_once(s2)
        tries = 0
        while DASH in rewritten and tries < 2:
            rewritten, flagged = rewrite_once(f"This still has an em dash. Remove it completely:\n{rewritten}")
            tries += 1
    except Exception as e:  # noqa: BLE001 — never let one bad line kill the batch
        stats["failed"] = stats.get("failed", 0) + 1
        review.append({"original": s2, "rewritten": None, "error": str(e)})
        print(f"  FAILED (left as-is, still has a dash): {s2[:100]!r} — {e}")
        return s2
    if flagged:
        review.append({"original": s2, "rewritten": rewritten})
        stats["flagged"] += 1
    cache[k] = rewritten
    stats["llm"] += 1
    save_cache(cache)  # incremental save so interrupted runs don't lose work
    return rewritten


# ---------------------------------------------------------------------------
# Field scope per file — which string fields are OURS (safe to rewrite) vs
# sourced exam text (never touch: `question`, `choices` unless explicitly
# whitelisted below for a known-ours phrase).
# ---------------------------------------------------------------------------

# openstaxMCQ.json choices contains our own answer-option phrasing for
# "cannot be determined" style distractors, not sourced exam wording — but to
# stay conservative we only rewrite it via an explicit literal fix, never a
# generic recursive walk over `choices`.
OPENSTAX_CHOICE_FIX = {
    "Cannot be determined — no data provided": "Cannot be determined. No data provided",
}

OURS_FIELDS = {
    "hints", "storyContext", "explanation", "world_feedback", "narrative_need",
    "correct_reasoning", "student_action", "misconception_label", "storyIntro",
    "introTemplates", "synopsis", "katha_voice_sample", "questionBridge",
    "message", "note",
}
NEVER_FIELDS = {"question", "choices", "raw_question", "source"}


def walk_and_fix(obj, cache: dict, stats: dict, review: list, path: str = ""):
    if isinstance(obj, dict):
        for k, v in obj.items():
            child_path = f"{path}.{k}" if path else k
            if k in NEVER_FIELDS:
                continue
            if k == "choices":
                # explicit literal-only fix, never a generic rewrite
                if isinstance(v, list):
                    for i, c in enumerate(v):
                        if isinstance(c, str) and c in OPENSTAX_CHOICE_FIX:
                            v[i] = OPENSTAX_CHOICE_FIX[c]
                continue
            obj[k] = walk_and_fix(v, cache, stats, review, child_path)
        return obj
    if isinstance(obj, list):
        return [walk_and_fix(v, cache, stats, review, path) for v in obj]
    if isinstance(obj, str) and DASH in obj:
        # distractor_taxonomy.student_thinking and other nested "ours" prose
        # fields not explicitly named above are still fixed by default; the
        # NEVER_FIELDS blocklist above is what actually protects sourced text.
        return rewrite_line(obj, cache, stats, review)
    return obj


def process_file(path: Path, cache: dict, stats: dict, review: list, dry_run: bool) -> None:
    data = json.loads(path.read_text())
    before = count_dashes(data)
    fixed = walk_and_fix(data, cache, stats, review, path.stem)
    after = count_dashes(fixed)
    print(f"{path.relative_to(REPO)}: {before} -> {after} em dashes"
          f"{' (dry run, not written)' if dry_run else ''}")
    if not dry_run:
        path.write_text(json.dumps(fixed, indent=2, ensure_ascii=False) + "\n")


def count_dashes(obj) -> int:
    if isinstance(obj, dict):
        return sum(count_dashes(v) for v in obj.values())
    if isinstance(obj, list):
        return sum(count_dashes(v) for v in obj)
    if isinstance(obj, str):
        return obj.count(DASH)
    return 0


DEFAULT_FILES = [
    "app/src/data/eediQuestions.json",
    "app/src/data/actMasterQuestionBank.generated.json",
    "app/src/data/openstaxMCQ.json",
    "app/src/data/openstaxQuestions.json",
    "app/src/data/storyCells.json",
    "app/src/data/mathSkinTop.json",
    "app/src/data/questionContextFrames.json",
    "app/src/data/actDiagnostic.json",
    "app/public/demo/v2/spark-bank.json",
    "ml/data/promotion_queue.json",
    "ml/data/eedi_misconceptions.json",
]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--file", action="append", default=None,
                     help="restrict to one or more repo-relative paths (repeatable)")
    args = ap.parse_args()

    load_dotenv()
    cache = load_cache()
    stats = {"template": 0, "llm": 0, "cache_hit": 0, "flagged": 0}
    review: list = []
    files = args.file or DEFAULT_FILES

    for rel in files:
        p = REPO / rel
        if not p.exists():
            print(f"SKIP (missing): {rel}")
            continue
        process_file(p, cache, stats, review, args.dry_run)

    save_cache(cache)
    print(f"\ntemplate fixes: {stats['template']}  |  LLM rewrites: {stats['llm']}  |  "
          f"cache hits: {stats['cache_hit']}  |  flagged for manual review: {stats['flagged']}")
    if review:
        review_path = REPO / "ml" / "data" / ".em_dash_review_flagged.json"
        review_path.write_text(json.dumps(review, indent=2, ensure_ascii=False) + "\n")
        print(f"Flagged lines (awkward ending, likely a pre-existing truncated source "
              f"line) written to {review_path.relative_to(REPO)} — check by hand.")


if __name__ == "__main__":
    main()
