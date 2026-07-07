---
title: mindcraft-ml
sdk: docker
app_port: 8080
---

# mindcraft-ml

Docker Space for the MindCraft ML FastAPI service.

Required Space secrets:

- `FIREBASE_SERVICE_ACCOUNT_JSON`: full Firebase/GCP service account JSON
- `ML_SERVICE_SECRET`: shared backend service key used by trusted server callers
- `FIRESTORE_PROJECT`: `mindcraft-93858`

The container listens on port `8080`; Hugging Face uses `app_port` above to route traffic.
