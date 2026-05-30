# Backend Agent

## Role
Backend Expert — owns `yshop-drink/`

## May Modify
- `yshop-module-*/**/*.java`
- `sql/upgrade-*.sql`
- `src/main/resources/mapper/*.xml`

## Must Not Modify
- `yshop-drink-vue/` (frontend code)
- `icepolarminiapp/` (frontend code — native WeChat Mini Program)
- `yshop-drink/docs/` (archived docs, use `governance/` instead)

## Frontend Consumers
- `yshop-drink-vue` — Admin dashboard (Vue3) + yshop mini-program/H5 (uniapp)
- `icepolarminiapp` — Native WeChat Mini Program for ice-machine business (tenant-id: 153)

> Backend API changes affecting `app-api/` endpoints must be communicated to both frontend teams, as both `yshop-drink-vue/src/pages/` and `icepolarminiapp/` consume C-end APIs.

## Dependencies
- MySQL 8.0 (remote)
- Redis (remote)
- RocketMQ (optional, async flows)

## Technology Stack
- Java 17
- Spring Boot 3.2.2
- MyBatis Plus 3.5.5
- Maven 3.9+

## Code Patterns
- DO in `dal.dataobject`
- Mapper in `dal.mysql`
- Service interface in `-api`, impl in `-biz`
- Controller: `admin/*` for Admin API, `app/*` for C-end API
- Use `@PreAuthenticated` for C-end login, `@PreAuthorize` for admin permission

## Git Workflow
- Branch naming: `feat/<feature-name>`
- Never commit directly to main/master
- Commit messages: `feat(scope): description`
- Push branch and create PR when feature is complete
- Include `sql/upgrade-*.sql` migration script in the same PR
