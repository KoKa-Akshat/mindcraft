#!/usr/bin/env python3
"""
Comparison harness: human concept paths vs. engine-generated ingredient orders.

Runs each question through recommend_cards() with and without combinations,
scores coverage/fire-set-match/order-agreement, and generates a detailed report.
"""

import argparse
import csv
import json
import pathlib
import re
import sys
from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.engine.ingredient_pipeline import recommend_cards
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.ingredient import IngredientOntology, IngredientStudentState
from mindcraft_graph.representation import embeddings


@dataclass
class PathStep:
    """A single step in a human concept path."""
    text: str
    matched_ingredient_id: str | None = None
    match_score: float = 0.0


@dataclass
class QuestionResult:
    """Results for one question, comparing path to engine output."""
    question_text: str
    concept_path_text: str
    path_steps: list[PathStep]
    
    # Without combinations
    fire_set_no_combo: set[str]
    order_no_combo: list[str]
    
    # With combinations
    fire_set_with_combo: set[str]
    order_with_combo: list[str]
    
    # Scores
    coverage: float
    precision_no_combo: float
    recall_no_combo: float
    precision_with_combo: float
    recall_with_combo: float
    order_agreement_no_combo: float
    order_agreement_with_combo: float
    
    verdict: str


def load_sample_questions() -> str:
    """Generate and return path to sample questions file."""
    sample_file = pathlib.Path(__file__).parent.parent / "data" / "sample_questions" / "concept_paths.json"
    
    sample_data = [
        {
            "exact_question_text": "A sequence starts at 3 and grows by 2 each term. Find the 10th term.",
            "concept_path": "Sequences & Patterns -> finite sequence -> compare successive terms -> first differences -> constant difference -> next term prediction",
            "primary_topic": "Sequences & Patterns",
            "secondary_topics": "Number patterns"
        },
        {
            "exact_question_text": "Solve 3(x + 2) - 5 = 7 - 2(x - 1) for x.",
            "concept_path": "Algebra: Linear Equations -> distribute terms -> combine like terms -> variables on both sides -> inverse operations -> isolate variable",
            "primary_topic": "Algebra: Linear Equations",
            "secondary_topics": "Equation solving"
        },
        {
            "exact_question_text": "Two similar triangles have sides 6, 8, 10 and 9, 12, ?. Find the missing side.",
            "concept_path": "Geometry: Similar Triangles & Proportions -> identify corresponding sides -> scale factor -> ratio as comparison -> proportion solving -> multiply to find unknown",
            "primary_topic": "Geometry: Similar Triangles & Proportions",
            "secondary_topics": "Ratios; scale factors; triangle similarity criteria"
        }
    ]
    
    with open(sample_file, 'w') as f:
        json.dump(sample_data, f, indent=2)
    
    print(f"Generated sample questions file: {sample_file}")
    return str(sample_file)


def load_questions(questions_file: str) -> list[dict[str, Any]]:
    """Load questions from CSV or JSON file."""
    path = pathlib.Path(questions_file)
    
    if path.suffix == '.json':
        with open(path) as f:
            return json.load(f)
    elif path.suffix == '.csv':
        with open(path) as f:
            reader = csv.DictReader(f)
            return list(reader)
    else:
        raise ValueError(f"Unsupported file format: {path.suffix}")


def match_step_to_ingredient(
    step_text: str,
    ingredient_embeddings: dict[str, np.ndarray],
    embed_fn,
) -> tuple[str | None, float]:
    """Find the best-matching ingredient for a path step using cosine similarity."""
    step_embedding = embed_fn(step_text).reshape(1, -1)
    
    best_id = None
    best_score = 0.0
    
    for ing_id, ing_embedding in ingredient_embeddings.items():
        ing_embedding_reshaped = ing_embedding.reshape(1, -1)
        similarity = cosine_similarity(step_embedding, ing_embedding_reshaped)[0, 0]
        
        if similarity > best_score:
            best_score = similarity
            best_id = ing_id
    
    return best_id, best_score


def kendall_tau_distance(order1: list[str], order2: list[str]) -> float:
    """
    Compute normalized Kendall tau distance between two partial orderings.
    
    Returns a value in [0, 1] where 0 = perfect agreement, 1 = perfect disagreement.
    Only considers elements present in both lists.
    """
    common = set(order1) & set(order2)
    if len(common) < 2:
        return 0.0 if len(common) == len(order1) == len(order2) else 1.0
    
    # Build position maps for common elements
    pos1 = {elem: idx for idx, elem in enumerate(order1) if elem in common}
    pos2 = {elem: idx for idx, elem in enumerate(order2) if elem in common}
    
    # Count inversions (pairs that are in different order)
    inversions = 0
    n = len(common)
    for i, elem_i in enumerate(sorted(common, key=lambda x: pos1[x])):
        for elem_j in sorted(common, key=lambda x: pos1[x])[i+1:]:
            if pos2[elem_i] > pos2[elem_j]:
                inversions += 1
    
    max_inversions = n * (n - 1) / 2
    if max_inversions == 0:
        return 0.0
    
    return inversions / max_inversions


def compute_precision_recall(
    truth_set: set[str],
    predicted_set: set[str],
) -> tuple[float, float]:
    """Compute precision and recall for fire-set match."""
    if not predicted_set:
        precision = 1.0 if not truth_set else 0.0
    else:
        precision = len(truth_set & predicted_set) / len(predicted_set)
    
    if not truth_set:
        recall = 1.0 if not predicted_set else 0.0
    else:
        recall = len(truth_set & predicted_set) / len(truth_set)
    
    return precision, recall


def extract_fire_set_and_order(
    result,
    ingredient_graph: IngredientGraph,
) -> tuple[set[str], list[str]]:
    """Extract ingredient IDs from recommendation result and their order."""
    if not result.cards:
        return set(), []
    
    fire_set = set()
    order = []
    
    for card in result.cards:
        if card.target_type == "ingredient":
            ing_id = card.target_id
            fire_set.add(ing_id)
            if ing_id not in order:
                order.append(ing_id)
    
    return fire_set, order


def run_question_comparison(
    question_row: dict[str, str],
    ingredient_graph: IngredientGraph,
    concept_ontology: Any,
    ingredient_ontology: Any,
    student_state: IngredientStudentState,
    embed_fn,
    concept_embeddings_dict: dict[str, np.ndarray],
    combination_min_overlap: float = 0.5,
) -> QuestionResult | None:
    """Run a single question through the engine with and without combinations."""
    question_text = question_row.get('exact_question_text', '').strip()
    concept_path_text = question_row.get('concept_path', '').strip()
    
    if not question_text:
        return None

    
    # Parse human path. Authored paths use a step delimiter that varies by
    # source: ASCII "->" in the JSON samples, Unicode "→" (U+2192) in the CSV.
    # Split on either so multi-step paths aren't collapsed into one mega-step.
    path_steps_text = [
        step.strip()
        for step in re.split(r"\s*(?:->|→)\s*", concept_path_text)
        if step.strip()
    ]
    path_steps: list[PathStep] = []
    matched_ingredients = set()
    
    # Pre-compute embeddings for all ingredients (name + description)
    ingredient_embeddings: dict[str, np.ndarray] = {}
    for ing in ingredient_ontology.ingredients:
        # Combine name and description for richer semantic match
        ing_text = f"{ing.name} {ing.description}"
        ingredient_embeddings[ing.id] = embed_fn(ing_text)
    
    for step_text in path_steps_text:
        matched_id, match_score = match_step_to_ingredient(step_text, ingredient_embeddings, embed_fn)
        path_step = PathStep(
            text=step_text,
            matched_ingredient_id=matched_id,
            match_score=match_score,
        )
        path_steps.append(path_step)
        if matched_id:
            matched_ingredients.add(matched_id)
    
    coverage = (len([s for s in path_steps if s.matched_ingredient_id]) / len(path_steps)) if path_steps else 0.0
    
    # Run WITHOUT combinations
    result_no_combo = recommend_cards(
        problem_text=question_text,
        student_state=student_state,
        graph=ingredient_graph,
        concept_embeddings=concept_embeddings_dict,
        embed_fn=embed_fn,
        ontology=concept_ontology,
        use_combinations=False,
    )
    fire_set_no_combo, order_no_combo = extract_fire_set_and_order(result_no_combo, ingredient_graph)
    
    # Run WITH combinations
    result_with_combo = recommend_cards(
        problem_text=question_text,
        student_state=student_state,
        graph=ingredient_graph,
        concept_embeddings=concept_embeddings_dict,
        embed_fn=embed_fn,
        ontology=concept_ontology,
        use_combinations=True,
        combination_min_overlap=combination_min_overlap,
    )
    fire_set_with_combo, order_with_combo = extract_fire_set_and_order(result_with_combo, ingredient_graph)
    
    # Score fire-set match
    prec_no_combo, recall_no_combo = compute_precision_recall(matched_ingredients, fire_set_no_combo)
    prec_with_combo, recall_with_combo = compute_precision_recall(matched_ingredients, fire_set_with_combo)
    
    # Score order agreement
    path_ingredient_order = [s.matched_ingredient_id for s in path_steps if s.matched_ingredient_id]
    order_agree_no_combo = 1.0 - kendall_tau_distance(path_ingredient_order, order_no_combo)
    order_agree_with_combo = 1.0 - kendall_tau_distance(path_ingredient_order, order_with_combo)
    
    # Determine verdict
    if recall_with_combo > recall_no_combo + 0.1:
        verdict = "✓ Combinations helped (better recall)"
    elif recall_with_combo < recall_no_combo - 0.1:
        verdict = "✗ Combinations hurt (worse recall)"
    elif order_agree_with_combo > order_agree_no_combo + 0.1:
        verdict = "✓ Combinations helped (better order)"
    elif order_agree_with_combo < order_agree_no_combo - 0.1:
        verdict = "✗ Combinations hurt (worse order)"
    else:
        verdict = "~ No significant change"
    
    return QuestionResult(
        question_text=question_text,
        concept_path_text=concept_path_text,
        path_steps=path_steps,
        fire_set_no_combo=fire_set_no_combo,
        order_no_combo=order_no_combo,
        fire_set_with_combo=fire_set_with_combo,
        order_with_combo=order_with_combo,
        coverage=coverage,
        precision_no_combo=prec_no_combo,
        recall_no_combo=recall_no_combo,
        precision_with_combo=prec_with_combo,
        recall_with_combo=recall_with_combo,
        order_agreement_no_combo=order_agree_no_combo,
        order_agreement_with_combo=order_agree_with_combo,
        verdict=verdict,
    )


def format_report(results: list[QuestionResult]) -> str:
    """Generate a human-readable markdown report."""
    lines = []
    
    # Header
    lines.append("# Concept Path Comparison Report\n")
    lines.append(f"**Generated:** {pathlib.Path(__file__).parent / 'output'}\n")
    
    # Aggregate summary
    in_coverage = sum(1 for r in results if r.coverage == 1.0)
    out_coverage = len(results) - in_coverage
    mean_recall_no_combo = np.mean([r.recall_no_combo for r in results]) if results else 0.0
    mean_recall_with_combo = np.mean([r.recall_with_combo for r in results]) if results else 0.0
    mean_order_no_combo = np.mean([r.order_agreement_no_combo for r in results]) if results else 0.0
    mean_order_with_combo = np.mean([r.order_agreement_with_combo for r in results]) if results else 0.0
    
    helped = sum(1 for r in results if "helped" in r.verdict.lower())
    hurt = sum(1 for r in results if "hurt" in r.verdict.lower())
    no_change = len(results) - helped - hurt
    
    lines.append("## Aggregate Summary\n")
    lines.append(f"- **Total questions:** {len(results)}")
    lines.append(f"- **Full coverage:** {in_coverage} | **Partial coverage:** {out_coverage}")
    lines.append(f"- **Mean recall (no combinations):** {mean_recall_no_combo:.3f}")
    lines.append(f"- **Mean recall (with combinations):** {mean_recall_with_combo:.3f}")
    lines.append(f"- **Mean order agreement (no combinations):** {mean_order_no_combo:.3f}")
    lines.append(f"- **Mean order agreement (with combinations):** {mean_order_with_combo:.3f}")
    lines.append(f"- **Combinations impact:** +{helped} helped | -{hurt} hurt | {no_change} no change\n")
    
    # Per-question details
    lines.append("## Per-Question Analysis\n")
    
    for i, result in enumerate(results, 1):
        lines.append(f"### Question {i}\n")
        lines.append(f"**Text:** _{result.question_text[:100]}..._\n")
        lines.append(f"**Concept Path:** {result.concept_path_text}\n")
        
        lines.append("**Path Steps & Ingredient Mapping:**\n")
        for step in result.path_steps:
            if step.matched_ingredient_id:
                lines.append(f"  - `{step.text}` → `{step.matched_ingredient_id}` (score: {step.match_score:.2f})")
            else:
                lines.append(f"  - `{step.text}` → **no_ingredient_in_ontology**")
        
        lines.append(f"\n**Coverage:** {result.coverage:.0%}\n")
        
        lines.append("**Without Combinations:**")
        lines.append(f"  - Fire-set: {result.fire_set_no_combo}")
        lines.append(f"  - Order: {result.order_no_combo}")
        lines.append(f"  - Precision: {result.precision_no_combo:.3f} | Recall: {result.recall_no_combo:.3f}")
        lines.append(f"  - Order agreement: {result.order_agreement_no_combo:.3f}\n")
        
        lines.append("**With Combinations:**")
        lines.append(f"  - Fire-set: {result.fire_set_with_combo}")
        lines.append(f"  - Order: {result.order_with_combo}")
        lines.append(f"  - Precision: {result.precision_with_combo:.3f} | Recall: {result.recall_with_combo:.3f}")
        lines.append(f"  - Order agreement: {result.order_agreement_with_combo:.3f}\n")
        
        lines.append(f"**Verdict:** {result.verdict}\n")
        lines.append("---\n")
    
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(
        description="Compare human concept paths to engine-generated ingredient orders."
    )
    parser.add_argument(
        "--questions",
        type=str,
        default=None,
        help="Path to questions file (CSV or JSON). If not provided, generates sample data.",
    )
    parser.add_argument(
        "--min-overlap",
        type=float,
        default=0.5,
        help="Combination match threshold: fraction of a combination's "
             "ingredients that must be present for it to fire (default 0.5).",
    )
    parser.add_argument(
        "--concept-ontology",
        type=str,
        default="ml/data/ontology.json",
        help="Path to concept ontology JSON (separate-file schema).",
    )
    parser.add_argument(
        "--ingredient-ontology",
        type=str,
        default="ml/data/ingredient_ontology.json",
        help="Path to ingredient ontology JSON (separate-file schema).",
    )
    parser.add_argument(
        "--complete-ontology",
        type=str,
        default=None,
        help="Path to the standardized unified ontology (concepts + ingredients "
             "+ combinations in one file). When set, this overrides "
             "--concept-ontology / --ingredient-ontology and loads via "
             "load_complete_ontology — the same path serve.py uses.",
    )
    args = parser.parse_args()
    
    questions_file = args.questions
    if not questions_file:
        questions_file = load_sample_questions()
    
    if not pathlib.Path(questions_file).exists():
        print(f"Error: Questions file not found: {questions_file}")
        sys.exit(1)
    
    # Load ontologies
    print("Loading ontologies...")
    if args.complete_ontology:
        print(f"  using unified standardized ontology: {args.complete_ontology}")
        concept_ontology, ingredient_ontology = load_complete_ontology(args.complete_ontology)
    else:
        concept_ontology = Ontology.model_validate_json(pathlib.Path(args.concept_ontology).read_text())
        ingredient_ontology = IngredientOntology.model_validate_json(pathlib.Path(args.ingredient_ontology).read_text())
    ingredient_graph = IngredientGraph(ingredient_ontology)
    print(f"  concepts={len(concept_ontology.concepts)} ingredients={len(ingredient_ontology.ingredients)} "
          f"combinations={len(ingredient_ontology.combinations)}")
    
    # Load embeddings
    print("Loading embeddings...")
    model = embeddings.load_sentence_transformer()
    concept_embeddings_dict = embeddings.compute_concept_embeddings(concept_ontology, model)
    embed_fn = lambda text: model.encode(text)
    
    # Load questions
    print(f"Loading questions from {questions_file}...")
    questions = load_questions(questions_file)
    
    # Create empty student state
    student_state = IngredientStudentState(student_id="test_student")
    
    # Run comparisons
    print(f"Running {len(questions)} question(s) through the engine...")
    results = []
    for row in questions:
        result = run_question_comparison(
            row,
            ingredient_graph,
            concept_ontology,
            ingredient_ontology,
            student_state,
            embed_fn,
            concept_embeddings_dict,
            combination_min_overlap=args.min_overlap,
        )
        if result:
            results.append(result)
    
    # Generate report
    report = format_report(results)
    
    # Print to stdout
    print("\n" + "="*80)
    print(report)
    print("="*80 + "\n")
    
    # Write to file
    output_dir = pathlib.Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    report_file = output_dir / "concept_path_report.md"
    
    with open(report_file, 'w') as f:
        f.write(report)
    
    print(f"Report saved to: {report_file}")


if __name__ == "__main__":
    main()
