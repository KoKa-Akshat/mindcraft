import pathlib
from datetime import datetime, timedelta

import numpy as np
import matplotlib.pyplot as plt

from mindcraft_graph.engine.features import compute_concept_profiles
from mindcraft_graph.engine.student_graph import create_personal_graph, update_personal_graph
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.events import SessionEvent
from mindcraft_graph.planning.goal import Goal
from mindcraft_graph.planning.pathfinder import find_path, get_prerequisite_chain
from mindcraft_graph.representation import embeddings
from mindcraft_graph.representation.student_embeddings import (
    compute_student_embedding_from_mastery,
    compute_student_embedding_from_profiles,
)


ONTOLOGY_PATH = pathlib.Path(__file__).parent.parent / "data" / "ontology.json"
ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())


def build_tag_embeddings(ontology: Ontology) -> dict[str, np.ndarray]:
    """
    Deterministic fallback embeddings for validation cases.

    These encode concept tags and levels, which is enough for the pathfinder
    behavior tests in this script even when the sentence-transformer model
    is unavailable offline.
    """
    all_tags = sorted({tag for concept in ontology.concepts for tag in concept.tags})
    all_levels = sorted({concept.level for concept in ontology.concepts})
    tag_index = {tag: idx for idx, tag in enumerate(all_tags)}
    level_offset = len(all_tags)
    level_index = {
        level: level_offset + idx for idx, level in enumerate(all_levels)
    }

    concept_embs: dict[str, np.ndarray] = {}
    dim = len(all_tags) + len(all_levels)

    for concept in ontology.concepts:
        vec = np.zeros(dim, dtype=float)
        for tag in concept.tags:
            vec[tag_index[tag]] = 1.0
        vec[level_index[concept.level]] = 0.5

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec = vec / norm

        concept_embs[concept.id] = vec

    return concept_embs


def load_concept_embeddings(ontology: Ontology) -> dict[str, np.ndarray]:
    try:
        model = embeddings.load_sentence_transformer()
        print("Loaded sentence-transformer embeddings.\n")
        return embeddings.compute_concept_embeddings(ontology, model)
    except Exception as exc:
        print(
            "Falling back to deterministic tag embeddings "
            f"(model unavailable: {exc}).\n"
        )
        return build_tag_embeddings(ontology)


concept_embs = load_concept_embeddings(ontology)
validation_embs = build_tag_embeddings(ontology)


def make_event(student_id, concept_id, outcome, effort, time_min, day):
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


def build_student_state(name, events, concept_embeddings):
    graph = create_personal_graph(name, ontology)
    graph = update_personal_graph(graph, events, ontology)
    profiles = compute_concept_profiles(events)
    strength_vec = compute_student_embedding_from_profiles(profiles, concept_embeddings)
    return graph, profiles, strength_vec


def run_goal(name, events, goal, concept_embeddings):
    graph, profiles, strength_vec = build_student_state(
        name, events, concept_embeddings,
    )
    return find_path(
        graph,
        goal,
        concept_embeddings,
        strength_vec,
        profiles,
        ontology,
    )


def assert_case(label, condition, detail):
    if not condition:
        raise AssertionError(f"{label} failed: {detail}")
    print(f"  PASS: {label}")


# Show the raw prerequisite chain
print("Canonical chain to derivatives:")
derivatives_chain = get_prerequisite_chain("derivatives", ontology)
print(f"  {' → '.join(derivatives_chain)}\n")

print("Canonical chain to integrals:")
integrals_chain = get_prerequisite_chain("integrals", ontology)
print(f"  {' → '.join(integrals_chain)}\n")


# Alice: strong algebra, weak geometry
alice_events = [
    make_event("alice", "basic_equations", 0.9, 0.3, 15, 1),
    make_event("alice", "linear_equations", 0.85, 0.4, 20, 3),
    make_event("alice", "linear_equations", 0.9, 0.3, 15, 5),
    make_event("alice", "exponent_rules", 0.8, 0.4, 20, 7),
    make_event("alice", "polynomials", 0.75, 0.5, 25, 9),
    make_event("alice", "factoring_polynomials", 0.7, 0.5, 25, 11),
    make_event("alice", "quadratic_equations", 0.8, 0.4, 20, 13),
    make_event("alice", "functions_basics", 0.85, 0.3, 15, 15),
    make_event("alice", "lines_angles", -0.3, 0.8, 40, 17),
    make_event("alice", "triangles_congruence", -0.5, 0.9, 45, 19),
    make_event("alice", "circles_geometry", -0.4, 0.85, 40, 21),
    make_event("alice", "descriptive_statistics", 0.3, 0.6, 30, 23),
    make_event("alice", "basic_probability", 0.4, 0.5, 25, 25),
]

# Bob: strong geometry, weak algebra
bob_events = [
    make_event("bob", "lines_angles", 0.9, 0.3, 15, 1),
    make_event("bob", "triangles_congruence", 0.85, 0.4, 20, 3),
    make_event("bob", "circles_geometry", 0.8, 0.3, 15, 5),
    make_event("bob", "area_volume", 0.9, 0.35, 18, 7),
    make_event("bob", "geometric_transformations", 0.75, 0.4, 20, 9),
    make_event("bob", "right_triangle_geometry", 0.85, 0.3, 15, 11),
    make_event("bob", "trigonometry_basics", 0.7, 0.5, 25, 13),
    make_event("bob", "basic_equations", -0.2, 0.8, 40, 15),
    make_event("bob", "linear_equations", -0.4, 0.9, 45, 17),
    make_event("bob", "exponent_rules", -0.5, 0.85, 40, 19),
    make_event("bob", "polynomials", -0.6, 0.9, 45, 21),
    make_event("bob", "limits_continuity", 0.3, 0.6, 30, 23),
]


def run_student(name, events):
    print(f"\n{'=' * 60}")
    print(f"  {name.upper()}")
    print(f"{'=' * 60}")

    graph, profiles, strength_vec = build_student_state(name, events, concept_embs)

    print("\nMastered concepts (strength > 0.3, events >= 1):")
    for cid, profile in sorted(profiles.items(), key=lambda item: -item[1].strength_score):
        if profile.event_count >= 1 and profile.strength_score > 0.3:
            print(f"  ✓ {cid:30s} strength={profile.strength_score:+.3f}")

    print("\nStruggling concepts:")
    for cid, profile in sorted(profiles.items(), key=lambda item: item[1].strength_score):
        if profile.strength_score < 0:
            print(f"  ✗ {cid:30s} strength={profile.strength_score:+.3f}")

    print("\n--- Exam: derivatives in 7 days ---")
    result = find_path(
        graph,
        Goal(
            target_concepts=["derivatives"],
            target_mastery=0.8,
            deadline_days=7,
            mode="exam",
            exploration_temp=0.1,
        ),
        concept_embs,
        strength_vec,
        profiles,
        ontology,
    )
    print(f"  Full chain:    {' → '.join(result['canonical_chain'])}")
    print(f"  Student needs: {' → '.join(result['trimmed_chain'])}")

    print("\n--- Curriculum: calculus in 60 days ---")
    result = find_path(
        graph,
        Goal(
            target_concepts=[
                "limits_continuity",
                "derivatives",
                "applications_of_derivatives",
                "integrals",
            ],
            target_mastery=0.7,
            deadline_days=60,
            mode="curriculum",
            exploration_temp=0.3,
        ),
        concept_embs,
        strength_vec,
        profiles,
        ontology,
    )
    print(f"  Full chain:    {' → '.join(result['canonical_chain'])}")
    print(f"  Student needs: {' → '.join(result['trimmed_chain'])}")
    if result["supplements"]:
        print("  Supplements:")
        for concept, analogs in result["supplements"].items():
            analog_str = ", ".join(
                f"{analog_id} (align={score:.2f})"
                for analog_id, score in analogs
            )
            print(f"    {concept} → try also: {analog_str}")

    print("\n--- Explore: open-ended ---")
    result = find_path(
        graph,
        Goal(target_concepts=[], mode="explore", exploration_temp=0.9),
        concept_embs,
        strength_vec,
        profiles,
        ontology,
    )
    for recommendation in result.get("recommendations", [])[:5]:
        print(
            f"  {recommendation['concept_id']:30s} "
            f"score={recommendation['score']:.3f} "
            f"alignment={recommendation['alignment']:+.3f}"
        )

    # PCA visualization
    components, mean_vector, explained_variance = embeddings.compute_pca_axes(
        concept_embs, n_components=4,
    )
    projected_concepts = embeddings.project_concept_embeddings(
        concept_embs, components, mean_vector,
    )

    mastery_vec = compute_student_embedding_from_mastery(
        graph.state.mastery_by_concept, concept_embs,
    )
    mastery_proj = embeddings.project_vectors_onto_axes(
        mastery_vec, components, mean_vector,
    )
    strength_proj = embeddings.project_vectors_onto_axes(
        strength_vec, components, mean_vector,
    )

    projected_matrix = np.stack(list(projected_concepts.values()))
    concept_names = list(projected_concepts.keys())
    x = projected_matrix[:, 0]
    y = projected_matrix[:, 1]

    fig, ax = plt.subplots(figsize=(12, 9))
    ax.scatter(x, y, alpha=0.5, s=40, color="tab:blue", label="Concepts")

    distances = np.linalg.norm(projected_matrix[:, :2], axis=1)
    top_indices = np.argsort(distances)[-20:]
    for idx in top_indices:
        ax.text(x[idx], y[idx], concept_names[idx], fontsize=8, alpha=0.8)

    mx, my = float(mastery_proj[0, 0]), float(mastery_proj[0, 1])
    ax.scatter(
        [mx], [my], color="tab:red", s=120, marker="*",
        label=f"{name} (mastery)", zorder=5,
    )
    ax.text(
        mx, my, "mastery", fontsize=11, fontweight="bold",
        va="bottom", ha="right",
    )

    sx, sy = float(strength_proj[0, 0]), float(strength_proj[0, 1])
    ax.scatter(
        [sx], [sy], color="tab:orange", s=120, marker="*",
        label=f"{name} (strength)", zorder=5,
    )
    ax.text(
        sx, sy, "strength", fontsize=11, fontweight="bold",
        va="bottom", ha="right",
    )

    ax.annotate(
        "",
        xy=(sx, sy),
        xytext=(mx, my),
        arrowprops=dict(
            arrowstyle="->",
            color="mediumpurple",
            lw=2,
            connectionstyle="arc3,rad=0.1",
        ),
    )
    mid_x, mid_y = (mx + sx) / 2, (my + sy) / 2
    ax.text(
        mid_x, mid_y, "effort→strength", fontsize=9,
        color="mediumpurple", ha="center", va="top",
    )

    for cid, profile in profiles.items():
        if cid not in projected_concepts:
            continue
        proj = projected_concepts[cid]
        px, py = float(proj[0]), float(proj[1])
        if profile.strength_score > 0.3:
            ax.scatter([px], [py], color="green", s=60, alpha=0.7, zorder=4)
        elif profile.strength_score < -0.1:
            ax.scatter([px], [py], color="red", s=60, alpha=0.7, zorder=4)

    variance_labels = ", ".join(
        f"PC{i + 1}={ratio:.1%}" for i, ratio in enumerate(explained_variance[:2])
    )
    ax.set_xlabel("PC 1")
    ax.set_ylabel("PC 2")
    ax.set_title(f"{name} — Concept Embedding Space ({variance_labels})")
    ax.grid(True, linestyle="--", alpha=0.3)
    ax.legend(loc="best")

    output_path = pathlib.Path(__file__).parent / f"{name.lower()}_pca.png"
    fig.savefig(output_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    print(f"\n  Saved PCA plot to {output_path}")

    return profiles, strength_vec


def run_trim_validation_cases():
    print(f"\n{'=' * 60}")
    print("  VALIDATION: chain trimming edge cases")
    print(f"{'=' * 60}")

    target = "derivatives"
    chain = get_prerequisite_chain(target, ontology)
    weak_concept = chain[0]
    mid_concept = chain[len(chain) // 2]

    all_mastered_events = [
        make_event("mastered", concept_id, 0.9, 0.3, 20, idx)
        for idx, concept_id in enumerate(chain, start=1)
    ]
    mastered_result = run_goal(
        "mastered",
        all_mastered_events,
        Goal(
            target_concepts=[target],
            target_mastery=0.8,
            deadline_days=14,
            mode="exam",
            exploration_temp=0.1,
        ),
        validation_embs,
    )
    print(f"\nAll-practiced student: {' → '.join(mastered_result['trimmed_chain'])}")
    assert_case(
        "all-practiced trims to target",
        mastered_result["trimmed_chain"] in ([target], []),
        f"expected {[target]} or [], got {mastered_result['trimmed_chain']}",
    )

    no_events_result = run_goal(
        "blank",
        [],
        Goal(
            target_concepts=[target],
            target_mastery=0.8,
            deadline_days=14,
            mode="exam",
            exploration_temp=0.1,
        ),
        validation_embs,
    )
    print(f"Zero-event student:      {' → '.join(no_events_result['trimmed_chain'])}")
    assert_case(
        "zero events keeps full chain",
        no_events_result["trimmed_chain"] == chain,
        f"expected {chain}, got {no_events_result['trimmed_chain']}",
    )

    mixed_events = [
        make_event("mixed", weak_concept, -0.7, 0.9, 35, 1),
        make_event("mixed", mid_concept, 0.85, 0.4, 20, 2),
    ]
    mixed_result = run_goal(
        "mixed",
        mixed_events,
        Goal(
            target_concepts=[target],
            target_mastery=0.8,
            deadline_days=14,
            mode="exam",
            exploration_temp=0.1,
        ),
        validation_embs,
    )
    print(f"Mixed-strength student:  {' → '.join(mixed_result['trimmed_chain'])}")
    assert_case(
        "weak prereq stays",
        weak_concept in mixed_result["trimmed_chain"],
        f"{weak_concept} should remain in {mixed_result['trimmed_chain']}",
    )
    assert_case(
        "mid-chain strength trims out",
        mid_concept not in mixed_result["trimmed_chain"],
        f"{mid_concept} should be trimmed from {mixed_result['trimmed_chain']}",
    )


def run_mode_validation_case():
    print(f"\n{'=' * 60}")
    print("  VALIDATION: same student across all three modes")
    print(f"{'=' * 60}")

    mode_events = [
        make_event("mode", "right_triangle_geometry", 0.95, 0.3, 20, 1),
        make_event("mode", "trigonometry_basics", 0.9, 0.35, 22, 2),
        make_event("mode", "functions_basics", 0.2, 0.5, 20, 3),
    ]
    target = "integrals"
    chain = get_prerequisite_chain(target, ontology)

    exam_result = run_goal(
        "mode",
        mode_events,
        Goal(
            target_concepts=[target],
            target_mastery=0.8,
            deadline_days=10,
            mode="exam",
            exploration_temp=0.1,
        ),
        validation_embs,
    )
    curriculum_result = run_goal(
        "mode",
        mode_events,
        Goal(
            target_concepts=[target],
            target_mastery=0.8,
            deadline_days=45,
            mode="curriculum",
            exploration_temp=0.3,
        ),
        validation_embs,
    )
    explore_result = run_goal(
        "mode",
        mode_events,
        Goal(target_concepts=[], mode="explore", exploration_temp=0.9),
        validation_embs,
    )

    print(f"\nExam chain:       {' → '.join(exam_result['trimmed_chain'])}")
    print(f"Curriculum chain: {' → '.join(curriculum_result['trimmed_chain'])}")
    if curriculum_result["supplements"]:
        for concept, analogs in curriculum_result["supplements"].items():
            analog_str = ", ".join(
                f"{analog_id} ({score:.2f})" for analog_id, score in analogs
            )
            print(f"  Curriculum supplements for {concept}: {analog_str}")
    print(
        "Explore recommendations: "
        + ", ".join(
            recommendation["concept_id"]
            for recommendation in explore_result["recommendations"][:5]
        )
    )

    assert_case(
        "exam follows prerequisite chain strictly",
        exam_result["canonical_chain"] == chain
        and exam_result["trimmed_chain"] == curriculum_result["trimmed_chain"]
        and not exam_result["supplements"],
        (
            "expected exam to keep the unmet prerequisite path with no "
            f"supplements, got {exam_result}"
        ),
    )
    assert_case(
        "curriculum keeps the chain but adds supplements",
        curriculum_result["canonical_chain"] == chain
        and curriculum_result["trimmed_chain"] == exam_result["trimmed_chain"]
        and bool(curriculum_result["supplements"]),
        f"expected supplements on {chain}, got {curriculum_result}",
    )
    assert_case(
        "explore ignores the chain entirely",
        not explore_result["canonical_chain"]
        and not explore_result["trimmed_chain"]
        and bool(explore_result["recommendations"]),
        f"expected recommendations-only explore result, got {explore_result}",
    )


run_student("Alice", alice_events)
run_student("Bob", bob_events)

print(f"\n{'=' * 60}")
print("  COMPARISON: same goal, different students")
print(f"{'=' * 60}")

for name, events in [("Alice", alice_events), ("Bob", bob_events)]:
    result = run_goal(
        name.lower(),
        events,
        Goal(
            target_concepts=["derivatives"],
            target_mastery=0.8,
            deadline_days=30,
            mode="curriculum",
            exploration_temp=0.3,
        ),
        concept_embs,
    )
    print(f"\n  {name}: {' → '.join(result['trimmed_chain'])}")
    if result["supplements"]:
        for concept, analogs in result["supplements"].items():
            print(f"    {concept} → also: {', '.join(analog[0] for analog in analogs)}")

run_trim_validation_cases()
run_mode_validation_case()

print(f"\n{'=' * 60}")
print("  All requested validation cases passed")
print(f"{'=' * 60}")
