"""
Data models for the ingredient layer.

These sit one level below the concept ontology.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from mindcraft_graph.config import INGREDIENT_PRIOR_PSEUDO_COUNTS


class Ingredient(BaseModel):
    """
    An atomic mental model inside a concept.
    """

    id: str
    concept_id: str
    name: str
    description: str
    tags: list[str] = Field(default_factory=list)
    depends_on: list[str] = Field(default_factory=list)
    failure_prior: float = 0.5


class Bridge(BaseModel):
    """
    A directed enabling relationship between ingredients
    from different concepts.
    """

    id: str
    from_ingredient: str
    to_ingredient: str
    source_concept: str
    target_concept: str
    relation: Literal["enables", "extends", "generalizes"] = "enables"
    description: str = ""
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


class CardRepresentation(BaseModel):
    """One style-specific version of a card."""

    title: str
    body: str
    visual_hint: str = ""


class CardTemplate(BaseModel):
    """
    A reusable instructional scaffold attached to an ingredient or bridge.
    """

    id: str
    target_type: Literal["ingredient", "bridge", "composition"]
    target_id: str
    representations: dict[str, CardRepresentation] = Field(default_factory=dict)
    prompt: str = ""
    difficulty: float = Field(default=0.5, ge=0.0, le=1.0)


class Combination(BaseModel):
    """A hyperedge of ingredients that fire together to solve a class of problems."""

    id: str
    ingredients: list[str] = Field(default_factory=list)
    apply_order: list[str] = Field(default_factory=list)
    # Parsed and preserved, not read at runtime. spans_concepts is maintained by
    # scripts/canonicalize_concept_ids.py + reconcile_ontology.py;
    # captured_by_dependency_or_bridge flags combos redundant with existing edges
    # (a candidate firing filter — see ENGINE_MECHANISM.md issue #3).
    spans_concepts: list[str] = Field(default_factory=list)
    example_problem: str = ""
    captured_by_dependency_or_bridge: bool = False
    note: str = ""
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class ProblemFeatures(BaseModel):
    """Structured tags extracted from a problem statement."""

    primary_concept: str
    secondary_concepts: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    known_quantities: dict[str, str | float] = Field(default_factory=dict)
    target_quantity: str = ""
    required_ingredient_ids: list[str] = Field(default_factory=list)
    archetype_ids: list[str] = Field(default_factory=list)
    concept_scores: dict[str, float] = Field(default_factory=dict)
    ingredient_scores: dict[str, float] = Field(default_factory=dict)
    classification_mode: str = "concept"


class IngredientMastery(BaseModel):
    """Per-student mastery at the ingredient level."""

    ingredient_id: str
    mastery: float = Field(default=0.0, ge=0.0, le=1.0)
    attempts: int = 0
    last_outcome: float = 0.0
    cumulative_outcome: float = 0.0
    alpha: float | None = None
    beta: float | None = None


class BridgeConfidence(BaseModel):
    """Per-student confidence in a specific bridge transition."""

    bridge_id: str
    from_ingredient: str
    to_ingredient: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    attempts: int = 0
    successes: int = 0
    alpha: float | None = None
    beta: float | None = None


def ensure_posterior(
    state: IngredientMastery | BridgeConfidence,
    prior_mean: float,
) -> tuple[float, float]:
    """Return α/β for a record that may predate the Beta migration."""
    if state.alpha is not None and state.beta is not None:
        return state.alpha, state.beta

    if state.attempts > 0:
        total = state.attempts + INGREDIENT_PRIOR_PSEUDO_COUNTS
        scalar = state.mastery if isinstance(state, IngredientMastery) else state.confidence
        return scalar * total, (1.0 - scalar) * total

    return (
        prior_mean * INGREDIENT_PRIOR_PSEUDO_COUNTS,
        (1.0 - prior_mean) * INGREDIENT_PRIOR_PSEUDO_COUNTS,
    )


class IngredientStudentState(BaseModel):
    """
    Full ingredient-level state for one student.

    Sits alongside the concept-level StudentState.
    """

    student_id: str
    ingredient_mastery: dict[str, IngredientMastery] = Field(default_factory=dict)
    bridge_confidence: dict[str, BridgeConfidence] = Field(default_factory=dict)
    style_scores: dict[str, float] = Field(default_factory=dict)
    # Hit counts per misconception_id, incremented each time the student
    # chooses a distractor tagged with that misconception. Used by /recommend
    # to compute misconception severity gaps (B3).
    misconception_counts: dict[str, int] = Field(default_factory=dict)


class IngredientOntology(BaseModel):
    """
    Complete ingredient-level graph data.

    Loaded from JSON at startup, same as the concept ontology.
    """

    version: str
    ingredients: list[Ingredient] = Field(default_factory=list)
    bridges: list[Bridge] = Field(default_factory=list)
    card_templates: list[CardTemplate] = Field(default_factory=list)
    combinations: list[Combination] = Field(default_factory=list)
