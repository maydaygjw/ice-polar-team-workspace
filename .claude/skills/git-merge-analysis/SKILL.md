---
name: git-merge-analysis
description: Analyze merge compatibility between two Git branches. Use when the user explicitly asks to compare branches, check for merge conflicts, preview a merge, or analyze differences before merging. Supports local/remote branch pairs.
---

# Git Merge Analysis

Analyze the differences between two Git branches and produce a comprehensive merge report including conflict detection, commit history comparison, and merge recommendations.

## When to Use

This skill is invoked explicitly by the user. Do not auto-trigger.

Common invocation patterns:
- "帮我看一下 branch A 和 branch B 能不能合并"
- "比较一下这两个分支的差异"
- "检测合并冲突"
- "preview merge of X into Y"
- "分析上游改动"

## Prerequisites

- The repository must be a valid Git repo
- The branches/remotes being compared must exist or be fetchable
- Git must be available in the environment

## Workflow

### Step 1: Identify Branches

Ask the user to clarify if not already provided:
- Source branch (the one being merged FROM) — usually a remote/upstream branch
- Target branch (the one being merged INTO) — usually local branch

Default conventions:
- If user mentions "upstream" or "上游" without specifying, assume it's a remote tracking branch
- If only one branch is given, assume target is the **current local branch** (`$(git branch --show-current)`), not hardcoded `master`
- Never assume target is `master` unless the user explicitly says so

Parse branch references:
- `origin/master` → remote branch
- `yshop/master` → remote branch
- `master` → local branch
- `HEAD` → current commit

### Step 2: Fetch if Needed

If the source is a remote branch and has not been fetched recently:

```bash
git fetch <remote> <branch>
```

If fetch fails (network error, SSL issue, auth failure):
- Report the error to the user
- Check if the remote refs exist locally: `git show-ref | grep <remote>`
- If local refs exist, proceed with cached data but note this limitation
- If no local cache, stop and ask user to resolve connectivity

### Step 3: Find Common Ancestor

```bash
git merge-base <target> <source>
```

Record the merge-base commit hash. This is the divergence point.

### Step 4: Analyze Commit History

**Commits unique to source:**
```bash
git log --oneline --reverse <source> --not <target>
```

**Commits unique to target:**
```bash
git log --oneline --reverse <target> --not <source>
```

**Combined view:**
```bash
git log --oneline --left-right --graph <target>...<source>
```

For each side, summarize:
- Total commit count
- Key themes (look at commit message patterns)
- Any merge commits (indicates complex history)

### Step 5: Detect File-Level Changes

**Files modified by both branches (potential conflict zone):**
```bash
git diff --name-only --diff-filter=M <target>...<source>
```

**Overall change statistics:**
```bash
git diff --stat <target> <source>
```

Group modified files by module/component if possible (infer from file paths).

### Step 6: Detect Merge Conflicts (Critical)

Conflict detection uses a two-phase approach because `git merge-tree` alone can produce false negatives in some scenarios.

#### Phase 1: merge-tree Preview (Fast)

Run `git merge-tree` to get a quick preview:

```bash
BASE=$(git merge-base <target> <source>)
git merge-tree "$BASE" <target> <source>
```

Count conflicts in the output: `grep -ci "conflict"`

Note the result but do not treat it as final.

#### Phase 2: Dry Merge Verification (Accurate)

Always verify with an actual dry merge. This is the authoritative conflict check:

```bash
# Save current branch name
CURRENT_BRANCH=$(git branch --show-current)

# Create temp branch from target
git checkout -b temp-merge-check <target>

# Attempt merge
git merge <source> --no-commit --no-ff

# Check exit status and list conflicted files
if [ $? -ne 0 ]; then
    git diff --name-only --diff-filter=U
fi

# Always clean up
git merge --abort 2>/dev/null || true
git checkout "$CURRENT_BRANCH"
git branch -D temp-merge-check
```

**Record the definitive result from Phase 2.**

**If conflicts exist:**
- List each conflicting file with path
- Show the conflicting sections (run `git diff` on the temp branch before abort, or inspect the working tree)
- Categorize conflicts by severity:
  - **High**: Database schema (`*.sql`), build config (`pom.xml`)
  - **Medium**: Business logic, enums, controller methods
  - **Low**: Comments, formatting, non-critical config

**If no conflicts:**
- Explicitly state "0 conflicts detected — automatic merge possible"
- Still recommend a test-merge branch if the change set is large

### Step 7: Generate Merge Report

Produce a comprehensive merge report. By default, generate an HTML report that can be opened directly in a browser.

#### Report Content Requirements

The report must include:

1. **Core Conclusion** — Conflict count, merge recommendation
2. **Branch Overview** — Target vs source branch summary, latest commits, commit counts
3. **Common Ancestor** — merge-base hash and message
4. **Source Branch Commits** — Unique commits with hash and message (up to 10)
5. **Target Branch Commits** — Unique commits with hash and message (up to 10)
6. **Files Modified by Both** — List of files changed by both branches
7. **Conflict Details** — For each conflict file:
   - File path and severity (High/Medium/Low)
   - Diff showing the conflicting sections (<<<<<<< HEAD / ======= / >>>>>>>)
   - **Analysis** (in Chinese):
     - **feat branch (ours)** — Explain why the current branch made these changes, reference specific commits
     - **yshop branch (theirs)** — Explain why the upstream branch made these changes, reference specific commits
     - **Merge Logic** — Explain why the conflict occurred, how the two changes relate, and the recommended resolution strategy
   - **Recommended Resolution** — Code snippet showing the merged result
8. **Risk Assessment Table** — Risk items with severity levels
9. **Merge Steps** — Step-by-step commands to perform the merge safely

#### Generating the HTML Report

Use the bundled template file at `<skill-path>/assets/merge-report-template.html`. Read the template, replace all `{{PLACEHOLDER}}` tokens with actual content, and write the result to the output file.

**Template placeholders:**

| Placeholder | Content to fill |
|---|---|
| `{{REPORT_TITLE}}` | `"Git Merge Analysis Report"` |
| `{{BRANCH_PAIR}}` | `"target-branch ← source-branch"` |
| `{{GENERATED_DATE}}` | Current date, e.g. `"2026-05-28"` |
| `{{CONFLICT_COUNT}}` | Total number of conflicted files |
| `{{MERGE_RECOMMENDATION}}` | `"Manual Resolution Required"` or `"Automatic Merge Possible"` |
| `{{CONCLUSION_TEXT}}` | 1-2 sentence summary in Chinese |
| `{{SOURCE_COMMIT_COUNT}}` | Number of commits unique to source |
| `{{TARGET_COMMIT_COUNT}}` | Number of commits unique to target |
| `{{CHANGED_FILE_COUNT}}` | Total files changed between branches |
| `{{SOURCE_BRANCH}}` | Source branch name |
| `{{TARGET_BRANCH}}` | Target branch name |
| `{{SOURCE_LATEST_COMMIT_HASH}}` / `{{MSG}}` / `{{DATE}}` | Source branch latest commit details |
| `{{TARGET_LATEST_COMMIT_HASH}}` / `{{MSG}}` / `{{DATE}}` | Target branch latest commit details |
| `{{SOURCE_KEY_THEMES}}` / `{{TARGET_KEY_THEMES}}` | Short description of main changes per branch |
| `{{MERGE_BASE_HASH}}` / `{{MSG}}` | Common ancestor commit info |
| `{{SOURCE_COMMIT_ROWS}}` | HTML `<tr>` rows for source commits (up to 10) |
| `{{TARGET_COMMIT_ROWS}}` | HTML `<tr>` rows for target commits (up to 10) |
| `{{HIGH_CONFLICT_COUNT}}` / `{{MEDIUM}}` / `{{LOW}}` | Count per severity |
| `{{CONFLICT_SECTIONS}}` | Full HTML for each conflict file (see format below) |
| `{{RISK_ROWS}}` | HTML `<tr>` rows for risk assessment table |
| `{{MERGE_STEPS}}` | HTML step-by-step merge instructions |

**Conflict section HTML format** (repeat for each conflict file, insert into `{{CONFLICT_SECTIONS}}`):

```html
<div class="conflict-file {{SEVERITY}}" data-severity="{{SEVERITY}}">
  <div class="conflict-header">
    <span class="conflict-path">{{FILE_PATH}}</span>
    <span class="badge badge-{{SEVERITY}}">{{SEVERITY}}</span>
  </div>
  <div class="conflict-body">
    <pre>{{CONFLICT_DIFF}}</pre>
    <div class="analysis-box">
      <h4>冲突分析</h4>
      <p><strong>当前分支 (ours) 改动原因：</strong>{{WHY_OURS}}</p>
      <p><strong>上游分支 (theirs) 改动原因：</strong>{{WHY_THEIRS}}</p>
      <p><strong>冲突产生的逻辑：</strong>{{CONFLICT_LOGIC}}</p>
      <p><strong>推荐解决方案：</strong>{{RESOLUTION}}</p>
    </div>
  </div>
</div>
```

**Report content rules (strict):**

1. **Branch Overview** — Show up to 10 commits from EACH side. Label as "最近 10 个" with total count.
2. **Conflict analysis** — Each conflict file must include four parts in Chinese:
   - **当前分支改动原因** — WHY the current branch changed this file, with specific commit hashes/messages and business context (1-3 sentences).
   - **上游分支改动原因** — WHY the upstream branch changed this file, with specific commit hashes/messages and business context (1-3 sentences).
   - **冲突产生的逻辑** — HOW the two changes relate spatially and semantically. Why did Git flag it? Are they truly incompatible or just adjacent?
   - **推荐解决方案** — Specific merged code or step-by-step strategy. Include code snippets. If both changes can coexist, state this explicitly.
3. **Diff display** — Show COMPLETE conflict hunks with actual `<<<<<<< HEAD / ======= / >>>>>>>` markers. Do NOT truncate conflict blocks unless they exceed ~80 lines. Use syntax highlighting with color code: green (`.ours`) for HEAD content, blue (`.theirs`) for branch content, orange (`.conflict-marker`) for the markers. Label markers clearly: `<<<<<<< HEAD (ours)` and `>>>>>>> branch-name (theirs)`.
4. **Merged result** — For each conflict file, provide a concrete "合并结果" code snippet showing the recommended resolution after merge. This must be actual code the user can copy, not just a description.
5. **Filter buttons** — The template already includes working JS (`filterConflicts`). Just ensure each `.conflict-file` has the correct `data-severity` attribute.

**Pre-generation workflow:**

```bash
# 1. After dry merge (from Step 6), extract FULL conflict hunks from working tree.
#    Do NOT use grep with fixed line counts — conflict hunks can be arbitrarily long.
#    Use awk to extract complete conflict blocks (from <<<<<<< to >>>>>>>).
for f in $(git diff --name-only --diff-filter=U); do
    awk '/^<<<<<<< /{in_conflict=1} in_conflict{print} /^>>>>>>> /{in_conflict=0}' "$f" \
        > "/tmp/conflict_$(echo "$f" | tr '/' '_').txt"
done

# 2. For each conflict file, analyze commit history to understand WHY each side changed it
BASE=$(git merge-base <target> <source>)
for f in $(git diff --name-only --diff-filter=U); do
    echo "=== $f ==="
    echo "--- TARGET (ours) ---"
    git log --oneline "$BASE"..<target> -- "$f"
    echo "--- SOURCE (theirs) ---"
    git log --oneline "$BASE"..<source> -- "$f"
    echo ""
done

# 3. Build {{CONFLICT_SECTIONS}} HTML:
#    For each conflict file, include:
#    - The COMPLETE conflict hunk(s) with markers (<<<<<<< HEAD / ======= / >>>>>>>)
#    - Color-code: green (.ours) for HEAD content, blue (.theirs) for branch content,
#      orange (.conflict-marker) for the markers themselves
#    - If a conflict hunk exceeds ~80 lines, truncate with "... (truncated)" note
#    - A "合并结果" (merged result) code snippet showing the recommended resolution
#
# 4. Read template, replace placeholders, write to output
# 5. Save to /tmp/merge-report-<target>-<source>.html
# 6. Open in browser for the user
```

#### Alternative: Markdown Report

If HTML generation is not practical, fall back to a structured Markdown report with the same content sections. Use code blocks for diffs and tables for risk assessment.

#### Report Output Location

Save the report to a location the user can easily find:
- Preferred: `/tmp/merge-report-<target>-<source>.html`
- Alternative: `~/.claude/skills/git-merge-analysis-workspace/merge-report-<target>-<source>.html`

Always open the report in the user's default browser after generation.

### Step 8: Provide Recommendations

Based on the analysis:

- **0 conflicts + simple history** → Recommend direct merge
- **0 conflicts + many shared files** → Recommend test-merge branch first
- **Has conflicts** → Provide conflict resolution strategy, ask user preference
- **Large divergence** → Recommend incremental merge or rebase discussion

Always suggest creating a temporary branch for the trial merge as a safety measure.

## Edge Cases

**Remote not accessible:**
- Check local packed-refs: `git show-ref | grep <remote>`
- If refs exist, use cached data with a disclaimer
- If not, ask user about VPN/network access

**No common ancestor:**
- Report as "unrelated histories"
- Warn that merge will produce a messy history
- Suggest `git merge --allow-unrelated-histories` only if user explicitly wants it

**One branch is ancestor of the other:**
- Report as "fast-forward possible"
- Suggest simple `git merge` or `git rebase`

**Shallow clone:**
- Merge-base may fail if the common ancestor is not in local history
- Report limitation and suggest `git fetch --unshallow` if appropriate

## Safety Rules

- Never perform an actual merge without explicit user confirmation
- Never modify the working tree or current branch
- Never push changes to remotes
- All destructive operations must use `--dry-run` or temporary branches only
