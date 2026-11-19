# Source this file from the workspace, then call load_incident_env dev|prod.
# Environment values stay in the workspace; no credentials are bundled here.

load_incident_env() {
  local workspace_root env_name env_file had_allexport=0

  workspace_root="$(git rev-parse --show-toplevel)" || {
    echo "Unable to locate the workspace root." >&2
    return 1
  }
  env_name="${1:-}"
  case "$env_name" in
    dev|prod) ;;
    *)
      echo "Usage: load_incident_env dev|prod" >&2
      return 1
      ;;
  esac

  env_file="$workspace_root/governance/ENVIRONMENTS/$env_name.env"
  if [[ ! -f "$env_file" ]]; then
    echo "Environment configuration not found for: $env_name" >&2
    return 1
  fi

  case "$-" in
    *a*) had_allexport=1 ;;
  esac
  set -a
  # shellcheck source=/dev/null
  source "$env_file"
  if [[ "$had_allexport" -eq 0 ]]; then
    set +a
  fi
  echo "Loaded environment: $env_name"
}
