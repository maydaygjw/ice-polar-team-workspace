# 变更报告

## 业务结果

- 客户群页面增加群标签维护、批量添加/移除标签和按标签筛选。
- 企业群发支持按群标签匹配客户群并创建企业微信群发任务。

## 影响仓库

- `backend`：标签表、关联表、管理端 API、企业微信客户群群发调用、菜单权限迁移。
- `admin`：客户群标签维护、批量打标、标签筛选和群发弹窗。

## 验证结果

- Backend compile/test：通过。
- Admin build:dev：通过。
- Admin 定向 TypeScript 检查：通过。

## 交付说明

- 已完成本地 commit；未执行 push 或创建 PR。
- 部署前需执行 `backend/sql/upgrade-2026-08-17-wecom-customer-group-tags.sql`。
