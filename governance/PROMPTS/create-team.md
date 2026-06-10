# Create Engineering Team

## Objective

Analyze a feature request, assemble the right engineering team from `governance/AGENTS/`, and execute the full delivery workflow through to merge.

## Roles

This prompt acts as the **orchestrator**. It drives phase transitions, enforces gates, collects artifacts, generates reports, and handles all user communication. Agents do the specialist work — this prompt keeps them aligned.

## Pre-flight

Read before assembly: `CLAUDE.md` → `ARCHITECTURE.md` → `CONTRACTS.md` → relevant `ADR/` entries.

## Team Assembly

Agents are defined in `governance/AGENTS/`. Read each active agent before assignment.

### Always-on Agents

| Agent | File | Phase |
|-------|------|-------|
| Requirements | `requirements-agent.md` | 1 |
| Architecture | `architecture-agent.md` | 1 |
| Test | `test-agent.md` | 2 |
| Review | `review-agent.md` | 3 |

### Conditional Agents

| Agent | File | Invoke When |
|-------|------|-------------|
| Backend | `backend-agent.md` | `backend/` changes needed |
| Frontend | `frontend-agent.md` | `admin/` changes needed |
| MiniApp | `miniapp-agent.md` | `miniapp/` changes needed |
| UI/UX | `ui-ux-agent.md` | Any new/modified UI component, page, style, or interaction |

> **UI/UX Agent Activation (Hard Rule)**: Activate if **any** of: new page/component, style/layout/interaction change, design spec change, or frontend/miniapp agent is activated **with component-level scope**. UI/UX Agent must complete design delivery before any frontend/miniapp implementation begins.

## Phase Workflow

---

### Phase 1: Discovery, Design & Contract Freeze

**Participants**: requirements-agent, architecture-agent, ui-ux-agent (if activated)

**Parallel execution**:
- requirements-agent: scope, edge cases, acceptance criteria
- architecture-agent: data model, API contracts, module boundaries
- ui-ux-agent: visual style, interaction patterns, component spec (when activated)
- Meanwhile: init status tracker, confirm all required agents activated

**Contract freeze** (architecture-agent lead, requirements-agent review):
1. For each contract layer, explicitly state: (a) changed → update doc, (b) reused as-is → cite existing doc, (c) no contract needed → state reason. No implicit skips.
2. Update `CONTRACTS.md` if platform-level contracts changed
3. Write `governance/feature-docs/{feature}/contract-changes.md` for feature-level API changes
4. Verify against `CONTRACT/backend-api.json` via `extract-openapi` skill
5. Write ADR only if introducing **new architectural patterns**
6. Define branch names per repo

**Gate** — all must be green before proceeding:
- [ ] Requirements spec with in-scope / out-scope boundaries
- [ ] Technical design with DB changes, API contracts, module impact
- [ ] Every contract layer has explicit status (changed / reused / N/A with reason)
- [ ] API contracts documented: platform-level → `CONTRACTS.md`; feature-level → `governance/feature-docs/{feature}/contract-changes.md`
- [ ] OpenAPI JSON snapshot generated if backend changed
- [ ] UI/UX design review approved (if activated)
- [ ] Branch names defined for every affected repo

**→ Escalation**: If any gate is blocked:
1. Immediately stop all active agent work
2. Produce `REPORT.md` in `governance/feature-docs/{feature}/` listing: which gate failed, why, what is missing, what the user must provide or decide
3. **Pause and wait for explicit user confirmation** — no self-approving, skipping, or retrying without user
4. No agent may proceed to Phase 2 until user explicitly clears the gate

**Document collection**:

| Document | Source | Filename | Required |
|----------|--------|----------|----------|
| Requirements spec | requirements-agent | `requirements-spec.md` | Always |
| Technical design | architecture-agent | `technical-design.md` | Always |
| API contract changes | architecture-agent | `contract-changes.md` | If API changed |
| UI/UX design | ui-ux-agent | `ui-ux-design.md` | If UI/UX activated |
| ADR | architecture-agent | `adr-{nnn}.md` | If new pattern introduced |

---

### Phase 2: Parallel Implementation

**Participants**: backend-agent, frontend-agent, miniapp-agent (as activated), ui-ux-agent (as activated), test-agent

**Dependency rule (hard)**: frontend-agent / miniapp-agent **blocked** until ui-ux-agent design delivery is complete. If ui-ux-agent is not activated, the frontend agent must produce a simplified component spec and save it to `governance/feature-docs/{feature}/ui-ux-design.md`.

**Execution**:
- Workspace root: commit directly to `main`, no feature branch
- Submodules: one `feat/<feature-name>` branch per repo from base branch (`backend/` → `master`, `admin/` → `master`, `miniapp/` → `main`, `icepolar-dms/` → `main`)
- Commit format: `feat(scope): description`
- Never commit directly to submodule base branches
- Include migration script in same PR as backend changes
- test-agent designs test plan and writes E2E / unit tests in parallel

**→ Escalation**: If implementation reveals design flaws, pause and assess. If flaw is minor, adjust within Phase 2. If flaw is structural, return to Phase 1 with a delta `REPORT.md` and wait for user confirmation.

---

### Phase 3: Review, Deliver & Merge

**Participants**: review-agent (technical), developer agents

#### Step 3.1: Code Review

**Review checklist** (review-agent):
- [ ] Implementation matches requirements spec
- [ ] API contracts match `CONTRACTS.md` and/or `contract-changes.md`
- [ ] No hardcoded secrets
- [ ] Tenant isolation verified in all new queries
- [ ] Migration script present and correct
- [ ] Tests cover the change
- [ ] ADR updated if needed
- [ ] Submodule branches follow naming convention
- [ ] No code duplication
- [ ] Security checked (SQL injection, XSS, etc.)
- [ ] Visual consistency verified (if ui-ux-agent activated)

**Process check**:
- [ ] All activated agents reported completion
- [ ] All required artifacts present
- [ ] No unresolved escalation reports

**Gate**: PASS → proceed to Step 3.2; FAIL → return to Phase 2.

#### Step 3.2: User Confirmation

1. Collect change summaries from all agents
2. Review-agent outputs review conclusion
3. Present `CHANGE-REPORT.md` (overview, affected files, API/DB/UI changes, test coverage, review conclusion, risks) and **wait for explicit user confirmation**

**Gate**: user confirms → Step 3.3; user requests changes → back to Phase 2/3.1; user rejects → terminate.

#### Step 3.3: Pull Request Creation

**Actions**:
1. Workspace root: already on `main`, push if needed
2. Push submodule feature branches to remote
3. Auto-create PR via CLI: GitHub → `gh pr create`; Gitee → `@gitee-pr-submit` skill
4. If auto-create fails, list branches/remote URLs and wait for manual PR
5. PR description must **embed** the actual content of: requirements spec, technical design, `CONTRACTS.md`, ADR. Do **not** use file path references (e.g. `governance/feature-docs/...`) — these documents live in the workspace repo, not in the submodule repo, and cannot be viewed on GitHub/Gitee
6. Record PR URLs for tracking

#### Step 3.4: Merge & Cleanup

**Prerequisite**: All submodule PRs reviewed and approved.

**Actions per repo**:
- Workspace root: `git pull origin main`, verify clean working tree on `main`
- Submodules: squash-merge PR into base branch → switch local to base → `git pull` → delete local `feat/` branch → delete remote `feat/` branch

**Final verification**:
- [ ] Workspace root on `main` with clean tree
- [ ] Each submodule on base branch with clean tree
- [ ] Merge commit present in `git log --oneline -5`
- [ ] No dangling feature branches locally
- [ ] No unresolved escalation reports
- [ ] `CONTRACTS.md` updated if API changes
- [ ] ADR written if new patterns introduced

---

## Escalation Rules

| Scenario | Action |
|----------|--------|
| Any Phase exceeds **10 minutes** | Output progress summary to conversation, then **continue execution** |
| Phase 1 gate blocked | Generate `REPORT.md`, **pause and wait for user confirmation** |
| Phase 2 design flaw (minor) | Adjust within Phase 2 |
| Phase 2 design flaw (structural) | Return to Phase 1 with delta `REPORT.md`, pause for user |

---

## Branch & Commit Rules

| Rule | Value |
|------|-------|
| Workspace root branch | `main` (direct commits) |
| Submodule branch naming | `feat/<feature-name>` |
| Submodule base branches | `backend/` → `master`, `admin/` → `master`, `miniapp/` → `main`, `icepolar-dms/` → `main` |
| Commit format | `feat(scope): description` |
| Direct commit to submodule base branches | Forbidden |
| Migration script inclusion | Same PR as backend changes |

---

## Completion Criteria

A feature is complete when **all** are true:

1. All activated agents completed; review-agent passed; all gates verified
2. Phase 3 Step 3.2 user confirmation received
3. Submodule PRs created, merged, and feature branches deleted (local + remote)
4. Workspace root on `main` with clean state; submodules on base branches with clean state
5. No unresolved escalation reports
6. `CONTRACTS.md` updated and ADR written if applicable
7. All delivery documents archived to `governance/feature-docs/{feature}/` (requirements-spec, technical-design, contract-changes, plus ui-ux-design / adr if applicable)
