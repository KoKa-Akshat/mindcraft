
import pathlib
import numpy as np
from mindcraft_graph.models.concept import Ontology
from mindcraft_graph.representation import embeddings

ONTOLOGY_PATH = pathlib.Path(__file__).parent.parent.parent / "data" / "ontology.json"
ontology = Ontology.model_validate_json(ONTOLOGY_PATH.read_text())

def build_tag_embeddings(ontology):
    all_tags = sorted({tag for concept in ontology.concepts for tag in concept.tags})
    all_levels = sorted({concept.level for concept in ontology.concepts})
    tag_index = {tag: idx for idx, tag in enumerate(all_tags)}
    level_offset = len(all_tags)
    level_index = {level: level_offset + idx for idx, level in enumerate(all_levels)}

    concept_embs = {}
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

try:
    model = embeddings.load_sentence_transformer()
    concept_embs = embeddings.compute_concept_embeddings(ontology, model)
    source = "sentence-transformer"
except Exception as exc:
    concept_embs = build_tag_embeddings(ontology)
    source = f"tag-fallback ({exc})"

components, mean_vector, explained_variance = embeddings.compute_pca_axes(
    concept_embs, n_components=4
)
summary = embeddings.summarize_pca_axes(
    concept_embs,
    components,
    mean_vector,
    explained_variance,
    axis_labels=[f"PC{i+1}" for i in range(4)],
    top_n=8,
)

print("SOURCE:", source)
for axis in summary:
    print(f"\n{axis['axis_label']}  variance={axis['explained_variance_ratio']:.2%}")
    print("  positive:", ", ".join(
        f"{x['concept_id']} ({x['score']:.3f})"
        for x in axis["top_positive_concepts"]
    ))
    print("  negative:", ", ".join(
        f"{x['concept_id']} ({x['score']:.3f})"
        for x in axis["top_negative_concepts"]
    ))
