# Create Engineering Team

## Objective

Analyze a feature request, assemble the right engineering team from `governance/AGENTS/`, and execute the full delivery workflow through to merge.

## Pre-flight

Read before assembly: `CLAUDE.md` → `ARCHITECTURE.md` → `CONTRACTS.md` → relevant `ADR/` entries.

## Team Assembly

Agents are defined in `governance/AGENTS/`. Read each active agent before assignment.

### Always-on Agents

| Agent | File | Phase |
|-------|------|-------|
| Coordinator | `coordinator-agent.md` | All |
| Requirements | `requirements-agent.md` | 1 |
| Architecture | `architecture-agent.md` | 1–2 |
| Test | `test-agent.md` | 3 |
| Review | `review-agent.md` | 4 |

### Conditional Agents

| Agent | File | Invoke When |
|-------|------|-------------|
| Backend | `backend-agent.md` | `backend/` changes needed |
| Frontend | `frontend-agent.md` | `admin/` changes needed |
| MiniApp | `miniapp-agent.md` | `miniapp/` changes needed |
| UI/UX | `ui-ux-agent.md` | Any new/modified UI component, page, style, or interaction |

> **UI/UX Agent Activation (Hard Rule)**: Activate if **any** of: new page/component, style/layout/interaction change, design spec change, or frontend/miniapp agent is activated **with component-level scope**. UI/UX Agent must complete design delivery before any frontend/miniapp implementation begins.

## Phase Workflow

### Phase 1: Discovery & Design

**Participants**: coordinator-agent, requirements-agent, architecture-agent, ui-ux-agent (if activated)

**Parallel execution**:
- requirements-agent: scope, edge cases, acceptance criteria
- architecture-agent: data model, API contracts, module boundaries
- ui-ux-agent: visual style, interaction patterns, component spec (when activated)
- coordinator-agent: init status tracker, confirm all required agents activated

**Gates** (coordinator-agent verifies):
- [ ] Requirements spec with in-scope / out-scope boundaries
- [ ] Technical design with DB changes, API contracts, module impact
- [ ] API contracts documented: platform-level → `CONTRACTS.md`; feature-level → `governance/feature-docs/{feature}/contract-changes.md`
- [ ] UI/UX design review approved (if activated) — style guide, component spec, interaction flow
- [ ] **Coordinator-agent has explicitly confirmed all above gates are green, or produced `REPORT.md` and paused for user input**

**→ Escalation**: If any gate is blocked, coordinator-agent **must**:
1. Immediately stop all active agent work.
2. Produce `REPORT.md` in `governance/feature-docs/{feature}/` listing: which gate failed, why, what is missing, and what the user must provide or decide.
3. **Pause and wait for explicit user confirmation** — coordinator-agent is forbidden from self-approving, skipping, or "trying one more thing."
4. No agent may proceed to Phase 2 until the user explicitly clears the gate.

### Phase 2: Contract Freeze

**Participants**: architecture-agent (lead), requirements-agent (review), coordinator-agent (gatekeeper)

**Actions**:
1. **Freeze API contracts in writing** — architecture-agent must explicitly state for each contract layer: (a) changed → update doc, (b) reused as-is → cite existing doc, (c) no contract needed → state reason. No implicit skips allowed.
2. Update `CONTRACTS.md` if platform-level contracts changed
3. Write `governance/feature-docs/{feature}/contract-changes.md` for all feature-level API changes
4. Verify structural details against `CONTRACT/backend-api.json` via `extract-openapi` skill
5. Write ADR if introducing new patterns
6. Define branch names per repo: workspace root → `main` (direct); submodules → `feat/<feature-name>`

**Gate** (coordinator-agent enforces):
- [ ] Every contract layer has explicit status (changed / reused / N/A with reason)
- [ ] Relevant docs updated and match technical design
- [ ] OpenAPI JSON snapshot generated if backend changed
- [ ] ADR written if required
- [ ] Branch names defined for every affected repo
- [ ] **No agent proceeds until coordinator-agent clears this gate**

### Phase 3: Parallel Implementation

**Participants**: backend-agent, frontend-agent, miniapp-agent (as activated), ui-ux-agent (as activated), test-agent, coordinator-agent (sync lead)

**Dependency rule (hard)**: frontend-agent / miniapp-agent **blocked** until ui-ux-agent design delivery is complete. If ui-ux-agent is not activated, the frontend agent must produce a simplified component spec and save it to `governance/feature-docs/{feature}/ui-ux-design.md`.

**Execution**:
- Workspace root: commit directly to `main`, no feature branch
- Submodules: one `feat/<feature-name>` branch per repo from base branch (`backend/` → `master`, `admin/` → `master`, `miniapp/` → `main`, `icepolar-dms/` → `main`)
- Commit format: `feat(scope): description`
- Never commit directly to submodule base branches
- Include migration script in same PR as backend changes
- test-agent designs test plan and writes E2E / unit tests in parallel

**Document collection** (coordinator-agent):

| Document | Source | Filename |
|----------|--------|----------|
| Requirements spec | requirements-agent | `requirements-spec.md` |
| Technical design | architecture-agent | `technical-design.md` |
| API contract changes | architecture-agent | `contract-changes.md` |
| UI/UX design | ui-ux-agent | `ui-ux-design.md` |
| Test plan | test-agent | `test-plan.md` |
| ADR | architecture-agent | `adr-{nnn}.md` |

**→ Escalation**: If implementation reveals design flaws, report to coordinator-agent.

### Phase 4: Review & Gate

**Participants**: review-agent (technical), coordinator-agent (process)

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

**Process verification** (coordinator-agent):
- [ ] All activated agents reported completion
- [ ] All required artifacts present
- [ ] No unresolved escalation reports

**Gate**: PASS → proceed; FAIL → return to Phase 3.

### Phase 4.5: Change Report & User Confirmation

**Participants**: coordinator-agent (lead), review-agent, all developer agents

**Actions**:
1. coordinator-agent collects change summaries from all agents
2. review-agent outputs review conclusion
3. coordinator-agent generates `CHANGE-REPORT.md` (overview, affected files, API/DB/UI changes, test coverage, review conclusion, risks)
4. coordinator-agent **presents CHANGE-REPORT.md to user and waits for explicit confirmation**

**Gate**: user confirms → Phase 5; user requests changes → back to Phase 3/4; user rejects → terminate.

### Phase 5: Pull Request Creation

**Participants**: developer agents, coordinator-agent

**Prerequisite**: Phase 4.5 user confirmation.

**Actions**:
1. Workspace root: already on `main`, push if needed
2. Push submodule feature branches to remote
3. Auto-create PR via CLI: GitHub → `gh pr create`; Gitee → `@gitee-pr-submit` skill
4. If auto-create fails, list branches/remote URLs and wait for manual PR
5. PR description must reference: requirements spec, technical design, `CONTRACTS.md`, ADR, CHANGE-REPORT.md
6. coordinator-agent updates status tracker with PR URLs

### Phase 6: Merge & Return to Main

**Participants**: devops-agent (or user), developer agents, coordinator-agent

**Prerequisite**: All submodule PRs reviewed and approved.

**Actions per repo**:
- Workspace root: `git pull origin main`, verify clean working tree on `main`
- Submodules: squash-merge PR into base branch → switch local to base → `git pull` → delete local `feat/` branch → delete remote `feat/` branch

**Final verification** (coordinator-agent):
- [ ] Workspace root on `main` with clean tree
- [ ] Each submodule on base branch with clean tree
- [ ] Merge commit present in `git log --oneline -5`
- [ ] No dangling feature branches locally
- [ ] No unresolved escalation reports
- [ ] `CONTRACTS.md` updated if API changes
- [ ] ADR written if new patterns introduced

## Escalation Rules

If any Phase exceeds **10 minutes**, coordinator-agent must pause, output a progress report to `governance/feature-docs/{feature}/progress-report-{phase}-{timestamp}.md`, and wait for user confirmation.


## Branch & Commit Rules

| Rule | Value |
|------|-------|
| Workspace root branch | `main` (direct commits) |
| Submodule branch naming | `feat/<feature-name>` |
| Submodule base branches | `backend/` → `master`, `admin/` → `master`, `miniapp/` → `main`, `icepolar-dms/` → `main` |
| Commit format | `feat(scope): description` |
| Direct commit to submodule base branches | Forbidden |
| Migration script inclusion | Same PR as backend changes |

## Completion Criteria

A feature is complete when **all** are true:

1. All activated agents completed; review-agent passed; coordinator verified gates
2. Phase 4.5 CHANGE-REPORT.md confirmed by user
3. Submodule PRs created, merged, and feature branches deleted (local + remote)
4. Workspace root on `main` with clean state; submodules on base branches with clean state
5. No unresolved escalation reports
6. `CONTRACTS.md` updated and ADR written if applicable
7. All delivery documents archived to `governance/feature-docs/{feature}/` (requirements-spec, technical-design, contract-changes, test-plan, CHANGE-REPORT, plus ui-ux-design / adr if applicable)
