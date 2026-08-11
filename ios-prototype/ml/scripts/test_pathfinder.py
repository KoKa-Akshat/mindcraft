# ml/scripts/test_pathfinder_controlled.py

import pathlib
from datetime import datetime, timedelta

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.models.student_state import StudentState
from mindcraft_graph.engine.student_graph import create_personal_graph, update_personal_graph
from mindcraft_graph.engine.features import compute_concept_profiles
from mindcraft_graph.representation import embeddings
from mindcraft_graph.representation.student_embeddings import (
    compute_student_embedding_from_profiles,
)
from mindcraft_graph.planning.goal import Goal
from mindcraft_graph.planning.pathfinder import find_path, rank_candidates

ONTOLOGY_PATH = pathlib.Path(__file__).parent.parent / "data" / "ontology.json"
ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())

model = embeddings.load_sentence_transformer()
concept_embs = embeddings.compute_concept_embeddings(ontology, model)


def make_event(student_id, concept_id, outcome, effort, time_min, day):
    """Helper to create a concrete event."""
    return SessionEvent(
        student_id=student_id,
        concept_id=concept_id,
        event_type="session",
        outcome=outcome,
        effort=effort,
        duration_minutes=time_min,
        timestamp=datetime(2026, 1, 1) + timedelta(days=day),
        exposure_weight=1.0,
    )


# ════════════════════════════════════════════
# STUDENT A: "The Algebraist"
# Strong on algebra/symbolic manipulation
# Weak on geometry/spatial reasoning
# ════════════════════════════════════════════
alice_events = [
    # Strong algebra performance — high outcome, low effort
    make_event("alice", "basic_equations", 0.9, 0.3, 15, 1),
    make_event("alice", "linear_equations", 0.85, 0.4, 20, 3),
    make_event("alice", "linear_equations", 0.9, 0.3, 15, 5),
    make_event("alice", "exponent_rules", 0.8, 0.4, 20, 7),
    make_event("alice", "polynomials", 0.75, 0.5, 25, 9),
    make_event("alice", "factoring_polynomials", 0.7, 0.5, 25, 11),
    make_event("alice", "quadratic_equations", 0.8, 0.4, 20, 13),
    make_event("alice", "functions_basics", 0.85, 0.3, 15, 15),

    # Weak geometry — low outcome, high effort
    make_event("alice", "lines_angles", -0.3, 0.8, 40, 17),
    make_event("alice", "triangles_congruence", -0.5, 0.9, 45, 19),
    make_event("alice", "circles_geometry", -0.4, 0.85, 40, 21),

    # Moderate stats
    make_event("alice", "descriptive_statistics", 0.3, 0.6, 30, 23),
    make_event("alice", "basic_probability", 0.4, 0.5, 25, 25),
]

# ════════════════════════════════════════════
# STUDENT B: "The Geometer"
# Strong on geometry/spatial reasoning
# Weak on algebra/symbolic manipulation
# ════════════════════════════════════════════
bob_events = [
    # Strong geometry — high outcome, low effort
    make_event("bob", "lines_angles", 0.9, 0.3, 15, 1),
    make_event("bob", "triangles_congruence", 0.85, 0.4, 20, 3),
    make_event("bob", "circles_geometry", 0.8, 0.3, 15, 5),
    make_event("bob", "area_volume", 0.9, 0.35, 18, 7),
    make_event("bob", "geometric_transformations", 0.75, 0.4, 20, 9),
    make_event("bob", "right_triangle_geometry", 0.85, 0.3, 15, 11),
    make_event("bob", "trigonometry_basics", 0.7, 0.5, 25, 13),

    # Weak algebra — low outcome, high effort
    make_event("bob", "basic_equations", -0.2, 0.8, 40, 15),
    make_event("bob", "linear_equations", -0.4, 0.9, 45, 17),
    make_event("bob", "exponent_rules", -0.5, 0.85, 40, 19),
    make_event("bob", "polynomials", -0.6, 0.9, 45, 21),

    # Moderate calculus
    make_event("bob", "limits_continuity", 0.3, 0.6, 30, 23),
]


def run_student(name, events):
    print(f"\n{'=' * 60}")
    print(f"  STUDENT: {name.upper()}")
    print(f"{'=' * 60}")

    graph = create_personal_graph(name, ontology)
    graph = update_personal_graph(graph, events, ontology)
    profiles = compute_concept_profiles(events)
    strength_vec = compute_student_embedding_from_profiles(profiles, concept_embs)

    # Show profile
    print(f"\nConcept profiles:")
    ranked = sorted(profiles.values(), key=lambda p: p.strength_score, reverse=True)
    for p in ranked:
        indicator = "+" if p.strength_score > 0 else "-"
        print(
            f"  [{indicator}] {p.concept_id:30s} "
            f"strength={p.strength_score:+.4f} "
            f"efficiency={p.strength_score:.4f} "
            f"events={p.event_count}"
        )

    # ── Test: Same goal, different students ──
    # Both students asked to learn derivatives
    print(f"\n--- Exam: derivatives in 7 days ---")
    exam_goal = Goal(
        target_concepts=["derivatives"],
        target_mastery=0.8,
        deadline_days=7,
        mode="exam",
        exploration_temp=0.1,
    )
    path = find_path(graph, exam_goal, events, concept_embs, strength_vec, profiles)
    print(f"  Path: {' → '.join(path)}")

    # Curriculum: full calculus unit
    print(f"\n--- Curriculum: calculus in 60 days ---")
    curr_goal = Goal(
        target_concepts=["limits_continuity", "derivatives",
                         "applications_of_derivatives", "integrals"],
        target_mastery=0.7,
        deadline_days=60,
        mode="curriculum",
        exploration_temp=0.3,
    )
    path = find_path(graph, curr_goal, events, concept_embs, strength_vec, profiles)
    print(f"  Path: {' → '.join(path)}")

    # Explore: what should I study next?
    print(f"\n--- Explore: open-ended ---")
    explore_goal = Goal(
        target_concepts=[],
        target_mastery=0.5,
        deadline_days=None,
        mode="explore",
        exploration_temp=0.9,
    )
    recs = find_path(graph, explore_goal, events, concept_embs, strength_vec, profiles)
    print(f"  Recommendations: {', '.join(recs[:5])}")

    return profiles, strength_vec


print("Loading embeddings...")

alice_profiles, alice_strength = run_student("alice", alice_events)
bob_profiles, bob_strength = run_student("bob", bob_events)

# ════════════════════════════════════════════
# COMPARISON: Do the paths actually differ?
# ════════════════════════════════════════════
print(f"\n{'=' * 60}")
print(f"  COMPARISON")
print(f"{'=' * 60}")

compare_goal = Goal(
    target_concepts=["derivatives"],
    target_mastery=0.8,
    deadline_days=30,
    mode="curriculum",
    exploration_temp=0.3,
)

alice_graph = create_personal_graph("alice", ontology)
alice_graph = update_personal_graph(alice_graph, alice_events, ontology)
alice_path = find_path(
    alice_graph, compare_goal, alice_events, concept_embs,
    alice_strength, alice_profiles,
)

bob_graph = create_personal_graph("bob", ontology)
bob_graph = update_personal_graph(bob_graph, bob_events, ontology)
bob_path = find_path(
    bob_graph, compare_goal, bob_events, concept_embs,
    bob_strength, bob_profiles,
)

print(f"\n  Same goal (derivatives, 30 days, curriculum mode):")
print(f"  Alice (algebraist): {' → '.join(alice_path)}")
print(f"  Bob   (geometer):   {' → '.join(bob_path)}")

if alice_path != bob_path:
    print(f"\n  ✓ Paths differ — heuristic is personalizing based on learning style")
else:
    print(f"\n  ✗ Paths identical — heuristic is NOT differentiating between students")