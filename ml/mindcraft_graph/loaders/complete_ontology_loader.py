"""
Loader for the unified mindcraft_ontology_COMPLETE.json format.

Parses the rich ingredient-level ontology and produces both:
  - Ontology (concept graph with edges derived from bridges)
  - IngredientOntology (full ingredient + bridge + card template graph)
"""

from __future__ import annotations

import json
import pathlib
from typing import Any

from mindcraft_graph.models.concept import Concept, OntologyEdge, Ontology
from mindcraft_graph.models.ingredient import (
    Bridge,
    CardRepresentation,
    CardTemplate,
    Ingredient,
    IngredientOntology,
)


def load_complete_ontology(path: str | pathlib.Path) -> tuple[Ontology, IngredientOntology]:
    """
    Load the unified complete ontology JSON and return both ontology objects.

    Returns:
        (Ontology, IngredientOntology) — drop-in replacements for the separate files.
    """
    data = json.loads(pathlib.Path(path).read_text())
    ontology = _build_concept_ontology(data)
    ingredient_ontology = _build_ingredient_ontology(data)
    return ontology, ingredient_ontology


def _build_concept_ontology(data: dict[str, Any]) -> Ontology:
    """Build the concept-level Ontology from complete JSON."""
    meta = data.get("meta", {})
    raw_concepts = data["concepts"]

    concepts = []
    for idx, c in enumerate(raw_concepts):
        concepts.append(Concept(
            id=c["id"],
            name=c["name"],
            level=c["level"],
            typical_order=idx,
            description=c.get("population_failure_prior", {}).get("notes", c["name"]),
            tags=_extract_tags(c),
        ))

    edges = _derive_concept_edges(data)

    return Ontology(
        version=meta.get("version", "1.0-complete"),
        domain=meta.get("domain", "math"),
        concepts=concepts,
        edges=edges,
    )


def _extract_tags(concept: dict[str, Any]) -> list[str]:
    tags = [concept["level"]]
    act = concept.get("act_relevance", {})
    if act.get("tested"):
        tags.append("act_tested")
    for qt in act.get("question_types", []):
        tags.append(qt.replace(" ", "_").lower())
    return tags


def _derive_concept_edges(data: dict[str, Any]) -> list[OntologyEdge]:
    """
    Derive concept-level edges from two sources:
      1. Top-level bridges[] — each has from_concept/to_concept (prerequisite)
      2. Ingredient comes_from fields that reference different concepts (prerequisite)
    """
    seen: set[tuple[str, str]] = set()
    edges: list[OntologyEdge] = []

    # Source 1: top-level bridge groups
    concept_index = {c["id"] for c in data["concepts"]}
    for bridge_group in data.get("bridges", []):
        fc = bridge_group.get("from_concept", "")
        tc = bridge_group.get("to_concept", "")
        if fc and tc and (fc, tc) not in seen:
            seen.add((fc, tc))
            # Average bridge difficulty as strength proxy
            bridge_items = bridge_group.get("bridges", [])
            strength = 1.0 - (
                sum(b.get("difficulty", 0.5) for b in bridge_items) / max(len(bridge_items), 1)
            )
            edges.append(OntologyEdge(**{"from": fc, "to": tc, "relation": "prerequisite", "strength": round(strength, 2)}))

    # Source 2: ingredient comes_from cross-concept references
    ingredient_to_concept: dict[str, str] = {}
    for concept in data["concepts"]:
        for ing in concept.get("ingredients", []):
            ingredient_to_concept[ing["id"]] = concept["id"]

    for concept in data["concepts"]:
        tc = concept["id"]
        for ing in concept.get("ingredients", []):
            comes_from = ing.get("comes_from", "new")
            if comes_from == "new" or comes_from not in ingredient_to_concept:
                continue
            fc = ingredient_to_concept[comes_from]
            if fc == tc:
                continue  # same-concept dependency — not a concept edge
            if (fc, tc) not in seen and fc in concept_index:
                seen.add((fc, tc))
                edges.append(OntologyEdge(**{"from": fc, "to": tc, "relation": "prerequisite", "strength": 0.7}))

    return edges


def _build_ingredient_ontology(data: dict[str, Any]) -> IngredientOntology:
    """Build the IngredientOntology from embedded ingredients + bridges."""
    ingredients: list[Ingredient] = []
    card_templates: list[CardTemplate] = []
    bridges: list[Bridge] = []

    for concept in data["concepts"]:
        concept_id = concept["id"]
        for raw_ing in concept.get("ingredients", []):
            # Ingredient
            ing = Ingredient(
                id=raw_ing["id"],
                concept_id=concept_id,
                name=raw_ing.get("label", raw_ing["id"]),
                description=raw_ing.get("description", ""),
                tags=[concept_id, concept["level"]] + raw_ing.get("tags", []),
                depends_on=_resolve_depends_on(raw_ing.get("comes_from", "new"), concept_id),
            )
            ingredients.append(ing)

            # Card templates from the three representation styles
            raw_cards = raw_ing.get("card_templates", {})
            if raw_cards:
                representations = {
                    style: CardRepresentation(title=raw_ing.get("label", ""), body=body, visual_hint="")
                    for style, body in raw_cards.items()
                }
                card_templates.append(CardTemplate(
                    id=f"tpl::{raw_ing['id']}",
                    target_type="ingredient",
                    target_id=raw_ing["id"],
                    representations=representations,
                    prompt=f"Explain {raw_ing.get('label', '')} in your own words and apply it to the problem.",
                    difficulty=raw_ing.get("failure_prior", 0.5),
                ))

    # Bridges from the top-level bridges[] array
    bridge_counter: dict[str, int] = {}
    for bridge_group in data.get("bridges", []):
        source_concept = bridge_group.get("from_concept", "")
        target_concept = bridge_group.get("to_concept", "")
        for b in bridge_group.get("bridges", []):
            fi = b["from_ingredient_id"]
            ti = b["to_ingredient_id"]
            key = f"{fi}->{ti}"
            bridge_counter[key] = bridge_counter.get(key, 0) + 1
            bridge_id = key if bridge_counter[key] == 1 else f"{key}_{bridge_counter[key]}"
            bridges.append(Bridge(
                id=bridge_id,
                from_ingredient=fi,
                to_ingredient=ti,
                source_concept=source_concept,
                target_concept=target_concept,
                relation="enables",
                description=b.get("bridge_description", ""),
                confidence=1.0 - b.get("difficulty", 0.5),
            ))

    return IngredientOntology(
        version=data.get("meta", {}).get("version", "1.0-complete"),
        ingredients=ingredients,
        bridges=bridges,
        card_templates=card_templates,
    )


def _resolve_depends_on(comes_from: str, own_concept_id: str) -> list[str]:
    if comes_from in ("new", "", None):
        return []
    return [comes_from]
