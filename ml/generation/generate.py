"""Prompt construction + generation + validation to the Question schema (C5).

Builds an essence-grounded prompt for a (concept, level, format), asks the LLM
for JSON, and validates each item to the exact shape the frontend bank expects.
"""
from __future__ import annotations

import json
import re

from .essence import ConceptEssence
from .llm_client import complete

LEVEL_GUIDE = {
    1: "Foundation: direct, single-step application of the core skill.",
    2: "Applied: a multi-step problem requiring the skill in context.",
    3: "Exam-ready: ACT-difficulty — concise, timed-feel, with a common trap.",
}

# Each canonical FormatId → how the generated question should be presented.
FORMAT_GUIDE = {
    "word_problem": "Frame as a real-world word problem (people, money, rates, etc.).",
    "diagram": "Reference a described geometric figure; describe it fully in text.",
    "number_line": "Frame around a described number line (positions, distances).",
    "symbolic_expression": "Pure symbolic manipulation — no real-world context.",
    "coordinate_graph": "Reference points/lines on the coordinate plane, described in text.",
    "table": "Include a small data table written inline in the prompt text.",
}

SYSTEM = (
    "You write ACT math multiple-choice questions. Output STRICT JSON only, no prose. "
    "Each question has EXACTLY 4 answer choices, exactly one correct."
)


def _essence_block(ess: ConceptEssence | None) -> str:
    if not ess or not ess.examples:
        return "(no seed examples — rely on the concept name and standard ACT style)"
    lines = ["Real ACT examples for this concept (match their style, do NOT copy):"]
    for e in ess.examples[:4]:
        lines.append(f"- {e['text']}")
    if ess.misconceptions:
        lines.append("Common student misconceptions to target as distractors:")
        for m in ess.misconceptions[:3]:
            lines.append(f"- {m}")
    return "\n".join(lines)


def build_prompt(concept_id: str, ess: ConceptEssence | None, level: int, fmt: str, n: int) -> str:
    return (
        f"Concept: {concept_id}\n"
        f"Difficulty — {LEVEL_GUIDE.get(level, LEVEL_GUIDE[1])}\n"
        f"Format — {FORMAT_GUIDE.get(fmt, 'standard')}\n\n"
        f"{_essence_block(ess)}\n\n"
        f"Generate {n} NEW questions. Return JSON: "
        '{"questions":[{"question":str,"choices":[str,str,str,str],'
        '"correctIndex":0-3,"explanation":str,"hints":[str,str,str]}]}'
    )


def _valid(item: dict) -> bool:
    return (
        isinstance(item.get("question"), str) and item["question"].strip()
        and isinstance(item.get("choices"), list) and len(item["choices"]) == 4
        and all(isinstance(c, str) and c.strip() for c in item["choices"])
        and isinstance(item.get("correctIndex"), int) and 0 <= item["correctIndex"] <= 3
        and isinstance(item.get("explanation"), str) and item["explanation"].strip()
    )


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")[:24]


def _extract_json(text: str) -> dict | list | None:
    """Tolerant JSON parse: strip code fences, grab the outermost object/array.
    Models occasionally wrap JSON in prose or fences, or emit a stray glitch."""
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.MULTILINE).strip()
    start = min((i for i in (t.find("{"), t.find("[")) if i != -1), default=-1)
    end = max(t.rfind("}"), t.rfind("]"))
    if start == -1 or end <= start:
        return None
    try:
        return json.loads(t[start:end + 1])
    except json.JSONDecodeError:
        return None


def generate_for(
    concept_id: str, ess: ConceptEssence | None, level: int, fmt: str, n: int = 4,
    attempts: int = 2,
) -> list[dict]:
    """Return validated Question dicts (C5 shape) for one (concept, level, format).
    Retries a couple times — LLM JSON output is occasionally malformed."""
    prompt = build_prompt(concept_id, ess, level, fmt, n)
    parsed: dict | list | None = None
    for _ in range(attempts):
        parsed = _extract_json(complete(prompt, system=SYSTEM))
        if parsed:
            break
    if not parsed:
        return []
    items = parsed.get("questions", []) if isinstance(parsed, dict) else parsed
    out: list[dict] = []
    for i, item in enumerate(items):
        if not _valid(item):
            continue
        out.append({
            "id": f"gen-{concept_id}-{level}-{_slug(fmt)}-{i+1}",
            "conceptId": concept_id,
            "level": level,
            "question": item["question"].strip(),
            "choices": [c.strip() for c in item["choices"]],
            "correctIndex": item["correctIndex"],
            "explanation": item["explanation"].strip(),
            "hints": [h for h in item.get("hints", []) if isinstance(h, str)][:3],
            "examTag": "ACT",
            "format": fmt,
        })
    return out
