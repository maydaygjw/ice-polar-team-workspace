#!/usr/bin/env bash
set -euo pipefail

# Query a Yunxiao pipeline run and its job logs.
# Usage:
#   bash governance/SCRIPTS/query-yunxiao.sh --pipeline backend [--run 123]
#   bash governance/SCRIPTS/query-yunxiao.sh --pipeline 1408445 --latest

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${workspace_root}/.env.local"

# Keep credentials out of shell tracing and terminal output.
set +x
if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$env_file" >/dev/null 2>&1
  set +a
fi

: "${YUNXIAO_API_DOMAIN:?YUNXIAO_API_DOMAIN is missing (set it in .env.local)}"
: "${YUNXIAO_TOKEN:?YUNXIAO_TOKEN is missing (set it in .env.local)}"

pipeline=""
run_id=""
while (($#)); do
  case "$1" in
    --pipeline)
      (($# >= 2)) || { echo '--pipeline requires a value' >&2; exit 2; }
      pipeline="$2"
      shift 2
      ;;
    --run)
      (($# >= 2)) || { echo '--run requires a value' >&2; exit 2; }
      run_id="$2"
      shift 2
      ;;
    --latest)
      run_id=""
      shift
      ;;
    --help|-h)
      sed -n '1,8p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

case "$pipeline" in
  backend) pipeline_id="${YUNXIAO_PIPELINE_BACKEND_ID:-1408445}" ;;
  admin) pipeline_id="${YUNXIAO_PIPELINE_ADMIN_ID:-1409672}" ;;
  h5) pipeline_id="${YUNXIAO_PIPELINE_H5_ID:-1409664}" ;;
  db) pipeline_id="${YUNXIAO_PIPELINE_DB_ID:-1410661}" ;;
  '' ) echo 'Usage: query-yunxiao.sh --pipeline backend|admin|h5|db|<pipeline-id> [--run <run-id>|--latest]' >&2; exit 2 ;;
  *) pipeline_id="$pipeline" ;;
esac

[[ "$pipeline_id" =~ ^[0-9]+$ ]] || { echo 'Pipeline ID must be numeric.' >&2; exit 2; }
if [[ -n "$run_id" && ! "$run_id" =~ ^[0-9]+$ ]]; then
  echo 'Run ID must be numeric.' >&2
  exit 2
fi

base_url="https://${YUNXIAO_API_DOMAIN}/oapi/v1/flow/pipelines/${pipeline_id}"
api_get() {
  curl --silent --show-error --fail \
    -H "x-yunxiao-token: ${YUNXIAO_TOKEN}" \
    -H 'Content-Type: application/json' \
    "$1"
}

if [[ -z "$run_id" ]]; then
  runs="$(api_get "${base_url}/runs?perPage=1&page=1")" || {
    echo 'Failed to list pipeline runs. Check the Yunxiao token read permission and pipeline ID.' >&2
    exit 1
  }
  run_id="$(jq -er 'if type == "array" then .[0].pipelineRunId // empty else .pipelineRuns[0].pipelineRunId // empty end' <<<"$runs")" || {
    echo "No runs found for pipeline ${pipeline_id}." >&2
    exit 1
  }
fi

run="$(api_get "${base_url}/runs/${run_id}")" || {
  echo "Failed to query pipeline ${pipeline_id}, run ${run_id}. Check the Yunxiao token read permission." >&2
  exit 1
}

# Never print globalParams or job params wholesale: Yunxiao may return unmasked
# credentials there even when the run itself is readable.
jq -r '
  def param($key): ([.globalParams[]? | select(.key == $key) | .value][0] // "-");
  "Pipeline: \(.pipelineId // "-")  Run: \(.pipelineRunId // "-")  Status: \(.status // "UNKNOWN")",
  "Branch: \(param("CI_COMMIT_REF_NAME"))  Commit: \(param("CI_COMMIT_ID"))  Remark: \(param("BUILD_REMARK"))",
  (.stages[]? as $stage |
    "Stage: \($stage.name // "-")  Status: \($stage.stageInfo.status // "UNKNOWN")",
    ($stage.stageInfo.jobs[]? |
      "  Job: \(.name // "-")  Status: \(.status // "UNKNOWN")  ID: \(.id // "-")"))
' <<<"$run"

overall_status="$(jq -r '.status // "UNKNOWN"' <<<"$run")"
job_count="$(jq '[.stages[]?.stageInfo.jobs[]?] | length' <<<"$run")"
if ((job_count == 0)); then
  echo 'No job log entries are present in the run details.'
fi

log_error=0
while IFS=$'\t' read -r job_id job_name; do
  [[ -n "$job_id" ]] || continue
  echo "--- Log: ${job_name} (job ${job_id}) ---"
  log_response=""
  if ! log_response="$(api_get "${base_url}/runs/${run_id}/job/${job_id}/log" 2>/dev/null)"; then
    echo 'Unable to read this job log (check the Yunxiao pipeline job-log read permission).' >&2
    log_error=1
    continue
  fi
  log_content="$(jq -r '.content // empty' <<<"$log_response")"
  if [[ -n "$log_content" ]]; then
    # Best-effort protection for common credential formats in build output.
    sed -E \
      -e 's/([A-Za-z0-9_]*(PASSWORD|TOKEN|SECRET|ACCESS_KEY|PRIVATE_KEY)[A-Za-z0-9_]*[=:][[:space:]]*)[^[:space:],;]+/\1<redacted>/Ig' \
      -e 's/(Bearer[[:space:]]+)[^[:space:]]+/\1<redacted>/Ig' \
      -e 's#https?://[^[:space:]]+[?][^[:space:]]+#<redacted-url>#Ig' \
      -e 's#(OSSAccessKeyId|Signature|security-token)=([^&[:space:]]+)#\1=<redacted>#Ig' \
      -e 's#(jdbc:mysql://)[^?[:space:]]+#\1<redacted>#Ig' <<<"$log_content"
  else
    echo '(No log content returned.)'
  fi
done < <(jq -r '.stages[]?.stageInfo.jobs[]? | [.id // "", .name // "unknown"] | @tsv' <<<"$run")

if [[ "$overall_status" == "SUCCESS" && "$log_error" -eq 0 ]]; then
  exit 0
elif [[ "$log_error" -ne 0 ]]; then
  exit 3
elif [[ "$overall_status" == "FAILED" || "$overall_status" == "FAIL" ]]; then
  exit 2
fi
exit 1
