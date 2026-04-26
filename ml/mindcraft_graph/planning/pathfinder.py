# mindcraft_graph/planning/pathfinder.py

"""
Prerequisite-chain pathfinder with learning-style personalization.
"""

from __future__ import annotations

import numpy as np

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.engine.student_graph import PersonalGraph
from mindcraft_graph.engine.features import ConceptProfile
from mindcraft_graph.planning.goal import Goal


# ── Step 1: Extract prerequisite chain ──

def get_prerequisite_chain(
    target_concept: str,
    ontology: Ontology,
) -> list[str]:
    """
    Walk backwards from target through prerequisite edges.
    Returns the canonical learning sequence ending at target.
    
    If multiple prerequisites exist for a concept, follows
    the one with highest strength (most essential prereq).
    """
    # Build reverse prerequisite lookup: concept → its prerequisites
    prereqs: dict[str, list[tuple[str, float]]] = {}
    for edge in ontology.edges:
        if edge.relation == "prerequisite":
            to_id = edge.to_concept
            from_id = edge.from_concept
            if to_id not in prereqs:
                prereqs[to_id] = []
            prereqs[to_id].append((from_id, edge.strength))

    # Walk backwards from target
    chain = [target_concept]
    current = target_concept
    visited = {target_concept}

    while current in prereqs:
        # Pick the strongest prerequisite (most essential)
        candidates = [
            (cid, strength) for cid, strength in prereqs[current]
            if cid not in visited
        ]
        if not candidates:
            break

        best_prereq = max(candidates, key=lambda x: x[1])[0]
        chain.append(best_prereq)
        visited.add(best_prereq)
        current = best_prereq

    chain.reverse()  # foundational → target
    return chain


def get_multi_target_chain(
    target_concepts: list[str],
    ontology: Ontology,
) -> list[str]:
    """
    For multiple targets, merge their prerequisite chains
    into a single ordered sequence respecting all dependencies.
    """
    # Get chain for each target
    all_chains = [
        get_prerequisite_chain(target, ontology)
        for target in target_concepts
    ]

    # Merge: topological sort preserving order within each chain
    seen = set()
    merged = []
    
    # Sort chains by length (shortest/most foundational first)
    all_chains.sort(key=len)
    
    for chain in all_chains:
        for concept in chain:
            if concept not in seen:
                merged.append(concept)
                seen.add(concept)

    return merged


# ── Step 2: Trim based on mastery ──

def trim_chain(
    chain: list[str],
    profiles: dict[str, ConceptProfile],
    graph: PersonalGraph,
    mastery_threshold: float = 0.0,
    min_events: int = 1,
) -> list[str]:
    """
    Trim the prerequisite chain based on three-state classification.
    
    Mastered: positive strength with evidence → remove from chain
    Struggling: negative strength with evidence → KEEP (never skip)
    Unknown: no evidence → presume mastered only if successor is mastered
    """
    # Classify each concept
    MASTERED = "mastered"
    STRUGGLING = "struggling"
    UNKNOWN = "unknown"

    status: dict[str, str] = {}

    for concept_id in chain:
        profile = profiles.get(concept_id)
        mastery = graph.state.mastery_by_concept.get(concept_id)

        if profile is not None and profile.event_count >= min_events:
            # Has direct evidence
            if profile.strength_score >= mastery_threshold:
                status[concept_id] = MASTERED
            else:
                status[concept_id] = STRUGGLING
        elif mastery is not None and mastery.mastery > 0.4:
            # Mastery engine says they know it even without strong profile
            status[concept_id] = MASTERED
        else:
            status[concept_id] = UNKNOWN

    # Backward propagation: ONLY for unknowns
    # If an unknown concept's successor is mastered, presume mastered
    # NEVER override struggling — that's direct negative evidence
    changed = True
    while changed:
        changed = False
        for i in range(len(chain) - 1):
            if (status[chain[i]] == UNKNOWN
                    and status[chain[i + 1]] == MASTERED):
                status[chain[i]] = MASTERED
                changed = True

    # Build trimmed chain: keep struggling + unknown, remove mastered
    trimmed = [c for c in chain if status[c] != MASTERED]

    # Always include target
    if not trimmed and chain:
        trimmed = [chain[-1]]

    return trimmed


def get_mastered_chain_concepts(
    chain: list[str],
    graph: PersonalGraph,
    profiles: dict[str, ConceptProfile],
    mastery_threshold: float = 0.45,
    strength_threshold: float = 0.0,
    min_events: int = 1,
) -> list[str]:
    """
    Return concepts on the canonical chain that look already mastered.

    We use both the explicit mastery state and event-derived profile strength
    so the roadmap can start from any concept the student truly seems to own.
    """
    mastered: list[str] = []

    for concept_id in chain:
        mastery = graph.state.mastery_by_concept.get(concept_id)
        profile = profiles.get(concept_id)

        mastery_ok = mastery is not None and mastery.mastery >= mastery_threshold
        profile_ok = (
            profile is not None
            and profile.event_count >= min_events
            and profile.strength_score >= strength_threshold
        )

        if mastery_ok or profile_ok:
            mastered.append(concept_id)

    return mastered


def choose_roadmap_start(
    chain: list[str],
    graph: PersonalGraph,
    profiles: dict[str, ConceptProfile],
    goal: Goal,
) -> tuple[str | None, list[str], list[str]]:
    """
    Pick the start concept from the mastered concepts already on the roadmap.

    Returns:
    - start_concept: the mastered anchor or first concept if no anchor exists
    - mastered_anchors: all mastered concepts found on the chain
    - recommended_path: the remaining ontology roadmap from the next unmet step
    """
    if not chain:
        return None, [], []

    mastered_anchors = get_mastered_chain_concepts(chain, graph, profiles)
    if not mastered_anchors:
        return chain[0], [], chain

    anchor = mastered_anchors[-1]
    anchor_index = chain.index(anchor)

    # For goal-directed study, start at the first unmet concept after the
    # strongest mastered anchor. If the whole chain is already mastered,
    # keep the target as the final recommendation.
    if anchor_index + 1 < len(chain):
        recommended_path = chain[anchor_index + 1:]
    else:
        recommended_path = [chain[-1]]

    if goal.mode == "exam":
        # Exam mode stays strict: no backfilling before the anchor.
        start_concept = recommended_path[0]
    else:
        # Curriculum mode surfaces the mastered anchor as the base the learner
        # is launching from, even though recommendations start at the next gap.
        start_concept = anchor

    return start_concept, mastered_anchors, recommended_path


# ── Step 3: Personalize via substitution ──

def find_analogous_concepts(
    concept_id: str,
    student_strength_vec: np.ndarray,
    concept_embeddings: dict[str, np.ndarray],
    ontology: Ontology,
    profiles: dict[str, ConceptProfile],
    max_suggestions: int = 2,
    min_alignment: float = 0.3,
) -> list[tuple[str, float]]:
    """
    Find concepts that are related/application-linked to the given
    concept AND align with the student's learning style.
    
    These are potential supplements or swaps that teach similar
    skills through a lens the student resonates with.
    
    Returns list of (concept_id, alignment_score).
    """
    # Find related and application edges from ontology
    related_concepts = set()
    for edge in ontology.edges:
        if edge.relation in ("related", "application"):
            if edge.from_concept == concept_id:
                related_concepts.add(edge.to_concept)
            elif edge.to_concept == concept_id:
                related_concepts.add(edge.from_concept)

    if not related_concepts:
        return []

    concept_vec = concept_embeddings.get(concept_id)
    if concept_vec is None:
        return []

    # Score each related concept by alignment with student strength
    scored = []
    for related_id in related_concepts:
        if related_id not in concept_embeddings:
            continue

        # Skip concepts the student is already strong on
        profile = profiles.get(related_id)
        if profile and profile.strength_score > 0.5:
            continue

        related_vec = concept_embeddings[related_id]

        # Alignment = how well this concept matches the student's strengths
        strength_norm = np.linalg.norm(student_strength_vec)
        related_norm = np.linalg.norm(related_vec)
        if strength_norm < 1e-8 or related_norm < 1e-8:
            continue

        alignment = float(
            np.dot(student_strength_vec, related_vec)
            / (strength_norm * related_norm)
        )

        if alignment >= min_alignment:
            scored.append((related_id, alignment))

    scored.sort(key=lambda x: -x[1])
    return scored[:max_suggestions]


# ── Main entry point ──

def find_path(
    graph: PersonalGraph,
    goal: Goal,
    concept_embeddings: dict[str, np.ndarray],
    strength_vec: np.ndarray,
    profiles: dict[str, ConceptProfile],
    ontology: Ontology,
    events: list | None = None,  # kept for API compatibility
) -> dict:
    """
    Main pathfinder entry point.
    
    Returns a structured result:
    {
        "canonical_chain": [...],     # full prerequisite chain
        "trimmed_chain": [...],       # remaining roadmap after mastered anchor
        "supplements": {              # per-concept analogous suggestions
            "concept_id": [("analog_id", alignment), ...],
        },
        "start_concept": str,         # anchor/base concept for study
        "mastered_anchors": [...],    # mastered concepts on the roadmap
        "target_concepts": [...],     # goal targets
        "mode": str,
    }
    """
    if goal.mode == "explore":
        return _explore_recommendations(
            graph, concept_embeddings, strength_vec,
            profiles, ontology, goal,
        )

    # ── Exam / Curriculum: prerequisite-chain approach ──
    if not goal.target_concepts:
        return {
            "canonical_chain": [],
            "trimmed_chain": [],
            "supplements": {},
            "start_concept": None,
            "mastered_anchors": [],
            "target_concepts": [],
            "mode": goal.mode,
        }

    # Step 1: Get the canonical prerequisite chain
    if len(goal.target_concepts) == 1:
        canonical = get_prerequisite_chain(
            goal.target_concepts[0], ontology,
        )
    else:
        canonical = get_multi_target_chain(
            goal.target_concepts, ontology,
        )

    # Step 2: Anchor the route on mastered concepts already in the ontology path
# Step 2: Trim based on three-state classification
    trimmed = trim_chain(canonical, profiles, graph)
    start_concept = trimmed[0] if trimmed else None

    # Step 3: Find supplements for each remaining concept
    supplements = {}
    if goal.mode == "curriculum":
        # Only suggest supplements in curriculum mode
        # Exam mode follows the chain exactly
        for concept_id in trimmed:
            analogs = find_analogous_concepts(
                concept_id, strength_vec, concept_embeddings,
                ontology, profiles,
            )
            if analogs:
                supplements[concept_id] = analogs

    return {
        "canonical_chain": canonical,
        "trimmed_chain": trimmed,
        "supplements": supplements,
        "start_concept": start_concept,
        "mastered_anchors": [],  # or remove this key entirely
        "target_concepts": goal.target_concepts,
        "mode": goal.mode,
}


def _explore_recommendations(
    graph: PersonalGraph,
    concept_embeddings: dict[str, np.ndarray],
    strength_vec: np.ndarray,
    profiles: dict[str, ConceptProfile],
    ontology: Ontology,
    goal: Goal,
    max_recommendations: int = 8,
) -> dict:
    """
    Explore mode: no target. Recommend concepts the student
    hasn't tried that align with their learning style.
    """
    temp = max(0.01, goal.exploration_temp)
    all_concepts = {c.id for c in ontology.concepts}

    scored = []
    for concept_id in all_concepts:
        if concept_id not in concept_embeddings:
            continue

        profile = profiles.get(concept_id)

        # Novelty — prefer untouched concepts
        if profile is None or profile.event_count == 0:
            novelty = 1.0
        else:
            novelty = 1.0 / (1.0 + profile.event_count)

        # Strength alignment
        concept_vec = concept_embeddings[concept_id]
        strength_norm = np.linalg.norm(strength_vec)
        concept_norm = np.linalg.norm(concept_vec)
        if strength_norm < 1e-8 or concept_norm < 1e-8:
            alignment = 0.0
        else:
            alignment = float(
                np.dot(strength_vec, concept_vec)
                / (strength_norm * concept_norm)
            )

        # Temperature controls alignment influence
        # High temp → more uniform → more exploration
        # Low temp → alignment dominates → exploit strengths
        score = novelty * (1.0 + alignment / temp)

        # Prerequisite readiness (soft check for explore)
        prereqs_ok = _check_prereqs_simple(concept_id, ontology, profiles)
        if not prereqs_ok:
            score *= 0.3  # penalize but don't block

        scored.append((concept_id, score, alignment))

    scored.sort(key=lambda x: -x[1])
    recommendations = scored[:max_recommendations]

    return {
        "canonical_chain": [],
        "trimmed_chain": [],
        "supplements": {},
        "mastered_anchors": [],
        "recommendations": [
            {
                "concept_id": cid,
                "score": s,
                "alignment": a,
            }
            for cid, s, a in recommendations
        ],
        "start_concept": None,
        "target_concepts": [],
        "mode": "explore",
    }


def _check_prereqs_simple(
    concept_id: str,
    ontology: Ontology,
    profiles: dict[str, ConceptProfile],
) -> bool:
    """
    Simple one-level prereq check for explore mode.
    Returns True if all direct prerequisites have some exposure.
    """
    for edge in ontology.edges:
        if edge.relation != "prerequisite":
            continue
        if edge.to_concept != concept_id:
            continue
        profile = profiles.get(edge.from_concept)
        if profile is None or profile.event_count == 0:
            return False
    return True
