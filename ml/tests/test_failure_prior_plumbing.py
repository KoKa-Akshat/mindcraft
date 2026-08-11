import json
from pathlib import Path

from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology


def test_complete_ontology_plumbs_all_population_failure_priors():
    path = (
        Path(__file__).resolve().parents[1]
        / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
    )
    raw = json.loads(path.read_text())
    ontology, ingredient_ontology = load_complete_ontology(path)

    assert len(ontology.concepts) == 42
    assert all(0.0 < concept.population_failure_rate < 1.0 for concept in ontology.concepts)
    expected_concepts = {
        concept["id"]: float(concept["population_failure_prior"]["overall"])
        for concept in raw["concepts"]
    }
    assert {
        concept.id: concept.population_failure_rate for concept in ontology.concepts
    } == expected_concepts

    assert len(ingredient_ontology.ingredients) == 179
    assert all(0.0 < ingredient.failure_prior < 1.0 for ingredient in ingredient_ontology.ingredients)
    expected_ingredients = {
        ingredient["id"]: float(ingredient["failure_prior"])
        for concept in raw["concepts"]
        for ingredient in concept["ingredients"]
    }
    assert {
        ingredient.id: ingredient.failure_prior
        for ingredient in ingredient_ontology.ingredients
    } == expected_ingredients
