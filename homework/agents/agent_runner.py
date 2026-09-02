"""
agents/agent_runner.py

Runs one Claude agent per solution path concurrently using asyncio.gather.
Each agent receives the path structure and student profile, then produces a
teaching narrative (sequence of hints / questions / reframes / encouragement).
"""

from __future__ import annotations
import json, asyncio, logging
from pathlib import Path
from pydantic import BaseModel, field_validator

from orchestrator.orchestrator import SolutionPath
from students.student_loader import StudentProfile
from utils.claude_client import call_claude

logger = logging.getLogger(__name__)

AGENT_TEMP       = 0.4   # slightly creative — narrative framing benefits from variance
AGENT_MAX_TOKENS = 2048

_prompt_template: str | None = None


def _load_template() -> str:
    """Load and cache the agent system prompt template from disk."""
    global _prompt_template
    if _prompt_template is None:
        p = Path(__file__).parent.parent / "orchestrator" / "prompts" / "agent.txt"
        _prompt_template = p.read_text()
    return _prompt_template


# ── Pydantic models ────────────────────────────────────────────────────────────

class NarrativeStep(BaseModel):
    step_number:          int
    type:                 str
    content:              str
    concept_addressed:    str
    assumes_knowledge_of: list[str]
    visual_needed:        bool
    visual_description:   str = ""

    @field_validator("type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        """Coerce unknown step types to 'hint' rather than raising."""
        return v if v in {"question", "hint", "reframe", "encouragement"} else "hint"

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("step content must not be empty")
        return v.strip()


class AgentOutput(BaseModel):
    path_id:   str
    framing:   str
    narrative: list[NarrativeStep]

    @field_validator("narrative")
    @classmethod
    def narrative_has_steps(cls, v: list[NarrativeStep]) -> list[NarrativeStep]:
        """Enforce 2-6 steps and guarantee at least one encouragement step."""
        if not (2 <= len(v) <= 6):
            raise ValueError(f"Expected 2-6 steps, got {len(v)}")
        if not any(s.type == "encouragement" for s in v):
            mid = len(v) // 2
            orig = v[mid]
            v[mid] = NarrativeStep(
                step_number          = orig.step_number,
                type                 = "encouragement",
                content              = orig.content,
                concept_addressed    = orig.concept_addressed,
                assumes_knowledge_of = orig.assumes_knowledge_of,
                visual_needed        = orig.visual_needed,
                visual_description   = orig.visual_description,
            )
        return v


# ── Single agent call ──────────────────────────────────────────────────────────

async def _run_single_agent(
    path:         SolutionPath,
    student:      StudentProfile,
    problem_text: str,
) -> AgentOutput | None:
    """
    Run one agent for one solution path and return its narrative output.

    Args:
        path:         The solution path this agent should narrate.
        student:      The student's knowledge profile.
        problem_text: The original homework problem.

    Returns:
        AgentOutput on success, None if the agent fails (caller drops it).
    """
    system_prompt = (
        _load_template()
        .replace("{path_id}",           path.path_id)
        .replace("{student_strengths}", ", ".join(student.strengths) or "none identified")
        .replace("{student_gaps}",      ", ".join(student.gaps)      or "none identified")
        .replace("{preferred_style}",   student.preferred_style)
        .replace("{problem_text}",      problem_text)
        .replace("{path_json}",         json.dumps(path.model_dump(), indent=2))
    )

    try:
        logger.info("Agent %s → Claude", path.path_id)
        raw = await call_claude(
            system_prompt = system_prompt,
            user_message  = f"Generate the teaching narrative for path {path.path_id}.",
            temperature   = AGENT_TEMP,
            max_tokens    = AGENT_MAX_TOKENS,
        )

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        output = AgentOutput.model_validate(json.loads(raw))
        logger.info("Agent %s ← %d steps", path.path_id, len(output.narrative))
        return output

    except Exception as exc:
        logger.error("Agent %s failed: %s", path.path_id, exc)
        return None


# ── Parallel runner ────────────────────────────────────────────────────────────

async def run_agents(
    paths:        list[SolutionPath],
    student:      StudentProfile,
    problem_text: str,
) -> list[AgentOutput]:
    """
    Run all solution-path agents in parallel and return successful outputs.

    Args:
        paths:        All solution paths from the orchestrator.
        student:      The student's knowledge profile.
        problem_text: The original homework problem.

    Returns:
        List of AgentOutput objects for paths that succeeded.

    Raises:
        RuntimeError: If every agent fails.
    """
    results = await asyncio.gather(
        *[_run_single_agent(path, student, problem_text) for path in paths],
        return_exceptions=False,
    )
    if valid := [r for r in results if r is not None]:
        return valid
    raise RuntimeError("All agents failed — cannot continue")
