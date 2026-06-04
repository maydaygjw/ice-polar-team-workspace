# Feature Development Playbook

## Phase 0: Team Assembly

1. Read `governance/CLAUDE.md` and `governance/ARCHITECTURE.md`
2. Analyze requirements scope — determine which repos are affected:
   - `backend/` (yshop-drink backend)
   - `admin/` (yshop-drink-vue admin dashboard)
   - `miniapp/` (native WeChat mini-program)
3. Assemble the team using `governance/PROMPTS/create-team.md`:
   - **requirements-agent** (always)
   - **architecture-agent** (always)
   - **backend-agent** (if backend changes needed)
   - **frontend-agent** (if admin UI changes needed)
   - **miniapp-agent** (if mini-program changes needed)
   - **test-agent** (always)
   - **review-agent** (always)

## Phase 1: Requirements (requirements-agent)

1. Read existing similar features for consistency
2. **Interrupt & Report**: If requirements are ambiguous, produce a `REPORT.md` and pause for stakeholder confirmation before proceeding
3. Produce requirements spec in `governance/` or `/team-docs/`

## Phase 2: Architecture (architecture-agent)

1. Read requirements spec
2. Check `governance/ADR/` for relevant past decisions
3. Design data model and API contracts
4. Update `governance/CONTRACTS.md` with new contracts
5. **Interrupt & Report**: If the design introduces new patterns or contradicts past ADRs, produce a `REPORT.md` and pause for confirmation
6. Write ADR if introducing new patterns
7. Produce technical design doc

## Phase 3: Parallel Development

### Branch Rules
- Workspace root (`.`): commit directly to `main`, no feature branch
- Submodules: create `feat/<feature-name>` from base branch
  - `backend/`: from `master`
  - `admin/`: from `master`
  - `miniapp/`: from `main`
- Never commit directly to submodule base branches
- Commit messages follow: `feat(scope): description`

### Development Assignments
- **backend-agent**: Implement backend (DO, Mapper, Service, Controller)
- **frontend-agent**: Implement admin UI (views, API clients, forms)
- **miniapp-agent**: Implement mini-program pages if needed

### Escalation Rules
- **Interrupt & Report** immediately if:
  - Backend API contract differs from architecture design
  - Existing code contradicts requirements
  - Security concerns discovered during implementation
  - Database migration conflicts with existing data
  - Estimated effort exceeds 2x initial assessment

## Phase 4: Testing (test-agent)

1. Design test cases
2. Write unit tests for complex logic
3. Write Playwright E2E tests
4. Run full test suite

## Phase 5: Review (review-agent)

1. Check implementation against requirements
2. Verify API contracts match `CONTRACTS.md`
3. Security review
4. Check tenant isolation
5. Verify migration scripts

## Phase 6: Merge & Document

1. **Workspace root**: changes are already on `main` — commit and push directly
2. **Submodules: Create Pull Request** for each affected submodule:
   - Push branch: `git push -u origin feat/<feature-name>`
   - Create PR with description referencing requirements and design docs
   - Link cross-repo PRs in descriptions
3. Merge submodule PRs after review approval
4. Update `governance/KNOWLEDGE/` if domain knowledge gained
5. Archive requirements and design docs to `/team-docs/`

## Interrupt & Report Protocol

Whenever the process needs stakeholder input, produce a report with this format:

```markdown
# REPORT: [Feature Name] — [Issue Type]

## Context
[What we are doing and why]

## Problem / Question
[What needs your decision]

## Options
| Option | Pros | Cons |
|--------|------|------|
| A | ... | ... |
| B | ... | ... |

## Recommendation
[Which option we recommend and why]

## Blocked On
[What we cannot proceed without]
```

**Issue types that trigger a report:**
- Requirements ambiguity
- Architecture decision needed
- Scope creep detected
- Security concern
- Breaking change to existing API/contract
- Uncertainty about tenant isolation approach
- Migration script concerns
