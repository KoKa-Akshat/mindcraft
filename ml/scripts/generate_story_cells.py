#!/usr/bin/env python3
"""Bulk-generate full story cells from lightweight DNA cells.

A "DNA cell" is the compact spec that seeds one story cell:
    conceptId, ingredient_id, misconception_id, misconception_label,
    world, primitive, level, examTag
The DNA subset is extracted from an existing cell file (default
`ml/data/story_cells/batch_ingredient_fable5.json` — the 13 approved pilot
cells double as DNA seeds here; only the 8 DNA fields above are read, the
manually-authored math/narrative fields on those cells are ignored).

For each DNA cell this script runs a four-step LLM chain (see
`agent_work/engine/STORY_CELL_SCALE_PLAN.md` §B for the full design):

  Step 1 — math spine generation (question, choices, correctIndex,
           correct_reasoning, distractor_taxonomy, hints, explanation,
           transfer_question). One Groq call.
  Step 2 — math-integrity auto-verify (Gate A firewall): re-solve the
           question independently, without seeing Step 1's correctIndex.
           Disagreement => discard immediately, no retry, no override.
  Step 3 — Katha-voice narrative generation (storyContext, narrative_need,
           student_action, top-level world_feedback, title,
           presentation.minimal, tone_flags).
  Step 4 — pedagogy scoring (7 dimensions via Groq) + gate assignment.

Per-distractor `world_feedback` (the string a student sees the instant they
pick that wrong choice) is generated separately through the shared
`ml.mindcraft_graph.world_feedback` module — the same Katha-voice contract
`world_feedback_generator.py` uses for the Eedi bank, so both pipelines speak
with one voice.

Each step retries up to 2 times on a technical failure (LLM error / JSON
parse failure). A Step 2 disagreement is NOT retried — it is an immediate
discard (triple-verify principle, PIPELINE_MCQ_SPEC.md): a wrong key in a
story cell corrupts the mastery graph exactly like a wrong key in the bank.

Usage:
    python3 ml/scripts/generate_story_cells.py                       # generate all DNA cells
    python3 ml/scripts/generate_story_cells.py --dry-run             # print prompts, no LLM calls
    python3 ml/scripts/generate_story_cells.py --limit 3             # first 3 DNA cells only
    python3 ml/scripts/generate_story_cells.py --concept linear_equations
    python3 ml/scripts/generate_story_cells.py --dna-file ml/data/story_cells/batch_dna_scale_v1.json
    python3 ml/scripts/generate_story_cells.py --no-llm              # math spine only (Step 1), skip narrative/scoring

Output:
    ml/data/story_cells/batch_generated_{YYYYMMDD}.json   — gate A/B cells
    ml/data/story_cells/generate_report_{YYYYMMDD}.json   — drop log (discards + reasons)

Requires LLM_PROVIDER=groq in ml/.env.local for live runs. --dry-run works
without GROQ_API_KEY.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
STORY_CELLS_DIR = ROOT / "ml/data/story_cells"
DEFAULT_DNA_FILE = STORY_CELLS_DIR / "batch_ingredient_fable5.json"
ONT_PATH = ROOT / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
MIS_PATH = ROOT / "ml/data/eedi_misconceptions.json"

GENERATOR_VERSION = "scs-v2.0"

# Prevent importing the full ml package deps — call the LLM + shared modules
# directly, same pattern as world_feedback_generator.py.
sys.path.insert(0, str(ROOT / "ml"))
from generation.llm_client import complete  # noqa: E402
from mindcraft_graph.world_feedback import (  # noqa: E402
    build_ontology_index,
    build_world_feedback_user_prompt,
    generate_world_feedback,
)


def extract_json_object(raw: str) -> dict | None:
    """Parse a JSON object from an LLM reply, tolerating fences/preamble."""
    if not raw:
        return None
    try:
        obj = json.loads(raw)
        return obj if isinstance(obj, dict) else None
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{[\s\S]*\}", raw)
    if m:
        try:
            obj = json.loads(m.group(0))
            return obj if isinstance(obj, dict) else None
        except json.JSONDecodeError:
            return None
    return None

# ---------------------------------------------------------------------------
# Story worlds — reuse the pilot protagonists only (STORY_CELL_NARRATIVE_RULES.md
# §5: new named characters require an Akshat sign-off). Unknown/missing world
# values in a DNA cell fall back to market_world.
# ---------------------------------------------------------------------------

WORLDS = {
    "market_world": {
        "display_name": "Market World",
        "setting_line": "Kingston harbor, 1762 — merchants, ledgers, and a ship that must sail on budget.",
        "protagonist_name": "William",
        "protagonist_bio": "A merchant's apprentice tracking prices and contracts before his father's voyage.",
        "default_primitive": "trade_price_bargain",
    },
    "creature_sanctuary": {
        "display_name": "Creature Sanctuary",
        "setting_line": "A wildlife sanctuary where every measurement affects an animal's care.",
        "protagonist_name": "Simon",
        "protagonist_bio": "A young keeper logging feed, water, and training data for the animals in his care.",
        "default_primitive": "fill_spill_overflow",
    },
}
DEFAULT_WORLD_ID = "market_world"

# DNA cell fields (the lightweight spec extracted from an existing cell file).
DNA_FIELDS = ["conceptId", "ingredient_id", "misconception_id", "misconception_label", "world", "primitive", "level", "examTag"]

MAX_STEP_RETRIES = 2

JSON_ONLY_SYSTEM = "Output valid JSON only — no markdown code fences, no commentary before or after the JSON object."
VERIFY_SYSTEM = "Show your work, then end with the exact line: FINAL ANSWER: [letter]."

# Field budgets — STORY_CELL_NARRATIVE_RULES.md §1
MAX_STORY_CONTEXT = 120
MAX_NARRATIVE_NEED = 100
MAX_STUDENT_ACTION = 80
MAX_MINIMAL_STORY_CONTEXT = 60
MAX_WORLD_FEEDBACK = 200

# Brand Book banned words (§1.2.3 tone flags) — never say these in narrative fields.
BANNED_WORDS = ["wrong", "incorrect", "mistake", "mistaken", "error", "try again", "bad", "unfortunately", "sadly"]

# Pedagogy scoring dimensions (7) + gate thresholds
SCORE_DIMS = [
    "math_integrity",
    "emotional_safety",
    "narrative_fit",
    "misconception_alignment",
    "difficulty_appropriate",
    "engagement",
    "clarity",
]
GATE_A_MIN_AVG = 8.5
GATE_A_MIN_MATH_INTEGRITY = 8
GATE_A_MIN_EMOTIONAL_SAFETY = 8
GATE_B_MIN_AVG = 7.0
GATE_B_MAX_AVG = 8.4

FINAL_ANSWER_RE = re.compile(r"FINAL ANSWER:\s*\[?\s*([A-D])\s*\]?", re.I)


# ---------------------------------------------------------------------------
# Ontology / DNA loading
# ---------------------------------------------------------------------------

def load_full_ontology(path: Path) -> tuple[dict, dict]:
    """Returns (concepts_by_id, ingredients_by_id). ingredients carry `concept_id`."""
    data = json.loads(path.read_text())
    concepts: dict[str, dict] = {}
    ingredients: dict[str, dict] = {}
    for c in data.get("concepts", []):
        concepts[c["id"]] = c
        for ing in c.get("ingredients", []):
            ingredients[ing["id"]] = {**ing, "concept_id": c["id"]}
    return concepts, ingredients


def load_dna_cells(path: Path) -> list[dict]:
    data = json.loads(path.read_text())
    out: list[dict] = []
    for c in data.get("cells", []):
        dna = {k: c.get(k) for k in DNA_FIELDS}
        dna["_dna_id"] = c.get("id")
        if not dna.get("conceptId") or not dna.get("ingredient_id") or not dna.get("misconception_label"):
            continue  # malformed DNA entry — skip
        out.append(dna)
    return out


def world_info_for(world_id: str | None) -> tuple[str, dict]:
    wid = world_id or DEFAULT_WORLD_ID
    info = WORLDS.get(wid)
    if info is None:
        wid = DEFAULT_WORLD_ID
        info = WORLDS[DEFAULT_WORLD_ID]
    return wid, info


# ---------------------------------------------------------------------------
# Prompt builders (templates verbatim from STORY_CELL_SCALE_PLAN.md §B)
# ---------------------------------------------------------------------------

def build_step1_prompt(concept_name: str, ingredient_label: str, ingredient_description: str,
                        misconception_label: str, world_name: str, world_setting_line: str,
                        primitive: str) -> str:
    return f"""You are authoring a math question for a 15-16 year old student (ACT/GCSE level).

Concept: {concept_name}
Ingredient: {ingredient_label} — {ingredient_description}
Target misconception: {misconception_label}

World context: {world_name} — {world_setting_line}
Primitive: {primitive}

Requirements:
1. Write a 4-choice MCQ where:
   - correctIndex is the index of the ONLY correct answer (0-3)
   - choices[0..3] are all plausible; exactly ONE is correct
   - The question tests the specific ingredient listed above
   - The wrong choices each reflect a specific, named error type (not "random wrong number")
2. math_integrity = 10 is MANDATORY. Verify your answer step-by-step before outputting.
3. The question must be FULLY self-contained. Do not require the story context to solve it.
4. Distractor taxonomy: for each wrong choice, name the exact misconception (student_thinking ≤ 60 chars).
   Identify which ONE wrong choice most directly reflects the target misconception listed above.

Output JSON only (no markdown wrapper):
{{
  "question": "...",
  "choices": ["...", "...", "...", "..."],
  "correctIndex": 0,
  "correct_reasoning": "Step-by-step...",
  "distractor_taxonomy": [
    {{"choice_index": 1, "error_type": "...", "student_thinking": "..."}},
    {{"choice_index": 2, "error_type": "...", "student_thinking": "..."}},
    {{"choice_index": 3, "error_type": "...", "student_thinking": "..."}}
  ],
  "primary_misconception_choice_index": 1,
  "hints": ["Hint 1 (step towards method)...", "Hint 2 (partial compute)...", "Hint 3 (almost there)..."],
  "explanation": "Full worked solution...",
  "transfer_question": "A related problem in a different context..."
}}"""


def build_verify_prompt(question: str, choices: list[str]) -> str:
    letters = "ABCD"
    lines = "\n".join(f"{letters[i]}: {c}" for i, c in enumerate(choices))
    return f"""Solve this multiple choice problem. Show step-by-step work.
End with: "FINAL ANSWER: [letter A/B/C/D]"

{question}
{lines}"""


def build_step3_prompt(world_name: str, world_setting_line: str, protagonist_name: str,
                        protagonist_bio: str, ingredient_label: str, correct_reasoning: str,
                        misconception_label: str) -> str:
    first_sentence = correct_reasoning.split(". ")[0].strip().rstrip(".") + "."
    return f"""You are writing in Katha voice (the story layer of MindCraft — see brand rules below).

World: {world_name} — {world_setting_line}
Protagonist: {protagonist_name} — {protagonist_bio}
Math move in this scene: {ingredient_label} ({first_sentence})
Student's error this question catches: {misconception_label}

Katha voice rules:
- Present tense, sensory, specific
- One person, one crisis, one mathematical stake (implicit — never name the math)
- No interface words: "concept", "practice", "level", "question", "solve", "calculate"
- storyContext: ≤ 120 chars. Protagonist + stake only. No backstory.
- world_feedback: ≤ 200 chars. One string. Celebrate the move, land ONE math insight.
  - Never: "wrong", "incorrect", "mistake", "try again"
  - Do: name what the student was trying to do + the one corrective move
- presentation.minimal.storyContext: ≤ 60 chars, no character names, plain language

Output JSON only:
{{
  "title": "≤8 words",
  "storyContext": "...",
  "narrative_need": "...(≤100 chars, verb-first, story stake)...",
  "student_action": "...(≤80 chars, math verbs allowed)...",
  "world_feedback": "...",
  "presentation": {{
    "minimal": {{
      "storyContext": "...(≤60 chars)...",
      "world_feedback": "...(≤200 chars, no character names)..."
    }}
  }},
  "tone_flags": []
}}"""


def build_compress_prompt(step3_prompt: str, field_name: str, current_value: str, max_len: int) -> str:
    return (
        f"{step3_prompt}\n\n"
        f"Your previous {field_name} was {len(current_value)} chars: \"{current_value}\". "
        f"That is over the {max_len}-char budget. Regenerate the FULL JSON above with a compressed "
        f"{field_name} (≤{max_len} chars) that keeps protagonist + stake. Do not change any other field."
    )


def build_score_prompt(cell_json_str: str) -> str:
    return f"""Score this story cell on 7 dimensions (each 1-10):
- math_integrity: Is the answer key definitely correct? (Must be high given the independent re-solve verification)
- emotional_safety: Does the feedback ever shame, blame, or use banned words (wrong/incorrect/mistake/try again)? Score low if so.
- narrative_fit: Does the story stake connect naturally to the math move, without decoration or a forced scene?
- misconception_alignment: Will a student who holds the target misconception predictably choose the matching distractor?
- difficulty_appropriate: Is the question calibrated for a 15-16 year old at the stated level?
- engagement: Does the scene raise a real, specific stake rather than reading as a worksheet wrapper?
- clarity: Is the question, once the story is covered, fully self-contained and unambiguous?

Cell:
{cell_json_str}

Output JSON only: {{"math_integrity": N, "emotional_safety": N, "narrative_fit": N, "misconception_alignment": N, "difficulty_appropriate": N, "engagement": N, "clarity": N}}"""


# ---------------------------------------------------------------------------
# LLM call wrappers (retry on technical failure; no retry on Step-2 disagreement)
# ---------------------------------------------------------------------------

def _call_json_step(prompt: str, max_tokens: int = 1400, temperature: float = 0.6,
                     retries: int = MAX_STEP_RETRIES) -> tuple[dict | None, str | None]:
    last_err = None
    for _attempt in range(retries + 1):
        try:
            raw = complete(prompt, system=JSON_ONLY_SYSTEM, max_tokens=max_tokens, temperature=temperature)
        except Exception as exc:  # noqa: BLE001
            last_err = f"llm_error: {exc}"
            time.sleep(1.0)
            continue
        data = extract_json_object(raw or "")
        if data is not None:
            return data, None
        last_err = f"json_parse_failed (raw[:200]={(raw or '')[:200]!r})"
        time.sleep(0.5)
    return None, last_err


def _call_verify(prompt: str, retries: int = MAX_STEP_RETRIES) -> tuple[int | None, str | None]:
    last_err = None
    for _attempt in range(retries + 1):
        try:
            raw = complete(prompt, system=VERIFY_SYSTEM, max_tokens=700, temperature=0.3)
        except Exception as exc:  # noqa: BLE001
            last_err = f"llm_error: {exc}"
            time.sleep(1.0)
            continue
        matches = FINAL_ANSWER_RE.findall(raw or "")
        if matches:
            letter = matches[-1].upper()
            return "ABCD".index(letter), None
        last_err = f"no_final_answer_line (raw[-200:]={(raw or '')[-200:]!r})"
        time.sleep(0.5)
    return None, last_err


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _hard_truncate(text: str, max_len: int) -> str:
    if not isinstance(text, str) or len(text) <= max_len:
        return text
    return text[:max_len].rsplit(" ", 1)[0].rstrip(",;: ")


def _tone_flags(*fields: str) -> list[str]:
    flags = []
    for f in fields:
        if not isinstance(f, str):
            continue
        low = f.lower()
        for w in BANNED_WORDS:
            if w in low:
                flags.append(f"banned_word:{w}")
    return sorted(set(flags))


def _gate_for_score(pedagogy_score: dict) -> str:
    avg = pedagogy_score["average"]
    if (avg >= GATE_A_MIN_AVG
            and pedagogy_score["math_integrity"] >= GATE_A_MIN_MATH_INTEGRITY
            and pedagogy_score["emotional_safety"] >= GATE_A_MIN_EMOTIONAL_SAFETY):
        return "A"
    if GATE_B_MIN_AVG <= avg <= GATE_B_MAX_AVG:
        return "B"
    return "reject"


def _new_cell_id(concept_id: str, ingredient_id: str, misconception_id: str | None, idx: int) -> str:
    basis = f"{concept_id}|{ingredient_id}|{misconception_id}|{idx}|{time.time()}"
    h = hashlib.sha1(basis.encode()).hexdigest()[:6]
    return f"cell_{concept_id}_{h}"


def _drop(dna: dict, stage: str, reason: str, extra: dict | None = None) -> dict:
    rec = {
        "dna_id": dna.get("_dna_id"),
        "conceptId": dna.get("conceptId"),
        "ingredient_id": dna.get("ingredient_id"),
        "stage": stage,
        "reason": reason,
    }
    if extra:
        rec["extra"] = extra
    return rec


# ---------------------------------------------------------------------------
# Per-cell pipeline
# ---------------------------------------------------------------------------

def process_dna_cell(idx: int, dna: dict, ingredients: dict, concept_names: dict,
                      failure_modes: dict, concept_fms: dict, mis_registry: dict,
                      dry_run: bool = False, no_llm: bool = False) -> tuple[dict | None, dict | None]:
    concept_id = dna["conceptId"]
    concept_name = concept_names.get(concept_id, concept_id.replace("_", " ").title())
    ing = ingredients.get(dna["ingredient_id"], {})
    ingredient_label = ing.get("label", dna["ingredient_id"])
    ingredient_description = ing.get("description", "")

    world_id, world = world_info_for(dna.get("world"))
    primitive = dna.get("primitive") or world["default_primitive"]

    step1_prompt = build_step1_prompt(
        concept_name, ingredient_label, ingredient_description, dna["misconception_label"],
        world["display_name"], world["setting_line"], primitive,
    )

    if dry_run:
        print(f"\n=== DNA[{idx}] {concept_id} / {dna['ingredient_id']} (world={world_id}) ===")
        print("--- STEP 1 (math spine) prompt ---")
        print(step1_prompt)
        placeholder_reasoning = "The correct approach isolates the target quantity step by step."
        step3_prompt = build_step3_prompt(
            world["display_name"], world["setting_line"], world["protagonist_name"],
            world["protagonist_bio"], ingredient_label, placeholder_reasoning, dna["misconception_label"],
        )
        print("--- STEP 3 (narrative) prompt ---")
        print(step3_prompt)
        print("--- STEP 2 (verify) / STEP 4 (scoring): skipped in dry-run — depend on generated content ---")
        return None, None

    cell_id = _new_cell_id(concept_id, dna["ingredient_id"], dna.get("misconception_id"), idx)

    # ── Step 1 — math spine ────────────────────────────────────────────────
    spine, err = _call_json_step(step1_prompt, max_tokens=1400, temperature=0.6)
    if spine is None:
        return None, _drop(dna, "step1_math_spine", err or "no JSON parsed")

    required = ["question", "choices", "correctIndex", "correct_reasoning",
                "distractor_taxonomy", "hints", "explanation", "transfer_question"]
    missing = [k for k in required if k not in spine]
    if missing:
        return None, _drop(dna, "step1_math_spine", f"missing keys: {missing}")

    choices = spine["choices"]
    if not isinstance(choices, list) or len(choices) != 4:
        return None, _drop(dna, "step1_math_spine", f"choices must be a list of 4, got {choices!r}")
    ci = spine.get("correctIndex")
    if not isinstance(ci, int) or not (0 <= ci < 4):
        return None, _drop(dna, "step1_math_spine", f"bad correctIndex: {ci!r}")

    if no_llm:
        cell = {
            "id": cell_id,
            "generator_version": GENERATOR_VERSION,
            "conceptId": concept_id,
            "ingredient_id": dna["ingredient_id"],
            "misconception_id": dna.get("misconception_id"),
            "misconception_label": dna["misconception_label"],
            "level": dna.get("level") or 2,
            "format": "multiple_choice",
            "examTag": dna.get("examTag"),
            "question": spine["question"],
            "choices": choices,
            "correctIndex": ci,
            "correct_reasoning": spine["correct_reasoning"],
            "distractor_taxonomy": spine["distractor_taxonomy"],
            "hints": spine["hints"][:3],
            "explanation": spine.get("explanation", ""),
            "transfer_question": spine.get("transfer_question", ""),
            "gate_status": "reject",
            "_note": "no_llm_math_spine_only — narrative/scoring skipped by --no-llm",
        }
        return cell, None

    # ── Step 2 — math-integrity auto-verify (Gate A firewall) ─────────────
    verify_prompt = build_verify_prompt(spine["question"], choices)
    resolved_idx, verify_err = _call_verify(verify_prompt)
    if resolved_idx is None:
        return None, _drop(dna, "step2_verify", verify_err or "could not parse FINAL ANSWER")
    if resolved_idx != ci:
        return None, _drop(
            dna, "step2_verify_disagreement",
            f"step1 correctIndex={ci} vs independent resolve={resolved_idx}",
            extra={"question": spine["question"], "choices": choices,
                   "step1_reasoning": spine["correct_reasoning"]},
        )

    # ── Step 3 — Katha-voice narrative generation ──────────────────────────
    step3_prompt = build_step3_prompt(
        world["display_name"], world["setting_line"], world["protagonist_name"],
        world["protagonist_bio"], ingredient_label, spine["correct_reasoning"], dna["misconception_label"],
    )
    narrative, err = _call_json_step(step3_prompt, max_tokens=900, temperature=0.8)
    if narrative is None:
        return None, _drop(dna, "step3_narrative", err or "no JSON parsed")

    story_context = narrative.get("storyContext", "")
    if not isinstance(story_context, str):
        return None, _drop(dna, "step3_narrative", "storyContext is not a string")
    if len(story_context) > MAX_STORY_CONTEXT:
        # Revise-loop: one compression retry before falling back to a hard trim.
        compress_prompt = build_compress_prompt(step3_prompt, "storyContext", story_context, MAX_STORY_CONTEXT)
        revised, _rerr = _call_json_step(compress_prompt, max_tokens=900, temperature=0.7, retries=0)
        if revised and isinstance(revised.get("storyContext"), str) and len(revised["storyContext"]) <= MAX_STORY_CONTEXT:
            narrative = revised
            story_context = revised["storyContext"]
        else:
            story_context = _hard_truncate(story_context, MAX_STORY_CONTEXT)
            narrative["storyContext"] = story_context

    world_feedback_top = narrative.get("world_feedback", "")
    if isinstance(world_feedback_top, dict):
        return None, _drop(dna, "step3_narrative", "world_feedback is a {correct,incorrect} object — must be a string")
    world_feedback_top = _hard_truncate(str(world_feedback_top), MAX_WORLD_FEEDBACK)

    narrative_need = _hard_truncate(str(narrative.get("narrative_need", "")), MAX_NARRATIVE_NEED)
    student_action = _hard_truncate(str(narrative.get("student_action", "")), MAX_STUDENT_ACTION)

    presentation = narrative.get("presentation") or {}
    minimal = presentation.get("minimal") or {}
    minimal_story = _hard_truncate(str(minimal.get("storyContext", "")), MAX_MINIMAL_STORY_CONTEXT)
    minimal_feedback = _hard_truncate(str(minimal.get("world_feedback", "")), MAX_WORLD_FEEDBACK)
    presentation = {"default": "story", "minimal": {"storyContext": minimal_story, "world_feedback": minimal_feedback}}

    tone_flags = sorted(set(narrative.get("tone_flags") or []) | set(_tone_flags(
        story_context, narrative_need, student_action, world_feedback_top, minimal_story, minimal_feedback,
    )))

    # ── Per-distractor world_feedback — shared Katha-voice module ──────────
    primary_idx = spine.get("primary_misconception_choice_index")
    wrong_indices = [i for i in range(4) if i != ci]
    if primary_idx not in wrong_indices:
        primary_idx = wrong_indices[0] if wrong_indices else None

    question_like = {"conceptId": concept_id, "question": spine["question"], "choices": choices, "id": cell_id}
    distractor_taxonomy = []
    for dt in spine["distractor_taxonomy"]:
        dt = dict(dt)
        dt["misconception_id"] = dna.get("misconception_id") if dt.get("choice_index") == primary_idx else None
        wf_prompt = build_world_feedback_user_prompt(
            dt, question_like, concept_names, failure_modes, concept_fms, mis_registry,
        )
        dt["world_feedback"] = generate_world_feedback(wf_prompt, dry_run=False)
        distractor_taxonomy.append(dt)
        time.sleep(0.3)  # Groq rate-limit headroom

    hints = [str(h) for h in spine["hints"]][:3]
    while len(hints) < 3:
        hints.append("Re-check your last step against the reasoning above.")

    # ── Step 4 — pedagogy scoring + gate ────────────────────────────────────
    scoring_payload = {
        "conceptId": concept_id,
        "level": dna.get("level") or 2,
        "storyContext": story_context,
        "question": spine["question"],
        "choices": choices,
        "correctIndex": ci,
        "correct_reasoning": spine["correct_reasoning"],
        "distractor_taxonomy": distractor_taxonomy,
        "hints": hints,
        "world_feedback": world_feedback_top,
    }
    score_prompt = build_score_prompt(json.dumps(scoring_payload, ensure_ascii=False))
    score_data, score_err = _call_json_step(score_prompt, max_tokens=300, temperature=0.2)
    if score_data is None:
        return None, _drop(dna, "step4_scoring", score_err or "no JSON parsed")

    try:
        values = {d: float(score_data[d]) for d in SCORE_DIMS}
    except (KeyError, TypeError, ValueError) as exc:
        return None, _drop(dna, "step4_scoring", f"bad score payload: {exc} ({score_data!r})")

    avg = round(sum(values.values()) / len(values), 2)
    pedagogy_score = {**values, "average": avg}
    gate = _gate_for_score(pedagogy_score)
    if gate == "reject":
        return None, _drop(dna, "step4_gate_reject", f"pedagogy_score={pedagogy_score}")

    # Best-effort deterministic persona note (no extra LLM call needed).
    persona_simulation = (
        f"A student holding '{dna['misconception_label']}' predictably selects "
        f"choice {primary_idx if primary_idx is not None else '?'}."
    )

    cell = {
        "id": cell_id,
        "generator_version": GENERATOR_VERSION,
        "title": str(narrative.get("title", "")).strip(),
        "world": world_id,
        "primitive": primitive,
        "conceptId": concept_id,
        "ingredient_id": dna["ingredient_id"],
        "misconception_id": dna.get("misconception_id"),
        "misconception_label": dna["misconception_label"],
        "level": dna.get("level") or 2,
        "format": "multiple_choice",
        "examTag": dna.get("examTag"),
        "storyContext": story_context,
        "narrative_need": narrative_need,
        "student_action": student_action,
        "question": spine["question"],
        "choices": choices,
        "correctIndex": ci,
        "correct_reasoning": spine["correct_reasoning"],
        "distractor_taxonomy": distractor_taxonomy,
        "hints": hints,
        "world_feedback": world_feedback_top,
        "transfer_question": spine.get("transfer_question", ""),
        "explanation": spine.get("explanation", ""),
        "presentation": presentation,
        "pedagogy_score": pedagogy_score,
        "gate_status": gate,
        "gate_passed": gate,
        "tone_flags": tone_flags,
        "persona_simulation": persona_simulation,
        "queue_id": None,
    }
    return cell, None


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Bulk-generate full story cells from DNA cells")
    parser.add_argument("--dna-file", default=str(DEFAULT_DNA_FILE), help="DNA cell source file")
    parser.add_argument("--out", default=None, help="Output path (default: batch_generated_{date}.json)")
    parser.add_argument("--concept", default=None, help="Comma-separated conceptId filter")
    parser.add_argument("--limit", type=int, default=None, help="Only process the first N DNA cells")
    parser.add_argument("--dry-run", action="store_true", help="Print prompts, no LLM calls")
    parser.add_argument("--no-llm", action="store_true", help="Math spine only (Step 1) — skip narrative/scoring")
    args = parser.parse_args()

    provider = os.getenv("LLM_PROVIDER", "ollama")
    if provider != "groq" and not args.dry_run:
        print(f"WARNING: LLM_PROVIDER={provider}. Set LLM_PROVIDER=groq for best results.")
        if provider == "ollama":
            print("  Ollama may not follow length/JSON constraints reliably. Consider: LLM_PROVIDER=groq python3 ...")

    dna_path = Path(args.dna_file)
    if not dna_path.is_absolute():
        dna_path = ROOT / dna_path
    dna_cells = load_dna_cells(dna_path)

    if args.concept:
        wanted = {c.strip() for c in args.concept.split(",") if c.strip()}
        dna_cells = [d for d in dna_cells if d["conceptId"] in wanted]
    if args.limit:
        dna_cells = dna_cells[: args.limit]

    if not dna_cells:
        print(f"No DNA cells matched (file={dna_path}, concept filter={args.concept!r}).")
        sys.exit(0)

    concepts, ingredients = load_full_ontology(ONT_PATH)
    concept_names, failure_modes, concept_fms = build_ontology_index(ONT_PATH)
    mis_registry = json.loads(MIS_PATH.read_text()) if MIS_PATH.exists() else {}

    cells: list[dict] = []
    drops: list[dict] = []
    gate_a = gate_b = 0

    for idx, dna in enumerate(dna_cells):
        cell, drop = process_dna_cell(
            idx, dna, ingredients, concept_names, failure_modes, concept_fms, mis_registry,
            dry_run=args.dry_run, no_llm=args.no_llm,
        )
        if args.dry_run:
            continue
        if cell is None:
            if drop is not None:
                drops.append(drop)
            continue
        cells.append(cell)
        if cell.get("gate_status") == "A":
            gate_a += 1
        elif cell.get("gate_status") == "B":
            gate_b += 1

    if args.dry_run:
        print(f"\nDone (dry-run). dna_cells_considered={len(dna_cells)}")
        return

    date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
    out_path = Path(args.out) if args.out else STORY_CELLS_DIR / f"batch_generated_{date_str}.json"
    report_path = STORY_CELLS_DIR / f"generate_report_{date_str}.json"

    payload = {
        "_meta": {
            "pipeline": "generate_story_cells",
            "generator_version": GENERATOR_VERSION,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "dna_file": str(dna_path),
            "total": len(dna_cells),
            "passed_gate_a": gate_a,
            "passed_gate_b": gate_b,
            "discarded": len(drops),
        },
        "cells": cells,
    }
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n")

    report = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "dna_file": str(dna_path),
        "total_dna_cells": len(dna_cells),
        "passed_gate_a": gate_a,
        "passed_gate_b": gate_b,
        "discarded": len(drops),
        "drops": drops,
    }
    report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False) + "\n")

    print(f"\nDone. total={len(dna_cells)} passed_gate_a={gate_a} passed_gate_b={gate_b} discarded={len(drops)}")
    print(f"Wrote {len(cells)} cells -> {out_path}")
    print(f"Wrote drop report -> {report_path}")


if __name__ == "__main__":
    main()
