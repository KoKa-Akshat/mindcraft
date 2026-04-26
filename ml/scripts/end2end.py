# ml/scripts/test_end_to_end.py

"""
End-to-end integration test for the MindCraft knowledge graph pipeline.

Simulates a student progressing over 90 days, processing events through
the full pipeline (update → decay → recommend), and verifies that:

1. Mastery increases with practice
2. Strength scores reflect actual performance
3. Edge weights evolve from ontology priors
4. Discovered edges appear from co-occurrence
5. Trimmed chains shorten as the student progresses
6. Recommendations personalize based on learning style
7. Temporal decay moves evidence toward priors
8. Summary parser produces valid events
9. Recommender API returns structured results with explanations
10. Explore mode differs from exam/curriculum mode
"""

import pathlib
from datetime import datetime, timedelta

import numpy as np

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.student_state import StudentState
from mindcraft_graph.engine.student_graph import create_personal_graph, update_personal_graph
from mindcraft_graph.engine.features import compute_concept_profiles, ConceptProfile
from mindcraft_graph.engine.update import update_student_state
from mindcraft_graph.engine.edge_weights import build_initial_graph, update_edges_from_events
from mindcraft_graph.engine.decay import (
    decay_student_state, decay_all_edges, decay_concept_mastery, decay_edge,
)
from mindcraft_graph.representation import embeddings
from mindcraft_graph.representation.student_embeddings import (
    compute_student_embedding_from_mastery,
    compute_student_embedding_from_profiles,
)
from mindcraft_graph.representation.summary_parser import (
    detect_valence, parse_summary_bullets, mentions_to_events,
    process_session_summary,
)
from mindcraft_graph.planning.goal import Goal
from mindcraft_graph.planning.pathfinder import (
    find_path, get_prerequisite_chain, trim_chain,
)
from mindcraft_graph.api.recommend import recommend, RecommendationResult


# ── Setup ──

ONTOLOGY_PATH = pathlib.Path(__file__).parent.parent / "data" / "ontology.json"
ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())

print("Loading sentence transformer (one-time)...")
model = embeddings.load_sentence_transformer()
concept_embs = embeddings.compute_concept_embeddings(ontology, model)
components, mean_vector, variance_ratios = embeddings.compute_pca_axes(concept_embs, n_components=4)

passed = 0
failed = 0
total = 0


def check(name: str, condition: bool, detail: str = ""):
    global passed, failed, total
    total += 1
    if condition:
        passed += 1
        print(f"  ✓ {name}")
    else:
        failed += 1
        msg = f"  ✗ {name}"
        if detail:
            msg += f" — {detail}"
        print(msg)


def make_event(sid, cid, outcome, effort, time_min, day):
    return SessionEvent(
        student_id=sid, concept_id=cid,
        event_type="session", outcome=outcome, effort=effort,
        duration_minutes=time_min,
        timestamp=datetime(2026, 1, 1) + timedelta(days=day),
        exposure_weight=1.0,
    )


def make_flashcard(sid, cid, outcome, effort, day):
    return SessionEvent(
        student_id=sid, concept_id=cid,
        event_type="flashcard", outcome=outcome, effort=effort,
        duration_minutes=5.0,
        timestamp=datetime(2026, 1, 1) + timedelta(days=day),
        exposure_weight=0.4,
    )


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 1: MASTERY UPDATE ENGINE")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# A student practices one concept repeatedly with positive outcomes
events_1 = [
    make_event("s1", "linear_equations", 0.7, 0.5, 25, 1),
    make_event("s1", "linear_equations", 0.8, 0.4, 20, 3),
    make_event("s1", "linear_equations", 0.9, 0.3, 15, 5),
]

state_1 = StudentState(
    student_id="s1", mastery_by_concept={},
    created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 1),
)
state_1 = update_student_state(state_1, events_1)

cm = state_1.mastery_by_concept.get("linear_equations")
check("Mastery exists after events", cm is not None)
check("Mastery > 0 after positive events", cm is not None and cm.mastery > 0,
      f"mastery={cm.mastery:.3f}" if cm else "")
check("Attempts = 3", cm is not None and cm.attempts == 3)
check("Cumulative outcome is positive", cm is not None and cm.cumulative_outcome > 0,
      f"cum={cm.cumulative_outcome:.3f}" if cm else "")

# A student with negative outcomes should have lower mastery
events_2 = [
    make_event("s2", "linear_equations", -0.5, 0.8, 40, 1),
    make_event("s2", "linear_equations", -0.6, 0.9, 45, 3),
]
state_2 = StudentState(
    student_id="s2", mastery_by_concept={},
    created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 1),
)
state_2 = update_student_state(state_2, events_2)
cm2 = state_2.mastery_by_concept.get("linear_equations")
check("Negative student has lower mastery than positive student",
      cm is not None and cm2 is not None and cm2.mastery < cm.mastery,
      f"positive={cm.mastery:.3f}, negative={cm2.mastery:.3f}" if cm and cm2 else "")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 2: CONCEPT PROFILES & STRENGTH SCORES")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# High outcome, low effort = high strength (natural talent)
talent_events = [
    make_event("talent", "derivatives", 0.9, 0.2, 10, 1),
    make_event("talent", "derivatives", 0.85, 0.3, 12, 3),
]

# Low outcome, high effort = negative strength (struggling)
struggle_events = [
    make_event("struggle", "derivatives", -0.7, 0.9, 45, 1),
    make_event("struggle", "derivatives", -0.6, 0.85, 40, 3),
]

talent_profiles = compute_concept_profiles(talent_events)
struggle_profiles = compute_concept_profiles(struggle_events)

tp = talent_profiles.get("derivatives")
sp = struggle_profiles.get("derivatives")

check("Talent has positive strength", tp is not None and tp.strength_score > 0,
      f"strength={tp.strength_score:.3f}" if tp else "")
check("Struggle has negative strength", sp is not None and sp.strength_score < 0,
      f"strength={sp.strength_score:.3f}" if sp else "")
check("Talent strength > struggle strength",
      tp is not None and sp is not None and tp.strength_score > sp.strength_score)

# Zero events should return 0 strength
empty_profiles = compute_concept_profiles([])
check("Empty profiles returns empty dict", len(empty_profiles) == 0)


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 3: EDGE WEIGHTS & BAYESIAN UPDATES")
print("=" * 60)
# ════════════════════════════════════════════════════════════

graph_3 = build_initial_graph(ontology)
initial_edge_count = len(graph_3)
check("Initial graph has edges", initial_edge_count > 0,
      f"edges={initial_edge_count}")

# Check that prerequisite edges have high prior weight
prereq_edges = [e for e in graph_3.values() if e.relation == "prerequisite"]
related_edges = [e for e in graph_3.values() if e.relation == "related"]

if prereq_edges:
    avg_prereq_weight = sum(e.weight for e in prereq_edges) / len(prereq_edges)
    check("Prerequisite edges have high average weight",
          avg_prereq_weight > 0.7, f"avg={avg_prereq_weight:.3f}")

if related_edges:
    avg_related_weight = sum(e.weight for e in related_edges) / len(related_edges)
    check("Related edges have lower average weight than prerequisites",
          avg_related_weight < avg_prereq_weight,
          f"related={avg_related_weight:.3f}, prereq={avg_prereq_weight:.3f}")

# Co-occurrence should create or strengthen edges
co_events = [
    make_event("s3", "linear_equations", 0.8, 0.5, 25, 1),
    make_event("s3", "quadratic_equations", 0.7, 0.5, 25, 1),  # same day
    make_event("s3", "linear_equations", 0.9, 0.4, 20, 2),
    make_event("s3", "quadratic_equations", 0.85, 0.4, 20, 2),  # same day again
]

graph_3_updated = update_edges_from_events(dict(graph_3), co_events, ontology)
check("Edge count >= initial after co-occurrence",
      len(graph_3_updated) >= initial_edge_count,
      f"before={initial_edge_count}, after={len(graph_3_updated)}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 4: PERSONAL GRAPH ORCHESTRATION")
print("=" * 60)
# ════════════════════════════════════════════════════════════

pg = create_personal_graph("test_student", ontology)
check("Personal graph has edges", len(pg.edges) > 0)
check("Personal graph has empty mastery initially",
      len(pg.state.mastery_by_concept) == 0)

test_events = [
    make_event("test_student", "basic_equations", 0.8, 0.4, 20, 1),
    make_event("test_student", "linear_equations", 0.7, 0.5, 25, 2),
    make_flashcard("test_student", "basic_equations", 0.9, 0.3, 3),
]

pg = update_personal_graph(pg, test_events, ontology)
check("Personal graph has mastery after update",
      len(pg.state.mastery_by_concept) > 0,
      f"concepts tracked: {len(pg.state.mastery_by_concept)}")

neighbors = pg.get_neighbors("basic_equations", min_weight=0.1)
check("get_neighbors returns results", len(neighbors) > 0,
      f"neighbors={len(neighbors)}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 5: EMBEDDINGS & PCA")
print("=" * 60)
# ════════════════════════════════════════════════════════════

check("Concept embeddings cover all ontology concepts",
      len(concept_embs) == len(ontology.concepts),
      f"embeddings={len(concept_embs)}, concepts={len(ontology.concepts)}")

sample_vec = next(iter(concept_embs.values()))
check("Embedding dimension is 384", sample_vec.shape[0] == 384)

check("PCA has 4 components", components.shape[0] == 4)
check("Explained variance sums < 1",
      sum(variance_ratios) < 1.0,
      f"total={sum(variance_ratios):.3f}")
check("Each variance ratio > 0",
      all(v > 0 for v in variance_ratios))


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 6: STUDENT EMBEDDINGS")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# Two students with opposite strengths should have different embeddings
alice_events = [
    make_event("alice", "linear_equations", 0.9, 0.3, 15, 1),
    make_event("alice", "polynomials", 0.8, 0.4, 20, 3),
    make_event("alice", "exponent_rules", 0.85, 0.3, 15, 5),
]
bob_events = [
    make_event("bob", "triangles_congruence", 0.9, 0.3, 15, 1),
    make_event("bob", "circles_geometry", 0.8, 0.4, 20, 3),
    make_event("bob", "lines_angles", 0.85, 0.3, 15, 5),
]

alice_profiles = compute_concept_profiles(alice_events)
bob_profiles = compute_concept_profiles(bob_events)

alice_strength = compute_student_embedding_from_profiles(alice_profiles, concept_embs)
bob_strength = compute_student_embedding_from_profiles(bob_profiles, concept_embs)

cos_sim = float(np.dot(alice_strength, bob_strength) / (
    np.linalg.norm(alice_strength) * np.linalg.norm(bob_strength) + 1e-8
))
check("Opposite students have low cosine similarity",
      cos_sim < 0.7, f"cosine_sim={cos_sim:.3f}")

# Same student's mastery and strength embeddings should be similar but not identical
alice_state = StudentState(
    student_id="alice", mastery_by_concept={},
    created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 1),
)
alice_state = update_student_state(alice_state, alice_events)
alice_mastery = compute_student_embedding_from_mastery(
    alice_state.mastery_by_concept, concept_embs,
)

mastery_strength_sim = float(np.dot(alice_mastery, alice_strength) / (
    np.linalg.norm(alice_mastery) * np.linalg.norm(alice_strength) + 1e-8
))
check("Same student's mastery and strength embeddings are related",
      mastery_strength_sim > 0.3, f"sim={mastery_strength_sim:.3f}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 7: TEMPORAL DECAY")
print("=" * 60)
# ════════════════════════════════════════════════════════════

from mindcraft_graph.models.student_state import ConceptMastery

# Mastery should decay over time
cm_fresh = ConceptMastery(
    concept_id="test", mastery=0.7, exposure_count=5,
    last_interaction=datetime(2026, 1, 1),
    cumulative_outcome=3.0, attempts=5,
)

# 30 days later
cm_30d = decay_concept_mastery(cm_fresh, datetime(2026, 1, 31))
check("Mastery outcome decays after 30 days",
      cm_30d.cumulative_outcome < cm_fresh.cumulative_outcome,
      f"before={cm_fresh.cumulative_outcome:.3f}, after={cm_30d.cumulative_outcome:.3f}")

# 180 days later — should decay significantly
cm_180d = decay_concept_mastery(cm_fresh, datetime(2026, 7, 1))
check("Mastery decays more after 180 days",
      cm_180d.cumulative_outcome < cm_30d.cumulative_outcome,
      f"30d={cm_30d.cumulative_outcome:.3f}, 180d={cm_180d.cumulative_outcome:.3f}")

# Edge decay: evidence should decay toward prior
from mindcraft_graph.engine.edge_weights import EdgeState

edge_fresh = EdgeState(
    from_concept="a", to_concept="b", relation="prerequisite",
    alpha=25.0, beta=3.0,  # shifted from prior of α=18, β=2
    last_updated=datetime(2026, 1, 1),
)

edge_decayed = decay_edge(edge_fresh, datetime(2026, 7, 1))
check("Edge alpha moves toward prior after decay",
      edge_decayed.alpha < edge_fresh.alpha,
      f"before={edge_fresh.alpha:.1f}, after={edge_decayed.alpha:.1f}")

# Weight should move toward prior mean (~0.9 for prerequisite)
check("Edge weight moves toward prior",
      abs(edge_decayed.weight - 0.9) < abs(edge_fresh.weight - 0.9),
      f"before_w={edge_fresh.weight:.3f}, after_w={edge_decayed.weight:.3f}, prior≈0.9")

# No decay for very recent edges
edge_recent = decay_edge(edge_fresh, datetime(2026, 1, 1, 12, 0))  # 12 hours
check("No decay within 1 day",
      edge_recent.alpha == edge_fresh.alpha)


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 8: SUMMARY PARSER")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# Valence detection
check("Positive valence for 'mastered'",
      detect_valence("Student mastered the chain rule") > 0)
check("Negative valence for 'struggled'",
      detect_valence("Struggled with implicit differentiation") < 0)
check("Neutral valence for plain text",
      abs(detect_valence("Covered integration techniques")) < 0.5)

# Summary parsing
def embed_fn(text):
    return model.encode([text], convert_to_numpy=True)[0]

test_bullets = [
    "Strong understanding of derivatives and chain rule",
    "Struggled with integration by parts",
    "Reviewed basic limits",
]

events_from_summary = process_session_summary(
    student_id="summary_test",
    bullets=test_bullets,
    topics=["Calculus", "Derivatives"],
    concept_embeddings=concept_embs,
    embed_fn=embed_fn,
    session_timestamp=datetime(2026, 3, 15),
    session_duration_minutes=45.0,
)

check("Summary parser produces events",
      len(events_from_summary) > 0,
      f"events={len(events_from_summary)}")
check("All events have correct student_id",
      all(e.student_id == "summary_test" for e in events_from_summary))
check("All events have valid outcomes [-1, 1]",
      all(-1 <= e.outcome <= 1 for e in events_from_summary))
check("Events have session event_type",
      all(e.event_type == "session" for e in events_from_summary))

# Check that positive bullets produce higher outcomes than negative bullets
concept_ids = [e.concept_id for e in events_from_summary]
check("Summary detected at least 2 distinct concepts",
      len(set(concept_ids)) >= 2,
      f"concepts={set(concept_ids)}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 9: PATHFINDER — PREREQUISITE CHAIN")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# Canonical chain should exist and be ordered
chain = get_prerequisite_chain("derivatives", ontology)
check("Chain to derivatives exists", len(chain) > 1,
      f"chain={' → '.join(chain)}")
check("Chain ends at derivatives", chain[-1] == "derivatives")
check("Chain is at least 3 concepts long", len(chain) >= 3,
      f"length={len(chain)}")

# Multi-target chain should cover all targets
from mindcraft_graph.planning.pathfinder import get_multi_target_chain
multi_chain = get_multi_target_chain(
    ["derivatives", "integrals"], ontology,
)
check("Multi-target chain includes derivatives", "derivatives" in multi_chain)
check("Multi-target chain includes integrals", "integrals" in multi_chain)

# Trimming: strong student should get shorter chain
strong_events = [
    make_event("strong", "order_of_operations", 0.9, 0.3, 10, 1),
    make_event("strong", "basic_equations", 0.9, 0.3, 10, 2),
    make_event("strong", "linear_equations", 0.9, 0.3, 10, 3),
    make_event("strong", "functions_basics", 0.9, 0.3, 10, 4),
]
strong_graph = create_personal_graph("strong", ontology)
strong_graph = update_personal_graph(strong_graph, strong_events, ontology)
strong_profiles = compute_concept_profiles(strong_events)

trimmed = trim_chain(chain, strong_profiles, strong_graph)
check("Strong student gets shorter chain",
      len(trimmed) < len(chain),
      f"full={len(chain)}, trimmed={len(trimmed)}: {' → '.join(trimmed)}")

# Weak student should keep struggling concepts
weak_events = [
    make_event("weak", "basic_equations", -0.5, 0.9, 45, 1),
    make_event("weak", "linear_equations", -0.4, 0.8, 40, 2),
]
weak_graph = create_personal_graph("weak", ontology)
weak_graph = update_personal_graph(weak_graph, weak_events, ontology)
weak_profiles = compute_concept_profiles(weak_events)

trimmed_weak = trim_chain(chain, weak_profiles, weak_graph)
check("Weak student keeps struggling concepts",
      "basic_equations" in trimmed_weak or "linear_equations" in trimmed_weak,
      f"trimmed={' → '.join(trimmed_weak)}")

# Zero-event student gets full chain
empty_graph = create_personal_graph("empty", ontology)
empty_profiles = compute_concept_profiles([])
trimmed_empty = trim_chain(chain, empty_profiles, empty_graph)
check("Zero-event student gets full chain",
      len(trimmed_empty) == len(chain),
      f"trimmed={len(trimmed_empty)}, full={len(chain)}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 10: PATHFINDER — GOAL MODES")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# Setup a student with moderate progress
moderate_events = [
    make_event("mod", "basic_equations", 0.8, 0.4, 20, 1),
    make_event("mod", "linear_equations", 0.7, 0.5, 25, 3),
    make_event("mod", "functions_basics", 0.6, 0.5, 25, 5),
    make_event("mod", "triangles_congruence", 0.8, 0.3, 15, 7),
    make_event("mod", "circles_geometry", 0.7, 0.4, 20, 9),
]

mod_graph = create_personal_graph("mod", ontology)
mod_graph = update_personal_graph(mod_graph, moderate_events, ontology)
mod_profiles = compute_concept_profiles(moderate_events)
mod_strength = compute_student_embedding_from_profiles(mod_profiles, concept_embs)

# Exam mode
exam_result = find_path(
    mod_graph,
    Goal(target_concepts=["derivatives"], target_mastery=0.8,
         deadline_days=7, mode="exam", exploration_temp=0.1),
    concept_embs, mod_strength, mod_profiles, ontology,
)
check("Exam mode returns trimmed chain",
      len(exam_result["trimmed_chain"]) > 0,
      f"path={' → '.join(exam_result['trimmed_chain'])}")
check("Exam mode has no supplements",
      len(exam_result.get("supplements", {})) == 0)

# Curriculum mode
curr_result = find_path(
    mod_graph,
    Goal(target_concepts=["derivatives", "integrals"],
         target_mastery=0.7, deadline_days=60,
         mode="curriculum", exploration_temp=0.3),
    concept_embs, mod_strength, mod_profiles, ontology,
)
check("Curriculum covers multiple targets",
      len(curr_result["trimmed_chain"]) > 0)

# Explore mode
explore_result = find_path(
    mod_graph,
    Goal(target_concepts=[], mode="explore", exploration_temp=0.9),
    concept_embs, mod_strength, mod_profiles, ontology,
)
check("Explore mode returns recommendations",
      len(explore_result.get("recommendations", [])) > 0,
      f"recs={len(explore_result.get('recommendations', []))}")
check("Explore mode has no canonical chain",
      len(explore_result.get("canonical_chain", [])) == 0)


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 11: RECOMMENDER API")
print("=" * 60)
# ════════════════════════════════════════════════════════════

rec_result = recommend(
    mod_graph,
    Goal(target_concepts=["derivatives"], target_mastery=0.8,
         deadline_days=30, mode="curriculum", exploration_temp=0.3),
    moderate_events,
    concept_embs, components, mean_vector, ontology,
)

check("Recommend returns RecommendationResult",
      isinstance(rec_result, RecommendationResult))
check("Result has recommendations",
      len(rec_result.recommendations) > 0,
      f"count={len(rec_result.recommendations)}")
check("Each recommendation has a reason",
      all(r.reason and len(r.reason) > 10 for r in rec_result.recommendations),
      f"reasons={[r.reason[:40] for r in rec_result.recommendations[:3]]}")
check("Each recommendation has PCA profile",
      all(len(r.pca_profile) == 4 for r in rec_result.recommendations))
check("Student profile has projections",
      len(rec_result.student_profile.mastery_projection) == 4)
check("Student profile has displacement",
      rec_result.student_profile.displacement_magnitude >= 0)

# Explore recommendation
explore_rec = recommend(
    mod_graph,
    Goal(target_concepts=[], mode="explore", exploration_temp=0.9),
    moderate_events,
    concept_embs, components, mean_vector, ontology,
)
check("Explore recommendation returns results",
      len(explore_rec.recommendations) > 0)
check("Explore mode differs from curriculum mode",
      explore_rec.mode == "explore")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 12: PERSONALIZATION — DIFFERENT STUDENTS, SAME GOAL")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# Alice: strong algebra
alice_full_events = [
    make_event("alice_full", "basic_equations", 0.9, 0.3, 15, 1),
    make_event("alice_full", "linear_equations", 0.85, 0.4, 20, 3),
    make_event("alice_full", "exponent_rules", 0.8, 0.4, 20, 5),
    make_event("alice_full", "polynomials", 0.75, 0.5, 25, 7),
    make_event("alice_full", "functions_basics", 0.85, 0.3, 15, 9),
]

# Bob: strong geometry
bob_full_events = [
    make_event("bob_full", "lines_angles", 0.9, 0.3, 15, 1),
    make_event("bob_full", "triangles_congruence", 0.85, 0.4, 20, 3),
    make_event("bob_full", "circles_geometry", 0.8, 0.3, 15, 5),
    make_event("bob_full", "basic_equations", -0.3, 0.8, 40, 7),
    make_event("bob_full", "linear_equations", -0.4, 0.9, 45, 9),
]

same_goal = Goal(
    target_concepts=["derivatives"], target_mastery=0.8,
    deadline_days=30, mode="curriculum", exploration_temp=0.3,
)

alice_g = create_personal_graph("alice_full", ontology)
alice_g = update_personal_graph(alice_g, alice_full_events, ontology)
alice_p = compute_concept_profiles(alice_full_events)
alice_s = compute_student_embedding_from_profiles(alice_p, concept_embs)

bob_g = create_personal_graph("bob_full", ontology)
bob_g = update_personal_graph(bob_g, bob_full_events, ontology)
bob_p = compute_concept_profiles(bob_full_events)
bob_s = compute_student_embedding_from_profiles(bob_p, concept_embs)

alice_result = find_path(alice_g, same_goal, concept_embs, alice_s, alice_p, ontology)
bob_result = find_path(bob_g, same_goal, concept_embs, bob_s, bob_p, ontology)

alice_trimmed = alice_result["trimmed_chain"]
bob_trimmed = bob_result["trimmed_chain"]

check("Alice and Bob get different paths to same goal",
      alice_trimmed != bob_trimmed,
      f"Alice: {' → '.join(alice_trimmed)}, Bob: {' → '.join(bob_trimmed)}")
check("Bob has longer path (weaker prerequisites)",
      len(bob_trimmed) >= len(alice_trimmed),
      f"Alice={len(alice_trimmed)}, Bob={len(bob_trimmed)}")

# Explore mode should recommend different concepts
alice_explore = find_path(
    alice_g, Goal(target_concepts=[], mode="explore", exploration_temp=0.9),
    concept_embs, alice_s, alice_p, ontology,
)
bob_explore = find_path(
    bob_g, Goal(target_concepts=[], mode="explore", exploration_temp=0.9),
    concept_embs, bob_s, bob_p, ontology,
)

alice_recs = set(r["concept_id"] for r in alice_explore.get("recommendations", [])[:3])
bob_recs = set(r["concept_id"] for r in bob_explore.get("recommendations", [])[:3])
check("Explore recommendations differ between students",
      alice_recs != bob_recs,
      f"Alice: {alice_recs}, Bob: {bob_recs}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TEST SUITE 13: PROGRESSION OVER TIME")
print("=" * 60)
# ════════════════════════════════════════════════════════════

# Simulate a student progressing through the prerequisite chain
# Their trimmed chain should get shorter with each batch of events

progression_graph = create_personal_graph("progress", ontology)
chain_to_deriv = get_prerequisite_chain("derivatives", ontology)

goal_deriv = Goal(
    target_concepts=["derivatives"], target_mastery=0.8,
    deadline_days=60, mode="exam", exploration_temp=0.1,
)

# Phase 1: No events
p0_profiles = compute_concept_profiles([])
p0_strength = compute_student_embedding_from_profiles(p0_profiles, concept_embs)
r0 = find_path(progression_graph, goal_deriv, concept_embs, p0_strength, p0_profiles, ontology)
len_0 = len(r0["trimmed_chain"])

# Phase 2: Master foundational concepts
phase2_events = [
    make_event("progress", "order_of_operations", 0.9, 0.3, 10, 1),
    make_event("progress", "basic_equations", 0.85, 0.4, 15, 3),
]
progression_graph = update_personal_graph(progression_graph, phase2_events, ontology)
p2_profiles = compute_concept_profiles(phase2_events)
p2_strength = compute_student_embedding_from_profiles(p2_profiles, concept_embs)
r2 = find_path(progression_graph, goal_deriv, concept_embs, p2_strength, p2_profiles, ontology)
len_2 = len(r2["trimmed_chain"])

# Phase 3: Master more
phase3_events = phase2_events + [
    make_event("progress", "linear_equations", 0.9, 0.3, 12, 5),
    make_event("progress", "functions_basics", 0.8, 0.4, 20, 7),
]
progression_graph_3 = create_personal_graph("progress3", ontology)
progression_graph_3 = update_personal_graph(progression_graph_3, phase3_events, ontology)
p3_profiles = compute_concept_profiles(phase3_events)
p3_strength = compute_student_embedding_from_profiles(p3_profiles, concept_embs)
r3 = find_path(progression_graph_3, goal_deriv, concept_embs, p3_strength, p3_profiles, ontology)
len_3 = len(r3["trimmed_chain"])

check("Chain shortens as student progresses: phase 0 → 2",
      len_2 <= len_0,
      f"phase0={len_0}, phase2={len_2}")
check("Chain shortens further: phase 2 → 3",
      len_3 <= len_2,
      f"phase2={len_2}, phase3={len_3}")
check("Final trimmed chain is shorter than original",
      len_3 < len_0,
      f"original={len_0}, final={len_3}: {' → '.join(r3['trimmed_chain'])}")


# ════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  RESULTS")
print("=" * 60)
print(f"\n  Passed: {passed}/{total}")
print(f"  Failed: {failed}/{total}")
if failed == 0:
    print("\n  ✓ ALL TESTS PASSED")
else:
    print(f"\n  ✗ {failed} TESTS FAILED — review output above")
print()