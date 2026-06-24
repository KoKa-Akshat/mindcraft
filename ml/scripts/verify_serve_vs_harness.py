#!/usr/bin/env python3
"""
VERIFY: does the live serve.py code path produce the same fire-sets the harness
reports, on the SAME standardized ontology?

- LIVE path: imports serve.py and calls recommend_cards with serve's exact
  module-level objects (ingredient_graph, ingredient_concept_embs, embed_fn,
  ontology, max_cards=4) — i.e. exactly what POST /recommend-ingredients runs.
- HARNESS path: calls recommend_cards the way test_concept_paths.py does
  (concept_embeddings = raw concept embeddings, combination_min_overlap = 0.5).

Both run on the standardized file serve.py loads. We diff the fire-sets and
ordering per question and print any divergence.

Run:  cd ml && python3 scripts/verify_serve_vs_harness.py
"""
from __future__ import annotations

import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))

import serve  # noqa: E402  (triggers ontology + embedding load; prints startup log)
from mindcraft_graph.engine.ingredient_pipeline import recommend_cards  # noqa: E402
from mindcraft_graph.models.ingredient import IngredientStudentState  # noqa: E402
from scripts.test_concept_paths import (  # noqa: E402
    extract_fire_set_and_order,
    load_questions,
)

CSV = pathlib.Path(__file__).parent.parent / "data" / "sample_questions" / "first_15_questions.csv"

# What the live endpoint passes (see serve.recommend_ingredients_endpoint).
HARNESS_MIN_OVERLAP = 0.5


def run_live(question_text: str):
    state = IngredientStudentState(student_id="verify_student")
    result = recommend_cards(
        problem_text=question_text,
        student_state=state,
        graph=serve.ingredient_graph,
        concept_embeddings=serve.ingredient_concept_embs,
        embed_fn=serve.embed_fn,
        ontology=serve.ontology,
        max_cards=4,
        # Mirror the endpoint: it pins combination_min_overlap to the validated value.
        combination_min_overlap=serve.COMBINATION_MIN_OVERLAP,
    )
    return extract_fire_set_and_order(result, serve.ingredient_graph)


def run_harness(question_text: str):
    state = IngredientStudentState(student_id="verify_student")
    result = recommend_cards(
        problem_text=question_text,
        student_state=state,
        graph=serve.ingredient_graph,
        concept_embeddings=serve.concept_embs,   # raw concept embeddings, like the harness
        embed_fn=serve.embed_fn,
        ontology=serve.ontology,
        max_cards=4,
        use_combinations=True,
        combination_min_overlap=HARNESS_MIN_OVERLAP,
    )
    return extract_fire_set_and_order(result, serve.ingredient_graph)


def main():
    questions = load_questions(str(CSV))
    print(f"\n===== LIVE serve path vs HARNESS path on {len(questions)} questions =====")
    print(f"live concept_embeddings = ingredient_concept_embs (augmented), min_overlap = pipeline default")
    print(f"harness concept_embeddings = concept_embs (raw), min_overlap = {HARNESS_MIN_OVERLAP}")
    print(f"embeddings identical? {serve.ingredient_concept_embs.keys() == serve.concept_embs.keys()} "
          f"(live n={len(serve.ingredient_concept_embs)}, harness n={len(serve.concept_embs)})\n")

    divergent = 0
    for i, row in enumerate(questions, 1):
        qt = row.get("exact_question_text", "").strip()
        if not qt:
            continue
        live_set, live_order = run_live(qt)
        harn_set, harn_order = run_harness(qt)
        set_match = live_set == harn_set
        order_match = live_order == harn_order
        if set_match and order_match:
            print(f"Q{i:<2} MATCH  ({len(live_set)} ingredients)")
        else:
            divergent += 1
            print(f"Q{i:<2} DIVERGE")
            if not set_match:
                print(f"      live only:    {sorted(live_set - harn_set)}")
                print(f"      harness only: {sorted(harn_set - live_set)}")
            if not order_match:
                print(f"      live order:    {live_order}")
                print(f"      harness order: {harn_order}")

    print(f"\n===== {len(questions) - divergent}/{len(questions)} match, {divergent} diverge =====")


if __name__ == "__main__":
    main()
