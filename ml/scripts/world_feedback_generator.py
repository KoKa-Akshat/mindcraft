#!/usr/bin/env python3
"""Generate world_feedback for all distractor entries in promotion_queue.json.

For each distractor entry with world_feedback: null and a known misconception_id,
calls Groq to generate a ≤200-char narrative feedback sentence — the sentence the
student sees immediately after picking the wrong answer.

Rules (Brand Book):
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
import hashlib
import json
import os
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
QUEUE_PATH = ROOT / "ml/data/promotion_queue.json"
CACHE_PATH = ROOT / "ml/data/.world_feedback_cache.json"
ONT_PATH = ROOT / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
MIS_PATH = ROOT / "ml/data/eedi_misconceptions.json"

# Prevent importing ml package deps — use llm_client directly
sys.path.insert(0, str(ROOT / "ml"))
from generation.llm_client import complete  # noqa: E402

SYSTEM_PROMPT = """You are Fable 5, the narrative voice of MindCraft — a tutoring platform where \
math lives inside a story world.

Write a world_feedback message: the one-sentence response a student sees \
the instant they pick the wrong answer.

Hard rules (ALL must hold):
1. Exactly ONE sentence. Max 200 characters including spaces. Count carefully.
2. Names the cognitive error through what the student was TRYING to do \
(their intention was reasonable — it just hits the wrong target).
3. NEVER uses these words: wrong, incorrect, mistake, mistaken, error, \
try again, bad, unfortunately, sadly.
4. Warm and specific — never generic ("interesting choice", "not quite").
5. Ends by pointing toward the right reasoning — a question, a subtle shift, \
or a revelation. Do not give away the answer.
6. Return ONLY the sentence — no quotes, no explanation, no JSON."""

USER_TEMPLATE = """Concept: {concept_name}
Misconception label: {mis_label}
What the student was trying to do: {student_thinking}
Ingredient failure mode: {failure_mode}
Question (first 180 chars): {question_stem}
The student chose: "{choice_text}"

Write the world_feedback sentence (≤200 chars):"""

MAX_LEN = 200


def _cache_key(mis_id: str, choice_text: str) -> str:
    raw = f"{mis_id}||{choice_text}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def _load_cache() -> dict[str, str]:
    if CACHE_PATH.exists():
        return json.loads(CACHE_PATH.read_text())
    return {}


def _save_cache(cache: dict[str, str]) -> None:
    CACHE_PATH.write_text(json.dumps(cache, indent=2))


def _build_ontology_index(ont_path: Path) -> tuple[dict, dict, dict]:
    """Returns (concept_names, ingredient_failure_modes, concept_to_failure_modes)."""
    data = json.loads(ont_path.read_text())
    concept_names: dict[str, str] = {}
    failure_modes: dict[str, str] = {}
    concept_fms: dict[str, list[str]] = {}  # concept_id → list of ingredient failure_modes
    for concept in data.get("concepts", []):
        cid = concept["id"]
        concept_names[cid] = concept.get("name") or cid.replace("_", " ").title()
        fms = []
        for ing in concept.get("ingredients", []):
            iid = ing.get("id", "")
            fm = ing.get("failure_mode", "")
            if iid and fm:
                failure_modes[iid] = fm
                fms.append(fm)
        if fms:
            concept_fms[cid] = fms
    return concept_names, failure_modes, concept_fms


def _get_ingredient_for_misconception(mis_id: str) -> str | None:
    """Look up ingredient ID from misconception_ingredient_map if available."""
    map_path = ROOT / "ml/data/misconception_ingredient_map.json"
    if not map_path.exists():
        return None
    mim = json.loads(map_path.read_text())
    links = mim.get("map", {}).get(mis_id)
    if links and isinstance(links, list) and links:
        return links[0].get("ingredient_id")
    return None


def _build_prompt(
    dt: dict,
    question: dict,
    concept_names: dict,
    failure_modes: dict,
    concept_fms: dict,
    mis_registry: dict,
) -> str:
    concept_id = question.get("conceptId", "")
    concept_name = concept_names.get(concept_id, concept_id.replace("_", " ").title())
    mis_id = dt.get("misconception_id", "")
    mis_entry = mis_registry.get(mis_id, {})
    mis_label = mis_entry.get("eedi_name") or dt.get("distractor_label", mis_id)
    student_thinking = dt.get("student_thinking") or mis_label

    # Find failure_mode from ingredient map → ontology (ingredient-specific)
    failure_mode = ""
    ing_id = _get_ingredient_for_misconception(mis_id)
    if ing_id:
        failure_mode = failure_modes.get(ing_id, "")

    # Fall back: use first ingredient failure_mode for this concept (concept-scoped)
    if not failure_mode:
        fms = concept_fms.get(concept_id, [])
        if fms:
            failure_mode = fms[0]

    choice_index = dt.get("choice_index", 0)
    choices = question.get("choices", [])
    choice_text = choices[choice_index] if choice_index < len(choices) else ""

    return USER_TEMPLATE.format(
        concept_name=concept_name,
        mis_label=mis_label,
        student_thinking=student_thinking,
        failure_mode=failure_mode or "Students apply a partially-correct procedure to the wrong part of the problem.",
        question_stem=question.get("question", "")[:180],
        choice_text=choice_text[:120],
    )


def _generate_feedback(user_prompt: str, dry_run: bool) -> str:
    """Call LLM with system + user prompt. Truncates to MAX_LEN if needed."""
    if dry_run:
        return "[DRY RUN — LLM call skipped]"
    # llm_client.complete(prompt, system) — system is the first positional arg
    # and prompt is user content. Confirmed from llm_client.py signature.
    text = complete(user_prompt, system=SYSTEM_PROMPT, max_tokens=120, temperature=0.7)
    # Strip surrounding quotes the model sometimes adds
    text = text.strip().strip('"').strip("'").strip()
    # Hard truncate at MAX_LEN preserving sentence end
    if len(text) > MAX_LEN:
        text = text[:MAX_LEN].rsplit(" ", 1)[0]
        if not text.endswith((".", "?", "!")):
            text = text.rstrip(",;:") + "."
    return text


def run(dry_run: bool = False, force: bool = False) -> None:
    if not QUEUE_PATH.exists():
        print(f"ERROR: {QUEUE_PATH} not found — run promote_questions.py first.")
        sys.exit(1)

    queue = json.loads(QUEUE_PATH.read_text())
    questions = queue.get("questions", [])

    concept_names, failure_modes, concept_fms = _build_ontology_index(ONT_PATH)
    mis_registry = json.loads(MIS_PATH.read_text()) if MIS_PATH.exists() else {}
    cache = _load_cache()

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

            ck = _cache_key(mis_id, choice_text)
            if ck in cache and not force:
                dt["world_feedback"] = cache[ck]
                cached_hits += 1
                filled += 1
                continue

            user_prompt = _build_prompt(dt, question, concept_names, failure_modes, concept_fms, mis_registry)

            if dry_run:
                print(f"\n--- [{question['id']} choice {dt['choice_index']}] ---")
                print(f"mis: {mis_id}")
                print(f"concept: {question.get('conceptId')}")
                print("PROMPT →")
                print(user_prompt[:600])
                filled += 1
                continue

            try:
                feedback = _generate_feedback(user_prompt, dry_run=False)
                dt["world_feedback"] = feedback
                dt["_promotion"] = {**dt.get("_promotion", {}), "world_feedback_source": "groq_generated"}
                cache[ck] = feedback
                filled += 1
                print(f"  [{question['id']} choice {dt['choice_index']}] {feedback[:90]}…" if len(feedback) > 90 else f"  [{question['id']} choice {dt['choice_index']}] {feedback}")
                # Save cache periodically
                if filled % 10 == 0:
                    _save_cache(cache)
                time.sleep(0.3)  # Groq rate-limit headroom
            except Exception as exc:
                print(f"  ERROR [{question['id']} choice {dt['choice_index']}]: {exc}", file=sys.stderr)
                errors += 1

    if not dry_run:
        _save_cache(cache)
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
