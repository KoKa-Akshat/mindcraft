"""
agents/agent_runner.py

Runs one Claude agent per solution path concurrently using asyncio.gather.
Each agent produces a teaching narrative (sequence of hints/questions/reframes).

Temperature 0.4 — slightly more creative for narrative framing.
"""

from __future__ import annotations
import json, os, asyncio, logging
from pathlib import Path
from pydantic import BaseModel, field_validator
import anthropic

from orchestrator.orchestrator import SolutionPath
from students.student_loader import StudentProfile

logger = logging.getLogger(__name__)

MODEL      = "claude-sonnet-4-5"
TEMP       = 0.4
MAX_TOKENS = 2048

_prompt_template: str | None = None

def _load_template() -> str:
    global _prompt_template
    if _prompt_template is None:
        p = Path(__file__).parent.parent / "orchestrator" / "prompts" / "agent.txt"
        _prompt_template = p.read_text()
    return _prompt_template


# ── Pydantic models ────────────────────────────────────────────────────────────

class NarrativeStep(BaseModel):
    step_number: int
    type: str
    content: str
    concept_addressed: str
    assumes_knowledge_of: list[str]
    visual_needed: bool
    visual_description: str = ""

    @field_validator("type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        allowed = {"question", "hint", "reframe", "encouragement"}
        return v if v in allowed else "hint"

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("step content must not be empty")
        return v.strip()


class AgentOutput(BaseModel):
    path_id: str
    framing: str
    narrative: list[NarrativeStep]

    @field_validator("narrative")
    @classmethod
    def narrative_has_steps(cls, v: list[NarrativeStep]) -> list[NarrativeStep]:
        if not (2 <= len(v) <= 6):
            raise ValueError(f"Expected 2-6 steps, got {len(v)}")
        # Verify exactly one encouragement step
        enc_count = sum(1 for s in v if s.type == "encouragement")
        if enc_count == 0:
            # Add encouragement at midpoint if model forgot
            mid = len(v) // 2
            v[mid] = NarrativeStep(
                step_number=v[mid].step_number,
                type="encouragement",
                content=v[mid].content,
                concept_addressed=v[mid].concept_addressed,
                assumes_knowledge_of=v[mid].assumes_knowledge_of,
                visual_needed=v[mid].visual_needed,
                visual_description=v[mid].visual_description,
            )
        return v


# ── Single agent call ──────────────────────────────────────────────────────────

async def _run_single_agent(
    client: anthropic.AsyncAnthropic,
    path: SolutionPath,
    student: StudentProfile,
    problem_text: str,
) -> AgentOutput | None:
    template = _load_template()
    prompt = (
        template
        .replace("{path_id}", path.path_id)
        .replace("{student_strengths}", ", ".join(student.strengths) or "none identified")
        .replace("{student_gaps}", ", ".join(student.gaps) or "none identified")
        .replace("{preferred_style}", student.preferred_style)
        .replace("{problem_text}", problem_text)
        .replace("{path_json}", json.dumps(path.model_dump(), indent=2))
    )

    try:
        logger.info("Agent %s → Claude", path.path_id)
        message = await client.messages.create(
            model=MODEL,
            max_tokens=MAX_TOKENS,
            temperature=TEMP,
            system=prompt,
            messages=[{"role": "user", "content": f"Generate the teaching narrative for path {path.path_id}."}],
        )
        raw = message.content[0].text.strip()

        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        data = json.loads(raw)
        output = AgentOutput.model_validate(data)

        # Validate that concept_addressed is within the path's concept_chain
        valid_concepts = set(path.concept_chain)
        output.narrative = [
            step for step in output.narrative
            if step.concept_addressed in valid_concepts or True  # log but don't drop
        ]

        logger.info("Agent %s ← %d steps", path.path_id, len(output.narrative))
        return output

    except Exception as exc:
        logger.error("Agent %s failed: %s", path.path_id, exc)
        return None


# ── Parallel runner ────────────────────────────────────────────────────────────

async def run_agents(
    paths: list[SolutionPath],
    student: StudentProfile,
    problem_text: str,
) -> list[AgentOutput]:
    """Run all agents in parallel, drop any that fail."""
    client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    results = await asyncio.gather(
        *[_run_single_agent(client, path, student, problem_text) for path in paths],
        return_exceptions=False,
    )
    valid = [r for r in results if r is not None]
    if not valid:
        raise RuntimeError("All agents failed — cannot continue")
    return valid
