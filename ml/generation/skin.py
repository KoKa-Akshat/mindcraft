"""Prose-only skinning. Mathematical text is inserted after prose generation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Protocol

import sympy as sp

from .llm_client import complete
from .models import MisconceptionRule, Problem
from .oracle import format_value, render_equation

EQUATION_TOKEN = "{{FROZEN_EQUATION}}"


@dataclass(frozen=True)
class Skin:
    question: str
    story_context: str
    story_intro: str
    explanation: str
    hints: tuple[str, ...]
    student_thinking: dict[str, str]


class Skinner(Protocol):
    def skin(
        self, problem: Problem, key: sp.Expr, rules: tuple[MisconceptionRule, ...]
    ) -> Skin: ...


def _insert_equation(text: str, problem: Problem) -> str:
    if text.count(EQUATION_TOKEN) != 1:
        raise ValueError("skin must preserve the frozen equation token exactly once")
    return text.replace(EQUATION_TOKEN, f"\\({render_equation(problem)}\\)")


class DeterministicSkinner:
    """Auditable default skin for offline generation and replay."""

    def skin(self, problem: Problem, key: sp.Expr, rules: tuple[MisconceptionRule, ...]) -> Skin:
        question = _insert_equation(f"Solve {EQUATION_TOKEN} for x.", problem)
        return Skin(
            question=question,
            story_context="A workshop display shows an equation that must stay balanced.",
            story_intro="You are checking the display before the next group arrives.",
            explanation=(
                "Keep both sides balanced and isolate x. The solution is "
                f"x = {format_value(key)}. Substitution makes both sides equal."
            ),
            hints=(
                "Collect the variable terms and constant terms on opposite sides.",
                "Use inverse operations on both sides.",
                "Substitute your result into the original equation to check it.",
            ),
            student_thinking={rule.rule_id: rule.student_thinking for rule in rules},
        )


LLM_SYSTEM = (
    "Write warm, direct educational prose as strict JSON. Never use an em dash. "
    "Preserve {{FROZEN_EQUATION}} exactly once in question. Do not add any digits, "
    "number words, equations, choice values, or answer indices."
)


class LLMSkinner:
    """Optional prose bookend. It never receives a coefficient, choice, or key."""

    def skin(self, problem: Problem, key: sp.Expr, rules: tuple[MisconceptionRule, ...]) -> Skin:
        rule_payload = [
            {"rule_id": rule.rule_id, "student_thinking": rule.student_thinking} for rule in rules
        ]
        prompt = (
            "Wrap this frozen equation token in concise prose: {{FROZEN_EQUATION}}. "
            "Return keys question, storyContext, storyIntro, explanation, hints, "
            "studentThinking. studentThinking must map the supplied rule ids to polished "
            f"first-person prose. Rules: {json.dumps(rule_payload)}"
        )
        payload = json.loads(complete(prompt, system=LLM_SYSTEM, temperature=0.2))
        strings = [
            payload.get("question", ""),
            payload.get("storyContext", ""),
            payload.get("storyIntro", ""),
            payload.get("explanation", ""),
            *payload.get("hints", []),
            *payload.get("studentThinking", {}).values(),
        ]
        if any(not isinstance(value, str) or "—" in value for value in strings):
            raise ValueError("skin contains an invalid string or em dash")
        question = _insert_equation(payload["question"], problem)
        return Skin(
            question=question,
            story_context=payload["storyContext"],
            story_intro=payload["storyIntro"],
            explanation=payload["explanation"],
            hints=tuple(payload["hints"][:3]),
            student_thinking=dict(payload["studentThinking"]),
        )
