#!/usr/bin/env bash
# One-time GCS bucket for business assets (logos).
# Safe to re-run. Creates the bucket, public read, Cloud Run write, and CORS.
#
# Usage:
#   yarn gcp:business-bucket:staging
#   yarn gcp:business-bucket:production
#
# Bucket name is fixed by product convention:
#   staging    → easyreview-business-staging
#   production → easyreview-business-production
#
# Override only if you know what you are doing:
#   GCS_BUSINESS_BUCKET=easyreview-business-your-name
#   GCS_BUSINESS_CORS_ORIGINS=https://app.example.com,https://www.example.com
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/load-env.sh"

load_deploy_env "${1:-}"
require_gcloud_auth

RUNTIME_SA="$(default_compute_sa)"
: "${GCS_BUSINESS_BUCKET:=easyreview-business-${DEPLOY_ENV_NAME}}"
BUCKET_URI="gs://${GCS_BUSINESS_BUCKET}"

if RUN_SA="$(gcloud run services describe "${CLOUD_RUN_SERVICE}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(spec.template.spec.serviceAccountName)' 2>/dev/null)" \
  && [[ -n "${RUN_SA}" ]]; then
  RUNTIME_SA="${RUN_SA}"
fi

DEFAULT_ORIGINS=(
  "http://localhost:5173"
  "http://localhost:5174"
  "http://localhost:5175"
  "http://localhost:4173"
  "https://app.easyreview.co.in"
  "https://easyreview.co.in"
)
ORIGINS=("${DEFAULT_ORIGINS[@]}")
if [[ -n "${GCS_BUSINESS_CORS_ORIGINS:-}" ]]; then
  IFS=',' read -r -a EXTRA_ORIGINS <<< "${GCS_BUSINESS_CORS_ORIGINS}"
  for origin in "${EXTRA_ORIGINS[@]}"; do
    origin="$(echo "${origin}" | xargs)"
    if [[ -n "${origin}" ]]; then
      ORIGINS+=("${origin}")
    fi
  done
fi

echo "Configuring business assets bucket for ${DEPLOY_ENV_NAME}"
echo "  Project:  ${GCP_PROJECT_ID}"
echo "  Region:   ${GCP_REGION}"
echo "  Bucket:   ${BUCKET_URI}"
echo "  Writer:   ${RUNTIME_SA}"
echo "  CORS:     ${ORIGINS[*]}"
echo

echo "Enabling Cloud Storage API..."
gcloud services enable storage.googleapis.com --project "${GCP_PROJECT_ID}"

if gcloud storage buckets describe "${BUCKET_URI}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "Bucket '${GCS_BUSINESS_BUCKET}' already exists."
else
  echo "Creating bucket '${GCS_BUSINESS_BUCKET}' in ${GCP_REGION}..."
  gcloud storage buckets create "${BUCKET_URI}" \
    --project="${GCP_PROJECT_ID}" \
    --location="${GCP_REGION}" \
    --uniform-bucket-level-access \
    --no-public-access-prevention
fi

echo "Allowing public object reads (business logos)..."
gcloud storage buckets update "${BUCKET_URI}" \
  --project="${GCP_PROJECT_ID}" \
  --no-public-access-prevention
gcloud storage buckets add-iam-policy-binding "${BUCKET_URI}" \
  --project="${GCP_PROJECT_ID}" \
  --member="allUsers" \
  --role="roles/storage.objectViewer" \
  --quiet >/dev/null

echo "Granting Cloud Run write access..."
gcloud storage buckets add-iam-policy-binding "${BUCKET_URI}" \
  --project="${GCP_PROJECT_ID}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectAdmin" \
  --quiet >/dev/null

CORS_FILE="$(mktemp)"
cleanup() { rm -f "${CORS_FILE}"; }
trap cleanup EXIT

{
  echo '['
  echo '  {'
  echo '    "origin": ['
  for i in "${!ORIGINS[@]}"; do
    comma=","
    if [[ "${i}" -eq $((${#ORIGINS[@]} - 1)) ]]; then
      comma=""
    fi
    printf '      "%s"%s\n' "${ORIGINS[$i]}" "${comma}"
  done
  echo '    ],'
  echo '    "method": ["GET", "HEAD", "PUT", "OPTIONS"],'
  echo '    "responseHeader": ["Content-Type", "Content-Length"],'
  echo '    "maxAgeSeconds": 3600'
  echo '  }'
  echo ']'
} > "${CORS_FILE}"

echo "Updating CORS..."
gcloud storage buckets update "${BUCKET_URI}" \
  --project="${GCP_PROJECT_ID}" \
  --cors-file="${CORS_FILE}"

echo
echo "business assets bucket ready for ${DEPLOY_ENV_NAME}."
echo "  ${BUCKET_URI}"
echo "  https://storage.googleapis.com/${GCS_BUSINESS_BUCKET}/"
echo
echo "Add this to ${DEPLOY_ENV_FILE} if it is not already there:"
echo "  GCS_BUSINESS_BUCKET=${GCS_BUSINESS_BUCKET}"
echo
echo "This script is one-time per environment. Re-run only if the bucket, CORS, or service account changes."
