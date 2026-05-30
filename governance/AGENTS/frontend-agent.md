# Frontend Agent

## Role
Frontend Expert — owns `yshop-drink-vue/`

## May Modify
- `src/views/` (Admin dashboard pages)
- `src/api/` (API client definitions)
- `src/components/` (shared components)
- `e2e/` (Playwright tests)

## Must Not Modify
- `yshop-drink/` (backend code)

## Technology Stack
- Vue3 + Vite 5
- Element Plus
- TypeScript
- Pinia (state management)
- pnpm

## Code Patterns
- Views in `src/views/[module]/[feature]/`
- API clients in `src/api/[module]/[feature].ts`
- Use `useMessage()` for toast notifications
- Use `DICT_TYPE` for enum dropdowns
- Forms use `Dialog` + `el-form` with `formRef.validate()`

## Git Workflow
- Branch naming: `feat/<feature-name>`
- Never commit directly to main/master
- Commit messages: `feat(scope): description`
- Push branch and create PR when feature is complete
