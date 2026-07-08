"""
Enrich existing question banks with story-cell DNA.

Pass 1 (deterministic, no LLM):
  - Eedi: add distractor_taxonomy from existing misconception_label
  - All questions: add storyContext from questionContextFrames.json

Run:
  python ml/scripts/enrich_questions.py --dry-run   # count only
  python ml/scripts/enrich_questions.py             # write enriched files
  python ml/scripts/enrich_questions.py --source act  # ACT only

Outputs enrich_report.json with before/after coverage stats.
"""

import json
import re
import argparse
import hashlib
from pathlib import Path

ROOT = Path(__file__).parent.parent.parent

EEDI_PATH  = ROOT / "app/src/data/eediQuestions.json"
ACT_PATH   = ROOT / "app/src/data/actMasterQuestionBank.generated.json"
FRAMES_PATH = ROOT / "app/src/data/questionContextFrames.json"
STORIES_PATH = ROOT / "app/src/data/conceptStories.json"
REPORT_PATH = ROOT / "ml/data/enrich_report.json"


# ── Misconception label → error type (deterministic keyword match) ──────────

ERROR_TAXONOMY = {
    "sign_error": [
        "sign", "negative", "positive", "minus", "subtract", "opposite",
        "negate", "absolute", "below zero",
    ],
    "wrong_formula": [
        "formula", "rule", "theorem", "procedure", "method", "algorithm",
        "denominator", "numerator", "base", "exponent", "power", "index",
        "equation", "law", "property", "definition", "confused",
        "mistake.*type", "wrong.*type", "incorrect.*type",
        "adds.*when", "multiplies.*when", "divides.*when",
    ],
    "arithmetic": [
        "arithmetic", "calcul", "compute", "miscalcul", "error in",
        "off by", "rounding", "decimal", "carries", "borrows",
        "digit", "place value",
    ],
    "unit_confusion": [
        "unit", "convert", "dimension", "scale", "measure", "ratio",
        "proportion", "rate", "percent", "fraction.*whole",
        "whole.*fraction",
    ],
}

# fallback order (most common in school math misconceptions)
FALLBACK_ORDER = ["wrong_formula", "arithmetic", "sign_error", "unit_confusion"]


def classify_misconception(label: str) -> str:
    label_lower = label.lower()
    for error_type, keywords in ERROR_TAXONOMY.items():
        for kw in keywords:
            if re.search(kw, label_lower):
                return error_type
    return FALLBACK_ORDER[0]


# ── storyContext builder from contextFrames ──────────────────────────────────

def load_frames() -> dict:
    """Returns {conceptId: frame_dict}."""
    with open(FRAMES_PATH) as f:
        raw = json.load(f)
    if isinstance(raw, dict):
        return raw
    # list form — key by conceptId
    return {fr.get("conceptId", fr.get("id", str(i))): fr for i, fr in enumerate(raw)}


def load_stories() -> dict:
    with open(STORIES_PATH) as f:
        return json.load(f)


def build_story_context(question: dict, frames: dict, stories: dict) -> str | None:
    """Build a 1-2 sentence storyContext from existing frames/stories."""
    concept_id = question.get("conceptId", "")
    frame = frames.get(concept_id)
    story = stories.get(concept_id)

    if not frame and not story:
        return None

    protagonist = None
    setting = None
    bridge = None

    if frame:
        protagonist = frame.get("protagonist")
        setting = frame.get("settingLine")
        bridge = frame.get("questionBridge")

    if not protagonist and story:
        protagonist = story.get("protagonist", {}).get("name") if isinstance(story.get("protagonist"), dict) else None

    if not protagonist:
        return None

    parts = []
    if setting:
        parts.append(setting.strip().rstrip("."))
    if bridge:
        parts.append(bridge.strip().rstrip("."))

    if not parts:
        return None

    # Combine: "Setting. Bridge."
    ctx = ". ".join(parts) + "."
    # Trim if too long (storyContext target: ≤200 chars)
    if len(ctx) > 200:
        ctx = ctx[:197] + "…"
    return ctx


# ── Distractor taxonomy builder ──────────────────────────────────────────────

def build_distractor_taxonomy(question: dict) -> list[dict] | None:
    """
    For Eedi questions: one misconception maps to all wrong choices,
    but the primary misconception is the most common wrong answer.
    We tag choice index 0 (the first wrong choice after shuffling) as
    the primary misconception distractor; others get derived types.
    """
    misconception_id    = question.get("misconception_id")
    misconception_label = question.get("misconception_label")
    correct_idx         = question.get("correctIndex")

    if not misconception_label or correct_idx is None:
        return None

    choices = question.get("choices", [])
    wrong_indices = [i for i in range(len(choices)) if i != correct_idx]

    if not wrong_indices:
        return None

    primary_type = classify_misconception(misconception_label)
    fallbacks = [t for t in FALLBACK_ORDER if t != primary_type]

    taxonomy = []
    for rank, idx in enumerate(wrong_indices):
        error_type = primary_type if rank == 0 else fallbacks[rank - 1] if rank - 1 < len(fallbacks) else "arithmetic"
        student_thinking = misconception_label if rank == 0 else f"Alternative error: {error_type.replace('_', ' ')}"
        taxonomy.append({
            "choice_index": idx,
            "error_type": error_type,
            "student_thinking": student_thinking,
            "misconception_id": misconception_id if rank == 0 else None,
        })

    return taxonomy


# ── Main enrichment ──────────────────────────────────────────────────────────

def enrich_questions(questions: list, frames: dict, stories: dict,
                     add_taxonomy: bool = True) -> tuple[list, dict]:
    stats = {
        "total": len(questions),
        "added_storyContext": 0,
        "added_distractor_taxonomy": 0,
        "already_had_storyContext": 0,
        "already_had_taxonomy": 0,
        "skipped_no_frame": 0,
    }

    enriched = []
    for q in questions:
        q = dict(q)  # don't mutate original

        # storyContext
        if q.get("storyContext"):
            stats["already_had_storyContext"] += 1
        else:
            ctx = build_story_context(q, frames, stories)
            if ctx:
                q["storyContext"] = ctx
                stats["added_storyContext"] += 1
            else:
                stats["skipped_no_frame"] += 1

        # distractor_taxonomy
        if add_taxonomy:
            if q.get("distractor_taxonomy"):
                stats["already_had_taxonomy"] += 1
            elif q.get("misconception_id") or q.get("misconception_label"):
                taxonomy = build_distractor_taxonomy(q)
                if taxonomy:
                    q["distractor_taxonomy"] = taxonomy
                    stats["added_distractor_taxonomy"] += 1

        enriched.append(q)

    return enriched, stats


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", choices=["eedi", "act", "all"], default="all")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    frames  = load_frames()
    stories = load_stories()

    all_stats = {}

    sources = []
    if args.source in ("eedi", "all"):
        sources.append(("eedi", EEDI_PATH, True))
    if args.source in ("act", "all"):
        sources.append(("act", ACT_PATH, False))

    for name, path, add_taxonomy in sources:
        print(f"\n── {name.upper()} ──")
        with open(path) as f:
            raw = json.load(f)
        questions = raw if isinstance(raw, list) else raw.get("questions", [])

        enriched, stats = enrich_questions(questions, frames, stories, add_taxonomy)
        all_stats[name] = stats

        print(f"  Total:               {stats['total']}")
        print(f"  +storyContext:       {stats['added_storyContext']}")
        print(f"  +distractor_taxonomy:{stats['added_distractor_taxonomy']}")
        print(f"  No frame found:      {stats['skipped_no_frame']}")

        if not args.dry_run:
            if isinstance(raw, list):
                output = enriched
            else:
                output = {**raw, "questions": enriched}
            with open(path, "w") as f:
                json.dump(output, f, indent=2, ensure_ascii=False)
            print(f"  ✓ Wrote {path.name}")
        else:
            print("  (dry-run — no files written)")

    with open(REPORT_PATH, "w") as f:
        json.dump(all_stats, f, indent=2)
    print(f"\n✓ Report → {REPORT_PATH}")


if __name__ == "__main__":
    main()
