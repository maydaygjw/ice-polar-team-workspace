# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workspace Layout

This is a **Git Submodule** workspace. The root repository tracks submodule pointers; each submodule is an independent Git project with its own PRs and CI.

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

**Working directory**: All Bash commands run from the workspace root. Do not `cd` into subdirectories. Use relative paths (e.g., `miniapp/pages/...`) or `cd subdir && cmd` when git operations require it.

## Governance — Read First

`governance/` is the single source of truth for the AI engineering team.

| File | Purpose |
|------|---------|
| `governance/CLAUDE.md` | Team constitution — core principles, red lines, system boundary |
| `governance/ARCHITECTURE.md` | System-wide architecture and data flow |
| `governance/CONTRACTS.md` | Cross-repo API/Event/DTO contracts |
| `governance/AGENTS/` | Agent role definitions (backend-agent, miniapp-agent, etc.) |
| `governance/PROMPTS/` | Reusable team prompt templates |

Key architecture points from governance:
- **Multi-tenant by default** — all business tables have `tenant_id` (backend)
- **Event-driven async flows** — payment callbacks, order timeouts use MQ/RocketMQ or Redis delay queue (backend)
- **API first** — any cross-repo change starts with contract definition in `CONTRACTS.md`
- **icepolar-dms** is called by the backend `yshop-drink` device module, never directly by the mini-program

## Commands by Submodule

### backend/ (Java / Maven)

```bash
# Build
mvn clean install -DskipTests

# Run single module tests
mvn test -pl yshop-module-mall/yshop-module-device-biz

# Run specific test class
mvn test -pl yshop-module-mall/yshop-module-device-biz -Dtest=DeviceManagementServiceImplTest
```

### admin/ (Vue3 / Vite / pnpm)

```bash
# Dev server
pnpm dev

# Build (production)
pnpm build:prod

# Lint
pnpm lint:eslint
pnpm lint:format
pnpm lint:style
```

### miniapp/ (Native WeChat Mini Program)

No command-line build. Development requires **WeChat DevTools**:
- AppID: `wx4df64c96e6540b4e` (in `project.config.json`)
- Compile / Preview / Upload via DevTools UI
- `app.globalData.dmsUrl` points to DMS backend for hardware commands

### icepolar-dms/ (Python / FastAPI)

```bash
# Install deps (use venv recommended)
pip install -r requirements.txt

# Run dev server
DEBUG=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest -v
pytest tests/test_services/ -v
pytest tests/test_routes/test_devices_connect.py -v

# Lint
ruff check .
ruff check --fix .
```

## Submodule Daily Workflow

```bash
# Pull workspace + all submodules
git pull --recurse-submodules

# Update submodules only
git submodule update --remote

# Check status across all repos
for d in backend admin miniapp icepolar-dms; do
  echo "[$d] $(cd $d && git status --short | wc -l | xargs) changes"
done
```

## Git Conventions

- Commit messages: `feat(scope): description`
- Feature branches: `feat/<feature-name>`
