# 变更报告

## 业务结果

- 企业微信目录新增客户标签管理页面，可按企业微信配置实时查看标签组和标签。
- 支持创建带首批标签的标签组、向已有标签组新增标签、编辑名称/排序以及删除标签组或标签。
- 不实现给具体企业微信客户打标签，且不影响已有客户群标签功能。

## 影响仓库

- backend：企业微信客户标签外部 API 封装、管理端接口、参数校验、错误码、单元测试和菜单权限 SQL。
- admin：客户标签页面、实时 API client、标签组/标签创建和编辑交互。

## 契约与迁移

- 新增 /admin-api/mp/wecom-customer-tag/{list,create,update,delete} 接口。
- 不新增业务数据表；新增 backend/sql/upgrade-2026-08-29-wecom-customer-tag-management.sql 菜单权限迁移。
- 未生成中央 OpenAPI 快照，部署环境可用后需补收集。

## 验证结果

- Backend compile：通过。
- Backend targeted test：4 个用例通过。
- Backend MP module test：51 个用例通过。
- Admin ESLint：通过。
- Admin Prettier check：通过。
- Admin build:dev：通过。
- Admin 全量 ts:check：受既有类型错误影响未通过；新增文件定向无错误。
- 真实企业微信和 E2E：未执行，需测试账号/数据和外部权限。

## 交付说明

- 已创建独立分支 worktree：feat/wecom-customer-tag-management。
- 未 commit、push、创建 PR 或执行数据库迁移。
