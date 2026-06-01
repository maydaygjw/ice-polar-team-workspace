# Repository Guidelines

## Project Structure & Module Organization
This workspace uses Git submodules so each product repo remains independently versioned. `backend/` is the Java 17 Spring Boot Maven backend, `admin/` is the Vue 3 + Vite admin console, `miniapp/` is the native WeChat Mini Program, and `icepolar-dms/` is the FastAPI device management service. `governance/` contains shared architecture, contracts, playbooks, prompts, and role guidance. Check each subproject's own `AGENTS.md` before editing inside it.

## Build, Test, and Development Commands
Run submodule commands from that submodule root.

- `git submodule update --init --recursive`: initialize all project repos after cloning.
- `git pull --recurse-submodules`: update the workspace and submodule pointers.
- `cd backend && mvn clean test`: run Java backend tests.
- `cd backend && mvn -pl yshop-server -am spring-boot:run -Dspring-boot.run.profiles=local`: start the backend locally.
- `cd admin && pnpm i && pnpm dev`: install and run the admin console.
- `cd admin && pnpm ts:check && pnpm build:dev`: validate TypeScript and build the admin app.
- `cd icepolar-dms && pip install -r requirements.txt && pytest -v`: install and test the DMS service.
- Open `miniapp/` in WeChat Developer Tools to compile and preview the mini program.

## Coding Style & Naming Conventions
Follow the local style of the subproject you change. Backend Java uses 4-space indentation and established suffixes such as `*Controller`, `*Service`, `*Mapper`, `*DO`, `*ReqVO`, and `*RespVO`. Admin Vue/TypeScript uses 2-space indentation, PascalCase component files, camelCase utilities, and `@/` imports. DMS Python follows PEP 8, snake_case modules, Pydantic schemas, SQLAlchemy models, and Ruff checks.

## Testing Guidelines
Add tests in the project that owns the behavior. Use Maven/JUnit tests under `backend/**/src/test`, `pytest` tests under `icepolar-dms/tests`, and admin validation through `pnpm ts:check`, lint, and the relevant `pnpm build:*` target. Name Python tests `test_*.py`; name Java test classes `*Test`.

## Commit & Pull Request Guidelines
Root history uses Conventional Commit subjects such as `feat(device): ...`, `docs(governance): ...`, and `chore(submodules): ...`. Keep commits scoped to one concern and update submodule pointers deliberately. PRs should summarize behavior, list affected repos, link issues or specs, include screenshots for UI changes, and state the commands run.

## Security & Configuration Tips
Never commit secrets or local `.env` values. Use `.env.example`, subproject environment files, and `governance/CONTRACTS.md` to document new configuration, API, or event changes.
