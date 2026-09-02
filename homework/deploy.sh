#!/usr/bin/env bash
# Deploy MindCraft Homework Help to Cloud Run
# Usage: bash deploy.sh

set -euo pipefail

PROJECT="mindcraft-93858"
REGION="us-central1"
SERVICE="mindcraft-homework"
IMAGE="gcr.io/${PROJECT}/${SERVICE}"

echo "==> Building image..."
gcloud builds submit --tag "${IMAGE}" .

echo "==> Deploying to Cloud Run..."
gcloud run deploy "${SERVICE}" \
  --image "${IMAGE}" \
  --region "${REGION}" \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 4 \
  --set-env-vars "ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}" \
  --project "${PROJECT}"

echo ""
echo "==> Deployed. Service URL:"
gcloud run services describe "${SERVICE}" \
  --region "${REGION}" \
  --project "${PROJECT}" \
  --format "value(status.url)"
