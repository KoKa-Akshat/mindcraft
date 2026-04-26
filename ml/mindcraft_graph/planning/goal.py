"""
Goal specification for recommendations.
"""
from pydantic import BaseModel, Field
from typing import Literal


class Goal(BaseModel):
    """Parameterized goal for the recommendation engine."""
    target_concepts: list[str] = Field(default_factory=list)
    target_mastery: float = Field(default=0.8, ge=0.0, le=1.0)
    deadline_days: int | None = None
    mode: Literal["exam", "curriculum", "explore"] = "curriculum"
    exploration_temp: float = Field(default=0.2, ge=0.0, le=1.0)