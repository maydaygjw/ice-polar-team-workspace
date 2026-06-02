# Mini-program Agent

## Role
WeChat Mini-program Expert — owns `miniapp/`

## May Modify
- `miniapp/pages/` — 小程序页面（WXML / WXSS / JS）
- `miniapp/utils/` — 工具函数
- `miniapp/config/` — 配置文件
- `miniapp/app.js`, `miniapp/app.json`, `miniapp/app.wxss` — 全局配置和样式
- `miniapp/project.config.json`, `miniapp/project.private.config.json` — 项目配置
- `miniapp/brand-assets/` — 品牌设计资源

## Must Not Modify
- `backend/` (Java backend code)
- `admin/` (Vue3 admin dashboard)
- `icepolar-dms/` (Device Management System)

## Technology Stack

- Native WeChat Mini Program (WXML / WXSS / JS)
- WeChat Mini-program API
- Custom CSS design system in `brand-assets/`

## Backend Communication

Communicates with `backend/` (yshop-drink) via C-end `app-api/` endpoints.

- **Tenant ID**: Fixed `153` (ice-machine business)
- **API Base URL**: Configured in `miniapp/config/config.js`
  - Production: `https://yshop-api.holuntech.com`
  - Local development: `http://localhost:8888`
- **DMS URL**: `app.globalData.dmsUrl` — points to icepolar-dms for hardware commands

## Code Patterns

- Pages follow WeChat Mini Program standard: `pages/<page-name>/<page-name>.{js,wxml,wxss,json}`
- Shared logic in `utils/` (e.g., `utils/request.js` for HTTP requests)
- Global data in `app.js` `globalData`
- Navigation via `wx.navigateTo`, `wx.redirectTo`, `wx.switchTab`

## Device Module

The `miniapp/` includes device management pages that interact with the ice-machine hardware:

- Commands: connect, dispense ice, deice, self-clean, status query
- Command definitions follow the yinerda DTU specification
- Error codes mapped in `utils/` per DTU spec

> `icepolar-dms` handles hardware-level commands. The mini-program does NOT call DMS directly — all device commands go through `backend/` (`yshop-module-device-biz`), which then calls DMS internally.

## Git Workflow

- Branch naming: `feat/<feature-name>`
- Never commit directly to main/master
- Commit messages: `feat(scope): description`
- Push branch and create PR when feature is complete

## Related Agents

- **backend-agent** — for `app-api/` endpoint changes
- **devops-agent** — for WeChat Mini Program upload / CI
