"""Shared Katha-voice world_feedback generator.

world_feedback is the one-sentence message a student sees the instant they
pick a wrong answer. It is a Brand Book deliverable (Katha voice), not a math
description, so both callers that mint it — the Eedi question-enrichment
pipeline (`ml/scripts/world_feedback_generator.py`, feeding
`promote_questions.py`) and the story-cell bulk generator
(`ml/scripts/generate_story_cells.py`) — go through this one module so the
voice rules and the on-disk cache stay in one place.

Brand Book rules (hard requirements):
  - Exactly ONE sentence, max 200 characters including spaces.
  - Names the cognitive error through what the student was TRYING to do —
    their intention was reasonable, it just hit the wrong target.
  - NEVER uses: wrong, incorrect, mistake, mistaken, error, try again, bad,
    unfortunately, sadly.
  - Warm and specific — never generic ("interesting choice", "not quite").
  - Ends by pointing toward the right reasoning — a question, a subtle shift,
    or a revelation. Does not give away the answer.
  - Output is the sentence only — no quotes, no JSON wrapper.

See BRAND_BOOK.md (Katha voice, emotional_safety constraints) and
STORY_CELL_SCALE_PLAN.md §D for the design rationale.
"""
from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent

WORLD_FEEDBACK_CACHE_PATH = ROOT / "ml/data/.world_feedback_cache.json"

# Prevent importing the full ml package's deps — call llm_client directly,
# same pattern as world_feedback_generator.py and generate_story_cells.py.
_ML_DIR = str(ROOT / "ml")
if _ML_DIR not in sys.path:
    sys.path.insert(0, _ML_DIR)
from generation.llm_client import complete  # noqa: E402

WORLD_FEEDBACK_SYSTEM_PROMPT = """You are Fable 5, the narrative voice of MindCraft — a tutoring platform where \
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

_USER_TEMPLATE = """Concept: {concept_name}
Misconception label: {mis_label}
What the student was trying to do: {student_thinking}
Ingredient failure mode: {failure_mode}
Question (first 180 chars): {question_stem}
The student chose: "{choice_text}"

Write the world_feedback sentence (≤200 chars):"""

MAX_LEN = 200


def cache_key(mis_id: str, choice_text: str) -> str:
    raw = f"{mis_id}||{choice_text}"
    return hashlib.sha1(raw.encode()).hexdigest()[:16]


def load_cache() -> dict[str, str]:
    if WORLD_FEEDBACK_CACHE_PATH.exists():
        return json.loads(WORLD_FEEDBACK_CACHE_PATH.read_text())
    return {}


def save_cache(cache: dict[str, str]) -> None:
    WORLD_FEEDBACK_CACHE_PATH.write_text(json.dumps(cache, indent=2))


def build_world_feedback_user_prompt(
    dt: dict,
    question: dict,
    concept_names: dict[str, str],
    failure_modes: dict[str, str],
    concept_fms: dict[str, list[str]],
    mis_registry: dict,
) -> str:
    """Build the user prompt for a single wrong-choice world_feedback call.

    `dt` is a distractor_taxonomy entry (needs `misconception_id`,
    `student_thinking` or `distractor_label`, `choice_index`). `question`
    needs `conceptId`, `question`, `choices`. `concept_names` /
    `failure_modes` / `concept_fms` come from the Layer-1 ontology index;
    `mis_registry` is the eedi_misconceptions.json-shaped registry.
    """
    concept_id = question.get("conceptId", "")
    concept_name = concept_names.get(concept_id, concept_id.replace("_", " ").title())
    mis_id = dt.get("misconception_id", "")
    mis_entry = mis_registry.get(mis_id, {})
    mis_label = mis_entry.get("eedi_name") or dt.get("distractor_label", mis_id)
    student_thinking = dt.get("student_thinking") or mis_label

    # Find failure_mode from ingredient map → ontology (ingredient-specific).
    failure_mode = ""
    ing_id = _get_ingredient_for_misconception(mis_id)
    if ing_id:
        failure_mode = failure_modes.get(ing_id, "")

    # Fall back: use first ingredient failure_mode for this concept (concept-scoped).
    if not failure_mode:
        fms = concept_fms.get(concept_id, [])
        if fms:
            failure_mode = fms[0]

    choice_index = dt.get("choice_index", 0)
    choices = question.get("choices", [])
    choice_text = choices[choice_index] if choice_index < len(choices) else ""

    return _USER_TEMPLATE.format(
        concept_name=concept_name,
        mis_label=mis_label,
        student_thinking=student_thinking,
        failure_mode=failure_mode or "Students apply a partially-correct procedure to the wrong part of the problem.",
        question_stem=question.get("question", "")[:180],
        choice_text=choice_text[:120],
    )


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


def build_ontology_index(ont_path: Path) -> tuple[dict, dict, dict]:
    """Returns (concept_names, ingredient_failure_modes, concept_to_failure_modes).

    Shared helper so both callers build the same Layer-1 index the same way.
    """
    data = json.loads(ont_path.read_text())
    concept_names: dict[str, str] = {}
    failure_modes: dict[str, str] = {}
    concept_fms: dict[str, list[str]] = {}  # concept_id -> list of ingredient failure_modes
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


def generate_world_feedback(user_prompt: str, dry_run: bool = False) -> str:
    """Call the LLM with the shared system prompt + a caller-built user prompt.

    Truncates to MAX_LEN (200 chars) if the model overruns, preserving a
    clean sentence boundary. In dry_run mode, returns a placeholder without
    calling the LLM (so callers can validate prompts without GROQ_API_KEY).
    """
    if dry_run:
        return "[DRY RUN — LLM call skipped]"
    text = complete(user_prompt, system=WORLD_FEEDBACK_SYSTEM_PROMPT, max_tokens=120, temperature=0.7)
    # Strip surrounding quotes the model sometimes adds.
    text = text.strip().strip('"').strip("'").strip()
    # Hard truncate at MAX_LEN preserving sentence end.
    if len(text) > MAX_LEN:
        text = text[:MAX_LEN].rsplit(" ", 1)[0]
        if not text.endswith((".", "?", "!")):
            text = text.rstrip(",;:") + "."
    return text
