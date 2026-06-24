"""
Main entry point for the ingredient runtime pipeline.
"""

from __future__ import annotations

import numpy as np

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.engine.ingredient_runtime import (
    IngredientRecommendationResult,
    MinimalDAG,
    apply_combinations,
    backtrack_prerequisites,
    build_minimal_dag,
    classify_problem,
    detect_weak_targets,
    generate_composition_prompt,
    order_cards_by_dag,
    prune_mastered_nodes,
    select_cards,
    select_target_ingredients,
)
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.ingredient import IngredientStudentState


def recommend_cards(
    problem_text: str,
    student_state: IngredientStudentState,
    graph: IngredientGraph,
    concept_embeddings: dict[str, np.ndarray],
    embed_fn,
    ontology: Ontology,
    max_cards: int = 4,
    mastery_threshold: float = 0.8,
    bridge_confidence_threshold: float = 0.7,
    style_priority: list[str] | None = None,
    use_combinations: bool = True,
    combination_min_overlap: float = 0.1,
) -> IngredientRecommendationResult:
    """
    Full runtime pipeline: problem -> ingredient-level card recommendations.
    """
    features = classify_problem(problem_text, concept_embeddings, embed_fn, ontology)
    target_ids = select_target_ingredients(
        features.primary_concept,
        features.features,
        graph,
    )

    if not target_ids:
        return IngredientRecommendationResult(
            problem_features=features,
            minimal_dag=MinimalDAG(
                nodes={},
                edges=[],
                target_ingredients=[],
                backtracked_ingredients=[],
            ),
            cards=[],
            composition_prompt="",
            hidden_answer="",
        )

    prereq_ids, used_bridges = backtrack_prerequisites(target_ids, graph)
    active_ids = set(target_ids) | prereq_ids
    if use_combinations:
        expanded_ids, ordering_override = apply_combinations(
            active_ids,
            graph,
            min_overlap=combination_min_overlap,
        )
    else:
        expanded_ids, ordering_override = active_ids, []

    expanded_prereq_ids = expanded_ids - set(target_ids)
    dag = build_minimal_dag(target_ids, expanded_prereq_ids, used_bridges, graph, student_state)
    dag = prune_mastered_nodes(dag, mastery_threshold, bridge_confidence_threshold)
    weak_targets = detect_weak_targets(dag, max_targets=max_cards)

    if style_priority is None:
        if student_state.style_scores:
            style_priority = sorted(
                student_state.style_scores.keys(),
                key=lambda style: -student_state.style_scores[style],
            )
        else:
            style_priority = ["geometric", "algebraic", "procedural"]

    cards = select_cards(weak_targets, graph, student_state, style_priority)
    cards = order_cards_by_dag(cards, dag, ordering_override=ordering_override)
    composition_prompt, hidden_answer = generate_composition_prompt(
        target_ids,
        graph,
        features,
    )

    return IngredientRecommendationResult(
        problem_features=features,
        minimal_dag=dag,
        cards=cards,
        composition_prompt=composition_prompt,
        hidden_answer=hidden_answer,
    )
