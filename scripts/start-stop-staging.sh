#!/usr/bin/env bash
# Stop, start, or check staging Cloud Run, Cloud SQL, and the metrics scheduler.
#
# Stop pauses the scheduler first, so it does not call a service that is down,
# then scales Cloud Run to 0 instances and stops the database. The disk is kept,
# so data stays. Start brings the database up, turns Cloud Run back to automatic
# scaling with the minimum from staging.env, then resumes the scheduler.
#
# Usage:
#   yarn staging:stop
#   yarn staging:start
#   yarn staging:status
#
# Requires an existing gcloud login (`gcloud auth login`) and deploy/environments/staging.env.
# This script refuses to run against production.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/load-env.sh"

action="${1:-}"
if [[ "${action}" != "stop" && "${action}" != "start" && "${action}" != "status" ]]; then
  echo "Usage: yarn staging:stop | yarn staging:start | yarn staging:status"
  exit 1
fi

load_deploy_env staging
require_gcloud_auth

if [[ -z "${CLOUD_SQL_INSTANCE:-}" ]]; then
  echo "CLOUD_SQL_INSTANCE is empty in ${DEPLOY_ENV_FILE}"
  exit 1
fi
if [[ -z "${CLOUD_RUN_SERVICE:-}" ]]; then
  echo "CLOUD_RUN_SERVICE is empty in ${DEPLOY_ENV_FILE}"
  exit 1
fi

instance="${CLOUD_SQL_INSTANCE##*:}"
if [[ "${instance}" != "easyreview-staging" ]]; then
  echo "Refusing to change '${instance}'. This command is only for easyreview-staging."
  exit 1
fi

min_instances="${CLOUD_RUN_MIN_INSTANCES:-1}"
max_instances="${CLOUD_RUN_MAX_INSTANCES:-2}"
scheduler_job="${SCHEDULER_JOB_NAME:-refresh-location-metrics}"

print_section() {
  echo
  echo "$1"
  echo "--------------------"
}

print_status() {
  print_section "Cloud SQL"
  gcloud sql instances describe "${instance}" \
    --project="${GCP_PROJECT_ID}" \
    --format='yaml(state,settings.activationPolicy)'
  print_section "Cloud Run"
  gcloud run services describe "${CLOUD_RUN_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --format='yaml(metadata.annotations["run.googleapis.com/scalingMode"],metadata.annotations["run.googleapis.com/manualInstanceCount"])'
  print_section "Cloud Scheduler"
  gcloud scheduler jobs describe "${scheduler_job}" \
    --project="${GCP_PROJECT_ID}" \
    --location="${GCP_REGION}" \
    --format='yaml(name,state)'
  echo
}

scheduler_state() {
  gcloud scheduler jobs describe "${scheduler_job}" \
    --project="${GCP_PROJECT_ID}" \
    --location="${GCP_REGION}" \
    --format='value(state)'
}

pause_scheduler() {
  if [[ "$(scheduler_state)" == "PAUSED" ]]; then
    echo "Scheduler job ${scheduler_job} is already paused."
    return
  fi
  echo "Pausing scheduler job ${scheduler_job}."
  gcloud scheduler jobs pause "${scheduler_job}" \
    --project="${GCP_PROJECT_ID}" \
    --location="${GCP_REGION}"
}

resume_scheduler() {
  if [[ "$(scheduler_state)" == "ENABLED" ]]; then
    echo "Scheduler job ${scheduler_job} is already enabled."
    return
  fi
  echo "Resuming scheduler job ${scheduler_job}."
  gcloud scheduler jobs resume "${scheduler_job}" \
    --project="${GCP_PROJECT_ID}" \
    --location="${GCP_REGION}"
}

scale_cloud_run_to_zero() {
  echo "Scaling ${CLOUD_RUN_SERVICE} to 0 instances."
  gcloud run services update "${CLOUD_RUN_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --scaling=0
}

scale_cloud_run_up() {
  echo "Scaling ${CLOUD_RUN_SERVICE} to automatic, minimum ${min_instances}."
  gcloud run services update "${CLOUD_RUN_SERVICE}" \
    --project="${GCP_PROJECT_ID}" \
    --region="${GCP_REGION}" \
    --scaling=auto \
    --min-instances="${min_instances}" \
    --max-instances="${max_instances}"
}

if [[ "${action}" == "status" ]]; then
  print_status
  exit 0
fi

if [[ "${action}" == "stop" ]]; then
  pause_scheduler
  scale_cloud_run_to_zero
  echo "Stopping ${instance} in ${GCP_PROJECT_ID}. Data stays on the disk."
  gcloud sql instances patch "${instance}" \
    --project="${GCP_PROJECT_ID}" \
    --activation-policy=NEVER \
    --quiet
else
  echo "Starting ${instance} in ${GCP_PROJECT_ID}."
  gcloud sql instances patch "${instance}" \
    --project="${GCP_PROJECT_ID}" \
    --activation-policy=ALWAYS \
    --quiet
  scale_cloud_run_up
  resume_scheduler
fi

print_status
