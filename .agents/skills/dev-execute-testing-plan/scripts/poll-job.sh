#!/usr/bin/env bash
# Poll a GitLab job until it reaches a terminal state, then print result + notify.
# Usage: ./poll-job.sh <project> <job_id> [job_name] [interval_seconds]
#
# Examples:
#   ./poll-job.sh full-stack/activities/activities-web 12345678
#   ./poll-job.sh full-stack/activities/activities-web 12345678 deploy_devstack 30

set -euo pipefail

PROJECT="${1:?Usage: $0 <project> <job_id> [job_name] [interval_seconds]}"
JOB_ID="${2:?Usage: $0 <project> <job_id> [job_name] [interval_seconds]}"
JOB_NAME="${3:-deploy_devstack}"
INTERVAL="${4:-30}"

ENCODED_PROJECT=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$PROJECT', safe=''))")
GITLAB_TOKEN=$(glab config get token 2>/dev/null || echo "")

check_status() {
  if [[ -n "$GITLAB_TOKEN" ]]; then
    curl -sf \
      -H "PRIVATE-TOKEN: $GITLAB_TOKEN" \
      "https://gitlab.agodadev.io/api/v4/projects/${ENCODED_PROJECT}/jobs/${JOB_ID}" \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"
  else
    glab api "projects/${ENCODED_PROJECT}/jobs/${JOB_ID}" --hostname gitlab.agodadev.io \
      | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"
  fi
}

echo "Polling job $JOB_ID ($JOB_NAME) every ${INTERVAL}s..."

while true; do
  STATUS=$(check_status)
  TIMESTAMP=$(date '+%H:%M:%S')
  echo "[$TIMESTAMP] status: $STATUS"

  case "$STATUS" in
    success)
      echo "$JOB_NAME SUCCEEDED"
      osascript -e "display notification \"$JOB_NAME completed successfully\" with title \"GitLab CI\"" 2>/dev/null || true
      exit 0
      ;;
    failed|canceled|skipped)
      echo "$JOB_NAME FAILED/SKIPPED (status: $STATUS)"
      osascript -e "display notification \"$JOB_NAME $STATUS\" with title \"GitLab CI\"" 2>/dev/null || true
      exit 1
      ;;
    *)
      sleep "$INTERVAL"
      ;;
  esac
done
