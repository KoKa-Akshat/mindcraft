#!/usr/bin/env python3
"""
Concept-story regenerator (question-aware).

Improves `app/src/data/conceptStories.json` + `app/src/data/questionContextFrames.json`.
Differences from the original ml/scripts/generate_concept_stories.py:

1. Reads the existing stories and ONLY regenerates concepts whose story is
   poor quality OR whose context frame conflicts with the actual practice
   questions (e.g. a 1585 bookkeeper wrapping questions about calculators).
2. Samples 3 real questions from the merged bank and puts them IN the prompt,
   requiring the generated setting to be compatible with them.
3. Validates the LLM's JSON output and the setting/question compatibility
   before writing anything back. Failed generations leave the existing story
   untouched.

Run via the unified CLI:
    python ml/scripts/pipeline/ingest.py --stories
    python ml/scripts/pipeline/ingest.py --stories --concepts linear_equations --dry-run
"""

from __future__ import annotations

import json
import random
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from base import (  # noqa: E402
    REPO, ConceptMapper, LLMClient, extract_json_object,
)

STORIES_PATH = REPO / "app/src/data/conceptStories.json"
FRAMES_PATH = REPO / "app/src/data/questionContextFrames.json"
BANK_PATHS = [
    REPO / "app/src/data/eediQuestions.json",
    REPO / "app/src/data/actMasterQuestionBank.generated.json",
    REPO / "app/src/data/generatedQuestions.json",
]

STORY_PROMPT = """\
You're writing a story that wraps a math concept for a 15-year-old.
The story must be compatible with these actual practice questions:

{sample_questions}

Write a 150-word story world for concept: {concept_name}
Include: a protagonist name, a specific setting (modern/near-future preferred),
and a recurring problem type that makes {concept_name} feel necessary.
The setting MUST be compatible with all 3 sample questions above.
Output JSON: {{"protagonist": "...", "settingLine": "...", "questionBridge": "...", "story": "...180-200 words..."}}"""

# ── Quality heuristics ───────────────────────────────────────────────────────

AI_VOICE_RE = re.compile(
    r'\b(in conclusion|in summary|delve|furthermore|moreover, )\b|^[-*•] ', re.I | re.M)
HISTORIC_YEAR_RE = re.compile(r'\b1[0-8]\d\d\b')  # any year 1000-1899
MODERN_TERM_RE = re.compile(
    r'\b(calculator|computer|phone|smartphone|laptop|app\b|website|internet|'
    r'wifi|video game|robot|drone|spreadsheet|pixels?|download|streaming|'
    r'text message|email|GPS|battery|screen)\b', re.I)

MIN_STORY_WORDS = 100
MAX_STORY_WORDS = 300


def word_count(text: str) -> int:
    return len(text.split())


def frame_conflicts_with_questions(frame: dict | None, story: str,
                                   sample_questions: list[str]) -> bool:
    """True when the story world's era clashes with the question content.

    Heuristic: a pre-1900 setting (year in settingLine/story) combined with
    modern technology in the sampled questions = incompatible world.
    """
    setting_text = " ".join([
        (frame or {}).get("settingLine") or "",
        (frame or {}).get("protagonist") or "",
        story or "",
    ])
    if not HISTORIC_YEAR_RE.search(setting_text):
        return False
    return any(MODERN_TERM_RE.search(q) for q in sample_questions)


def story_is_poor(story: str) -> bool:
    if not story or word_count(story) < MIN_STORY_WORDS:
        return True
    return bool(AI_VOICE_RE.search(story))


def validate_generated(data: dict, sample_questions: list[str]) -> list[str]:
    """Returns error strings; empty == the generated story passes."""
    errors: list[str] = []
    for key in ("protagonist", "settingLine", "questionBridge", "story"):
        if not str(data.get(key, "")).strip():
            errors.append(f"missing:{key}")
    story = str(data.get("story", ""))
    wc = word_count(story)
    if wc < MIN_STORY_WORDS or wc > MAX_STORY_WORDS:
        errors.append(f"story_length:{wc}")
    if AI_VOICE_RE.search(story):
        errors.append("ai_voice")
    frame = {"settingLine": data.get("settingLine", ""),
             "protagonist": data.get("protagonist", "")}
    if frame_conflicts_with_questions(frame, story, sample_questions):
        errors.append("setting_conflict")
    return errors


# ── Bank sampling ────────────────────────────────────────────────────────────

def load_bank_questions() -> list[dict]:
    questions: list[dict] = []
    for path in BANK_PATHS:
        if not path.exists():
            continue
        try:
            data = json.loads(path.read_text())
        except json.JSONDecodeError:
            continue
        if isinstance(data, dict):  # pipeline v2 shape {"_meta", "questions"}
            data = data.get("questions", [])
        questions.extend(q for q in data if isinstance(q, dict))
    return questions


def sample_questions_for_concept(bank: list[dict], concept_id: str,
                                 n: int = 3, seed: int = 7) -> list[str]:
    pool = [q.get("question", "") for q in bank if q.get("conceptId") == concept_id]
    pool = [q for q in pool if q]
    rng = random.Random(f"{seed}:{concept_id}")  # deterministic per concept
    if len(pool) <= n:
        return pool
    return rng.sample(pool, n)


# ── Main pass ────────────────────────────────────────────────────────────────

def regenerate_stories(concept_filter: set[str] | None = None,
                       dry_run: bool = False, limit: int | None = None,
                       force: bool = False) -> dict:
    """Regenerate poor/conflicting stories. Returns a stats dict."""
    client = LLMClient()
    mapper = ConceptMapper(client=client)

    stories: dict = json.loads(STORIES_PATH.read_text()) if STORIES_PATH.exists() else {}
    frames: dict = json.loads(FRAMES_PATH.read_text()) if FRAMES_PATH.exists() else {}
    bank = load_bank_questions()

    stats = {"checked": 0, "regenerated": 0, "skipped_ok": 0,
             "skipped_no_questions": 0, "failed_validation": 0, "llm_unavailable": 0}

    concept_ids = sorted(mapper.CANONICAL_IDS)
    if concept_filter:
        concept_ids = [c for c in concept_ids if c in concept_filter]
    if limit:
        concept_ids = concept_ids[:limit]

    for cid in concept_ids:
        stats["checked"] += 1
        record = stories.get(cid) or {}
        frame = frames.get(cid) or {}
        story = record.get("story", "")
        samples = sample_questions_for_concept(bank, cid)

        if not samples:
            stats["skipped_no_questions"] += 1
            continue

        needs = force or story_is_poor(story) or \
            frame_conflicts_with_questions(frame, story, samples)
        if not needs:
            stats["skipped_ok"] += 1
            continue

        if not client.available():
            stats["llm_unavailable"] += 1
            print(f"  [stories] {cid}: needs regeneration but no LLM provider "
                  "configured (set LLM_PROVIDER + API key)")
            continue

        concept_name = mapper.concept_name(cid)
        prompt = STORY_PROMPT.format(
            sample_questions="\n\n".join(f"Q{i + 1}: {q[:400]}"
                                         for i, q in enumerate(samples)),
            concept_name=concept_name,
        )
        raw = client.complete(prompt, max_tokens=700, temperature=0.8)
        data = extract_json_object(raw or "")
        if not data:
            stats["failed_validation"] += 1
            print(f"  [stories] {cid}: LLM returned no parseable JSON — kept existing")
            continue

        errors = validate_generated(data, samples)
        if errors:
            stats["failed_validation"] += 1
            print(f"  [stories] {cid}: rejected ({', '.join(errors)}) — kept existing")
            continue

        stats["regenerated"] += 1
        print(f"  [stories] {cid}: regenerated "
              f"(protagonist: {data['protagonist']}, "
              f"setting: {str(data['settingLine'])[:60]})")

        if dry_run:
            continue

        # conceptStories.json — preserve ingredientStories
        stories[cid] = {
            "conceptId": cid,
            "conceptName": record.get("conceptName", concept_name),
            "story": str(data["story"]).strip(),
            "ingredientStories": record.get("ingredientStories", {}),
        }
        # questionContextFrames.json — preserve dice/spinner frames
        frames[cid] = {
            "protagonist": str(data["protagonist"]).strip(),
            "settingLine": str(data["settingLine"]).strip(),
            "questionBridge": str(data["questionBridge"]).strip(),
            "diceFrame": frame.get("diceFrame"),
            "spinnerFrame": frame.get("spinnerFrame"),
        }
        # Save after each concept so partial runs aren't lost
        STORIES_PATH.write_text(json.dumps(stories, indent=2, ensure_ascii=False) + "\n")
        FRAMES_PATH.write_text(json.dumps(frames, indent=2, ensure_ascii=False) + "\n")

    mapper.save_cache()
    print("\nStory regeneration summary:")
    for k, v in stats.items():
        print(f"  {k:<24} {v}")
    return stats


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Regenerate concept stories")
    parser.add_argument("--concepts", help="Comma-separated concept ID filter")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--force", action="store_true",
                        help="Regenerate even stories that pass quality checks")
    args = parser.parse_args()
    regenerate_stories(
        concept_filter=set(args.concepts.split(",")) if args.concepts else None,
        dry_run=args.dry_run, limit=args.limit, force=args.force,
    )
