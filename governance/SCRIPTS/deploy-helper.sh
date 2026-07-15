#!/usr/bin/env bash
set -euo pipefail

# deploy-helper.sh
# Usage: source governance/SCRIPTS/deploy-helper.sh && load_env <env-name>
#
# Loads environment variables from governance/ENVIRONMENTS/<env-name>.env.
# Do not execute this script directly; source it instead.

if [[ -n "${BASH_VERSION:-}" ]]; then
  SCRIPT_FILE="${BASH_SOURCE[0]}"
elif [[ -n "${ZSH_VERSION:-}" ]]; then
  SCRIPT_FILE="${(%):-%N}"
else
  SCRIPT_FILE="$0"
fi
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_FILE")" && pwd)"

load_env() {
  local env_name="${1:-}"
  if [[ -z "$env_name" ]]; then
    echo "Usage: source deploy-helper.sh && load_env <env-name>" >&2
    return 1
  fi

  local env_file="$SCRIPT_DIR/../ENVIRONMENTS/${env_name}.env"
  if [[ ! -f "$env_file" ]]; then
    echo "Environment config not found: $env_file" >&2
    return 1
  fi

  # Child deployment scripts (stop/start/check) consume these variables through
  # the process environment. Preserve the caller's allexport setting while
  # exporting values loaded from the environment file.
  local had_allexport=0
  case "$-" in
    *a*) had_allexport=1 ;;
  esac
  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  if [[ "$had_allexport" -eq 0 ]]; then
    set +a
  fi
  echo "Loaded environment: $env_name (${SERVER_HOST})"
}

# Direct execution prints usage.
if [[ -n "${BASH_VERSION:-}" && "$SCRIPT_FILE" == "${0}" ]]; then
  echo "Source this file, do not execute it directly:"
  echo "  source governance/SCRIPTS/deploy-helper.sh && load_env test"
fi
