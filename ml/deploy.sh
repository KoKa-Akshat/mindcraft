#!/usr/bin/env bash
# Deploy the MindCraft ML server to Google Cloud Run.
# Run from the ml/ directory: bash deploy.sh

set -euo pipefail

GCLOUD=~/google-cloud-sdk/google-cloud-sdk/bin/gcloud
PROJECT=mindcraft-93858
REGION=us-central1
SERVICE=mindcraft-ml
IMAGE="gcr.io/${PROJECT}/${SERVICE}"

echo "==> Building and pushing image to GCR..."
$GCLOUD builds submit \
  --tag "$IMAGE" \
  --project "$PROJECT" \
  .

echo "==> Deploying to Cloud Run..."
$GCLOUD run deploy "$SERVICE" \
  --image "$IMAGE" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT" \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --concurrency 80 \
  --min-instances 0 \
  --max-instances 3 \
  --set-env-vars "GOOGLE_CLOUD_PROJECT=${PROJECT}" \
  --port 8080

echo ""
echo "==> Done! Service URL:"
$GCLOUD run services describe "$SERVICE" \
  --platform managed \
  --region "$REGION" \
  --project "$PROJECT" \
  --format "value(status.url)"
