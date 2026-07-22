#!/usr/bin/env bash
# PreToolUse(Bash) guard — keep the working directory pinned at the workspace root.
#
# Blocks a bare (non-subshell) `cd` that DESCENDS into a named subdirectory,
# e.g.  `cd backend && mvn test`  or  `cd admin`  (these persist across tool
# calls and drag cwd into a submodule).
#
# Allowed (NOT blocked):
#   (cd backend && mvn test)   subshell — cwd auto-returns to root
#   $(cd backend && ...)       command substitution — runs in a subshell
#   cd ..    cd -    cd ~      cd /abs/path   cd .    — walking up / back to root
#
# Detection: a `cd <name>` or `cd ./<name>` whose statement separator is line
# start / `;` / `&` / `|` (i.e. NOT preceded by `(` or `` ` `` or `$(`).
set -euo pipefail

cmd="$(cat | jq -r '.tool_input.command // ""')"

if printf '%s' "$cmd" | grep -Eq '(^|[;&|])[[:space:]]*cd[[:space:]]+(\./)?[A-Za-z0-9_]'; then
  cat <<'JSON'
{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"工作目录必须停在 workspace 根：禁止裸 `cd` 进子目录（会污染后续命令的 cwd）。请改用子 shell，例如 (cd backend && <cmd>)，命令结束后 cwd 自动回到根目录；或使用绝对路径。"}}
JSON
  exit 0
fi
exit 0
