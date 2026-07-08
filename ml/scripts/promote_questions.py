#!/usr/bin/env python3
"""
promote_questions.py — student-engagement-driven question enrichment pipeline.

What it does
------------
1. Aggregates misconception hit counts across all students from Firestore
   (ingredient_states/{uid}.misconception_counts).
2. Ranks misconceptions by engagement × signal quality.
3. For each top misconception, finds its example questions in eediQuestions.json.
4. Enriches those questions:
   - Fills in missing misconception_id entries in distractor_taxonomy using
     per-choice data from train.csv (currently only 1 of 3 wrong choices has
     a real mis_id; the others say "wrong_formula" / "arithmetic").
   - Adds world_feedback: null placeholder on every distractor entry.
5. Writes ml/data/promotion_queue.json — reviewed by Fable 5 who fills
   world_feedback, then merged back into the bank.

After Fable 5 fills world_feedback:
    python3 ml/scripts/promote_questions.py --merge

Dry-run (no Firestore — uses eedi_misconception_frequency.json as proxy):
    python3 ml/scripts/promote_questions.py --dry-run

Full usage:
    ML_AUTH_ENABLED=false FIRESTORE_PROJECT=mindcraft-93858 \\
        python3 ml/scripts/promote_questions.py [--top-n 30] [--dry-run] [--merge]

The world_feedback field
------------------------
After merge, Practice.tsx can render this immediately when a student picks
a wrong answer — before the next question loads:

    const dt = q.distractor_taxonomy?.find(d => d.choice_index === selectedIndex)
    if (dt?.world_feedback) renderFeedback(dt.world_feedback)

world_feedback rules (for Fable 5):
  - ≤200 chars, one sentence.
  - Names the cognitive error through what the student was *trying* to do.
  - Never says: wrong, incorrect, mistake, try again.
  - Example: "You're reading the equal sign as 'do the same thing to both sides'
    — but moving a term across changes its sign, not its operation."
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import os
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
ML_DATA = ROOT / "ml" / "data"
APP_DATA = ROOT / "app" / "src" / "data"
EEDI_DATA = ROOT / "data" / "eedi"

EEDI_QUESTIONS_PATH = APP_DATA / "eediQuestions.json"
EEDI_MIS_PATH = ML_DATA / "eedi_misconceptions.json"
MIS_FREQ_PATH = ML_DATA / "eedi_misconception_frequency.json"
TRAIN_CSV_PATH = EEDI_DATA / "train.csv"
MIS_MAP_PATH = ML_DATA / "misconception_mapping.csv"
ONT_PATH = ML_DATA / "5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
CONTEXT_FRAMES_PATH = APP_DATA / "questionContextFrames.json"
QUEUE_PATH = ML_DATA / "promotion_queue.json"
FIRESTORE_PROJECT = os.environ.get("FIRESTORE_PROJECT", "mindcraft-93858")


# ── Firestore aggregation ─────────────────────────────────────────────────────

def aggregate_firestore_counts() -> dict[str, int]:
    """Sum misconception_counts across all students from Firestore."""
    try:
        from google.cloud import firestore  # type: ignore
    except ImportError:
        print("ERROR: google-cloud-firestore not installed. Use --dry-run.")
        sys.exit(1)

    print(f"Connecting to Firestore project: {FIRESTORE_PROJECT}…")
    db = firestore.Client(project=FIRESTORE_PROJECT)
    totals: dict[str, int] = defaultdict(int)
    student_count = 0

    for doc in db.collection("ingredient_states").stream():
        data = doc.to_dict() or {}
        counts = data.get("misconception_counts", {})
        for mis_slug, n in counts.items():
            totals[mis_slug] += max(0, int(n))
        student_count += 1

    print(f"  {student_count} students, {len(totals)} unique misconceptions, "
          f"{sum(totals.values())} total hits")
    return dict(totals)


def aggregate_dry_run() -> dict[str, int]:
    """Fallback: use occurrence_count from eedi_misconception_frequency.json."""
    if not MIS_FREQ_PATH.exists():
        print(f"ERROR: {MIS_FREQ_PATH} not found. Run analyze_misconception_frequency.py first.")
        sys.exit(1)
    freq = json.loads(MIS_FREQ_PATH.read_text())
    totals: dict[str, int] = {}
    for slug, info in freq.get("per_slug", {}).items():
        totals[slug] = info.get("count", 0)
    print(f"  DRY RUN: {len(totals)} misconceptions from occurrence_count proxy")
    return totals


# ── Train.csv index (per-choice misconception IDs) ────────────────────────────

def build_train_index(
    numeric_to_slug: dict[str, str],
) -> dict[str, dict[str, str | None]]:
    """
    Returns {question_id_str: {A: mis_slug|None, B: ..., C: ..., D: ..., correct: 'A'}}.

    question_id_str = str(QuestionId) from train.csv — matches eedi_{N} format.
    """
    if not TRAIN_CSV_PATH.exists():
        print(f"WARNING: {TRAIN_CSV_PATH} not found — per-choice enrichment unavailable.")
        return {}

    index: dict[str, dict[str, str | None]] = {}

    def to_slug(raw: str) -> str | None:
        raw = raw.strip()
        if not raw or raw in ("", "nan"):
            return None
        try:
            return numeric_to_slug.get(str(int(float(raw))))
        except ValueError:
            return None

    with open(TRAIN_CSV_PATH, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            qid = str(row.get("QuestionId", "")).strip()
            if not qid:
                continue
            index[qid] = {
                "correct": row.get("CorrectAnswer", "").strip(),
                "A": to_slug(row.get("MisconceptionAId", "")),
                "B": to_slug(row.get("MisconceptionBId", "")),
                "C": to_slug(row.get("MisconceptionCId", "")),
                "D": to_slug(row.get("MisconceptionDId", "")),
            }

    print(f"  Train index: {len(index)} questions")
    return index


def build_numeric_to_slug(eedi_mis: dict[str, dict]) -> dict[str, str]:
    result: dict[str, str] = {}
    for slug, info in eedi_mis.items():
        nid = info.get("eedi_misconception_id")
        if nid is not None:
            result[str(int(nid))] = slug
    return result


# ── Ingredient failure mode lookup ────────────────────────────────────────────

def load_ingredient_meta(ont: dict) -> dict[str, dict]:
    """ingredient_id → {label, failure_mode}."""
    out: dict[str, dict] = {}
    for concept in ont.get("concepts", []):
        for ing in concept.get("ingredients", []):
            out[ing["id"]] = {
                "label": ing.get("label", ""),
                "failure_mode": ing.get("failure_mode", ""),
            }
    return out


def load_mis_ingredient_map() -> dict[str, list[dict]]:
    p = ML_DATA / "misconception_ingredient_map.json"
    if not p.exists():
        return {}
    data = json.loads(p.read_text())
    return data.get("map", {})


# ── Question enrichment ───────────────────────────────────────────────────────

CHOICE_LETTERS = ["A", "B", "C", "D"]


def letter_to_index(letter: str) -> int | None:
    mapping = {c: i for i, c in enumerate(CHOICE_LETTERS)}
    return mapping.get(letter.upper())


def enrich_distractor_taxonomy(
    q: dict,
    train_row: dict | None,
    eedi_mis: dict[str, dict],
    mis_ing_map: dict[str, list[dict]],
    ing_meta: dict[str, dict],
) -> list[dict]:
    """
    Rebuild distractor_taxonomy with real misconception IDs for all wrong choices.
    Adds world_feedback: null on every entry as a Fable 5 placeholder.
    """
    choices = q.get("choices", [])
    correct_idx = q.get("correctIndex", 0)
    existing_dt = {d["choice_index"]: d for d in (q.get("distractor_taxonomy") or [])}

    result = []
    for idx, _ in enumerate(choices):
        if idx == correct_idx:
            continue

        # Figure out which letter this choice index maps to
        # correctIndex is 0-based; train.csv CorrectAnswer is A/B/C/D
        # We need to map idx → letter relative to the correct answer position
        # Strategy: use train_row if available; otherwise preserve existing data
        mis_slug: str | None = None

        if train_row:
            # The correct choice in train.csv tells us letter mapping:
            # choices[0]='A'...'D' iff correctIndex matches that letter
            correct_letter = train_row.get("correct", "")
            correct_letter_idx = letter_to_index(correct_letter)
            if correct_letter_idx is not None and correct_letter_idx == correct_idx:
                # Direct mapping: choice index i → letter CHOICE_LETTERS[i]
                letter = CHOICE_LETTERS[idx] if idx < len(CHOICE_LETTERS) else None
            else:
                # Mapping is ambiguous without knowing the original order
                # Fall back to existing distractor_taxonomy data
                letter = None

            if letter:
                mis_slug = train_row.get(letter)

        # Fallback to existing entry's misconception_id
        existing = existing_dt.get(idx, {})
        if not mis_slug:
            mis_slug = existing.get("misconception_id") or None

        # Build the enriched entry
        mis_info = eedi_mis.get(mis_slug, {}) if mis_slug else {}
        mis_label = mis_info.get("eedi_name", "").strip()

        # Get student_thinking from ingredient failure_mode when available
        student_thinking = ""
        if mis_slug:
            links = mis_ing_map.get(mis_slug, [])
            if links:
                ing_id = links[0]["ingredient_id"]
                student_thinking = ing_meta.get(ing_id, {}).get("failure_mode", "")[:200]
        if not student_thinking:
            student_thinking = (existing.get("student_thinking") or
                                mis_label or
                                "Alternative error")

        entry = {
            "choice_index": idx,
            "misconception_id": mis_slug,
            "distractor_label": mis_label[:120] if mis_label else None,
            "error_type": "misconception" if mis_slug else existing.get("error_type", "unknown"),
            "student_thinking": student_thinking,
            "world_feedback": existing.get("world_feedback") or None,
        }
        result.append(entry)

    return result


# ── Main scoring and selection ────────────────────────────────────────────────

def score_misconceptions(
    student_hits: dict[str, int],
    eedi_mis: dict[str, dict],
    top_n: int,
) -> list[dict]:
    """
    Rank misconceptions by: student_hits × log(occurrence_count + 2).
    Pure student_hits can be noisy for rare misconceptions; multiplying by
    log(occurrence) upweights misconceptions that appear frequently in the
    dataset (more likely to be real signal, not a fluke).
    Skip misconceptions with no example_question_ids.
    """
    scored = []
    for slug, hits in student_hits.items():
        info = eedi_mis.get(slug, {})
        example_ids = info.get("example_question_ids", [])
        if not example_ids:
            continue
        occurrence = info.get("occurrence_count", 1)
        score = hits * math.log(occurrence + 2)
        scored.append({
            "misconception_id": slug,
            "student_hits": hits,
            "occurrence_count": occurrence,
            "score": round(score, 3),
            "concept_ids": info.get("concept_ids", []),
            "eedi_name": info.get("eedi_name", ""),
            "example_question_ids": example_ids,
        })

    scored.sort(key=lambda x: -x["score"])
    return scored[:top_n]


def build_queue(
    top_misconceptions: list[dict],
    eedi_questions: dict[str, dict],
    train_index: dict[str, dict],
    eedi_mis: dict[str, dict],
    mis_ing_map: dict[str, list[dict]],
    ing_meta: dict[str, dict],
    context_frames: dict,
) -> list[dict]:
    """
    For each top misconception, enrich its example questions.
    Returns flat list of enriched questions (deduped by id, most-engaged first).
    """
    seen_qids: set[str] = set()
    queue: list[dict] = []

    for mis_info in top_misconceptions:
        mis_slug = mis_info["misconception_id"]
        for qid in mis_info["example_question_ids"]:
            if qid in seen_qids:
                continue
            q = eedi_questions.get(qid)
            if not q:
                continue
            seen_qids.add(qid)

            # Train.csv row
            numeric_id = qid.replace("eedi_", "")
            train_row = train_index.get(numeric_id)

            # Enrich distractor_taxonomy
            enriched_dt = enrich_distractor_taxonomy(
                q, train_row, eedi_mis, mis_ing_map, ing_meta
            )

            # Check whether any world_feedback is already filled
            filled = sum(1 for d in enriched_dt if d.get("world_feedback"))
            total = len(enriched_dt)
            needs_wf = filled < total

            # storyContext: keep existing (Fable 5 can upgrade to modern voice later)
            story_context = q.get("storyContext", "")
            if not story_context:
                # Fallback: questionBridge from context frames
                concept_id = q.get("conceptId", "")
                frame = context_frames.get(concept_id, {})
                story_context = frame.get("questionBridge", "")

            enriched_q = {
                **q,
                "distractor_taxonomy": enriched_dt,
                "storyContext": story_context,
                "_promotion": {
                    "trigger_misconception": mis_slug,
                    "student_hits": mis_info["student_hits"],
                    "score": mis_info["score"],
                    "enriched_choices": [
                        d["choice_index"] for d in enriched_dt
                        if d.get("misconception_id")
                    ],
                    "world_feedback_filled": filled,
                    "world_feedback_total": total,
                    "status": "ready" if not needs_wf else "needs_world_feedback",
                },
            }
            queue.append(enriched_q)

    return queue


# ── Merge command ─────────────────────────────────────────────────────────────

def merge_queue() -> None:
    """
    Merge promotion_queue.json entries that have all world_feedbacks filled
    back into eediQuestions.json.
    """
    if not QUEUE_PATH.exists():
        print(f"ERROR: {QUEUE_PATH} not found. Run without --merge first.")
        sys.exit(1)

    queue_data = json.loads(QUEUE_PATH.read_text())
    eedi_raw = json.loads(EEDI_QUESTIONS_PATH.read_text())
    eedi_list: list[dict] = eedi_raw if isinstance(eedi_raw, list) else eedi_raw.get("questions", [])
    eedi_by_id = {q["id"]: q for q in eedi_list}

    merged = 0
    skipped = 0
    for q in queue_data.get("questions", []):
        promo = q.get("_promotion", {})
        if promo.get("status") != "ready":
            skipped += 1
            continue

        qid = q["id"]
        clean = {k: v for k, v in q.items() if not k.startswith("_")}
        eedi_by_id[qid] = clean
        merged += 1

    out_list = list(eedi_by_id.values())
    EEDI_QUESTIONS_PATH.write_text(json.dumps(out_list, indent=2, ensure_ascii=False))
    print(f"Merged {merged} questions into {EEDI_QUESTIONS_PATH.name} "
          f"({skipped} skipped — still need world_feedback).")


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true",
                        help="Use occurrence_count proxy instead of Firestore")
    parser.add_argument("--top-n", type=int, default=30,
                        help="Number of top misconceptions to process (default 30)")
    parser.add_argument("--merge", action="store_true",
                        help="Merge completed promotion_queue.json into eediQuestions.json")
    args = parser.parse_args()

    if args.merge:
        merge_queue()
        return

    # ── Load shared data ──────────────────────────────────────────────────────
    print("Loading shared data…")
    eedi_mis: dict[str, dict] = json.loads(EEDI_MIS_PATH.read_text())
    numeric_to_slug = build_numeric_to_slug(eedi_mis)
    print(f"  {len(eedi_mis)} Eedi misconceptions")

    ont: dict = json.loads(ONT_PATH.read_text())
    ing_meta = load_ingredient_meta(ont)
    print(f"  {len(ing_meta)} ingredients from Layer 1")

    mis_ing_map = load_mis_ingredient_map()
    print(f"  {len(mis_ing_map)} misconceptions in live ingredient map")

    eedi_raw = json.loads(EEDI_QUESTIONS_PATH.read_text())
    eedi_list = eedi_raw if isinstance(eedi_raw, list) else eedi_raw.get("questions", [])
    eedi_questions = {q["id"]: q for q in eedi_list}
    print(f"  {len(eedi_questions)} Eedi questions loaded")

    context_frames: dict = json.loads(CONTEXT_FRAMES_PATH.read_text()) if CONTEXT_FRAMES_PATH.exists() else {}

    # ── Per-choice train index ────────────────────────────────────────────────
    train_index = build_train_index(numeric_to_slug)

    # ── Aggregate student engagement ─────────────────────────────────────────
    print("\nAggregating misconception hits…")
    if args.dry_run:
        student_hits = aggregate_dry_run()
    else:
        student_hits = aggregate_firestore_counts()

    if not student_hits:
        print("No misconception hit data found. Run with --dry-run or ensure "
              "students have completed practice sessions.")
        sys.exit(0)

    # ── Score and select top misconceptions ───────────────────────────────────
    print(f"\nScoring and selecting top {args.top_n} misconceptions…")
    top_misconceptions = score_misconceptions(student_hits, eedi_mis, args.top_n)
    print(f"  {len(top_misconceptions)} scored with example questions")

    if not top_misconceptions:
        print("No scoreable misconceptions found (need example_question_ids).")
        sys.exit(0)

    print("\nTop 10 by score:")
    for m in top_misconceptions[:10]:
        print(f"  [{m['score']:7.1f}] {m['student_hits']:3d} hits  {m['misconception_id']}")
        print(f"           \"{m['eedi_name'][:70]}\"")

    # ── Build enriched queue ──────────────────────────────────────────────────
    print("\nEnriching questions…")
    queue = build_queue(
        top_misconceptions, eedi_questions, train_index,
        eedi_mis, mis_ing_map, ing_meta, context_frames,
    )

    ready = sum(1 for q in queue if q["_promotion"]["status"] == "ready")
    needs_wf = sum(1 for q in queue if q["_promotion"]["status"] == "needs_world_feedback")
    print(f"  {len(queue)} questions in queue")
    print(f"  {ready} ready to merge (world_feedback already filled)")
    print(f"  {needs_wf} need world_feedback from Fable 5")

    # Per-question enrichment summary
    newly_enriched = sum(
        len(q["_promotion"]["enriched_choices"])
        for q in queue
    )
    print(f"  {newly_enriched} choice slots with real misconception IDs (across all questions)")

    # ── Write queue ───────────────────────────────────────────────────────────
    out = {
        "_meta": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "mode": "dry_run" if args.dry_run else "firestore",
            "firestore_project": FIRESTORE_PROJECT if not args.dry_run else None,
            "top_n": args.top_n,
            "n_questions": len(queue),
            "n_ready": ready,
            "n_needs_world_feedback": needs_wf,
            "note": (
                "After Fable 5 fills world_feedback on distractor entries: "
                "run with --merge to apply to eediQuestions.json. "
                "world_feedback rules: ≤200 chars, names the cognitive error "
                "through what the student was trying to do, never says 'wrong'."
            ),
        },
        "questions": queue,
    }

    QUEUE_PATH.write_text(json.dumps(out, indent=2, ensure_ascii=False))
    print(f"\n✓ Written to {QUEUE_PATH}")
    print(f"\nNext steps:")
    print(f"  1. Give promotion_queue.json to Fable 5")
    print(f"  2. Fable 5 fills world_feedback on each distractor entry")
    print(f"  3. python3 ml/scripts/promote_questions.py --merge")
    print(f"  4. Commit eediQuestions.json — CI deploys to frontend")


if __name__ == "__main__":
    main()
