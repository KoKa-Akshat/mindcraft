"""
Data models for the ingredient layer.

These sit one level below the concept ontology.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


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


class ProblemFeatures(BaseModel):
    """Structured tags extracted from a problem statement."""

    primary_concept: str
    secondary_concepts: list[str] = Field(default_factory=list)
    features: list[str] = Field(default_factory=list)
    known_quantities: dict[str, str | float] = Field(default_factory=dict)
    target_quantity: str = ""


class IngredientMastery(BaseModel):
    """Per-student mastery at the ingredient level."""

    ingredient_id: str
    mastery: float = Field(default=0.0, ge=0.0, le=1.0)
    attempts: int = 0
    last_outcome: float = 0.0
    cumulative_outcome: float = 0.0


class BridgeConfidence(BaseModel):
    """Per-student confidence in a specific bridge transition."""

    bridge_id: str
    from_ingredient: str
    to_ingredient: str
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)
    attempts: int = 0
    successes: int = 0


class IngredientStudentState(BaseModel):
    """
    Full ingredient-level state for one student.

    Sits alongside the concept-level StudentState.
    """

    student_id: str
    ingredient_mastery: dict[str, IngredientMastery] = Field(default_factory=dict)
    bridge_confidence: dict[str, BridgeConfidence] = Field(default_factory=dict)
    style_scores: dict[str, float] = Field(default_factory=dict)


class IngredientOntology(BaseModel):
    """
    Complete ingredient-level graph data.

    Loaded from JSON at startup, same as the concept ontology.
    """

    version: str
    ingredients: list[Ingredient] = Field(default_factory=list)
    bridges: list[Bridge] = Field(default_factory=list)
    card_templates: list[CardTemplate] = Field(default_factory=list)
