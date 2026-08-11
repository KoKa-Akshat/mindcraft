"""
Graph operations on the ingredient layer.

Handles ingredient lookup, dependency traversal, bridge backtracking,
and card lookup.
"""

from __future__ import annotations

from mindcraft_graph.models.ingredient import (
    Bridge,
    CardTemplate,
    Combination,
    Ingredient,
    IngredientOntology,
)


class IngredientGraph:
    """
    In-memory graph built from IngredientOntology.

    Provides fast lookup for ingredients, dependencies, bridges, and cards.
    """

    CONCEPT_ID_ALIASES: dict[str, str] = {
        "sequences_series": "sequences_patterns",
        "ratios_proportions": "rates_proportion",
        "linear_inequalities": "inequalities",
        "descriptive_statistics": "statistics_averages",
        "functions_basics": "functions_evaluation",
        "basic_equations": "linear_equations",
        "order_of_operations": "expression_forms",
        "exponent_rules": "expression_forms",
        "polynomials": "expression_forms",
        "quadratic_equations": "expression_forms",
        "right_triangle_geometry": "squares_area_right_triangles",
        "triangles_congruence": "similar_triangles",
        "lines_angles": "coordinate_slope",
        "area_volume": "squares_area_right_triangles",
        "trigonometry_basics": "right_triangle_trig",
        "trigonometric_identities": "right_triangle_trig",
        "systems_of_linear_equations": "linear_equations",
    }

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

        self.combinations_by_ingredient: dict[str, list[Combination]] = {}
        for combination in ontology.combinations:
            for ingredient_id in combination.ingredients:
                self.combinations_by_ingredient.setdefault(ingredient_id, []).append(combination)

    def alias_concept_id(self, concept_id: str) -> str:
        """Map a concept ID from the main ontology into the ingredient namespace.

        Only redirects when the concept has no ingredients of its own but the
        alias target does. Under the standardized ontology the concept and
        ingredient layers share canonical IDs, so every real concept resolves to
        itself and is never misrouted into a stale pilot bucket (e.g. the legacy
        polynomials -> expression_forms alias). The legacy aliases below still
        apply for the old pilot ingredient_ontology.json, whose ingredient
        concept_ids lived in a different namespace.
        """
        if concept_id in self.by_concept:
            return concept_id
        aliased = self.CONCEPT_ID_ALIASES.get(concept_id, concept_id)
        if aliased in self.by_concept:
            return aliased
        return concept_id

    def get_concept_ingredients(self, concept_id: str) -> list[Ingredient]:
        """Return all ingredients belonging to a concept."""
        aliased = self.alias_concept_id(concept_id)
        return self.by_concept.get(aliased, [])

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

    def get_combinations_for_ingredients(
        self,
        ids: set[str],
        min_overlap: float = 0.5,
    ) -> list[Combination]:
        """Return combinations whose ingredient set overlaps the input by at least min_overlap."""
        if not ids:
            return []

        seen: set[str] = set()
        matches: list[Combination] = []
        for ingredient_id in ids:
            for combination in self.combinations_by_ingredient.get(ingredient_id, []):
                if combination.id in seen:
                    continue
                seen.add(combination.id)
                overlap = len(set(combination.ingredients) & ids)
                if overlap / max(len(combination.ingredients), 1) >= min_overlap:
                    matches.append(combination)

        return matches
