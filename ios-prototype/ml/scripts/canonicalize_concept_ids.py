#!/usr/bin/env python3
"""Populate the L1 alias registry and canonicalize concept references in L2/L3.

Run without arguments to check the committed files. Use ``--write`` to apply
the deterministic migration. The script is idempotent.
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

ML_ROOT = Path(__file__).resolve().parents[1]
if str(ML_ROOT) not in sys.path:
    sys.path.insert(0, str(ML_ROOT))

from mindcraft_graph.models.concept import Concept, build_concept_id_registry  # noqa: E402

DATA = ML_ROOT / "data/5_level_ontology"
L1 = DATA / "01_mindcraft_concept_ontology_v2_6_with_combinations.json"
L2 = DATA / "02_question_archetype_ontology_v1_6_standardized.json"
L3 = DATA / "03_question_instance_bank_schema_and_seed_v1_6.json"

# True source-vocabulary aliases only. Content coverage fallbacks (for example
# basic_equations -> linear_equations) deliberately do not belong here.
ALIASES: dict[str, str] = {
    "algebraic_structure_symbolic_manipulation": "algebraic_manipulation",
    "basic_one_variable_equations": "basic_equations",
    "basics_of_functions": "functions_basics",
    "geometry_circles": "circles_geometry",
    "number_properties_factors_divisibility": "number_properties",
    "representation_translation_mathematical_modeling": "representation_translation",
    "units_measurement_dimensional_reasoning": "measurement_units",
    "percent_ratio": "ratios_proportions",
    "data_interpretation": "descriptive_statistics",
    "statistics_data": "descriptive_statistics",
    "statistics_graphs": "descriptive_statistics",
    "probability_statistics": "basic_probability",
    "word_problems": "representation_translation",
    "absolute_value": "linear_inequalities",
    "function_transformations": "functions_basics",
    "trigonometric_identities": "trigonometry_basics",
    "polynomial_operations": "polynomials",
    "systems_linear_equations": "systems_of_linear_equations",
    "geometry_of_circles": "circles_geometry",
    "lines_and_angles": "lines_angles",
    "area_and_volume": "area_volume",
    "sequences_and_series": "sequences_series",
    "triangles_and_congruence": "triangles_congruence",
    "integer_operations": "number_properties",
    "coordinate_geometry": "linear_equations",
    "combinatorics": "basic_probability",
    "proportional_reasoning": "ratios_proportions",
    "number_patterns": "sequences_series",
    "inequalities_systems": "linear_inequalities",
    "plane_geometry": "lines_angles",
    "solid_geometry": "area_volume",
    "analytic_geometry": "linear_equations",
    "right_triangle": "right_triangle_geometry",
    "quadratics": "quadratic_equations",
}

SCALAR_FIELDS = {"concept_id", "primary_concept", "source_concept", "target_concept"}
LIST_FIELDS = {
    "concept_ids", "primary_concept_ids", "secondary_concept_ids",
    "bridge_concept_ids", "spans_concepts",
}
INGREDIENT_SCALAR_FIELDS = {"ingredient_id", "from_ingredient", "to_ingredient"}
INGREDIENT_LIST_FIELDS = {
    "ingredient_ids", "required_ingredient_ids", "ingredients", "apply_order",
}


def load(path: Path) -> Any:
    return json.loads(path.read_text())


def dump(path: Path, payload: Any) -> None:
    # Match the repository's existing JSON encoding to keep migration diffs surgical.
    path.write_text(json.dumps(payload, indent=2) + "\n")


def populate_aliases(layer1: dict[str, Any]) -> dict[str, str]:
    concepts = layer1["concepts"]
    canonical = {item["id"] for item in concepts}
    for alias, target in ALIASES.items():
        if target not in canonical:
            raise ValueError(f"Alias {alias!r} targets unknown concept {target!r}")
        if alias in canonical:
            raise ValueError(f"Alias {alias!r} collides with a canonical concept")
    by_id = {item["id"]: item for item in concepts}
    for alias, target in ALIASES.items():
        values = by_id[target].setdefault("aliases", [])
        if alias not in values:
            values.append(alias)
        values.sort()
    models = [Concept.model_validate(item) for item in concepts]
    return build_concept_id_registry(models)


def normalize_references(value: Any, registry: dict[str, str], path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key in SCALAR_FIELDS and isinstance(child, str) and child:
                if child not in registry:
                    raise ValueError(f"Unresolved concept id {child!r} at {child_path}")
                value[key] = registry[child]
            elif key in LIST_FIELDS and isinstance(child, list):
                resolved = []
                for index, raw in enumerate(child):
                    if not isinstance(raw, str) or raw not in registry:
                        raise ValueError(f"Unresolved concept id {raw!r} at {child_path}[{index}]")
                    resolved.append(registry[raw])
                value[key] = resolved
            else:
                normalize_references(child, registry, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            normalize_references(child, registry, f"{path}[{index}]")


def validate_ingredient_references(
    value: Any, ingredient_ids: set[str], path: str = "$"
) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            child_path = f"{path}.{key}"
            if key in INGREDIENT_SCALAR_FIELDS and isinstance(child, str) and child:
                if child not in ingredient_ids:
                    raise ValueError(f"Unresolved ingredient id {child!r} at {child_path}")
            elif key in INGREDIENT_LIST_FIELDS and isinstance(child, list):
                for index, raw in enumerate(child):
                    if isinstance(raw, str) and raw and raw not in ingredient_ids:
                        raise ValueError(
                            f"Unresolved ingredient id {raw!r} at {child_path}[{index}]"
                        )
            else:
                validate_ingredient_references(child, ingredient_ids, child_path)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            validate_ingredient_references(child, ingredient_ids, f"{path}[{index}]")


def migrated() -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    layer1, layer2, layer3 = load(L1), load(L2), load(L3)
    registry = populate_aliases(layer1)
    ingredient_ids = {
        ingredient["id"]
        for concept in layer1["concepts"]
        for ingredient in concept.get("ingredients", [])
    }
    normalize_references(layer1.get("bridges", []), registry, "$.bridges")
    normalize_references(layer1.get("combinations", []), registry, "$.combinations")
    # Normalize data records, not JSON-schema prose/example values in metadata.
    normalize_references(layer2.get("archetypes", []), registry, "$.archetypes")
    normalize_references(
        layer3.get("question_instances", []), registry, "$.question_instances"
    )
    validate_ingredient_references(layer2.get("archetypes", []), ingredient_ids, "$.archetypes")
    validate_ingredient_references(
        layer3.get("question_instances", []), ingredient_ids, "$.question_instances"
    )
    return layer1, layer2, layer3


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--write", action="store_true", help="write the canonicalized files")
    args = parser.parse_args()
    outputs = migrated()
    paths = (L1, L2, L3)
    changed = [path for path, payload in zip(paths, outputs) if load(path) != payload]
    if args.write:
        for path, payload in zip(paths, outputs):
            dump(path, payload)
        print(f"Canonical concept IDs written; changed {len(changed)} file(s).")
        return 0
    if changed:
        print("Concept-ID canonicalization required: " + ", ".join(str(p) for p in changed))
        return 1
    print("Concept-ID registry and L1/L2/L3 references are canonical.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
