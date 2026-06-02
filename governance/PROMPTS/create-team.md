# Create Engineering Team

## Objective

Analyze a feature request, assemble the right engineering team from `governance/AGENTS/`, and execute the full delivery workflow through to merge and branch cleanup.

## Pre-flight

Before any team assembly, read the following in order:

1. `governance/CLAUDE.md` — team constitution, core principles, red lines
2. `governance/ARCHITECTURE.md` — system-wide architecture and data flow
3. `governance/CONTRACTS.md` — cross-repo API/event/DTO contracts
4. Relevant `governance/ADR/` entries for the feature domain

## Team Assembly

Team members are defined in `governance/AGENTS/`. Read each active agent's definition before assignment.

### Always-on Agents

| Agent | File | When to Invoke |
|-------|------|----------------|
| Requirements Agent | `governance/AGENTS/requirements-agent.md` | Phase 1 — always |
| Architecture Agent | `governance/AGENTS/architecture-agent.md` | Phase 1 — always |
| Test Agent | `governance/AGENTS/test-agent.md` | Phase 3 — always |
| Review Agent | `governance/AGENTS/review-agent.md` | Phase 4 — always |

### Conditional Agents

| Agent | File | Invoke When |
|-------|------|-------------|
| Backend Agent | `governance/AGENTS/backend-agent.md` | `backend/` changes needed |
| Frontend Agent | `governance/AGENTS/frontend-agent.md` | `admin/` (Vue3 dashboard) changes needed |
| MiniApp Agent | `governance/AGENTS/miniapp-agent.md` | `miniapp/` (WeChat Mini Program) changes needed |
| UI/UX Agent | `governance/AGENTS/ui-ux-agent.md` | Visual style, interaction design, or UX optimization needed |

> **Determination Rule**: Analyze the feature scope against the system boundary in `ARCHITECTURE.md`. If a repository boundary is touched, the corresponding agent is activated.

## Phase Workflow

### Phase 1: Discovery & Design

**Participants**: requirements-agent, architecture-agent, ui-ux-agent (if visual/interaction changes)

**Parallel execution**:
- requirements-agent clarifies scope, edge cases, acceptance criteria
- architecture-agent designs data model, API contracts, module boundaries
- ui-ux-agent designs visual style, interaction patterns, and UX flow (when activated)

**Gates before proceeding**:
- [ ] Requirements spec is complete with in-scope / out-scope boundaries
- [ ] Technical design includes database changes, API contracts, module impact
- [ ] API contracts documented in `CONTRACTS.md` (or appended)
- [ ] UI/UX design review approved (if ui-ux-agent activated) — includes style guide, component spec, and interaction flow

**→ Escalation checkpoint**: See [Escalation Rules](#escalation-rules) below.

### Phase 2: Contract Freeze

**Participants**: architecture-agent (lead), requirements-agent (review)

**Actions**:
1. Freeze API contracts in `CONTRACTS.md`
2. Write ADR if introducing new patterns or changing existing ones
3. Produce implementation-ready technical design doc
4. Define branch names: `feat/<feature-name>` for each affected repo

**Gate**: No agent proceeds to implementation until contracts are frozen and escalation checkpoint is cleared.

### Phase 3: Parallel Implementation

**Participants**: backend-agent, frontend-agent, miniapp-agent (as activated), ui-ux-agent (as activated), test-agent

**Parallel execution**:
- Each developer agent creates `feat/<feature-name>` branch from main/master
- backend-agent implements backend changes + `sql/upgrade-*.sql`
- frontend-agent implements admin dashboard changes
- miniapp-agent implements mini-program changes
- ui-ux-agent implements style/WXSS changes and reviews frontend visual output (when activated)
- test-agent designs test plan and writes E2E / unit tests in parallel

**Rules**:
- One branch per repository
- Commit messages: `feat(scope): description`
- Never commit directly to main/master
- Include migration script in the same PR as backend changes
- Cross-repo API changes must be communicated to all frontend consumers

**→ Escalation checkpoint**: If implementation reveals design flaws, stop and escalate.

### Phase 4: Review & Gate

**Participants**: review-agent

**Review checklist**:
- [ ] Implementation matches requirements spec
- [ ] API contracts match `CONTRACTS.md`
- [ ] No hardcoded secrets
- [ ] Tenant isolation verified in all new queries
- [ ] Database migration script present and correct
- [ ] Tests cover the change
- [ ] ADR updated if needed
- [ ] Feature branch follows naming convention (`feat/<name>`)
- [ ] No code duplication
- [ ] Security issues checked (SQL injection, XSS, etc.)
- [ ] Visual consistency verified (if ui-ux-agent activated) — style guide followed, no hardcoded colors, `rpx` used for sizing

**Gate**:
- PASS → proceed to PR creation
- FAIL → return to Phase 3 with review feedback

### Phase 5: Pull Request Creation

**Actions**:
1. Push each feature branch to remote
2. Create one PR per affected repository
3. PR description must reference:
   - Requirements spec
   - Technical design doc
   - `CONTRACTS.md` changes
   - ADR (if any)

### Phase 6: Merge & Return to Main

**Participants**: devops-agent (or user), all developer agents

**Prerequisite**: All PRs have been reviewed and approved (by review-agent or human reviewers).

**Actions per affected repository**:
1. Merge the PR into `main`/`master` (merge strategy: prefer squash merge for clean history)
2. Switch local workspace back to `main`/`master`
3. Pull the latest changes to synchronize local state
4. Delete the local `feat/<feature-name>` branch
5. Delete the remote `feat/<feature-name>` branch (if applicable)

**Verification**:
- [ ] `git status` shows clean working tree on `main`/`master`
- [ ] `git log --oneline -5` confirms the merge commit is present
- [ ] No dangling feature branches remain locally

**Cross-repo synchronization**:
If multiple repositories are affected, ensure all PRs are merged **before** any deployment to avoid cross-repo version skew.

## Escalation Rules

The following conditions **require producing a `REPORT.md` and pausing all work** until the user confirms or resolves:

### 1. Requirements Ambiguity

| Trigger | Examples |
|---------|----------|
| Conflicting stakeholder requirements | Two different commission rules for the same scenario |
| Missing acceptance criteria | "Support balance payment" without defining fallback behavior |
| Undefined edge cases | What happens when inventory goes negative during payment? |
| Scope creep risk | Feature touches modules not originally identified |

**Action**: Produce `REPORT.md` documenting the ambiguity, list options with trade-offs, and pause.

### 2. Architecture Conflict

| Trigger | Examples |
|---------|----------|
| Contradicts past ADR | New design violates an existing ADR in `governance/ADR/` |
| Introduces circular dependency | Module A depends on B, B now needs to depend on A |
| Breaks existing contract | Changes DTO fields that `CONTRACTS.md` has frozen |
| Bypasses tenant isolation | Design requires cross-tenant query without `@TenantIgnore` justification |

**Action**: Produce `REPORT.md` with the conflict, reference the ADR/contract in question, propose resolution options, and pause.

### 3. Security Concerns

| Trigger | Examples |
|---------|----------|
| Secret exposure risk | New feature requires API key in code or config |
| Authentication bypass | Endpoint lacks proper `@PreAuthenticated` or `@PreAuthorize` |
| Injection vulnerability | Dynamic SQL without parameterization |
| Privilege escalation | New endpoint accessible to lower-privilege roles |

**Action**: Produce `REPORT.md` with security analysis, severity assessment, and remediation options, and pause.

### 4. Effort Underestimation

| Trigger | Action |
|---------|--------|
| Actual effort exceeds 2x initial assessment | Produce `REPORT.md` with revised estimate, risk analysis, and scope-trim options. Pause for re-prioritization. |

### 5. Cross-Repo Contract Breakage

| Trigger | Examples |
|---------|----------|
| Backend API change breaks frontend contract | DTO field removed or type changed without versioning |
| DMS interface change | `icepolar-dms` API contract changes affect backend proxy |
| Order status semantic change | Enum value meaning changed without updating all consumers |

**Action**: Produce `REPORT.md` listing all affected repos and the breakage, propose migration plan, and pause.

### 6. External Dependency Blocker

| Trigger | Examples |
|---------|----------|
| Third-party API unavailable | WeChat Pay sandbox down, blocking payment flow testing |
| DMS service unreachable | `icepolar-dms` environment down, blocking device feature dev |
| Database migration conflict | Existing migration script conflicts with new schema change |

**Action**: Produce `REPORT.md` with blocker details, estimated resolution time, and workaround options, and pause.

## REPORT.md Format

When escalation is triggered, produce a report with this structure:

```markdown
# Escalation Report: [Feature Name]

## Trigger
[Which escalation rule was hit and why]

## Impact
- Affected repos: [list]
- Affected agents: [list]
- Blocked phase: [which phase cannot proceed]

## Context
[Relevant excerpts from requirements, design, code, or ADR]

## Options
| Option | Description | Pros | Cons |
|--------|-------------|------|------|
| A | ... | ... | ... |
| B | ... | ... | ... |

## Recommendation
[Agent's recommended option with rationale]

## Next Step
Awaiting user decision on [specific question].
```

## Branch & Commit Rules

| Rule | Value |
|------|-------|
| Branch naming | `feat/<feature-name>` |
| Base branch | `main` or `master` per repo |
| Commit format | `feat(scope): description` |
| Direct commit to main/master | Forbidden |
| One branch per repository | Yes |
| Migration script inclusion | Same PR as backend changes |

## Completion Criteria

A feature is considered complete when **all** of the following are true:

1. All activated agents have completed their implementation
2. review-agent has passed all checklist items
3. PRs are created for all affected repositories
4. PRs are merged into `main`/`master`
5. All feature branches are deleted (local and remote)
6. Workspaces are back on `main`/`master` with clean state
7. No unresolved escalation reports exist
8. `CONTRACTS.md` is updated (if API changes occurred)
9. ADR is written (if new architectural patterns introduced)
