#!/usr/bin/env bash
# Create or update the Cloud Scheduler job that refreshes location metrics.
# Schedule: 9:00, 15:00, 21:00 Asia/Kolkata (IST)
#
# Usage:
#   yarn gcp:scheduler:staging
#   yarn gcp:scheduler:production
#
# Prerequisites:
#   - Cloud Run service already deployed with CRON_SECRET wired
#   - Secret Manager secret CRON_SECRET exists
#   - cloudscheduler.googleapis.com enabled (yarn gcp:bootstrap:<env>)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/load-env.sh"

load_deploy_env "${1:-}"
require_gcloud_auth

: "${CRON_SECRET_NAME:=CRON_SECRET}"
: "${SCHEDULER_JOB_NAME:=refresh-location-metrics}"
: "${SCHEDULER_SCHEDULE:=0 9,15,21 * * *}"
: "${SCHEDULER_TIME_ZONE:=Asia/Kolkata}"
: "${SCHEDULER_ATTEMPT_DEADLINE:=900s}"

SERVICE_URL="$(gcloud run services describe "${CLOUD_RUN_SERVICE}" \
  --project "${GCP_PROJECT_ID}" \
  --region "${GCP_REGION}" \
  --format='value(status.url)')"

if [[ -z "${SERVICE_URL}" ]]; then
  echo "Cloud Run service '${CLOUD_RUN_SERVICE}' has no URL. Deploy first:"
  echo "  yarn deploy:${DEPLOY_ENV_NAME}"
  exit 1
fi

JOB_URI="${SERVICE_URL}/internal/jobs/refresh-location-metrics"

CRON_SECRET_VALUE="$(gcloud secrets versions access latest \
  --secret="${CRON_SECRET_NAME}" \
  --project="${GCP_PROJECT_ID}")"

if [[ -z "${CRON_SECRET_VALUE}" ]]; then
  echo "Secret '${CRON_SECRET_NAME}' is empty. Create it via:"
  echo "  yarn gcp:bootstrap:${DEPLOY_ENV_NAME}"
  exit 1
fi

echo "Configuring Cloud Scheduler for ${DEPLOY_ENV_NAME}"
echo "  Project:  ${GCP_PROJECT_ID}"
echo "  Region:   ${GCP_REGION}"
echo "  Job:      ${SCHEDULER_JOB_NAME}"
echo "  Schedule: ${SCHEDULER_SCHEDULE} (${SCHEDULER_TIME_ZONE})"
echo "  URI:      ${JOB_URI}"
echo

COMMON_ARGS=(
  --project "${GCP_PROJECT_ID}"
  --location "${GCP_REGION}"
  --schedule "${SCHEDULER_SCHEDULE}"
  --time-zone "${SCHEDULER_TIME_ZONE}"
  --uri "${JOB_URI}"
  --http-method POST
  --headers "Content-Type=application/json,x-cron-secret=${CRON_SECRET_VALUE}"
  --attempt-deadline "${SCHEDULER_ATTEMPT_DEADLINE}"
  --message-body "{}"
)

if gcloud scheduler jobs describe "${SCHEDULER_JOB_NAME}" \
  --project="${GCP_PROJECT_ID}" \
  --location="${GCP_REGION}" >/dev/null 2>&1; then
  echo "Updating existing scheduler job '${SCHEDULER_JOB_NAME}'..."
  gcloud scheduler jobs update http "${SCHEDULER_JOB_NAME}" "${COMMON_ARGS[@]}"
else
  echo "Creating scheduler job '${SCHEDULER_JOB_NAME}'..."
  gcloud scheduler jobs create http "${SCHEDULER_JOB_NAME}" "${COMMON_ARGS[@]}"
fi

echo
echo "Scheduler ready."
echo "Manual test run:"
echo "  gcloud scheduler jobs run ${SCHEDULER_JOB_NAME} --project=${GCP_PROJECT_ID} --location=${GCP_REGION}"
