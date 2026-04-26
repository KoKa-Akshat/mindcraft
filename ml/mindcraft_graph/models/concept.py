# mindcraft/models/concept.py
from pydantic import BaseModel, Field
from typing import Literal

class Concept(BaseModel):
    id: str
    name: str
    level: Literal["foundational", "core", "advanced"]
    typical_order: int
    description: str
    tags: list[str]


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