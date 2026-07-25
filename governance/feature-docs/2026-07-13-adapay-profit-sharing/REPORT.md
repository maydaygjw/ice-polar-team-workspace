# 阻塞报告 — Adapay 分账结算银行列表后端化

## 当前阶段

**RESOLVED** — 用户已确认方案，技术设计与契约文档已更新，可进入 Phase 3 实现。

## 变更事实

用户要求：分账收款人表单中的银行列表不再保存在前端，改为保存在后端数据库。

## 用户决策

| 问题 | 决策 |
|------|------|
| 银行字典表是否全局共享？ | 全局共享（无 `tenant_id`） |
| 是否需要后台管理页面？ | 只读字典表，本期不做后台 CRUD 页面 |
| 5260 条数据如何初始化？ | 迁移脚本 `sql/upgrade-2026-07-08-adapay-profit-sharing-bank.sql` 从 `bank-list.json` 导入 |
| 后端是否强制校验 `bankCode`？ | 强制校验，必须存在且启用 |

## 已更新文档

- `governance/feature-docs/2026-07-13-adapay-profit-sharing/technical-design.md`
- `governance/feature-docs/2026-07-13-adapay-profit-sharing/contract-changes.md`
- `governance/feature-docs/2026-07-13-adapay-profit-sharing/ui-ux-design.md`
- `governance/feature-docs/2026-07-13-adapay-profit-sharing/requirements-spec.md`

## 下一步

进入 Phase 3：创建 backend / admin worktree，实现银行字典表、列表 API、前端调用改造与迁移脚本。
