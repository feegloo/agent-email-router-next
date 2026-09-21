#!/usr/bin/env bash
set -euo pipefail
: "${PROJECT_ID:?Set PROJECT_ID to your Google Cloud project ID}"
REGION=${REGION:-europe-west1}
[[ "$PROJECT_ID" =~ ^[a-z][a-z0-9-]{4,28}[a-z0-9]$ ]] || { echo 'Invalid PROJECT_ID'; exit 1; }
[[ "$REGION" =~ ^[a-z]+-[a-z]+[0-9]+$ ]] || { echo 'Invalid REGION'; exit 1; }
cd "$(dirname "$0")/../.."
command -v gcloud >/dev/null
command -v docker >/dev/null
BUCKET="${PROJECT_ID}-email-router-routes"
ACCOUNT="email-router@${PROJECT_ID}.iam.gserviceaccount.com"
REGISTRY="${REGION}-docker.pkg.dev/${PROJECT_ID}/email-router"
TAG=$(git rev-parse --short HEAD)
TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

gcloud services enable run.googleapis.com artifactregistry.googleapis.com storage.googleapis.com iam.googleapis.com --project "$PROJECT_ID"
if ! gcloud artifacts repositories describe email-router --location "$REGION" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud artifacts repositories create email-router --repository-format docker --location "$REGION" --project "$PROJECT_ID"
fi
if ! gcloud iam service-accounts describe "$ACCOUNT" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create email-router --project "$PROJECT_ID"
fi
if ! gcloud storage buckets describe "gs://$BUCKET" --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --location "$REGION" --uniform-bucket-level-access --public-access-prevention --project "$PROJECT_ID"
fi
gcloud storage buckets add-iam-policy-binding "gs://$BUCKET" --member "serviceAccount:$ACCOUNT" --role roles/storage.objectUser --project "$PROJECT_ID" >/dev/null
gcloud auth configure-docker "${REGION}-docker.pkg.dev" --quiet
for item in app gateway ollama; do
  dockerfile=Dockerfile
  if [[ "$item" != app ]]; then dockerfile="deploy/cloud-run/${item}.Dockerfile"; fi
  docker buildx build --platform linux/amd64 --file "$dockerfile" --tag "$REGISTRY/$item:$TAG" --push .
done
export PROJECT_ID REGION BUCKET ACCOUNT REGISTRY TAG
node deploy/cloud-run/manifests.mjs gpu > "$TMP_DIR/gpu.json"
gcloud run services replace "$TMP_DIR/gpu.json" --region "$REGION" --project "$PROJECT_ID"
gcloud run services add-iam-policy-binding email-router-gpu --member "serviceAccount:$ACCOUNT" --role roles/run.invoker --region "$REGION" --project "$PROJECT_ID" >/dev/null
OLLAMA_URL=$(gcloud run services describe email-router-gpu --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
export OLLAMA_URL
node deploy/cloud-run/manifests.mjs app > "$TMP_DIR/app.json"
gcloud run services replace "$TMP_DIR/app.json" --region "$REGION" --project "$PROJECT_ID"
gcloud run services update email-router --no-invoker-iam-check --region "$REGION" --project "$PROJECT_ID"
APP_URL=$(gcloud run services describe email-router --region "$REGION" --project "$PROJECT_ID" --format 'value(status.url)')
echo "Public UI: $APP_URL"
echo "The GPU service remains private."
