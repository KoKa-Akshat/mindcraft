# mindcraft/models/events.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class SessionEvent(BaseModel):
    student_id: str
    concept_id: str
    event_type: Literal["session", "flashcard", "worksheet", "problem_set", "assessment"]
    outcome: float = Field(ge=-1, le=1)  # performance valence
    effort: float = Field(ge=0, le=1)    # normalized effort/attempts
    duration_minutes: float
    timestamp: datetime
    # Also carries repeat-aware question evidence: fresh=1.0, first repeat=0.4,
    # later repeats=0.15.  Ingredient misconception counters are independent.
    exposure_weight: float = Field(default=1.0, ge=0, le=1)
    misconceptions: dict[str, int] = Field(default_factory=dict)
