#!/usr/bin/env bash
set -euo pipefail

# Trigger a dev/test Yunxiao pipeline. Production deployment is intentionally
# not supported by this script.
# Usage:
#   bash governance/SCRIPTS/deploy-yunxiao.sh --target backend [--branch <branch>]
#   bash governance/SCRIPTS/deploy-yunxiao.sh --target all
#   bash governance/SCRIPTS/deploy-yunxiao.sh --target db-info|db-migrate|db-validate

workspace_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
env_file="${workspace_root}/.env.local"

# Never source credentials while shell tracing is enabled.
set +x
if [[ -f "$env_file" ]]; then
  set -a
  # shellcheck source=/dev/null
  source "$env_file" >/dev/null 2>&1
  set +a
fi

target=""
branch=""
while (($#)); do
  case "$1" in
    --target)
      (($# >= 2)) || { echo '--target requires a value' >&2; exit 2; }
      target="$2"
      shift 2
      ;;
    --branch)
      (($# >= 2)) || { echo '--branch requires a value' >&2; exit 2; }
      branch="$2"
      shift 2
      ;;
    --help|-h)
      sed -n '1,10p' "$0" | sed 's/^# //'
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ -z "$target" ]]; then
  echo 'Usage: deploy-yunxiao.sh --target backend|admin|h5|all|db-info|db-migrate|db-validate [--branch <branch>]' >&2
  exit 2
fi

: "${YUNXIAO_API_DOMAIN:?YUNXIAO_API_DOMAIN is missing}"
: "${YUNXIAO_TOKEN:?YUNXIAO_TOKEN is missing}"

backend_id="${YUNXIAO_PIPELINE_BACKEND_ID:-1408445}"
admin_id="${YUNXIAO_PIPELINE_ADMIN_ID:-1409672}"
h5_id="${YUNXIAO_PIPELINE_H5_ID:-1409664}"
db_id="${YUNXIAO_PIPELINE_DB_ID:-1410661}"
backend_repo='https://gitee.com/icepolar/yshop-drink.git'
admin_repo='https://gitee.com/icepolar/yshop-drink-vue.git'
h5_repo='https://gitee.com/icepolar/yshop-activity-h5.git'

trigger_pipeline() {
  local name="$1" pipeline_id="$2" repo="$3" env_key="${4:-}" env_value="${5:-}" db_command="${6:-}"
  local branches='{}' envs='{}' params body response run_id status header_file

  if [[ -n "$branch" ]]; then
    branches="$(jq -cn --arg repo "$repo" --arg branch "$branch" '{runningBranchs: {($repo): $branch}}')"
  fi
  if [[ -n "$env_key" ]]; then
    envs="$(jq -cn --arg key "$env_key" --arg value "$env_value" '{envs: {($key): $value}}')"
  elif [[ -n "$db_command" ]]; then
    envs="$(jq -cn --arg value "$db_command" '{envs: {DB_MIGRATOR_COMMAND: $value}}')"
  fi

  params="$(jq -cn --arg comment "$name dev deployment $(date '+%F %T %z')" \
    --argjson branches "$branches" --argjson envs "$envs" \
    '$branches + $envs + {comment: $comment}')"
  body="$(jq -cn --arg params "$params" '{params: $params}')"

  response="$(
    header_file="$(mktemp)"
    trap 'rm -f "$header_file"' EXIT
    chmod 600 "$header_file"
    printf 'x-yunxiao-token: %s\n' "$YUNXIAO_TOKEN" >"$header_file"
    curl --fail --silent --show-error -X POST \
      "https://${YUNXIAO_API_DOMAIN}/oapi/v1/flow/pipelines/${pipeline_id}/runs" \
      -H 'Content-Type: application/json' \
      -H "@$header_file" \
      --data-raw "$body"
  )"
  # Yunxiao may return the run ID directly (for example, `145`) or wrap it
  # in an object. A primitive response has no status field, so treat it as
  # accepted and let the caller check the run through the pipeline history.
  run_id="$(jq -er '
    if type == "number" or type == "string" then .
    elif type == "object" then
      .pipelineRunId // .runId // .data.pipelineRunId // .data.runId // empty
    else empty end
  ' <<<"$response")" || run_id=""
  status="$(jq -r '
    if type == "object" then (.status // .data.status // "submitted")
    else "submitted" end
  ' <<<"$response")"
  if [[ -z "$run_id" ]]; then
    echo "Yunxiao did not return a pipeline run ID for target '$name'." >&2
    return 1
  fi
  jq -cn --arg target "$name" --arg pipelineRunId "$run_id" --arg status "$status" \
    '{target: $target, pipelineRunId: $pipelineRunId, status: $status}'
}

case "$target" in
  backend)
    trigger_pipeline backend "$backend_id" "$backend_repo" YSHOP_ENV dev2
    ;;
  admin)
    trigger_pipeline admin "$admin_id" "$admin_repo" ADMIN_ENV dev2
    ;;
  h5)
    trigger_pipeline h5 "$h5_id" "$h5_repo" H5_ENV dev2
    ;;
  all)
    trigger_pipeline backend "$backend_id" "$backend_repo" YSHOP_ENV dev2
    trigger_pipeline admin "$admin_id" "$admin_repo" ADMIN_ENV dev2
    trigger_pipeline h5 "$h5_id" "$h5_repo" H5_ENV dev2
    ;;
  db-info|db-migrate|db-validate)
    command="${target#db-}"
    trigger_pipeline "db-${command}" "$db_id" "$backend_repo" '' '' "$command"
    ;;
  *)
    echo "Unsupported target '$target'. Production targets are not supported." >&2
    exit 2
    ;;
esac
