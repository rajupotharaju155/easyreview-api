#!/usr/bin/env bash
# Shared helpers for environment-based GCP scripts.

load_deploy_env() {
  local env_name="${1:-}"
  if [[ -z "${env_name}" ]]; then
    echo "Usage: $0 <staging|production>"
    exit 1
  fi

  if [[ "${env_name}" != "staging" && "${env_name}" != "production" ]]; then
    echo "Environment must be 'staging' or 'production' (got: ${env_name})"
    exit 1
  fi

  local root_dir
  root_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
  local env_file="${root_dir}/deploy/environments/${env_name}.env"

  if [[ ! -f "${env_file}" ]]; then
    echo "Missing env file: ${env_file}"
    exit 1
  fi

  set -a
  # shellcheck disable=SC1090
  source "${env_file}"
  set +a

  export DEPLOY_ENV_NAME="${env_name}"
  export DEPLOY_ROOT_DIR="${root_dir}"
  export DEPLOY_ENV_FILE="${env_file}"

  if [[ -z "${GCP_PROJECT_ID:-}" ]]; then
    echo "GCP_PROJECT_ID is required in ${env_file}"
    exit 1
  fi
  if [[ -z "${GCP_REGION:-}" ]]; then
    echo "GCP_REGION is required in ${env_file}"
    exit 1
  fi
  if [[ -z "${CLOUD_RUN_SERVICE:-}" ]]; then
    echo "CLOUD_RUN_SERVICE is required in ${env_file}"
    exit 1
  fi
  if [[ -z "${ARTIFACT_REPO:-}" ]]; then
    echo "ARTIFACT_REPO is required in ${env_file}"
    exit 1
  fi
  if [[ -z "${APP_ENV:-}" ]]; then
    echo "APP_ENV is required in ${env_file}"
    exit 1
  fi

  export IMAGE="${GCP_REGION}-docker.pkg.dev/${GCP_PROJECT_ID}/${ARTIFACT_REPO}/${CLOUD_RUN_SERVICE}"
}

require_gcloud_auth() {
  if ! gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>/dev/null | grep -q .; then
    echo "No active gcloud account. Run: gcloud auth login"
    exit 1
  fi
}

project_number() {
  gcloud projects describe "${GCP_PROJECT_ID}" --format='value(projectNumber)'
}

default_compute_sa() {
  echo "$(project_number)-compute@developer.gserviceaccount.com"
}
