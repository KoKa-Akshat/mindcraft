# mindcraft/models/concept.py
from pydantic import BaseModel, Field
from typing import Literal

class Concept(BaseModel):
    id: str
    name: str
    level: Literal["foundational", "core", "advanced", "cross_cutting"]
    typical_order: int = 0
    description: str = ""
    tags: list[str] = Field(default_factory=list)
    # Exam-prep signal from act_relevance (Layer 1). frequency in [0,1] = how
    # often the concept shows up on the exam; drives exam-mode prioritization.
    exam_frequency: float = 0.0
    exam_tested: bool = False


def estimate_difficulty(concept: Concept, max_order: int) -> float:
    """Proxy difficulty from curriculum position. Range [0.1, 1.0]."""
    return 0.1 + 0.9 * (concept.typical_order / max_order)


class OntologyEdge(BaseModel):
    from_concept: str = Field(alias="from")
    to_concept: str = Field(alias="to")
    relation: Literal["prerequisite", "related", "application","discovered"]
    strength: float = Field(ge=0, le=1)

class Ontology(BaseModel):
    version: str
    domain: str
    concepts: list[Concept]
    edges: list[OntologyEdge]
    # Ordered exam-priority concepts from act_prep_overlay — the default targets
    # for exam mode when none are explicitly requested.
    high_priority_concepts: list[str] = Field(default_factory=list)

    def act_tested_concept_ids(self) -> list[str]:
        return [c.id for c in self.concepts if c.exam_tested]