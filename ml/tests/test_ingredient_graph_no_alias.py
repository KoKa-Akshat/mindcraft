from pathlib import Path

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology


def test_every_layer_one_concept_has_ingredients_and_unknown_does_not():
    ontology_path = (
        Path(__file__).resolve().parents[1]
        / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
    )
    ontology, ingredient_ontology = load_complete_ontology(ontology_path)
    graph = IngredientGraph(ingredient_ontology)

    assert all(graph.get_concept_ingredients(concept.id) for concept in ontology.concepts)
    assert graph.get_concept_ingredients("unknown_concept") == []
