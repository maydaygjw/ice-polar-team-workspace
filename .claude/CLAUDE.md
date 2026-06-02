# Workspace-Level AI Agent Rules

## icepolar-dms Submodule — SDD Rules

When working in `icepolar-dms/`, the following Specification Driven Development (SDD) rules apply.

### 1. No Code Without Spec

Any new feature **must** start with a spec in `icepolar-dms/specs/{编号}-{需求名称}/`:

- `spec.md` — 需求规格概要（系统架构、业务流程、数据模型，不含实现细节）
- `plan.md` — 技术实现方案（技术选型、API设计、数据库设计）
- `tasks.md` — 详细任务分解清单（TDD方式，测试先行）

### 2. TDD Iron Rule

Every task in `tasks.md` must:
1. Write the failing test first
2. Implement the code to make it pass
3. Refactor if needed

Coverage requirement: unit test coverage >= 80%.

### 3. Top-Down Development Order

```
interface/routes → services → dao/entity
```

Use STUB placeholders when lower layers are not yet implemented. Never write database code before the route contract is defined.

### 4. Strict Layered Architecture

| Layer | Returns | Responsibility |
|-------|---------|----------------|
| `interface/routes` | `dict` (JSON) | HTTP request handling, parameter validation |
| `services` | `Schema` (Pydantic) | Business logic, coordinates dao + api |
| `dao` | `Entity` (SQLAlchemy) | Database CRUD, transaction management |
| `api` | `Schema` (Pydantic) | External API call wrappers |

- **Route** calls `.model_dump()` to return JSON
- **Service** returns Pydantic Schema, never dict
- **DAO** returns SQLAlchemy Entity, never dict

### 5. Task Execution Rules

- One task = one primary file change or one new file
- Mark dependencies with `depends: [task-id]`
- Mark parallelizable tasks with `[P]`
- All docstrings and comments in **Chinese**

### 6. Quality Gates Before Commit

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
