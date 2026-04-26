# mindcraft/models/student_state.py
from pydantic import BaseModel, Field
from datetime import datetime

class ConceptMastery(BaseModel):
    concept_id: str
    mastery: float = Field(ge=0, le=1)
    exposure_count: int = 0
    last_interaction: datetime | None = None
    cumulative_outcome: float = 0.0  # sum of outcomes, for averaging
    attempts: int = 0

class StudentState(BaseModel):
    student_id: str
    mastery_by_concept: dict[str, ConceptMastery]
    created_at: datetime
    updated_at: datetime