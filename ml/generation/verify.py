"""Blind answer-key verification for generated questions.

The verifier sees only the question text and answer choices. It does not receive
the generated `correctIndex` or explanation, so disagreement is useful evidence
that an item should be dropped before handing JSON to the frontend bank.
"""
from __future__ import annotations

import json
import re
from typing import TypedDict

from .llm_client import complete

VERIFY_SYSTEM = (
    "You solve ACT math multiple-choice questions. Output STRICT JSON only, no prose. "
    "Choose exactly one answer index from 0 to 3."
)


class VerificationDrop(TypedDict):
    id: str
    expectedIndex: int
    solverIndex: int | None
    reason: str


def build_verify_prompt(item: dict) -> str:
    choices = "\n".join(f"{i}. {choice}" for i, choice in enumerate(item["choices"]))
    return (
        "Solve this ACT math question blind. Do not explain unless needed for your own work.\n\n"
        f"Question:\n{item['question']}\n\n"
        f"Choices:\n{choices}\n\n"
        'Return JSON exactly like {"answerIndex":0,"confidence":0.0}. '
        "answerIndex must be the index of the correct choice."
    )


def _extract_json(text: str) -> dict | None:
    if not text:
        return None
    t = text.strip()
    if t.startswith("```"):
        t = re.sub(r"^```(?:json)?|```$", "", t, flags=re.MULTILINE).strip()
    start = t.find("{")
    end = t.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        parsed = json.loads(t[start:end + 1])
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def solve_blind(item: dict, attempts: int = 2) -> int | None:
    prompt = build_verify_prompt(item)
    for _ in range(attempts):
        parsed = _extract_json(complete(prompt, system=VERIFY_SYSTEM, max_tokens=64, temperature=0.0))
        answer = parsed.get("answerIndex") if parsed else None
        if isinstance(answer, int) and 0 <= answer <= 3:
            return answer
    return None


def verify_item(item: dict, attempts: int = 2) -> tuple[bool, VerificationDrop | None]:
    solver_index = solve_blind(item, attempts=attempts)
    expected = item["correctIndex"]
    if solver_index == expected:
        return True, None
    return False, {
        "id": item.get("id", ""),
        "expectedIndex": expected,
        "solverIndex": solver_index,
        "reason": "solver_disagreed" if solver_index is not None else "solver_failed",
    }


def verify_items(items: list[dict], attempts: int = 2) -> tuple[list[dict], list[VerificationDrop]]:
    kept: list[dict] = []
    dropped: list[VerificationDrop] = []
    for item in items:
        ok, drop = verify_item(item, attempts=attempts)
        if ok:
            kept.append(item)
        elif drop:
            dropped.append(drop)
    return kept, dropped
