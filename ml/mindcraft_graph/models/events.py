# mindcraft/models/events.py
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Literal

class SessionEvent(BaseModel):
    student_id: str
    concept_id: str
    event_type: Literal["session", "flashcard", "worksheet", "problem_set"]
    outcome: float = Field(ge=-1, le=1)  # performance valence
    effort: float = Field(ge=0, le=1)    # normalized effort/attempts
    duration_minutes: float
    timestamp: datetime
    exposure_weight: float = 1.0  # primary=1.0, secondary=0.4, tertiary=0.15