"""
orchestrator/orchestrator.py

Calls Claude Sonnet 4 to decompose a homework problem into 2-4 distinct
solution paths. Each path has a concept chain and a framing (geometric /
algebraic / intuitive).

Temperature 0.2 — low variance for reliable concept extraction.
"""

from __future__ import annotations
import json, logging
from pathlib import Path
from pydantic import BaseModel, field_validator

from utils.claude_client import call_claude

logger = logging.getLogger(__name__)

ORCHESTRATOR_TEMP      = 0.2   # low variance — concept extraction must be reliable
ORCHESTRATOR_MAX_TOKENS = 2048

_prompt_text: str | None = None

def _load_prompt() -> str:
    global _prompt_text
    if _prompt_text is None:
        p = Path(__file__).parent / "prompts" / "orchestrator.txt"
        _prompt_text = p.read_text()
    return _prompt_text


# ── Pydantic models ────────────────────────────────────────────────────────────

class SolutionPath(BaseModel):
    path_id: str
    entry_concept: str
    concept_chain: list[str]
    framing: str
    description: str

    @field_validator("concept_chain")
    @classmethod
    def chain_not_empty(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("concept_chain must have at least one concept")
        return v

    @field_validator("framing")
    @classmethod
    def valid_framing(cls, v: str) -> str:
        if v not in ("geometric", "algebraic", "intuitive", "numerical", "visual"):
            return "algebraic"
        return v


class OrchestratorOutput(BaseModel):
    problem_summary: str
    target_concept: str
    paths: list[SolutionPath]

    @field_validator("paths")
    @classmethod
    def paths_count(cls, v: list[SolutionPath]) -> list[SolutionPath]:
        if not (2 <= len(v) <= 4):
            raise ValueError(f"Expected 2-4 paths, got {len(v)}")
        return v


# ── Main orchestrator call ─────────────────────────────────────────────────────

async def orchestrate(
    problem_text:      str,
    subject:           str,
    student_strengths: list[str],
    student_gaps:      list[str],
) -> OrchestratorOutput:
    """
    Decompose a homework problem into 2-4 distinct solution paths.

    Args:
        problem_text:      The raw problem the student submitted.
        subject:           Subject area (e.g. "algebra").
        student_strengths: Concept IDs the student is confident in.
        student_gaps:      Concept IDs the student struggles with.

    Returns:
        OrchestratorOutput with a problem_summary, target_concept, and
        a list of SolutionPath objects.

    Raises:
        json.JSONDecodeError: If Claude returns malformed JSON.
        pydantic.ValidationError: If the JSON doesn't match the schema.
    """
    user_message = (
        f"Subject: {subject}\n"
        f"Student strengths: {', '.join(student_strengths) or 'unknown'}\n"
        f"Student gaps: {', '.join(student_gaps) or 'none identified'}\n\n"
        f"Problem:\n{problem_text}"
    )

    logger.info("Orchestrator → Claude: %s", problem_text[:80])

    raw = await call_claude(
        system_prompt = _load_prompt(),
        user_message  = user_message,
        temperature   = ORCHESTRATOR_TEMP,
        max_tokens    = ORCHESTRATOR_MAX_TOKENS,
    )

    logger.info("Orchestrator ← Claude: %d chars", len(raw))

    # Strip markdown fences if model wraps output
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    data = json.loads(raw)
    return OrchestratorOutput.model_validate(data)
