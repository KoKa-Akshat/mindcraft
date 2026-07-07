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
from mindcraft_graph.representation import embeddings; \
import pathlib; \
ontology, _ = load_complete_ontology(pathlib.Path('data/5_level_ontology/01_mindcraft_concept_ontology_v2_6_with_combinations.json')); \
model = embeddings.load_sentence_transformer(); \
embs = embeddings.compute_concept_embeddings(ontology, model); \
comps, mean, var = embeddings.compute_pca_axes(embs); \
embeddings.save_concept_embeddings(embs, 'data/concept_embeddings.npz'); \
embeddings.save_pca_axes(comps, mean, var, 'data/pca_axes.npz'); \
print('Embeddings cached:', len(embs), 'concepts')"

RUN chmod +x /app/entrypoint.sh \
    && chmod -R a+rX /app \
    && chmod -R a+w /app/.cache /app/data

EXPOSE 8080

CMD ["/app/entrypoint.sh"]
