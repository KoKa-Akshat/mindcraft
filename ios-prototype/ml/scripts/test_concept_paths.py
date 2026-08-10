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
import random
import sys
from dataclasses import dataclass
from typing import Any

import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.engine.ingredient_pipeline import recommend_cards
from mindcraft_graph.engine.ingredient_runtime import classify_problem
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology
from mindcraft_graph.models.concept import Concept, Ontology, build_concept_id_registry
from mindcraft_graph.models.ingredient import IngredientOntology, IngredientStudentState
from mindcraft_graph.representation import embeddings
from mindcraft_graph.representation import classification_index as classifier_index


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
    expected_concept_id: str
    predicted_concept_ids: list[str]
    overlap_cluster: str | None

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


def load_bank_holdout(
    bank_paths: list[pathlib.Path], fraction: float, seed: int, concept_registry: dict[str, str]
) -> list[dict[str, Any]]:
    """Return a deterministic, concept-stratified held-out bank sample."""
    by_concept: dict[str, list[dict[str, Any]]] = {}
    for path in bank_paths:
        for question in json.loads(path.read_text()):
            source_id = question.get("conceptId", "")
            if source_id not in concept_registry:
                raise ValueError(f"Unresolved bank conceptId {source_id!r} in {path}")
            concept_id = concept_registry[source_id]
            row = dict(question)
            row["expected_concept_id"] = concept_id
            by_concept.setdefault(concept_id, []).append(row)
    rng = random.Random(seed)
    heldout: list[dict[str, Any]] = []
    for concept_id in sorted(by_concept):
        rows = by_concept[concept_id]
        rng.shuffle(rows)
        count = max(1, round(len(rows) * fraction)) if len(rows) > 1 else 0
        heldout.extend(rows[:min(count, len(rows) - 1)])
    return heldout


def format_bank_accuracy_report(
    questions: list[dict[str, Any]], classification_idx, embed_fn, ontology, holdout_frac: float, seed: int
) -> str:
    per_concept: dict[str, list[bool]] = {}
    top1_hits = top3_hits = gated_rank2 = rank2_total = 0
    archetype_bridges = {
        entry.archetype_id: set(entry.bridge_concept_ids)
        for entry in classification_idx.entries if entry.archetype_id
    }
    cross_cutting = {concept.id for concept in ontology.concepts if concept.level == "cross_cutting"}
    for question in questions:
        result = classify_problem(
            question.get("question") or question.get("stem") or question.get("text") or "",
            {}, embed_fn, ontology, classification_index=classification_idx,
            classifier_mode="bank",
        )
        ranked = list(result.concept_scores)[:3]
        expected = question["expected_concept_id"]
        hit = bool(ranked and ranked[0] == expected)
        top1_hits += int(hit)
        top3_hits += int(expected in ranked)
        per_concept.setdefault(expected, []).append(hit)
        if len(ranked) > 1:
            rank2_total += 1
            allowed = cross_cutting.copy()
            for archetype_id in result.archetype_ids:
                allowed.update(archetype_bridges.get(archetype_id, set()))
            gated_rank2 += int(ranked[1] in allowed)
    total = len(questions)
    lines = [
        "# Held-out bank concept placement report", "",
        f"- Split: `{holdout_frac:.3f}` with seed `{seed}`; {total} evaluation questions excluded from the index",
        f"- Top-1 accuracy: **{top1_hits / total:.3f}** ({top1_hits}/{total})",
        f"- Top-3 accuracy: **{top3_hits / total:.3f}** ({top3_hits}/{total})",
        f"- Rank-2 ontology gate: **{gated_rank2 / rank2_total:.3f}** ({gated_rank2}/{rank2_total}) bridge/cross-cutting; remainder sibling/confusion",
        "", "## Per-concept top-1", "",
        "| Concept | Correct | Total | Accuracy |", "|---|---:|---:|---:|",
    ]
    for concept_id, hits in sorted(per_concept.items()):
        lines.append(f"| `{concept_id}` | {sum(hits)} | {len(hits)} | {sum(hits) / len(hits):.3f} |")
    return "\n".join(lines) + "\n"


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
    classification_index=None,
    classifier_mode: str = "concept",
    ingredient_embeddings: dict[str, np.ndarray] | None = None,
    step_matches: dict[str, tuple[str | None, float]] | None = None,
    secondary_margin: float = 0.0,
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
    if ingredient_embeddings is None:
        ingredient_embeddings = {}
        for ing in ingredient_ontology.ingredients:
            ing_text = f"{ing.name} {ing.description}"
            ingredient_embeddings[ing.id] = embed_fn(ing_text)
    
    for step_text in path_steps_text:
        if step_matches is not None and step_text in step_matches:
            matched_id, match_score = step_matches[step_text]
        else:
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
        classification_index=classification_index,
        classifier_mode=classifier_mode,
        secondary_margin=secondary_margin,
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
        classification_index=classification_index,
        classifier_mode=classifier_mode,
        secondary_margin=secondary_margin,
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
        expected_concept_id=question_row.get("expected_concept_id", ""),
        predicted_concept_ids=[
            result_no_combo.problem_features.primary_concept,
            *result_no_combo.problem_features.secondary_concepts,
        ],
        overlap_cluster=question_row.get("overlap_cluster") or None,
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


def format_report(
    results: list[QuestionResult],
    classifier_mode: str,
    secondary_margin: float,
    exclude_evaluation_seeds: bool = False,
) -> str:
    """Generate a human-readable markdown report."""
    lines = []
    
    # Header
    lines.append("# Concept Path Comparison Report\n")
    lines.append(f"**Classifier:** `{classifier_mode}`\n")
    if classifier_mode == "archetype":
        lines.append(f"**Secondary margin τ:** `{secondary_margin:.3f}`\n")
        lines.append(
            f"**Evaluation seeds excluded:** `{exclude_evaluation_seeds}`\n"
        )
    lines.append(f"**Generated:** {pathlib.Path(__file__).parent / 'output'}\n")
    
    # Aggregate summary
    in_coverage = sum(1 for r in results if r.coverage == 1.0)
    out_coverage = len(results) - in_coverage
    mean_recall_no_combo = np.mean([r.recall_no_combo for r in results]) if results else 0.0
    mean_recall_with_combo = np.mean([r.recall_with_combo for r in results]) if results else 0.0
    mean_precision_no_combo = np.mean([r.precision_no_combo for r in results]) if results else 0.0
    mean_precision_with_combo = np.mean([r.precision_with_combo for r in results]) if results else 0.0
    mean_order_no_combo = np.mean([r.order_agreement_no_combo for r in results]) if results else 0.0
    mean_order_with_combo = np.mean([r.order_agreement_with_combo for r in results]) if results else 0.0
    
    helped = sum(1 for r in results if "helped" in r.verdict.lower())
    hurt = sum(1 for r in results if "hurt" in r.verdict.lower())
    no_change = len(results) - helped - hurt
    tagged = [result for result in results if result.expected_concept_id]
    concept_hits = sum(
        result.expected_concept_id in result.predicted_concept_ids
        for result in tagged
    )
    
    lines.append("## Aggregate Summary\n")
    lines.append(f"- **Total questions:** {len(results)}")
    lines.append(f"- **Full coverage:** {in_coverage} | **Partial coverage:** {out_coverage}")
    lines.append(f"- **Mean precision (no combinations):** {mean_precision_no_combo:.3f}")
    lines.append(f"- **Mean precision (with combinations):** {mean_precision_with_combo:.3f}")
    lines.append(f"- **Mean recall (no combinations):** {mean_recall_no_combo:.3f}")
    lines.append(f"- **Mean recall (with combinations):** {mean_recall_with_combo:.3f}")
    lines.append(f"- **Mean order agreement (no combinations):** {mean_order_no_combo:.3f}")
    lines.append(f"- **Mean order agreement (with combinations):** {mean_order_with_combo:.3f}")
    lines.append(f"- **Combinations impact:** +{helped} helped | -{hurt} hurt | {no_change} no change\n")
    if tagged:
        lines.append(
            f"- **Concept-tag accuracy:** {concept_hits}/{len(tagged)} "
            f"({concept_hits / len(tagged):.1%})\n"
        )
        lines.append("## Ingredient-Overlap Cluster Separation\n")
        for cluster in sorted({result.overlap_cluster for result in tagged if result.overlap_cluster}):
            cluster_results = [result for result in tagged if result.overlap_cluster == cluster]
            cluster_hits = sum(
                result.expected_concept_id in result.predicted_concept_ids
                for result in cluster_results
            )
            lines.append(
                f"- **{cluster}:** {cluster_hits}/{len(cluster_results)} "
                f"({cluster_hits / len(cluster_results):.1%}) kept their expected concept"
            )
        lines.append("")
    
    # Per-question details
    lines.append("## Per-Question Analysis\n")
    
    for i, result in enumerate(results, 1):
        lines.append(f"### Question {i}\n")
        lines.append(f"**Text:** _{result.question_text[:100]}..._\n")
        lines.append(f"**Concept Path:** {result.concept_path_text}\n")
        if result.expected_concept_id:
            lines.append(
                f"**Concept classification:** expected `{result.expected_concept_id}`; "
                f"predicted `{result.predicted_concept_ids}`\n"
            )
        
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
        "--exclude-evaluation-seeds",
        action="store_true",
        help="Leave evaluation question instances out of Layer 3 exemplars.",
    )
    parser.add_argument(
        "--secondary-margin",
        type=float,
        default=0.0,
        help="Archetype secondary-concept score margin tau (default: 0.0).",
    )
    parser.add_argument(
        "--classifier",
        choices=("concept", "archetype", "bank"),
        default="concept",
        help="Classifier implementation to measure (default: concept baseline).",
    )
    parser.add_argument("--holdout-frac", type=float, default=0.0,
                        help="Deterministic stratified bank holdout fraction (bank mode).")
    parser.add_argument("--split-seed", type=int, default=42,
                        help="Fixed seed for --holdout-frac (default: 42).")
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
    if not 0.0 <= args.holdout_frac < 1.0:
        parser.error("--holdout-frac must be in [0, 1)")

    repo_root = pathlib.Path(__file__).resolve().parents[2]
    raw_bank_paths = [
        repo_root / "app/src/data/eediQuestions.json",
        repo_root / "app/src/data/actMasterQuestionBank.generated.json",
    ]
    concept_payload = json.loads(
        (repo_root / "ml/data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json").read_text()
    )
    concept_registry = build_concept_id_registry(
        [Concept.model_validate(item) for item in concept_payload["concepts"]]
    )
    heldout_questions = (
        load_bank_holdout(raw_bank_paths, args.holdout_frac, args.split_seed, concept_registry)
        if args.classifier == "bank" and args.holdout_frac > 0
        else None
    )
    questions_file = args.questions
    if not questions_file and heldout_questions is None:
        questions_file = load_sample_questions()
    if questions_file and not pathlib.Path(questions_file).exists():
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

    print(f"Loading questions from {questions_file or 'deterministic bank holdout'}...")
    questions = heldout_questions or load_questions(questions_file)
    
    # Load embeddings
    print("Loading embeddings...")
    model = embeddings.load_sentence_transformer()
    concept_embeddings_dict = embeddings.compute_concept_embeddings(concept_ontology, model)
    classification_idx = None
    if args.classifier in {"archetype", "bank"}:
        if not args.complete_ontology:
            raise ValueError("--classifier archetype requires --complete-ontology")
        ontology_dir = pathlib.Path(args.complete_ontology).parent
        layer2_path = ontology_dir / "02_question_archetype_ontology_v1_6_standardized.json"
        layer3_path = ontology_dir / "03_question_instance_bank_schema_and_seed_v1_6.json"
        classification_idx = classifier_index.build_classification_index(
            concept_ontology,
            ingredient_ontology,
            layer2_path,
            layer3_path,
            model,
            source_paths=[args.complete_ontology, layer2_path, layer3_path],
            include_seed_stems=True,
            excluded_question_instance_ids=(
                {
                    question["question_instance_id"]
                    for question in questions
                    if question.get("question_instance_id")
                }
                if args.exclude_evaluation_seeds
                else None
            ),
            bank_index_path=(repo_root / "ml/data/bank_index.npz") if args.classifier == "bank" else None,
            bank_metadata_path=(repo_root / "ml/data/bank_index_meta.json") if args.classifier == "bank" else None,
            excluded_bank_question_ids=(
                {question["id"] for question in questions}
                if args.classifier == "bank" and args.holdout_frac > 0
                else None
            ),
        )
    if args.classifier == "bank" and heldout_questions is not None:
        question_texts = [q.get("question") or q.get("stem") or q.get("text") or "" for q in questions]
        question_vectors = model.encode(question_texts, convert_to_numpy=True)
        problem_vectors = dict(zip(question_texts, question_vectors))
        report = format_bank_accuracy_report(
            questions, classification_idx, lambda text: problem_vectors[text],
            concept_ontology, args.holdout_frac, args.split_seed,
        )
        print("\n" + report)
        output_dir = pathlib.Path(__file__).parent / "output"
        output_dir.mkdir(exist_ok=True)
        report_file = output_dir / "concept_path_report_bank_heldout.md"
        report_file.write_text(report)
        print(f"Report saved to: {report_file}")
        return
    ingredient_texts = [f"{ing.name} {ing.description}" for ing in ingredient_ontology.ingredients]
    ingredient_vectors = model.encode(ingredient_texts, convert_to_numpy=True)
    ingredient_embeddings = {
        ingredient.id: vector
        for ingredient, vector in zip(ingredient_ontology.ingredients, ingredient_vectors)
    }

    question_texts = [question.get("exact_question_text", "") for question in questions]
    question_vectors = model.encode(question_texts, convert_to_numpy=True)
    problem_vectors = dict(zip(question_texts, question_vectors))

    def embed_fn(text: str):
        vector = problem_vectors.get(text)
        return vector if vector is not None else model.encode(text)

    unique_steps = sorted({
        step.strip()
        for question in questions
        for step in re.split(r"\s*(?:->|→)\s*", question.get("concept_path", ""))
        if step.strip()
    })
    step_vectors = model.encode(unique_steps, convert_to_numpy=True)
    ingredient_ids = [ingredient.id for ingredient in ingredient_ontology.ingredients]
    similarity_matrix = cosine_similarity(step_vectors, ingredient_vectors)
    step_matches = {}
    for step, similarities in zip(unique_steps, similarity_matrix):
        best_idx = int(np.argmax(similarities))
        step_matches[step] = (ingredient_ids[best_idx], float(similarities[best_idx]))
    
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
            classification_index=classification_idx,
            classifier_mode=args.classifier,
            ingredient_embeddings=ingredient_embeddings,
            step_matches=step_matches,
            secondary_margin=args.secondary_margin,
        )
        if result:
            results.append(result)
    
    # Generate report
    report = format_report(
        results,
        args.classifier,
        args.secondary_margin,
        args.exclude_evaluation_seeds,
    )
    
    # Print to stdout
    print("\n" + "="*80)
    print(report)
    print("="*80 + "\n")
    
    # Write to file
    output_dir = pathlib.Path(__file__).parent / "output"
    output_dir.mkdir(exist_ok=True)
    suffix = (
        f"_tau_{args.secondary_margin:.3f}".replace(".", "_")
        if args.classifier == "archetype"
        else ""
    )
    if args.exclude_evaluation_seeds:
        suffix += "_heldout"
    report_file = output_dir / f"concept_path_report_{args.classifier}{suffix}.md"
    
    with open(report_file, 'w') as f:
        f.write(report)
    
    print(f"Report saved to: {report_file}")


if __name__ == "__main__":
    main()
