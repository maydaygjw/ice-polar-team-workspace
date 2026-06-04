# Return to Main Branch

## Objective

Switch all repositories — the workspace root and every submodule — back to their respective main branch with a clean working tree.

## Target Branches

| Repository | Directory | Main Branch |
|------------|-----------|-------------|
| Workspace root | `.` | `main` |
| yshop-drink | `backend/` | `master` |
| yshop-drink-vue | `admin/` | `master` |
| icepolarminiapp | `miniapp/` | `main` |
| icepolar-dms | `icepolar-dms/` | `main` |

## Procedure

Run the following steps **in order** from the workspace root:

### 1. Check current state

```bash
for d in . backend admin miniapp icepolar-dms; do
  path=$(test "$d" = "." && echo "." || echo "$d")
  branch=$(cd "$path" && git branch --show-current)
  dirty=$(cd "$path" && git status --short | wc -l | xargs)
  echo "[$path] branch=$branch dirty=$dirty"
done
```

### 2. Stash or reset uncommitted changes (if any)

**Option A — Stash (preserve work)**:
```bash
for d in . backend admin miniapp icepolar-dms; do
  path=$(test "$d" = "." && echo "." || echo "$d")
  (cd "$path" && git stash push -m "auto-stash before return-to-main")
done
```

**Option B — Hard reset (discard work)** — only if the user explicitly confirms:
```bash
for d in . backend admin miniapp icepolar-dms; do
  path=$(test "$d" = "." && echo "." || echo "$d")
  (cd "$path" && git reset --hard && git clean -fd)
done
```

### 3. Switch to main branch

```bash
(cd backend && git checkout master)
(cd admin && git checkout master)
(cd miniapp && git checkout main)
(cd icepolar-dms && git checkout main)
(git checkout main)
```

### 4. Pull latest changes

```bash
for d in . backend admin miniapp icepolar-dms; do
  path=$(test "$d" = "." && echo "." || echo "$d")
  branch=$(cd "$path" && git branch --show-current)
  (cd "$path" && git pull origin "$branch")
done
```

### 5. Delete merged feature branches (optional cleanup)

```bash
for d in . backend admin miniapp icepolar-dms; do
  path=$(test "$d" = "." && echo "." || echo "$d")
  main=$(cd "$path" && git branch --show-current)
  (cd "$path" && git branch --merged "$main" | grep -v "^\*" | grep -v "^  $main$" | xargs -r git branch -d)
done
```

## Verification Checklist

- [ ] `git status` in every repo shows **clean working tree**
- [ ] `git branch --show-current` returns the correct main branch per repo
- [ ] `git log --oneline -3` shows the latest commit matches remote
- [ ] No feature branches remain that are already merged

## Escalation

Produce `REPORT.md` and pause if any of the following occur:

| Condition | Action |
|-----------|--------|
| Uncommitted changes the user wants to keep but `git stash` fails | Report file paths and pause for manual resolution |
| `git pull` produces merge conflicts | Report conflicted files and pause for resolution |
| Submodule is in detached HEAD state | Report repo and pause for manual checkout |
| Local branch has unpushed commits the user wants preserved | Report branch/commits and pause for user decision |
