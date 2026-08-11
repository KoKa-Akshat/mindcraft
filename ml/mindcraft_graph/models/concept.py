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
    aliases: list[str] = Field(default_factory=list)
    # Exam-prep signal from act_relevance (Layer 1). frequency in [0,1] = how
    # often the concept shows up on the exam; drives exam-mode prioritization.
    exam_frequency: float = 0.0
    exam_tested: bool = False
    population_failure_rate: float = 0.5


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

    def middle_school_concept_ids(self) -> list[str]:
        """Foundational + core concepts — appropriate for grades 6-10."""
        return [c.id for c in self.concepts if c.level in ("foundational", "core")]

    def concept_id_registry(self) -> dict[str, str]:
        """Return canonical and alias IDs mapped to their canonical concept ID."""
        return build_concept_id_registry(self.concepts)

    def canonical_concept_id(self, raw: str) -> str:
        return canonical_concept_id(raw, self)


def build_concept_id_registry(concepts: list[Concept]) -> dict[str, str]:
    """Build the L1 concept-ID registry, rejecting ambiguous aliases."""
    canonical_ids = {concept.id for concept in concepts}
    if len(canonical_ids) != len(concepts):
        raise ValueError("Duplicate canonical concept id in Layer 1")
    registry = {concept_id: concept_id for concept_id in canonical_ids}
    for concept in concepts:
        for alias in concept.aliases:
            if alias in canonical_ids:
                raise ValueError(
                    f"Concept alias {alias!r} for {concept.id!r} collides with a canonical id"
                )
            existing = registry.get(alias)
            if existing is not None and existing != concept.id:
                raise ValueError(
                    f"Concept alias {alias!r} resolves to both {existing!r} and {concept.id!r}"
                )
            registry[alias] = concept.id
    return registry


def canonical_concept_id(raw: str, ontology: Ontology) -> str:
    """Resolve an L1 canonical ID or alias; fail fast for unknown IDs."""
    resolved = ontology.concept_id_registry().get(raw)
    if resolved is None:
        raise ValueError(f"Unresolved concept id {raw!r}")
    return resolved
