#!/usr/bin/env python3
"""
Generate ml/data/ontology.json (the concept layer) so its concept IDs match the
ingredient layer (ingredient_ontology.json) and the tagged-question topics.

The legacy on-disk ontology.json was the older ~38-concept ACT ontology, whose
IDs did not match the 15 pilot concepts the ingredient layer is built from.
classify_problem therefore returned concept IDs with no ingredients. This script
rebuilds ontology.json from:
  - the 15 tagged-question primary topics (names/descriptions/tags below), and
  - the cross-concept bridges in ingredient_ontology.json (-> prerequisite edges).

Deterministic, no LLM. Backs up the existing ontology.json before writing.

Run:  cd ml && python3 scripts/build_concept_ontology.py
"""

from __future__ import annotations

import json
import pathlib
import shutil

ML_DIR = pathlib.Path(__file__).resolve().parent.parent
ONT_PATH = ML_DIR / "data" / "ontology.json"
ING_PATH = ML_DIR / "data" / "ingredient_ontology.json"
BACKUP_PATH = ML_DIR / "data" / "ontology_legacy_38.json"

# id, name, level, typical_order, description, tags.
# Descriptions are written to carry the tagged-question subtopics verbatim so the
# sentence-transformer embedding (name + ". " + description) aligns with problem
# text — this is what drives classify_problem accuracy.
CONCEPTS = [
    ("number_theory", "Number Theory", "foundational", 1,
     "Factors and primes. Finding factors, identifying prime numbers and perfect "
     "squares, counting factors, and incremental search.",
     ["factors", "primes", "perfect squares", "factor counting", "number theory"]),
    ("sequences_patterns", "Sequences & Patterns", "foundational", 2,
     "Number patterns and finite sequences. Comparing successive terms, finding "
     "first differences, recognizing constant or growing differences, and "
     "predicting the next term.",
     ["sequence", "pattern", "first differences", "next term", "number patterns"]),
    ("rates_proportion", "Rates, Units & Proportional Reasoning", "foundational", 3,
     "Unit rate and work rate problems. Unit conversion, computing rooms per hour "
     "or hours per room, and proportional reasoning.",
     ["rate", "unit rate", "work rate", "unit conversion", "proportional reasoning"]),
    ("statistics_averages", "Statistics & Averages", "foundational", 4,
     "Arithmetic mean and weighted averages. Total sum divided by count, weighted "
     "totals, and translating word problems into average calculations.",
     ["mean", "average", "weighted average", "sum over count", "statistics"]),
    ("linear_equations", "Algebra: Linear Equations", "core", 5,
     "Solving linear equations. Combining like terms, applying inverse operations, "
     "handling variables on both sides, and integer and fraction arithmetic.",
     ["linear equation", "like terms", "inverse operations",
      "variables on both sides", "equation solving"]),
    ("expression_forms", "Algebra: Expression Evaluation & Equivalent Forms", "core", 6,
     "Evaluating expressions and recognizing equivalent forms. Substitution, "
     "exponent rules, square of a binomial, and difference of squares as an "
     "answer-choice trap.",
     ["expression", "substitution", "equivalent forms",
      "square of binomial", "difference of squares"]),
    ("words_to_equations", "Algebra: Translating Words to Equations", "core", 7,
     "Translating words into equations. Naming the unknown variable, converting "
     "verbal phrases to symbols, building one-variable linear equations, and "
     "applying the distributive property.",
     ["word problem", "verbal to symbolic", "unknown variable",
      "translation", "linear equation"]),
    ("inequalities", "Inequalities & Number Lines", "core", 8,
     "Inequalities and number lines. Compound inequalities, open and closed "
     "endpoints, interval notation and boundaries, and number line interpretation.",
     ["inequality", "number line", "interval notation",
      "compound inequality", "endpoints"]),
    ("literal_equations", "Algebra: Literal Equations & Rearranging Formulas", "core", 9,
     "Literal equations and rearranging formulas. Solving for a variable, "
     "isolating variables, factoring out common factors, and dividing by a "
     "coefficient or expression.",
     ["literal equation", "rearrange formula", "isolate variable",
      "solve for variable", "factoring"]),
    ("functions_evaluation", "Functions: Evaluation & Substitution", "core", 10,
     "Evaluating functions. Function notation, inputs and outputs, substituting "
     "values, evaluating polynomial and linear functions, and quotient of "
     "function values.",
     ["function", "function notation", "evaluation",
      "substitution", "inputs and outputs"]),
    ("coordinate_slope", "Coordinate Geometry: Slope", "core", 11,
     "Slope in the coordinate plane. Slope formula, rate of change, rise over run, "
     "lines through two points, and negative slope.",
     ["slope", "coordinate plane", "rise over run", "rate of change", "line"]),
    ("area_tiling", "Geometry: Area & Unit Tiling", "core", 12,
     "Area of rectangles and unit tiling. Composite area, tile and sod coverage, "
     "unit area conversion, and dividing by tile area.",
     ["area", "rectangle", "tiling", "unit squares", "coverage"]),
    ("squares_area_right_triangles", "Geometry: Squares, Area & Right Triangles", "advanced", 13,
     "Squares, area, and right triangles. Square area, finding side length from "
     "area, diagonal as hypotenuse, special right triangles, and the Pythagorean "
     "theorem.",
     ["square", "area", "diagonal", "pythagorean", "right triangle"]),
    ("similar_triangles", "Geometry: Similar Triangles & Proportions", "advanced", 14,
     "Similar triangles and proportions. Corresponding sides, proportional side "
     "lengths, scale factor, and SSS/SAS/AA similarity criteria.",
     ["similar triangles", "proportion", "scale factor",
      "corresponding sides", "similarity"]),
    ("right_triangle_trig", "Trigonometry: Right Triangle Ratios", "advanced", 15,
     "Right-triangle trigonometry. SOH-CAH-TOA, cosine and adjacent over "
     "hypotenuse, secant as the reciprocal of cosine, and identifying triangle "
     "sides.",
     ["trigonometry", "SOH-CAH-TOA", "cosine", "secant", "right triangle"]),
]

VALID_IDS = {c[0] for c in CONCEPTS}


def build_edges() -> list[dict]:
    """Derive concept-level edges from the ingredient layer's cross-concept bridges.

    Each bridge has source_concept -> target_concept. We aggregate counts per
    directed pair; the dominant direction becomes a prerequisite edge (strength
    scaled by evidence count). If the reverse direction also appears, it is added
    as a weaker 'related' edge so we never emit a prerequisite 2-cycle.
    """
    ing = json.loads(ING_PATH.read_text())
    counts: dict[tuple[str, str], int] = {}
    for b in ing["bridges"]:
        s, t = b.get("source_concept"), b.get("target_concept")
        if s in VALID_IDS and t in VALID_IDS and s != t:
            counts[(s, t)] = counts.get((s, t), 0) + 1

    edges: list[dict] = []
    handled: set[tuple[str, str]] = set()
    for (s, t), n in sorted(counts.items()):
        if (s, t) in handled:
            continue
        rev = counts.get((t, s), 0)
        if n >= rev:
            strong, weak = (s, t), (t, s)
            strong_n = n
        else:
            strong, weak = (t, s), (s, t)
            strong_n = rev
        edges.append({
            "from": strong[0],
            "to": strong[1],
            "relation": "prerequisite",
            "strength": 0.8 if strong_n >= 2 else 0.7,
        })
        if rev > 0:
            edges.append({
                "from": weak[0],
                "to": weak[1],
                "relation": "related",
                "strength": 0.4,
            })
        handled.add((s, t))
        handled.add((t, s))
    return edges


def main() -> None:
    concepts = [
        {
            "id": cid,
            "name": name,
            "level": level,
            "typical_order": order,
            "description": desc,
            "tags": tags,
        }
        for (cid, name, level, order, desc, tags) in CONCEPTS
    ]
    edges = build_edges()
    ontology = {
        "version": "0.2-pilot15",
        "domain": "math",
        "concepts": concepts,
        "edges": edges,
    }

    if ONT_PATH.exists() and not BACKUP_PATH.exists():
        shutil.copy2(ONT_PATH, BACKUP_PATH)
        print(f"Backed up legacy ontology -> {BACKUP_PATH.relative_to(ML_DIR)}")

    ONT_PATH.write_text(json.dumps(ontology, indent=2) + "\n")
    print(f"Wrote {ONT_PATH.relative_to(ML_DIR)}: "
          f"{len(concepts)} concepts, {len(edges)} edges")
    print()
    print(f"{'id':30} {'level':12} order  name")
    for c in concepts:
        print(f"{c['id']:30} {c['level']:12} {c['typical_order']:>4}   {c['name']}")
    print()
    print("Edges (concept-level, derived from ingredient bridges):")
    for e in edges:
        print(f"  {e['from']:30} --{e['relation']}({e['strength']})--> {e['to']}")


if __name__ == "__main__":
    main()
