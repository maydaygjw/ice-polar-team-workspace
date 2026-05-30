#!/bin/bash
# pull-all.sh — Pull latest changes for all repositories

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$(dirname "$SCRIPT_DIR")/repos"

echo "=== Pulling all repositories ==="
echo ""

for repo in backend admin miniapp; do
  REPO_PATH="$REPOS_DIR/$repo"
  if [ -d "$REPO_PATH/.git" ]; then
    echo "[$repo] Pulling..."
    (cd "$REPO_PATH" && git pull)
    echo "[$repo] Done"
  else
    echo "[$repo] Not found, run ./scripts/clone-all.sh first"
  fi
  echo ""
done

echo "=== All pulls complete ==="
