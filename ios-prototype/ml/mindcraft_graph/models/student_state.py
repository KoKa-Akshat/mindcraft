# mindcraft/models/student_state.py
from pydantic import BaseModel, Field
from datetime import datetime

class ConceptMastery(BaseModel):
    concept_id: str
    mastery: float = Field(ge=0, le=1)
    exposure_count: int = 0           # raw count (audit/display)
    last_interaction: datetime | None = None
    # Recency-weighted accumulators (time-decayed), as of last_interaction:
    #   cumulative_outcome = Σ wᵢ·outcomeᵢ      weighted_count = Σ wᵢ
    # avg_outcome = cumulative_outcome / weighted_count is the recency-weighted
    # mean (recent sessions dominate); weighted_count is the effective sample size.
    cumulative_outcome: float = 0.0
    weighted_count: float = 0.0
    attempts: int = 0                 # raw count (audit/display)

class StudentState(BaseModel):
    student_id: str
    mastery_by_concept: dict[str, ConceptMastery]
    created_at: datetime
    updated_at: datetime