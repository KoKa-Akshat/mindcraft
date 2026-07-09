#!/usr/bin/env python3
"""Generate world_feedback for all distractor entries in promotion_queue.json.

For each distractor entry with world_feedback: null and a known misconception_id,
calls Groq to generate a ≤200-char narrative feedback sentence — the sentence the
student sees immediately after picking the wrong answer.

Rules (Brand Book) — see `ml/mindcraft_graph/world_feedback.py` for the full
system prompt and voice rules:
  - ONE sentence, max 200 chars (hard limit)
  - Names the cognitive error through what the student was TRYING to do
  - Never says: wrong, incorrect, mistake, try again, bad, error
  - Warm, precise, never condescending
  - Points toward the correct reasoning (ends with a question or a revelation)

After running, call:
    python3 ml/scripts/promote_questions.py --merge
to apply the enriched queue to app/src/data/eediQuestions.json.

Usage:
    cd <repo-root>
    LLM_PROVIDER=groq python3 ml/scripts/world_feedback_generator.py
    LLM_PROVIDER=groq python3 ml/scripts/world_feedback_generator.py --dry-run
    LLM_PROVIDER=groq python3 ml/scripts/world_feedback_generator.py --force
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
from pathlib import Path

# macOS Python ships without system certs — set SSL_CERT_FILE early,
# before any urllib/http connections are opened, or Groq calls fail.
try:
    import certifi
    os.environ.setdefault("SSL_CERT_FILE", certifi.where())
    os.environ.setdefault("REQUESTS_CA_BUNDLE", certifi.where())
except ImportError:
    pass

ROOT = Path(__file__).resolve().parent.parent.parent
QUEUE_PATH = ROOT / "ml/data/promotion_queue.json"
ONT_PATH = ROOT / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
MIS_PATH = ROOT / "ml/data/eedi_misconceptions.json"

# Prevent importing ml package deps — use the shared module directly
sys.path.insert(0, str(ROOT / "ml"))
from mindcraft_graph.world_feedback import (  # noqa: E402
    build_ontology_index,
    build_world_feedback_user_prompt,
    cache_key,
    generate_world_feedback,
    load_cache,
    save_cache,
)


def run(dry_run: bool = False, force: bool = False) -> None:
    if not QUEUE_PATH.exists():
        print(f"ERROR: {QUEUE_PATH} not found — run promote_questions.py first.")
        sys.exit(1)

    queue = json.loads(QUEUE_PATH.read_text())
    questions = queue.get("questions", [])

    concept_names, failure_modes, concept_fms = build_ontology_index(ONT_PATH)
    mis_registry = json.loads(MIS_PATH.read_text()) if MIS_PATH.exists() else {}
    cache = load_cache()

    total = 0
    filled = 0
    cached_hits = 0
    skipped_no_mis = 0
    errors = 0

    for question in questions:
        for dt in question.get("distractor_taxonomy", []):
            total += 1
            if dt.get("world_feedback") and not force:
                continue  # already has feedback
            mis_id = dt.get("misconception_id")
            if not mis_id:
                skipped_no_mis += 1
                continue

            choices = question.get("choices", [])
            choice_index = dt.get("choice_index", 0)
            choice_text = choices[choice_index] if choice_index < len(choices) else ""

            ck = cache_key(mis_id, choice_text)
            if ck in cache and not force:
                dt["world_feedback"] = cache[ck]
                cached_hits += 1
                filled += 1
                continue

            user_prompt = build_world_feedback_user_prompt(
                dt, question, concept_names, failure_modes, concept_fms, mis_registry
            )

            if dry_run:
                print(f"\n--- [{question['id']} choice {dt['choice_index']}] ---")
                print(f"mis: {mis_id}")
                print(f"concept: {question.get('conceptId')}")
                print("PROMPT →")
                print(user_prompt[:600])
                filled += 1
                continue

            try:
                feedback = generate_world_feedback(user_prompt, dry_run=False)
                dt["world_feedback"] = feedback
                dt["_promotion"] = {**dt.get("_promotion", {}), "world_feedback_source": "groq_generated"}
                cache[ck] = feedback
                filled += 1
                print(f"  [{question['id']} choice {dt['choice_index']}] {feedback[:90]}…" if len(feedback) > 90 else f"  [{question['id']} choice {dt['choice_index']}] {feedback}")
                # Save cache periodically
                if filled % 10 == 0:
                    save_cache(cache)
                time.sleep(0.3)  # Groq rate-limit headroom
            except Exception as exc:
                print(f"  ERROR [{question['id']} choice {dt['choice_index']}]: {exc}", file=sys.stderr)
                errors += 1

            # Save progress every entry so a long Groq run is not lost on interrupt.
            if not dry_run and filled % 1 == 0:
                save_cache(cache)
                QUEUE_PATH.write_text(json.dumps(queue, indent=2))

    if not dry_run:
        save_cache(cache)
        # Update _meta
        queue["_meta"] = {
            **queue.get("_meta", {}),
            "world_feedback_generated": True,
            "world_feedback_filled": filled,
            "world_feedback_cached": cached_hits,
        }
        QUEUE_PATH.write_text(json.dumps(queue, indent=2))

    print(f"\nDone. total={total} filled={filled} cached={cached_hits} no_misconception={skipped_no_mis} errors={errors}")
    if not dry_run and errors == 0:
        print("\nNext: python3 ml/scripts/promote_questions.py --merge")


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate world_feedback for promotion_queue.json")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts, no LLM calls")
    parser.add_argument("--force", action="store_true", help="Regenerate even if world_feedback already set")
    args = parser.parse_args()

    provider = os.getenv("LLM_PROVIDER", "ollama")
    if provider != "groq" and not args.dry_run:
        print(f"WARNING: LLM_PROVIDER={provider}. Set LLM_PROVIDER=groq for best results.")
        if provider == "ollama" and not args.dry_run:
            print("  Ollama may not follow length constraints. Consider: LLM_PROVIDER=groq python3 ...")

    run(dry_run=args.dry_run, force=args.force)


if __name__ == "__main__":
    main()
