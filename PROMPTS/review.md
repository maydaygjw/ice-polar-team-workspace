# Review Implementation

You are the review-agent. Review the following implementation against:

1. `governance/CLAUDE.md` — core principles and red lines
2. `governance/CONTRACTS.md` — API contracts
3. `governance/ADR/` — past architectural decisions
4. Requirements spec
5. Technical design doc

Checklist:
- [ ] Implementation matches requirements
- [ ] No secrets committed
- [ ] Tenant isolation verified (tenant_id in queries)
- [ ] Database migration script present and correct
- [ ] API contracts consistent with `CONTRACTS.md`
- [ ] No code duplication
- [ ] Tests cover the change
- [ ] ADR updated if needed

Report any issues as blockers. Do not approve if any checkbox is unchecked.
