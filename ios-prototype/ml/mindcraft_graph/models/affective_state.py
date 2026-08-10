# mindcraft_graph/models/affective_state.py

from pydantic import BaseModel, Field


class AffectiveState(BaseModel):
    """Student's emotional/cognitive state captured at the start of a session.

    Written by the Vercel /api/agent-check-in function (Claude Haiku extract).
    Read by serve.py /recommend to soften target_mastery under high stress and
    force explicit struggles into the trimmed chain via the pathfinder override.
    """
    stress: float = Field(0.0, ge=0.0, le=1.0)
    motivation: float = Field(0.5, ge=0.0, le=1.0)
    confidence_by_concept: dict[str, float] = Field(default_factory=dict)
    explicit_struggles: list[str] = Field(default_factory=list)
    captured_at: int = 0  # ms epoch; freshness gate in /recommend
