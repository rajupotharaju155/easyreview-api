#!/usr/bin/env bash
# Build image with Cloud Build and deploy to Cloud Run.
# Usage:
#   yarn deploy:staging
#   yarn deploy:production
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/load-env.sh"

load_deploy_env "${1:-}"
require_gcloud_auth

if [[ -z "${CLOUD_SQL_INSTANCE:-}" ]]; then
  echo "CLOUD_SQL_INSTANCE is empty in ${DEPLOY_ENV_FILE}"
  echo "Set it to your Cloud SQL connection name, e.g.:"
  echo "  gcloud sql instances list --project=${GCP_PROJECT_ID} --format='value(connectionName)'"
  exit 1
fi

echo "Deploying ${DEPLOY_ENV_NAME}"
echo "  Project:   ${GCP_PROJECT_ID}"
echo "  Region:    ${GCP_REGION}"
echo "  Service:   ${CLOUD_RUN_SERVICE}"
echo "  Image:     ${IMAGE}"
echo "  APP_ENV:   ${APP_ENV}"
echo "  Cloud SQL: ${CLOUD_SQL_INSTANCE}"
echo

echo "Building and pushing image via Cloud Build..."
gcloud builds submit \
  --project "${GCP_PROJECT_ID}" \
  --config "${DEPLOY_ROOT_DIR}/cloudbuild.yaml" \
  --substitutions="_REGION=${GCP_REGION},_REPO=${ARTIFACT_REPO},_SERVICE=${CLOUD_RUN_SERVICE}" \
  "${DEPLOY_ROOT_DIR}"

DEPLOY_ARGS=(
  run deploy "${CLOUD_RUN_SERVICE}"
  --project "${GCP_PROJECT_ID}"
  --image "${IMAGE}:latest"
  --region "${GCP_REGION}"
  --platform managed
  --port 8080
  --memory "${CLOUD_RUN_MEMORY:-512Mi}"
  --cpu "${CLOUD_RUN_CPU:-1}"
  --min-instances "${CLOUD_RUN_MIN_INSTANCES:-0}"
  --max-instances "${CLOUD_RUN_MAX_INSTANCES:-5}"
  --add-cloudsql-instances "${CLOUD_SQL_INSTANCE}"
  --timeout "${CLOUD_RUN_TIMEOUT:-900}"
  --set-env-vars "NODE_ENV=${APP_ENV},JWT_ACCESS_TOKEN_EXPIRATION=${JWT_ACCESS_TOKEN_EXPIRATION:-24h},JWT_REFRESH_TOKEN_EXPIRATION=${JWT_REFRESH_TOKEN_EXPIRATION:-30d}"
  --set-secrets "DATABASE_URL=${DATABASE_SECRET}:latest,JWT_SECRET=${JWT_SECRET_NAME}:latest,GEMINI_API_KEY=${GEMINI_API_KEY_SECRET:-GEMINI_API_KEY}:latest,GOOGLE_MAPS_API_KEY=${GOOGLE_MAPS_API_KEY_SECRET:-GOOGLE_MAPS_API_KEY}:latest,BREVO_API_KEY=${BREVO_API_KEY_SECRET:-BREVO_API_KEY}:latest,CRON_SECRET=${CRON_SECRET_NAME:-CRON_SECRET}:latest"
)

if [[ "${CLOUD_RUN_ALLOW_UNAUTHENTICATED:-true}" == "true" ]]; then
  DEPLOY_ARGS+=(--allow-unauthenticated)
else
  DEPLOY_ARGS+=(--no-allow-unauthenticated)
fi

echo "Deploying to Cloud Run..."
gcloud "${DEPLOY_ARGS[@]}"

SERVICE_URL="$(gcloud run services describe "${CLOUD_RUN_SERVICE}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

echo
echo "Deployed ${DEPLOY_ENV_NAME} → ${SERVICE_URL}"
echo "Health: curl ${SERVICE_URL}/health"
