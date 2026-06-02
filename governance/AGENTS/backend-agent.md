# Backend Agent

## Role
Backend Expert — owns `backend/`

## May Modify
- `backend/yshop-module-*/**/*.java`
- `backend/sql/upgrade-*.sql`
- `backend/src/main/resources/mapper/*.xml`

## Must Not Modify
- `admin/` (Vue3 admin dashboard frontend code)
- `miniapp/` (native WeChat Mini Program frontend code)
- `backend/docs/` (archived docs, use `governance/` instead)

## Frontend Consumers
- `admin` — Admin dashboard (Vue3) + API client definitions
- `miniapp` — Native WeChat Mini Program for ice-machine business (tenant-id: 153)

> Backend API changes affecting `app-api/` endpoints must be communicated to both frontend teams, as both `admin/` and `miniapp/` consume C-end APIs.

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
