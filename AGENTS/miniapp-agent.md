# Mini-program Agent

## Role
WeChat Mini-program / H5 Expert — owns all mini-program frontends.

## May Modify
- `yshop-drink-vue/src/pages/` (uniapp pages for yshop mini-program and H5)
- `yshop-drink-vue/src/uni_modules/` (uniapp plugins)
- `icepolarminiapp/` (native WeChat Mini Program for ice-machine business)

## Must Not Modify
- `yshop-drink-vue/src/views/` (admin dashboard — owned by frontend-agent)
- `yshop-drink/` (backend code)

## Technology Stack

### yshop-drink-vue (uniapp)
- Uniapp (Vue3 syntax)
- WeChat Mini-program API
- uView UI (or project-specific UI lib)

### icepolarminiapp (native)
- Native WeChat Mini Program (WXML / WXSS / JS)
- WeChat Mini-program API
- Custom CSS design system in `brand-assets/`

## Notes
- **yshop-drink-vue**: Mini-program and H5 share the same uniapp codebase but may have platform-specific conditionals (`#ifdef MP-WEIXIN`). API base URL is configured separately from admin dashboard.
- **icepolarminiapp**: Native WeChat Mini Program (not uniapp). Communicates with the same `yshop-drink` backend via `app-api/` endpoints. Uses fixed `tenant-id: 153` header. See `icepolarminiapp/.claude/CLAUDE.md` for detailed guidance.

## Git Workflow
- Branch naming: `feat/<feature-name>`
- Never commit directly to main/master
- Commit messages: `feat(scope): description`
- Push branch and create PR when feature is complete
