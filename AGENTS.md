# Repository Guidelines

## Project Structure, Sync, and Governance

This workspace uses Git submodules so each product repo remains independently versioned.

```
ice-polar-team-workspace/
├── governance/         # AI team knowledge center (read first)
├── backend/            # submodule — yshop-drink (Java/Spring Boot)
├── admin/              # submodule — yshop-drink-vue (Vue3/Vite)
├── miniapp/            # submodule — icepolarminiapp (Native WeChat Mini Program)
├── icepolar-dms/       # submodule — icepolar-dms (Python/FastAPI)
└── .gitmodules
```

| Directory | Repository | Tech Stack | Branch |
|-----------|-----------|------------|--------|
| `backend/` | `https://gitee.com/icepolar/yshop-drink.git` | Java 17, Spring Boot 3.2, MyBatis Plus, Maven | `master` |
| `admin/` | `https://gitee.com/icepolar/yshop-drink-vue.git` | Vue3, Vite4, Element Plus, TypeScript, pnpm | `master` |
| `miniapp/` | `https://gitee.com/icepolar/icepolarminiapp.git` | Native WeChat Mini Program (WXML/WXSS/JS) | `main` |
| `icepolar-dms/` | `git@github.com:holun-yshop/icepolar-dms.git` | Python 3.12+, FastAPI, SQLAlchemy 2.x, pytest | `main` |

### Initialize & Sync

```bash
# Initialize all project repos after cloning
git submodule update --init --recursive

# Pull workspace + all submodules
git pull --recurse-submodules

# Update submodules only
git submodule update --remote

# Check status across all repos
for d in backend admin miniapp icepolar-dms; do
  echo "[$d] $(cd $d && git status --short | wc -l | xargs) changes"
done
```

### Governance — Read First

`governance/` is the single source of truth for the AI engineering team.

| File | Purpose |
|------|---------|
| `governance/CLAUDE.md` | Team constitution — core principles, red lines, system boundary |
| `governance/ARCHITECTURE.md` | System-wide architecture and data flow |
| `governance/CONTRACTS.md` | Cross-repo API/Event/DTO contracts |
| `governance/AGENTS/` | Agent role definitions (backend-agent, miniapp-agent, etc.) |
| `governance/PROMPTS/` | Reusable team prompt templates |

Key architecture points:
- **Multi-tenant by default** — all business tables have `tenant_id` (backend)
- **Event-driven async flows** — payment callbacks, order timeouts use MQ/RocketMQ or Redis delay queue (backend)
- **API first** — any cross-repo change starts with contract definition in `CONTRACTS.md`
- **icepolar-dms** is called by the backend `yshop-drink` device module, never directly by the mini-program

### Backlog

`governance/BACKLOG/` is where raw, unrefined feature requests live before they enter the delivery pipeline.

- **Purpose**: Capture feature ideas and needs as they arise, in business language, without committing to implementation.
- **Rule**: Write the problem or need only. Do not include technical design, database schemas, API contracts, or UI mockups. That work happens during the `create-team` workflow.
- **Template**: Copy `governance/BACKLOG/TEMPLATE.md` for each new item.
- **Naming**: `BACKLOG-{nnn}-{short-name}.md` (e.g. `BACKLOG-001-product-template.md`)
- **Lifecycle**: `draft` → `ready` (after requirements-agent evaluation) → `scheduled` (moved to a feature branch) → removed after delivery

## Build, Test, and Development Commands

Run commands from the target submodule root. Each submodule owns its own build, test, lint, and dev workflow — see its local `AGENTS.md` for details.

```bash
# Example: run a command inside a submodule without changing the shell cwd
(cd backend && mvn clean test)
(cd admin && pnpm dev)
(cd icepolar-dms && pytest -v)
```

## Coding Style & Testing Guidelines

Follow the conventions of the subproject you change. See each submodule's `AGENTS.md` and `governance/ARCHITECTURE.md` for stack-specific rules.

- **Backend Java**: suffixes such as `*Controller`, `*Service`, `*Mapper`, `*DO`, `*ReqVO`, `*RespVO`; tests under `**/src/test`.
- **Admin Vue/TypeScript**: PascalCase components, camelCase utilities, `@/` imports; validate via `pnpm ts:check`, lint, and build.
- **DMS Python**: PEP 8, snake_case modules, Pydantic schemas, SQLAlchemy models, Ruff checks, `pytest` under `tests/`.
- **Miniapp**: Native WeChat Mini Program; develop with WeChat DevTools.

## Git Conventions

Root history uses Conventional Commit subjects such as `feat(device): ...`, `docs(governance): ...`, and `chore(submodules): ...`.

- **Commit messages**: `feat(scope): description` (Conventional Commits)
- **Feature branches**: `feat/<feature-name>`
- **Keep commits scoped** to one concern and update submodule pointers deliberately.

Pull requests should:
- Summarize behavior
- List affected repos
- Link issues or specs
- Include screenshots for UI changes
- State the commands run

## Iron Rules

The following rules are mandatory. No exceptions.

1. **Working Directory Rule** — All Bash commands must run from the workspace root.
   - Never `cd` into subdirectories without wrapping in a subshell `(cd subdir && cmd)`
   - Prefer `(cd backend && git status)` over `cd backend && git status`
   - The user's terminal session shares the working directory; leaving them in a submodule causes confusion and mistakes
2. **API first** — any cross-repo change starts with contract definition in `governance/CONTRACTS.md`.
3. **Never commit secrets** — DB passwords, API keys, JWT secrets, or local `.env` values must not be committed. Use `.env.example` and project environment files.
