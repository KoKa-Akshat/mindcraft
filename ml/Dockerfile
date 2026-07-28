# ml/Dockerfile

FROM python:3.11-slim

WORKDIR /app

ENV HF_HOME=/app/.cache
ENV SENTENCE_TRANSFORMERS_HOME=/app/.cache

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python deps
COPY pyproject.toml .
COPY mindcraft_graph/ mindcraft_graph/
COPY data/ data/
COPY serve.py .
COPY entrypoint.sh .

RUN mkdir -p /app/.cache

RUN pip install --no-cache-dir ".[ml]" \
    uvicorn fastapi google-cloud-firestore firebase-admin

# Pre-download the sentence transformer model so it's baked into the image
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Pre-compute and cache embeddings from the SAME standardized ontology serve.py
# loads at runtime. Baking from the matching file means serve's startup staleness
# check passes (cache hit) instead of rebuilding embeddings on every cold start.
RUN python -c "\
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology; \
from mindcraft_graph.representation import embeddings, classification_index; \
import pathlib; \
l1 = pathlib.Path('data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json'); \
l2 = pathlib.Path('data/5_level_ontology/02_question_archetype_ontology_v1_6_standardized.json'); \
l3 = pathlib.Path('data/5_level_ontology/03_question_instance_bank_schema_and_seed_v1_6.json'); \
bank_index = pathlib.Path('data/bank_index.npz'); \
bank_meta = pathlib.Path('data/bank_index_meta.json'); \
ontology, ingredient_ontology = load_complete_ontology(l1); \
model = embeddings.load_sentence_transformer(); \
embs = embeddings.compute_concept_embeddings(ontology, model); \
comps, mean, var = embeddings.compute_pca_axes(embs); \
embeddings.save_concept_embeddings(embs, 'data/concept_embeddings.npz'); \
embeddings.save_pca_axes(comps, mean, var, 'data/pca_axes.npz'); \
index = classification_index.build_classification_index(ontology, ingredient_ontology, l2, l3, model, source_paths=[l1, l2, l3, bank_index, bank_meta], bank_index_path=bank_index, bank_metadata_path=bank_meta); \
classification_index.save_classification_index(index, 'data/classification_index.npz'); \
print('Embeddings cached:', len(embs), 'concepts;', len(index.entries), 'classifier entries')"

RUN chmod +x /app/entrypoint.sh \
    && chmod -R a+rX /app \
    && chmod -R a+w /app/.cache /app/data

EXPOSE 8080

CMD ["/app/entrypoint.sh"]
