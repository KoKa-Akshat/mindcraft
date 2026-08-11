import json
from pathlib import Path

import pytest

from mindcraft_graph.models.concept import (
    Concept,
    Ontology,
    build_concept_id_registry,
    canonical_concept_id,
)
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology


ROOT = Path(__file__).resolve().parents[1]
L1 = ROOT / "data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json"
L2 = ROOT / "data/5_level_ontology/02_question_archetype_ontology_v1_6_standardized.json"
L3 = ROOT / "data/5_level_ontology/03_question_instance_bank_schema_and_seed_v1_6.json"

LEGACY = {
    "algebraic_structure_symbolic_manipulation": "algebraic_manipulation",
    "basic_one_variable_equations": "basic_equations",
    "basics_of_functions": "functions_basics",
    "geometry_circles": "circles_geometry",
    "number_properties_factors_divisibility": "number_properties",
    "representation_translation_mathematical_modeling": "representation_translation",
    "units_measurement_dimensional_reasoning": "measurement_units",
}


def ontology() -> Ontology:
    loaded, _ingredients = load_complete_ontology(L1)
    return loaded


def test_legacy_ids_and_canonical_ids_round_trip() -> None:
    loaded = ontology()
    for alias, expected in LEGACY.items():
        assert canonical_concept_id(alias, loaded) == expected
        assert canonical_concept_id(expected, loaded) == expected


def test_unknown_id_fails_fast() -> None:
    with pytest.raises(ValueError, match="Unresolved concept id"):
        canonical_concept_id("invented_plausible_concept", ontology())


def test_alias_collision_is_rejected() -> None:
    concepts = [
        Concept(id="one", name="One", level="core", aliases=["two"]),
        Concept(id="two", name="Two", level="core"),
    ]
    with pytest.raises(ValueError, match="collides"):
        build_concept_id_registry(concepts)


def test_all_l2_l3_concept_references_are_canonical() -> None:
    canonical = {concept.id for concept in ontology().concepts}
    layer2 = json.loads(L2.read_text())
    layer3 = json.loads(L3.read_text())
    values: list[str] = []
    for archetype in layer2.get("archetypes", []):
        values.extend(archetype.get("primary_concept_ids", []))
        values.extend(archetype.get("bridge_concept_ids", []))
    for instance in layer3.get("question_instances", []):
        links = instance.get("links", {})
        values.extend(links.get("primary_concept_ids", []))
        values.extend(links.get("bridge_concept_ids", []))
        values.extend(links.get("concept_ids", []))
    assert set(values) <= canonical
