#!/usr/bin/env bash
# Count review-page hits (/locations/by-slug/<slug>) for one day from Cloud Logging.
# Usage:
#   yarn report:reviews:staging                  → yesterday
#   yarn report:reviews:production
#   yarn report:reviews:production 2026-10-29    → a specific day
#
# Optional env:
#   REPORT_TZ=Asia/Kolkata         → time zone that defines "the day" (default Asia/Kolkata)
#   LOG_LIMIT=10000
#
# Read-only: runs only `gcloud logging read`.
set -euo pipefail

# Scheduled runs (e.g. Claude Desktop) may not load the login shell profile,
# so add the usual Homebrew / gcloud install locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/google-cloud-sdk/bin:${PATH}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# shellcheck disable=SC1091
source "${SCRIPT_DIR}/lib/load-env.sh"

load_deploy_env "${1:-}"

# Not require_gcloud_auth: it hides gcloud's stderr, which is the only clue
# when a sandboxed run can't use the credentials.
if ! ACTIVE_ACCOUNT="$(gcloud auth list --filter=status:ACTIVE --format='value(account)' 2>&1)" \
  || [[ -z "${ACTIVE_ACCOUNT}" ]]; then
  echo "gcloud auth check failed."
  echo "  gcloud: $(command -v gcloud || echo 'not found')"
  echo "  HOME=${HOME} USER=$(id -un) CLOUDSDK_CONFIG=${CLOUDSDK_CONFIG:-<unset>}"
  echo "  output: ${ACTIVE_ACCOUNT:-<empty>}"
  exit 1
fi

REPORT_TZ="${REPORT_TZ:-Asia/Kolkata}"
LOG_LIMIT="${LOG_LIMIT:-10000}"

# Resolve the report day (BSD date on macOS, GNU date elsewhere).
if [[ $# -ge 2 ]]; then
  DAY="$2"
elif date -v-1d >/dev/null 2>&1; then
  DAY="$(TZ="$REPORT_TZ" date -v-1d +%Y-%m-%d)"
else
  DAY="$(TZ="$REPORT_TZ" date -d yesterday +%Y-%m-%d)"
fi

if date -v-1d >/dev/null 2>&1; then
  NEXT_DAY="$(date -j -v+1d -f %Y-%m-%d "$DAY" +%Y-%m-%d)"
  RAW_OFFSET="$(TZ="$REPORT_TZ" date -j -f %Y-%m-%d "$DAY" +%z)"
else
  NEXT_DAY="$(date -d "$DAY + 1 day" +%Y-%m-%d)"
  RAW_OFFSET="$(TZ="$REPORT_TZ" date -d "$DAY" +%z)"
fi
# +0530 → +05:30 for RFC 3339 timestamps
OFFSET="${RAW_OFFSET:0:3}:${RAW_OFFSET:3:2}"

START="${DAY}T00:00:00${OFFSET}"
END="${NEXT_DAY}T00:00:00${OFFSET}"

FILTER="resource.labels.service_name=\"${CLOUD_RUN_SERVICE}\"
jsonPayload.context=\"HTTP\"
jsonPayload.message:\"/locations/by-slug/\"
timestamp>=\"${START}\"
timestamp<\"${END}\""

ROWS="$(gcloud logging read "$FILTER" \
  --project="${GCP_PROJECT_ID}" \
  --limit="$LOG_LIMIT" \
  --order=asc \
  --format='value(timestamp,jsonPayload.message,httpRequest.status)')"

echo "# EasyReview review-page report"
echo "Day: ${DAY} (${REPORT_TZ})"
echo "Window: ${START} → ${END}"
echo "Env: ${DEPLOY_ENV_NAME} (project ${GCP_PROJECT_ID}, service ${CLOUD_RUN_SERVICE})"
echo

if [[ -z "$ROWS" ]]; then
  echo "Total hits: 0"
  echo "Unique businesses: 0"
  exit 0
fi

# Each row: timestamp<TAB>url<TAB>status → timestamp<TAB>slug<TAB>status
PARSED="$(printf '%s\n' "$ROWS" | awk -F'\t' '{
  slug = $2
  sub(/.*\/locations\/by-slug\//, "", slug)
  sub(/[?#\/].*/, "", slug)
  print $1 "\t" slug "\t" $3
}')"

TOTAL="$(printf '%s\n' "$PARSED" | wc -l | tr -d ' ')"
UNIQUE="$(printf '%s\n' "$PARSED" | cut -f2 | sort -u | wc -l | tr -d ' ')"

echo "Total hits: ${TOTAL}"
echo "Unique businesses: ${UNIQUE}"
if [[ "$TOTAL" -ge "$LOG_LIMIT" ]]; then
  echo "WARNING: hit LOG_LIMIT=${LOG_LIMIT}; counts may be truncated."
fi
echo

echo "## Hits per business (timestamps in UTC)"
echo -e "slug\thits\tfirst_seen\tlast_seen\tnon_2xx"
printf '%s\n' "$PARSED" | awk -F'\t' '{
  hits[$2]++
  if (!($2 in first)) first[$2] = $1
  last[$2] = $1
  if ($3 != "" && $3 !~ /^2/) errors[$2]++
} END {
  for (s in hits) print s "\t" hits[s] "\t" first[s] "\t" last[s] "\t" (errors[s] + 0)
}' | sort -t$'\t' -k2,2nr
echo

echo "## Non-2xx responses"
NON_2XX="$(printf '%s\n' "$PARSED" | awk -F'\t' '$3 != "" && $3 !~ /^2/')"
if [[ -z "$NON_2XX" ]]; then
  echo "None"
else
  echo -e "timestamp\tslug\tstatus"
  printf '%s\n' "$NON_2XX"
fi
