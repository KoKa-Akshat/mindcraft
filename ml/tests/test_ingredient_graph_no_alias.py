from pathlib import Path

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology
from mindcraft_graph.models.ingredient import Ingredient, IngredientOntology


def test_every_layer_one_concept_has_ingredients_and_unknown_does_not():
    ontology_path = (
        Path(__file__).resolve().parents[1]
        / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
    )
    ontology, ingredient_ontology = load_complete_ontology(ontology_path)
    graph = IngredientGraph(ingredient_ontology)
    legacy_index = {}
    for ingredient in ingredient_ontology.ingredients:
        legacy_index.setdefault(ingredient.concept_id, []).append(ingredient)

    assert all(
        ingredient.concept_ids == [ingredient.concept_id]
        for ingredient in ingredient_ontology.ingredients
    )
    assert graph.by_concept == legacy_index
    assert all(graph.get_concept_ingredients(concept.id) for concept in ontology.concepts)
    assert graph.get_concept_ingredients("unknown_concept") == []


def test_multi_concept_ingredient_is_indexed_under_every_membership():
    ingredient = Ingredient(
        id="shared",
        concept_ids=["primary", "secondary"],
        name="Shared ingredient",
        description="",
    )
    graph = IngredientGraph(IngredientOntology(version="test", ingredients=[ingredient]))

    assert ingredient.concept_id == "primary"
    assert graph.get_concept_ingredients("primary") == [ingredient]
    assert graph.get_concept_ingredients("secondary") == [ingredient]
