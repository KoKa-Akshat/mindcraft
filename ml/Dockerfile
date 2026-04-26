# ml/Dockerfile

FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy and install Python deps
COPY pyproject.toml .
COPY mindcraft_graph/ mindcraft_graph/
COPY data/ data/
COPY serve.py .

RUN pip install --no-cache-dir ".[ml]" \
    uvicorn fastapi google-cloud-firestore

# Pre-download the sentence transformer model so it's baked into the image
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Pre-compute and cache embeddings from the complete ontology
RUN python -c "\
from mindcraft_graph.loaders.complete_ontology_loader import load_complete_ontology; \
from mindcraft_graph.representation import embeddings; \
import pathlib; \
ontology, _ = load_complete_ontology(pathlib.Path('data/ontology_complete.json')); \
model = embeddings.load_sentence_transformer(); \
embs = embeddings.compute_concept_embeddings(ontology, model); \
comps, mean, var = embeddings.compute_pca_axes(embs); \
embeddings.save_concept_embeddings(embs, 'data/concept_embeddings.npz'); \
embeddings.save_pca_axes(comps, mean, var, 'data/pca_axes.npz'); \
print('Embeddings cached')"

EXPOSE 8080

CMD ["uvicorn", "serve:app", "--host", "0.0.0.0", "--port", "8080"]
