import pathlib
from datetime import datetime

from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.models.student_state import StudentState
from mindcraft_graph.simulation import SyntheticStudent, generate_study_trajectory
from mindcraft_graph.engine import (
    update_student_state,
    build_initial_graph,
    update_edges_from_events,
)
from mindcraft_graph.engine.features import compute_concept_profiles
from mindcraft_graph.representation import embeddings
from mindcraft_graph.representation.student_embeddings import (
    compute_student_embedding_from_mastery,
    compute_student_embedding_from_profiles,
)


ONTOLOGY_PATH = pathlib.Path(__file__).parent.parent / "data" / "ontology.json"
OUTPUT_IMAGE = pathlib.Path(__file__).parent / "alice_embedding_space_feature_based.png"

ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())

# Simulate a synthetic student
student = SyntheticStudent(
    "alice",
    ontology,
    ability=0.6,
    preferred_tags=["algebra", "procedural"],
)
events = generate_study_trajectory(student, days=60, sessions_per_week=3)
print(f"Generated {len(events)} events")

# Initialize empty student state
state = StudentState(
    student_id="alice",
    mastery_by_concept={},
    created_at=datetime.now(),
    updated_at=datetime.now(),
)

# Run the update engine
state = update_student_state(state, events)

# Inspect mastery
print(f"\nTracked {len(state.mastery_by_concept)} concepts")
print("\nTop 5 by mastery:")
top = sorted(state.mastery_by_concept.values(), key=lambda c: -c.mastery)[:5]
for cm in top:
    print(
        f"  {cm.concept_id:25s} mastery={cm.mastery:.3f} "
        f"attempts={cm.attempts} avg_outcome={cm.cumulative_outcome/max(cm.attempts,1):+.2f}"
    )

# Initialize graph from ontology
graph = build_initial_graph(ontology)
print(f"Initialized {len(graph)} edges from ontology")

# Update both mastery and edges from events
state = update_student_state(state, events)
graph = update_edges_from_events(graph, events, ontology)

# Inspect a few edges
for key, edge in list(graph.items())[:5]:
    print(
        f"  {edge.from_concept:20s} → {edge.to_concept:20s} "
        f"w={edge.weight:.3f} (α={edge.alpha:.1f}, β={edge.beta:.1f})"
    )

# Compute concept embeddings and PCA axes
print("\nBuilding concept embeddings and PCA axes...")
model = embeddings.load_sentence_transformer()
concept_embeddings = embeddings.compute_concept_embeddings(ontology, model)
components, mean_vector, explained_variance_ratio = embeddings.compute_pca_axes(
    concept_embeddings,
    n_components=4,
)

print("Explained variance ratios:")
for idx, ratio in enumerate(explained_variance_ratio, start=1):
    print(f"  PC{idx}: {ratio:.3f}")

axis_labels = [f"PC {i + 1}" for i in range(components.shape[0])]
summary = embeddings.summarize_pca_axes(
    concept_embeddings,
    components,
    mean_vector,
    explained_variance_ratio,
    axis_labels=axis_labels,
    top_n=5,
)

print("\nPCA axis summaries:")
for axis in summary:
    print(f"{axis['axis_label']} (variance={axis['explained_variance_ratio']:.3f})")
    print("  Top positive concepts:")
    for concept in axis["top_positive_concepts"]:
        print(f"    {concept['concept_id']}: {concept['score']:.3f}")
    print("  Top negative concepts:")
    for concept in axis["top_negative_concepts"]:
        print(f"    {concept['concept_id']}: {concept['score']:.3f}")
    print()

# Build a concept profile and compare mastery-weighted vs strength-weighted placements
concept_profiles = compute_concept_profiles(events)
mastery_vec = compute_student_embedding_from_mastery(
    state.mastery_by_concept,
    concept_embeddings,
)
strength_vec = compute_student_embedding_from_profiles(
    concept_profiles,
    concept_embeddings,
)

mastery_projection = embeddings.project_vectors_onto_axes(
    mastery_vec,
    components,
    mean_vector,
)
strength_projection = embeddings.project_vectors_onto_axes(
    strength_vec,
    components,
    mean_vector,
)

print("Alice mastery-weighted projection:")
for label, coord in zip(axis_labels, mastery_projection.flatten()):
    print(f"  {label}: {coord:.3f}")

print("Alice strength-weighted projection:")
for label, coord in zip(axis_labels, strength_projection.flatten()):
    print(f"  {label}: {coord:.3f}")

projected_concepts = embeddings.project_concept_embeddings(
    concept_embeddings,
    components,
    mean_vector,
)
embeddings.plot_embedding_space(
    projected_concepts,
    student_projections={
        "mastery": mastery_projection,
        "strength": strength_projection,
    },
    axis_labels=["PC 1", "PC 2"],
    output_path=OUTPUT_IMAGE,
)
print(f"Saved concept space visualization to {OUTPUT_IMAGE}")
