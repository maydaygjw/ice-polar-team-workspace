# Repository Guidelines

## Project Structure & Module Organization

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

Check each subproject's own `AGENTS.md` before editing inside it.

## Governance — Read First

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

## Build, Test, and Development Commands

Run submodule commands from that submodule root.

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

### backend/ (Java / Maven)

```bash
# Build
cd backend && mvn clean install -DskipTests

# Run Java backend tests
cd backend && mvn clean test

# Run single module tests
mvn test -pl yshop-module-mall/yshop-module-device-biz

# Run specific test class
mvn test -pl yshop-module-mall/yshop-module-device-biz -Dtest=DeviceManagementServiceImplTest

# Start backend locally
cd backend && mvn -pl yshop-server -am spring-boot:run -Dspring-boot.run.profiles=local
```

### admin/ (Vue3 / Vite / pnpm)

```bash
# Install and run dev server
cd admin && pnpm i && pnpm dev

# Build (production)
pnpm build:prod

# Validate TypeScript and build
cd admin && pnpm ts:check && pnpm build:dev

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
# Install deps and test
cd icepolar-dms && pip install -r requirements.txt && pytest -v

# Run dev server
DEBUG=true uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run all tests
pytest -v
pytest tests/test_services/ -v
pytest tests/test_routes/test_devices_connect.py -v

# Lint
ruff check .
ruff check --fix .
```

## Coding Style & Naming Conventions

Follow the local style of the subproject you change.

- **Backend Java**: 4-space indentation; established suffixes such as `*Controller`, `*Service`, `*Mapper`, `*DO`, `*ReqVO`, and `*RespVO`.
- **Admin Vue/TypeScript**: 2-space indentation; PascalCase component files; camelCase utilities; `@/` imports.
- **DMS Python**: PEP 8; snake_case modules; Pydantic schemas; SQLAlchemy models; Ruff checks.

## Testing Guidelines

Add tests in the project that owns the behavior.

- **Java**: Maven/JUnit tests under `backend/**/src/test`; name test classes `*Test`.
- **Python**: `pytest` tests under `icepolar-dms/tests`; name test files `test_*.py`.
- **Admin**: validation through `pnpm ts:check`, lint, and the relevant `pnpm build:*` target.

## Git Conventions

- Commit messages: `feat(scope): description` (Conventional Commits)
- Feature branches: `feat/<feature-name>`
- Keep commits scoped to one concern and update submodule pointers deliberately.

## Commit & Pull Request Guidelines

Root history uses Conventional Commit subjects such as `feat(device): ...`, `docs(governance): ...`, and `chore(submodules): ...`.

PRs should:
- Summarize behavior
- List affected repos
- Link issues or specs
- Include screenshots for UI changes
- State the commands run

## icepolar-dms — Specification Driven Development (SDD)

When working in `icepolar-dms/`, the following SDD rules apply.

### No Code Without Spec

Any new feature **must** start with a spec in `icepolar-dms/specs/{编号}-{需求名称}/`:

- `spec.md` — 需求规格概要（系统架构、业务流程、数据模型，不含实现细节）
- `plan.md` — 技术实现方案（技术选型、API设计、数据库设计）
- `tasks.md` — 详细任务分解清单（TDD方式，测试先行）

### TDD Iron Rule

Every task in `tasks.md` must:
1. Write the failing test first
2. Implement the code to make it pass
3. Refactor if needed

Coverage requirement: unit test coverage >= 80%.

### Top-Down Development Order

```
interface/routes → services → dao/entity
```

Use STUB placeholders when lower layers are not yet implemented. Never write database code before the route contract is defined.

### Strict Layered Architecture

| Layer | Returns | Responsibility |
|-------|---------|----------------|
| `interface/routes` | `dict` (JSON) | HTTP request handling, parameter validation |
| `services` | `Schema` (Pydantic) | Business logic, coordinates dao + api |
| `dao` | `Entity` (SQLAlchemy) | Database CRUD, transaction management |
| `api` | `Schema` (Pydantic) | External API call wrappers |

- **Route** calls `.model_dump()` to return JSON
- **Service** returns Pydantic Schema, never dict
- **DAO** returns SQLAlchemy Entity, never dict

### Task Execution Rules

- One task = one primary file change or one new file
- Mark dependencies with `depends: [task-id]`
- Mark parallelizable tasks with `[P]`
- All docstrings and comments in **Chinese**

### Quality Gates Before Commit

```bash
ruff check .
pytest -v
```

Both must pass. No exceptions.

## Working Directory Rule

**All Bash commands must run from the workspace root.**

- Never `cd` into subdirectories without wrapping in a subshell `(cd subdir && cmd)`
- Prefer `(cd backend && git status)` over `cd backend && git status`
- The user's terminal session shares the working directory; leaving them in a submodule causes confusion and mistakes

## Security & Configuration Tips

Never commit secrets or local `.env` values. Use `.env.example`, subproject environment files, and `governance/CONTRACTS.md` to document new configuration, API, or event changes.
