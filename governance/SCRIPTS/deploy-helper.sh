#!/usr/bin/env bash
set -euo pipefail

# deploy-helper.sh
# Usage: source governance/SCRIPTS/deploy-helper.sh && load_env <env-name>
#
# Loads environment variables from governance/ENVIRONMENTS/<env-name>.env.
# Do not execute this script directly; source it instead.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

  # shellcheck source=/dev/null
  source "$env_file"
  echo "Loaded environment: $env_name (${SERVER_HOST})"
}

# Direct execution prints usage.
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source this file, do not execute it directly:"
  echo "  source governance/SCRIPTS/deploy-helper.sh && load_env test"
fi
