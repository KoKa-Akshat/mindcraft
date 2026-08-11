from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal


LearningStatus = Literal[
    "unexplored",
    "open_gap",
    "repairing",
    "stable",
    "comeback_built",
    "ready_for_challenge",
]


class LearningIngredient(BaseModel):
    id: str
    label: str
    description: str
    failure_mode: str = ""
    practice_prompt: str = ""
    visual_metaphor: str = ""


class LearningConcept(BaseModel):
    id: str
    name: str
    unit_id: str
    level: Literal["foundational", "core", "advanced"] = "core"
    description: str = ""
    story: str = ""
    grit_prompt: str = ""
    visual_metaphor: str = ""
    ingredients: list[LearningIngredient] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class LearningUnit(BaseModel):
    id: str
    name: str
    metaphor: str = ""
    description: str = ""


class LearningEdge(BaseModel):
    from_id: str = Field(alias="from")
    to_id: str = Field(alias="to")
    relation: Literal["prerequisite", "bridge", "unlocks", "related"] = "prerequisite"
    strength: float = Field(default=0.7, ge=0, le=1)


class SubjectGraph(BaseModel):
    id: str
    subject: str
    course: str
    metaphor: str
    audience: str = ""
    units: list[LearningUnit]
    concepts: list[LearningConcept]
    edges: list[LearningEdge]


class LearningEvent(BaseModel):
    student_id: str
    subject_id: str
    concept_id: str
    event_type: str
    ingredient_id: str | None = None
    outcome: float | None = None
    duration_ms: int | None = None
    clue_used: bool = False
    hint_level: int | None = None
    source: str = "learning_world"
    metadata: dict = Field(default_factory=dict)


class StudentConceptState(BaseModel):
    concept_id: str
    status: LearningStatus
    mastery: float = Field(ge=0, le=1)
    recovery: float = Field(ge=0, le=1)
    stability: float = Field(ge=0, le=1)
    attempts: int = 0
    successful_retries: int = 0
    last_touched: str | None = None


class AgentSkill(BaseModel):
    id: str
    subject_id: str
    concept_id: str | None = None
    name: str
    goal: str
    policy_type: Literal[
        "diagnosis",
        "lesson_generation",
        "practice_generation",
        "hinting",
        "reflection",
        "visual_generation",
    ]
    inputs_schema: dict = Field(default_factory=dict)
    code: str
    language: Literal["python", "typescript", "prompt"] = "prompt"
    success_criteria: list[str] = Field(default_factory=list)
    failure_modes: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    version: int = 1


class MemoryRecord(BaseModel):
    student_id: str | None = None
    subject_id: str
    concept_id: str | None = None
    memory_type: Literal[
        "observation",
        "reflection",
        "constraint",
        "schema_update",
        "teaching_preference",
        "failure_pattern",
    ]
    text: str
    importance: float = Field(default=0.5, ge=0, le=1)
    source_event_ids: list[str] = Field(default_factory=list)
    metadata: dict = Field(default_factory=dict)


class ExecutionTrace(BaseModel):
    student_id: str | None = None
    subject_id: str
    concept_id: str | None = None
    skill_id: str | None = None
    goal: str
    plan: list[str] = Field(default_factory=list)
    input_snapshot: dict = Field(default_factory=dict)
    output_snapshot: dict = Field(default_factory=dict)
    success: bool
    error: str | None = None
    metrics: dict = Field(default_factory=dict)


class ReflexionRecord(BaseModel):
    trace_id: str | None = None
    subject_id: str
    concept_id: str | None = None
    failure_summary: str
    cause: str
    next_constraint: str
    suggested_skill_patch: str = ""
    confidence: float = Field(default=0.5, ge=0, le=1)
