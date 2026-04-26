"""
Runtime algorithm for the ingredient graph.

Problem -> classify -> extract features -> select target ingredients
-> backtrack prerequisites -> build DAG -> prune by student state
-> detect weak nodes/edges -> select cards -> order by DAG
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import numpy as np

from mindcraft_graph.engine.ingredient_graph import IngredientGraph
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.ingredient import (
    Bridge,
    BridgeConfidence,
    CardTemplate,
    Ingredient,
    IngredientMastery,
    IngredientStudentState,
    ProblemFeatures,
)


@dataclass
class DAGNode:
    """A node in the minimal dependency DAG."""

    ingredient_id: str
    concept_id: str
    mastery: float = 0.0
    need_score: float = 1.0
    is_target: bool = False
    is_pruned: bool = False


@dataclass
class DAGEdge:
    """An edge in the minimal dependency DAG."""

    from_id: str
    to_id: str
    edge_type: str
    confidence: float = 0.0
    need_score: float = 1.0
    bridge_id: str | None = None


@dataclass
class MinimalDAG:
    """The constructed dependency subgraph for one problem."""

    nodes: dict[str, DAGNode]
    edges: list[DAGEdge]
    target_ingredients: list[str]
    backtracked_ingredients: list[str]


@dataclass
class CardRecommendation:
    """One card to show the student."""

    card_template_id: str
    target_type: str
    target_id: str
    representation_key: str
    title: str
    body: str
    prompt: str
    need_score: float
    reason: str


@dataclass
class IngredientRecommendationResult:
    """Complete result from the runtime algorithm."""

    problem_features: ProblemFeatures
    minimal_dag: MinimalDAG
    cards: list[CardRecommendation]
    composition_prompt: str
    hidden_answer: str


@dataclass
class WeakTarget:
    """An ingredient or bridge that needs instructional intervention."""

    target_type: str
    target_id: str
    need_score: float
    from_id: str | None = None
    to_id: str | None = None


def classify_problem(
    problem_text: str,
    concept_embeddings: dict[str, np.ndarray],
    embed_fn,
    ontology: Ontology,
    top_n: int = 3,
) -> ProblemFeatures:
    """
    Classify a problem into concepts and extract coarse features.

    The ontology parameter is kept for future use and API symmetry.
    """
    _ = ontology
    problem_vec = embed_fn(problem_text)

    scored: list[tuple[str, float]] = []
    for concept_id, concept_vec in concept_embeddings.items():
        similarity = float(
            np.dot(problem_vec, concept_vec)
            / (np.linalg.norm(problem_vec) * np.linalg.norm(concept_vec) + 1e-8)
        )
        scored.append((concept_id, similarity))

    if not scored:
        return ProblemFeatures(primary_concept="", secondary_concepts=[], features=[])

    scored.sort(key=lambda item: -item[1])
    primary = scored[0][0]
    secondary = [concept_id for concept_id, _ in scored[1:top_n]]

    return ProblemFeatures(
        primary_concept=primary,
        secondary_concepts=secondary,
        features=_extract_features(problem_text),
    )


def _extract_features(text: str) -> list[str]:
    """Simple keyword-based feature extraction."""
    text_lower = text.lower()
    feature_keywords = {
        "height": ["height", "tall", "above", "elevation", "vertical"],
        "circle": ["circle", "circular", "wheel", "orbit", "rotation"],
        "radius": ["radius", "radii"],
        "angle": ["angle", "theta", "degrees", "radians"],
        "vertical_motion": ["up and down", "vertical", "oscillat", "periodic"],
        "center_height": ["center", "middle", "midpoint", "axis"],
        "slope": ["slope", "rate of change", "steepness"],
        "area": ["area", "surface", "region"],
        "volume": ["volume", "capacity"],
        "distance": ["distance", "far", "between", "length"],
        "speed": ["speed", "velocity", "rate", "fast"],
        "growth": ["grow", "increase", "exponential", "compound"],
        "decay": ["decay", "decrease", "depreciat", "half-life"],
        "probability": ["probability", "chance", "likely", "odds"],
        "equation": ["solve", "find x", "equation", "equal"],
        "graph": ["graph", "plot", "sketch", "curve"],
        "maximum": ["maximum", "max", "greatest", "peak"],
        "minimum": ["minimum", "min", "least", "lowest"],
    }

    detected: list[str] = []
    for feature, keywords in feature_keywords.items():
        if any(keyword in text_lower for keyword in keywords):
            detected.append(feature)
    return detected


def select_target_ingredients(
    concept_id: str,
    features: list[str],
    graph: IngredientGraph,
) -> list[str]:
    """
    Select the most relevant ingredients for the classified concept.
    """
    ingredients = graph.get_concept_ingredients(concept_id)
    if not ingredients:
        return []

    if not features:
        return [ingredient.id for ingredient in ingredients]

    feature_set = set(features)
    scored: list[tuple[str, int]] = []
    for ingredient in ingredients:
        overlap = len(set(ingredient.tags) & feature_set)
        scored.append((ingredient.id, overlap))

    relevant = [ingredient_id for ingredient_id, overlap in scored if overlap > 0]
    if not relevant:
        return [ingredient.id for ingredient in ingredients]
    return relevant


def backtrack_prerequisites(
    target_ingredient_ids: list[str],
    graph: IngredientGraph,
    max_depth: int = 3,
) -> tuple[set[str], list[Bridge]]:
    """
    Walk backwards from target ingredients to collect prerequisites.
    """
    prerequisite_ids: set[str] = set()
    used_bridges: list[Bridge] = []
    visited = set(target_ingredient_ids)
    frontier = list(target_ingredient_ids)

    for _depth in range(max_depth):
        next_frontier: list[str] = []

        for ingredient_id in frontier:
            ingredient = graph.get_ingredient(ingredient_id)
            if ingredient is not None:
                for dependency_id in ingredient.depends_on:
                    if dependency_id not in visited:
                        prerequisite_ids.add(dependency_id)
                        visited.add(dependency_id)
                        next_frontier.append(dependency_id)

            for bridge in graph.get_bridges_into(ingredient_id):
                if bridge.from_ingredient not in visited:
                    prerequisite_ids.add(bridge.from_ingredient)
                    visited.add(bridge.from_ingredient)
                    next_frontier.append(bridge.from_ingredient)
                    used_bridges.append(bridge)

        frontier = next_frontier
        if not frontier:
            break

    return prerequisite_ids, used_bridges


def build_minimal_dag(
    target_ids: list[str],
    prereq_ids: set[str],
    used_bridges: list[Bridge],
    graph: IngredientGraph,
    student_state: IngredientStudentState,
) -> MinimalDAG:
    """Construct the dependency subgraph for the current problem."""
    all_ids = set(target_ids) | prereq_ids
    nodes: dict[str, DAGNode] = {}
    edges: list[DAGEdge] = []

    for ingredient_id in all_ids:
        ingredient = graph.get_ingredient(ingredient_id)
        if ingredient is None:
            continue

        mastery_state = student_state.ingredient_mastery.get(ingredient_id)
        mastery = mastery_state.mastery if mastery_state is not None else 0.0
        nodes[ingredient_id] = DAGNode(
            ingredient_id=ingredient_id,
            concept_id=ingredient.concept_id,
            mastery=mastery,
            need_score=1.0 - mastery,
            is_target=ingredient_id in target_ids,
        )

    for ingredient_id in all_ids:
        ingredient = graph.get_ingredient(ingredient_id)
        if ingredient is None:
            continue
        for dependency_id in ingredient.depends_on:
            if dependency_id in all_ids:
                edges.append(
                    DAGEdge(
                        from_id=dependency_id,
                        to_id=ingredient_id,
                        edge_type="intra_dependency",
                        confidence=1.0,
                        need_score=0.0,
                    )
                )

    for bridge in used_bridges:
        if bridge.from_ingredient not in all_ids or bridge.to_ingredient not in all_ids:
            continue

        bridge_key = f"{bridge.from_ingredient}->{bridge.to_ingredient}"
        bridge_state = student_state.bridge_confidence.get(bridge_key)
        confidence = bridge_state.confidence if bridge_state is not None else 0.0
        edges.append(
            DAGEdge(
                from_id=bridge.from_ingredient,
                to_id=bridge.to_ingredient,
                edge_type="bridge",
                confidence=confidence,
                need_score=1.0 - confidence,
                bridge_id=bridge.id,
            )
        )

    return MinimalDAG(
        nodes=nodes,
        edges=edges,
        target_ingredients=list(target_ids),
        backtracked_ingredients=list(prereq_ids),
    )


def prune_mastered_nodes(
    dag: MinimalDAG,
    mastery_threshold: float = 0.8,
    bridge_confidence_threshold: float = 0.7,
) -> MinimalDAG:
    """Mark mastered nodes as pruned when all outgoing bridges are strong."""
    for node_id, node in dag.nodes.items():
        if node.mastery < mastery_threshold:
            continue

        outgoing_edges = [edge for edge in dag.edges if edge.from_id == node_id]
        all_bridges_confident = all(
            edge.confidence >= bridge_confidence_threshold
            for edge in outgoing_edges
            if edge.edge_type == "bridge"
        )
        if all_bridges_confident:
            node.is_pruned = True

    return dag


def detect_weak_targets(
    dag: MinimalDAG,
    max_targets: int = 4,
) -> list[WeakTarget]:
    """Score non-pruned nodes and bridges, preferring bridge failures."""
    targets: list[WeakTarget] = []

    for edge in dag.edges:
        if edge.edge_type != "bridge":
            continue

        from_node = dag.nodes.get(edge.from_id)
        to_node = dag.nodes.get(edge.to_id)
        if (
            from_node is not None
            and from_node.is_pruned
            and to_node is not None
            and to_node.is_pruned
        ):
            continue

        targets.append(
            WeakTarget(
                target_type="bridge",
                target_id=f"{edge.from_id}->{edge.to_id}",
                need_score=edge.need_score * 1.5,
                from_id=edge.from_id,
                to_id=edge.to_id,
            )
        )

    for node_id, node in dag.nodes.items():
        if node.is_pruned:
            continue
        targets.append(
            WeakTarget(
                target_type="ingredient",
                target_id=node_id,
                need_score=node.need_score,
            )
        )

    targets.sort(key=lambda target: -target.need_score)
    return targets[:max_targets]


def select_cards(
    weak_targets: list[WeakTarget],
    graph: IngredientGraph,
    student_state: IngredientStudentState,
    style_priority: list[str] | None = None,
) -> list[CardRecommendation]:
    """Select styled cards for the highest-need ingredients and bridges."""
    _ = student_state
    if style_priority is None:
        style_priority = ["geometric", "algebraic", "verbal"]

    cards: list[CardRecommendation] = []
    for target in weak_targets:
        templates = graph.get_cards_for(target.target_id)
        if not templates:
            if target.target_type != "ingredient":
                continue

            ingredient = graph.get_ingredient(target.target_id)
            if ingredient is None:
                continue

            representation_key = style_priority[0] if style_priority else "verbal"
            cards.append(
                CardRecommendation(
                    card_template_id=f"auto::{ingredient.id}",
                    target_type="ingredient",
                    target_id=ingredient.id,
                    representation_key=representation_key,
                    title=ingredient.name,
                    body=ingredient.description,
                    prompt=(
                        f"Explain {ingredient.name.lower()} in your own words and "
                        "show where it appears in this problem."
                    ),
                    need_score=target.need_score,
                    reason=(
                        f"No authored card exists yet for {ingredient.id}, so this "
                        "fallback card surfaces the core idea directly."
                    ),
                )
            )
            continue

        template: CardTemplate = templates[0]
        representation = None
        representation_key = "verbal"
        for style in style_priority:
            if style in template.representations:
                representation = template.representations[style]
                representation_key = style
                break

        if representation is None:
            representation_key = next(iter(template.representations))
            representation = template.representations[representation_key]

        if target.target_type == "bridge":
            reason = (
                "You understand both sides of this transition, but connecting "
                f"{target.from_id} to {target.to_id} is where you're getting stuck."
            )
        else:
            reason = (
                f"Your mastery of {target.target_id} is at "
                f"{1 - target.need_score:.0%}. This card builds the missing understanding."
            )

        cards.append(
            CardRecommendation(
                card_template_id=template.id,
                target_type=target.target_type,
                target_id=target.target_id,
                representation_key=representation_key,
                title=representation.title,
                body=representation.body,
                prompt=template.prompt,
                need_score=target.need_score,
                reason=reason,
            )
        )

    return cards


def order_cards_by_dag(
    cards: list[CardRecommendation],
    dag: MinimalDAG,
) -> list[CardRecommendation]:
    """Topologically order cards so prerequisites come first."""
    in_degree: dict[str, int] = {}
    adjacency: dict[str, list[str]] = {}
    all_node_ids: set[str] = set()

    for edge in dag.edges:
        all_node_ids.add(edge.from_id)
        all_node_ids.add(edge.to_id)
        in_degree.setdefault(edge.from_id, 0)
        in_degree.setdefault(edge.to_id, 0)
        in_degree[edge.to_id] += 1
        adjacency.setdefault(edge.from_id, []).append(edge.to_id)

    queue = [node_id for node_id in all_node_ids if in_degree.get(node_id, 0) == 0]
    topo_order: list[str] = []
    while queue:
        node_id = queue.pop(0)
        topo_order.append(node_id)
        for neighbor in adjacency.get(node_id, []):
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    order_map = {node_id: index for index, node_id in enumerate(topo_order)}

    def card_sort_key(card: CardRecommendation) -> int:
        if card.target_type == "bridge":
            parts = card.target_id.split("->")
            primary = parts[0] if parts else card.target_id
        else:
            primary = card.target_id
        return order_map.get(primary, 999)

    return sorted(cards, key=card_sort_key)


def generate_composition_prompt(
    target_ingredients: list[str],
    graph: IngredientGraph,
    problem_features: ProblemFeatures,
) -> tuple[str, str]:
    """Generate the assembly challenge shown after the cards."""
    pieces: list[str] = []
    for ingredient_id in target_ingredients:
        ingredient = graph.get_ingredient(ingredient_id)
        if ingredient is not None:
            pieces.append(ingredient.name)

    pieces_str = "\n".join(f"  - {piece}" for piece in pieces)
    target = problem_features.target_quantity or "the answer"

    composition_prompt = (
        "You have these building blocks:\n"
        f"{pieces_str}\n\n"
        f"How do these combine to find {target}?"
    )
    hidden_answer = " + ".join(pieces)
    return composition_prompt, hidden_answer


def update_ingredient_state(
    student_state: IngredientStudentState,
    card: CardRecommendation,
    student_succeeded: bool,
    concept_level_strength: float = 0.0,
) -> IngredientStudentState:
    """
    Update ingredient mastery and bridge confidence after a card interaction.

    The concept-level strength parameter is kept for future blending logic.
    """
    _ = concept_level_strength
    delta = 0.15 if student_succeeded else -0.05

    if card.target_type == "ingredient":
        ingredient_id = card.target_id
        current = student_state.ingredient_mastery.get(ingredient_id)
        if current is None:
            current = IngredientMastery(ingredient_id=ingredient_id)

        new_mastery = max(0.0, min(1.0, current.mastery + delta))
        new_outcome = 1.0 if student_succeeded else -0.5
        student_state.ingredient_mastery[ingredient_id] = IngredientMastery(
            ingredient_id=ingredient_id,
            mastery=new_mastery,
            attempts=current.attempts + 1,
            last_outcome=new_outcome,
            cumulative_outcome=current.cumulative_outcome + new_outcome,
        )

    elif card.target_type == "bridge":
        bridge_key = card.target_id
        current = student_state.bridge_confidence.get(bridge_key)
        parts = bridge_key.split("->")

        if current is None:
            current = BridgeConfidence(
                bridge_id=bridge_key,
                from_ingredient=parts[0] if len(parts) > 0 else "",
                to_ingredient=parts[1] if len(parts) > 1 else "",
            )

        new_confidence = max(0.0, min(1.0, current.confidence + delta))
        new_successes = current.successes + (1 if student_succeeded else 0)
        student_state.bridge_confidence[bridge_key] = BridgeConfidence(
            bridge_id=bridge_key,
            from_ingredient=current.from_ingredient,
            to_ingredient=current.to_ingredient,
            confidence=new_confidence,
            attempts=current.attempts + 1,
            successes=new_successes,
        )

    style = card.representation_key
    if student_succeeded:
        current_score = student_state.style_scores.get(style, 0.5)
        student_state.style_scores[style] = min(1.0, current_score + 0.05)

    return student_state


def aggregate_to_concept_mastery(
    student_state: IngredientStudentState,
    concept_id: str,
    graph: IngredientGraph,
) -> float:
    """
    Aggregate ingredient-level mastery back into a concept-level score.
    """
    ingredients = graph.get_concept_ingredients(concept_id)
    if not ingredients:
        return 0.0

    total_weight = 0.0
    weighted_sum = 0.0
    for ingredient in ingredients:
        weight = 1.0 + len(ingredient.depends_on) * 0.5
        mastery_state = student_state.ingredient_mastery.get(ingredient.id)
        mastery = mastery_state.mastery if mastery_state is not None else 0.0
        weighted_sum += weight * mastery
        total_weight += weight

    if total_weight < 1e-6:
        return 0.0
    return weighted_sum / total_weight
