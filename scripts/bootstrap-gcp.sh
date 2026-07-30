#!/usr/bin/env bash
# One-time (or rare) setup for a GCP environment.
# Usage:
#   yarn gcp:bootstrap:staging
#   yarn gcp:bootstrap:production
#
# Optional:
#   SKIP_SECRET_PROMPTS=1 yarn gcp:bootstrap:staging
#     → keep existing secrets, only ensure APIs/IAM/repo
#
# Covers everything needed before yarn deploy:<env>:
#   - Enable APIs
#   - Create Artifact Registry repo
#   - Create/update Secret Manager secrets
#   - IAM for Cloud Build, Cloud Run, Cloud SQL, Storage, secrets
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/load-env.sh"

load_deploy_env "${1:-}"
require_gcloud_auth

PROJECT_NUMBER="$(project_number)"
RUNTIME_SA="$(default_compute_sa)"
CLOUDBUILD_SA="${PROJECT_NUMBER}@cloudbuild.gserviceaccount.com"

grant_project_role() {
  local member="$1"
  local role="$2"
  echo "  + ${role} → ${member}"
  gcloud projects add-iam-policy-binding "${GCP_PROJECT_ID}" \
    --member="${member}" \
    --role="${role}" \
    --condition=None \
    --quiet >/dev/null
}

grant_secret_accessor() {
  local secret_id="$1"
  local member="$2"
  if ! gcloud secrets describe "${secret_id}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    echo "  ! Secret '${secret_id}' missing — create it before deploy."
    return
  fi
  echo "  + secretAccessor on ${secret_id} → ${member}"
  gcloud secrets add-iam-policy-binding "${secret_id}" \
    --project="${GCP_PROJECT_ID}" \
    --member="${member}" \
    --role="roles/secretmanager.secretAccessor" \
    --quiet >/dev/null
}

create_or_update_secret() {
  local secret_id="$1"
  local prompt="$2"
  local value

  if [[ "${SKIP_SECRET_PROMPTS:-}" == "1" ]]; then
    if gcloud secrets describe "${secret_id}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
      echo "Keeping existing secret '${secret_id}' (SKIP_SECRET_PROMPTS=1)."
      return
    fi
    echo "Secret '${secret_id}' does not exist. Create it in Console or re-run without SKIP_SECRET_PROMPTS=1."
    return
  fi

  if gcloud secrets describe "${secret_id}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    read -r -p "Secret '${secret_id}' exists. Update value? [y/N] " update
    if [[ "${update}" != "y" && "${update}" != "Y" ]]; then
      echo "Keeping existing secret '${secret_id}'."
      return
    fi
  fi

  read -r -s -p "${prompt}: " value
  echo
  if [[ -z "${value}" ]]; then
    echo "Skipping empty secret '${secret_id}'."
    return
  fi

  if gcloud secrets describe "${secret_id}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    printf '%s' "${value}" | gcloud secrets versions add "${secret_id}" \
      --project="${GCP_PROJECT_ID}" \
      --data-file=-
  else
    printf '%s' "${value}" | gcloud secrets create "${secret_id}" \
      --project="${GCP_PROJECT_ID}" \
      --replication-policy=automatic \
      --data-file=-
  fi
  echo "Secret '${secret_id}' ready."
}

echo "Bootstrapping ${DEPLOY_ENV_NAME}"
echo "  Project:        ${GCP_PROJECT_ID}"
echo "  Project number: ${PROJECT_NUMBER}"
echo "  Region:         ${GCP_REGION}"
echo "  Runtime SA:     ${RUNTIME_SA}"
echo "  Cloud Build SA: ${CLOUDBUILD_SA}"
echo "  Env file:       ${DEPLOY_ENV_FILE}"
echo

# ---------------------------------------------------------------------------
# 1) APIs
# ---------------------------------------------------------------------------
echo "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  sqladmin.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  cloudscheduler.googleapis.com \
  --project "${GCP_PROJECT_ID}"

# ---------------------------------------------------------------------------
# 2) Artifact Registry
# ---------------------------------------------------------------------------
if ! gcloud artifacts repositories describe "${ARTIFACT_REPO}" \
  --location="${GCP_REGION}" \
  --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
  echo "Creating Artifact Registry repo '${ARTIFACT_REPO}' in ${GCP_REGION}..."
  gcloud artifacts repositories create "${ARTIFACT_REPO}" \
    --repository-format=docker \
    --location="${GCP_REGION}" \
    --description="EasyReview container images (${DEPLOY_ENV_NAME})" \
    --project="${GCP_PROJECT_ID}"
else
  echo "Artifact Registry repo '${ARTIFACT_REPO}' already exists."
fi

# ---------------------------------------------------------------------------
# 3) Secrets
# ---------------------------------------------------------------------------
echo
echo "Cloud SQL Unix socket DATABASE_URL format:"
echo "  postgresql://DB_USER:DB_PASSWORD@localhost/DB_NAME?host=/cloudsql/PROJECT:REGION:INSTANCE"
echo "Get connection name with:"
echo "  gcloud sql instances list --project=${GCP_PROJECT_ID} --format='value(connectionName)'"
echo

: "${GEMINI_API_KEY_SECRET:=GEMINI_API_KEY}"
: "${GOOGLE_MAPS_API_KEY_SECRET:=GOOGLE_MAPS_API_KEY}"
: "${BREVO_API_KEY_SECRET:=BREVO_API_KEY}"
: "${CRON_SECRET_NAME:=CRON_SECRET}"

create_or_update_secret "${DATABASE_SECRET}" "Enter DATABASE_URL"
create_or_update_secret "${JWT_SECRET_NAME}" "Enter JWT_SECRET"
create_or_update_secret "${GEMINI_API_KEY_SECRET}" "Enter GEMINI_API_KEY"
create_or_update_secret "${GOOGLE_MAPS_API_KEY_SECRET}" "Enter GOOGLE_MAPS_API_KEY"
create_or_update_secret "${BREVO_API_KEY_SECRET}" "Enter BREVO_API_KEY"
create_or_update_secret "${CRON_SECRET_NAME}" "Enter CRON_SECRET (long random string for Cloud Scheduler)"

# ---------------------------------------------------------------------------
# 4) IAM — Cloud Build (source bucket + image push)
# ---------------------------------------------------------------------------
echo
echo "Granting Cloud Build permissions..."
# Default Cloud Build / Compute SA must read the uploaded source tarball.
grant_project_role "serviceAccount:${RUNTIME_SA}" "roles/storage.objectAdmin"
grant_project_role "serviceAccount:${RUNTIME_SA}" "roles/cloudbuild.builds.builder"
grant_project_role "serviceAccount:${RUNTIME_SA}" "roles/artifactregistry.writer"
# Classic Cloud Build SA also needs to push images.
grant_project_role "serviceAccount:${CLOUDBUILD_SA}" "roles/artifactregistry.writer"
grant_project_role "serviceAccount:${CLOUDBUILD_SA}" "roles/storage.objectAdmin"

gcloud artifacts repositories add-iam-policy-binding "${ARTIFACT_REPO}" \
  --project="${GCP_PROJECT_ID}" \
  --location="${GCP_REGION}" \
  --member="serviceAccount:${CLOUDBUILD_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet >/dev/null
gcloud artifacts repositories add-iam-policy-binding "${ARTIFACT_REPO}" \
  --project="${GCP_PROJECT_ID}" \
  --location="${GCP_REGION}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/artifactregistry.writer" \
  --quiet >/dev/null

# ---------------------------------------------------------------------------
# 5) IAM — Cloud Run runtime (secrets, Cloud SQL, pull image)
# ---------------------------------------------------------------------------
echo
echo "Granting Cloud Run runtime permissions..."
grant_project_role "serviceAccount:${RUNTIME_SA}" "roles/cloudsql.client"
grant_project_role "serviceAccount:${RUNTIME_SA}" "roles/artifactregistry.reader"
grant_secret_accessor "${DATABASE_SECRET}" "serviceAccount:${RUNTIME_SA}"
grant_secret_accessor "${JWT_SECRET_NAME}" "serviceAccount:${RUNTIME_SA}"
grant_secret_accessor "${GEMINI_API_KEY_SECRET}" "serviceAccount:${RUNTIME_SA}"
grant_secret_accessor "${GOOGLE_MAPS_API_KEY_SECRET}" "serviceAccount:${RUNTIME_SA}"
grant_secret_accessor "${BREVO_API_KEY_SECRET}" "serviceAccount:${RUNTIME_SA}"
grant_secret_accessor "${CRON_SECRET_NAME}" "serviceAccount:${RUNTIME_SA}"

# ---------------------------------------------------------------------------
# 6) Preflight checks
# ---------------------------------------------------------------------------
echo
echo "Preflight checks..."
MISSING=0

if [[ -z "${CLOUD_SQL_INSTANCE:-}" ]]; then
  echo "  ! CLOUD_SQL_INSTANCE is empty in ${DEPLOY_ENV_FILE}"
  MISSING=1
else
  echo "  ✓ CLOUD_SQL_INSTANCE=${CLOUD_SQL_INSTANCE}"
fi

for secret_id in "${DATABASE_SECRET}" "${JWT_SECRET_NAME}" "${GEMINI_API_KEY_SECRET}" "${GOOGLE_MAPS_API_KEY_SECRET}" "${BREVO_API_KEY_SECRET}" "${CRON_SECRET_NAME}"; do
  if gcloud secrets describe "${secret_id}" --project="${GCP_PROJECT_ID}" >/dev/null 2>&1; then
    echo "  ✓ Secret ${secret_id} exists"
  else
    echo "  ! Secret ${secret_id} is missing"
    MISSING=1
  fi
done

echo
if [[ "${MISSING}" -ne 0 ]]; then
  echo "Bootstrap finished with warnings. Fix the items above, then deploy."
  exit 1
fi

echo "Bootstrap complete for ${DEPLOY_ENV_NAME}."
echo "Next:"
echo "  yarn deploy:${DEPLOY_ENV_NAME}"
echo "  yarn gcp:scheduler:${DEPLOY_ENV_NAME}"
