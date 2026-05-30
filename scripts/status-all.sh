#!/bin/bash
# status-all.sh — Show git status for all repositories

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPOS_DIR="$(dirname "$SCRIPT_DIR")/repos"

echo "=== Workspace Git Status ==="
echo ""

# Show workspace status
echo "[workspace]"
git -C "$(dirname "$SCRIPT_DIR")" status --short
echo ""

# Show each repo status
for repo in backend admin miniapp; do
  REPO_PATH="$REPOS_DIR/$repo"
  if [ -d "$REPO_PATH/.git" ]; then
    BRANCH=$(git -C "$REPO_PATH" branch --show-current)
    STATUS=$(git -C "$REPO_PATH" status --short)
    echo "[$repo] branch: $BRANCH"
    if [ -n "$STATUS" ]; then
      echo "$STATUS"
    else
      echo "  (clean)"
    fi
    echo ""
  else
    echo "[$repo] Not cloned"
    echo ""
  fi
done
