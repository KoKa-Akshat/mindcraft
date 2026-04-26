"""
Graph operations on the ingredient layer.

Handles ingredient lookup, dependency traversal, bridge backtracking,
and card lookup.
"""

from __future__ import annotations

from mindcraft_graph.models.ingredient import Bridge, CardTemplate, Ingredient, IngredientOntology


class IngredientGraph:
    """
    In-memory graph built from IngredientOntology.

    Provides fast lookup for ingredients, dependencies, bridges, and cards.
    """

    def __init__(self, ontology: IngredientOntology):
        self.ingredients: dict[str, Ingredient] = {
            ingredient.id: ingredient for ingredient in ontology.ingredients
        }

        self.by_concept: dict[str, list[Ingredient]] = {}
        for ingredient in ontology.ingredients:
            self.by_concept.setdefault(ingredient.concept_id, []).append(ingredient)

        self.bridges_by_target: dict[str, list[Bridge]] = {}
        self.bridges_by_source: dict[str, list[Bridge]] = {}
        for bridge in ontology.bridges:
            self.bridges_by_target.setdefault(bridge.to_ingredient, []).append(bridge)
            self.bridges_by_source.setdefault(bridge.from_ingredient, []).append(bridge)

        self.cards_by_target: dict[str, list[CardTemplate]] = {}
        for card in ontology.card_templates:
            self.cards_by_target.setdefault(card.target_id, []).append(card)

    def get_concept_ingredients(self, concept_id: str) -> list[Ingredient]:
        """Return all ingredients belonging to a concept."""
        return self.by_concept.get(concept_id, [])

    def get_ingredient(self, ingredient_id: str) -> Ingredient | None:
        """Return a single ingredient by ID, or None if not found."""
        return self.ingredients.get(ingredient_id)

    def get_intra_dependencies(self, ingredient_id: str) -> list[Ingredient]:
        """
        Return the ingredients that this ingredient depends on
        within the same concept.
        """
        ingredient = self.ingredients.get(ingredient_id)
        if ingredient is None:
            return []

        return [
            self.ingredients[dep_id]
            for dep_id in ingredient.depends_on
            if dep_id in self.ingredients
        ]

    def get_bridges_into(self, ingredient_id: str) -> list[Bridge]:
        """Return all bridges that enable this ingredient."""
        return self.bridges_by_target.get(ingredient_id, [])

    def get_bridges_from(self, ingredient_id: str) -> list[Bridge]:
        """Return all bridges that this ingredient enables."""
        return self.bridges_by_source.get(ingredient_id, [])

    def get_cards_for(self, target_id: str) -> list[CardTemplate]:
        """
        Return card templates for an ingredient or bridge.

        For bridges, target_id is expected to be "from_id->to_id".
        """
        return self.cards_by_target.get(target_id, [])
