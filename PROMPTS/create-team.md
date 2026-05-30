# Create Engineering Team

Read `governance/CLAUDE.md` first.
Read `governance/ARCHITECTURE.md`.
Read relevant `governance/ADR/` entries.

Analyze the feature scope and determine which repositories are affected:
- `yshop-drink/` — backend API changes
- `yshop-drink-vue/` — admin dashboard changes
- `icepolarminiapp/` — native mini-program changes

Create an engineering team with these agents:
- requirements-agent (always)
- architecture-agent (always)
- backend-agent (if backend changes needed)
- frontend-agent (if admin UI changes needed)
- miniapp-agent (if mini-program changes needed)
- test-agent (always)
- review-agent (always)

Use `governance/` as the single source of truth.

Workflow:
1. requirements-agent + architecture-agent work first (parallel)
2. **Interrupt & Report**: If requirements are ambiguous or architecture contradicts past ADRs, produce a REPORT.md and pause for stakeholder confirmation
3. Once contracts are defined, backend + frontend + miniapp + test work in parallel
4. Each developer creates `feat/<feature-name>` branch from main/master
5. review-agent gates the final output
6. Create Pull Request for each affected repo after review approval

Branch Rules:
- Naming: `feat/<feature-name>` (e.g., `feat/balance-payment`, `feat/commission`)
- Never commit directly to main/master
- Commit messages: `feat(scope): description`
- One branch per repository

Escalation Rules:
- Produce REPORT.md and pause if requirements are ambiguous
- Produce REPORT.md and pause if architecture contradicts past ADRs
- Produce REPORT.md and pause if security concerns discovered
- Produce REPORT.md and pause if effort exceeds 2x initial assessment
