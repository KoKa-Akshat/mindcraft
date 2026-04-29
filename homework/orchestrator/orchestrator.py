"""
orchestrator/orchestrator.py

Calls Claude Sonnet 4 to decompose a homework problem into 2-4 distinct
solution paths. Each path has a concept chain and a framing (geometric /
algebraic / intuitive).

Temperature 0.2 — low variance for reliable concept extraction.
"""

from __future__ import annotations
import json, os, logging
from pathlib import Path
from pydantic import BaseModel, field_validator
import anthropic

logger = logging.getLogger(__name__)

MODEL     = "claude-sonnet-4-5"
TEMP      = 0.2
MAX_TOKENS = 2048

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
    problem_text: str,
    subject: str,
    student_strengths: list[str],
    student_gaps: list[str],
) -> OrchestratorOutput:
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    system_prompt = _load_prompt()

    user_message = (
        f"Subject: {subject}\n"
        f"Student strengths: {', '.join(student_strengths) or 'unknown'}\n"
        f"Student gaps: {', '.join(student_gaps) or 'none identified'}\n\n"
        f"Problem:\n{problem_text}"
    )

    logger.info("Orchestrator → Claude: %s", problem_text[:80])

    message = await client.messages.create(
        model=MODEL,
        max_tokens=MAX_TOKENS,
        temperature=TEMP,
        system=system_prompt,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = message.content[0].text.strip()
    logger.info("Orchestrator ← Claude: %d chars", len(raw))

    # Strip markdown fences if model wraps output
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    data = json.loads(raw)
    return OrchestratorOutput.model_validate(data)
