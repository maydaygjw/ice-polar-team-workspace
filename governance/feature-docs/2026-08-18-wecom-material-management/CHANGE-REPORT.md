# 企业微信素材管理变更报告

## Summary

- 新增按企业微信配置隔离的素材组和素材管理能力。
- 支持文字、图片、小程序、链接四类素材；每组最多一个文字素材和九个非文字素材。
- 客户群群发改为选择素材组，按素材顺序组装企业微信文字和附件消息，不再接受旧 `content` 请求。
- 小程序 AppID 使用当前租户默认小程序主账户，封面在创建群发任务时上传临时素材。

## Repositories

- `backend`：新增素材领域、管理 API、数据库迁移、权限菜单、群发编排和单元测试。
- `admin`：新增素材管理页面及表单，改造客户群群发弹窗为素材组选择和预览。
- `miniapp` / `icepolar-dms`：无变更。

## Contracts

- 新增素材组和素材管理 API、权限和两张租户业务表。
- 群发 API 保留原路径但请求字段改为 `materialGroupId`，删除 `content`。
- 外部调用复用企业微信 token、图片上传、临时封面上传和客户群群发接口。
- 详细契约见 `contract-changes.md`；OpenAPI 机器快照待运行环境可用后生成。

## Migration

- `backend/sql/upgrade-2026-08-18-wecom-material-management.sql`
- 创建素材组/素材表，增加企业微信“素材管理”菜单、权限并为 `tenant_admin` 分配权限。
- 回滚脚本为人工确认后的注释操作，不自动删除文件服务或企业微信外部素材。

## Verification

- backend 定向编译：通过。
- backend 新增素材服务单测：3 项通过。
- admin `pnpm build:dev`：通过。
- admin `pnpm ts:check`：受既有全局自动导入/类型声明错误阻断，详见 `test-notes.md`。
- 真实企业微信联调、Playwright E2E 和 OpenAPI 快照：待具备运行环境后执行。

## Risks

- 外部图片上传与本地数据库写入不是跨系统原子事务，可能产生外部孤儿素材。
- 群发网络异常时无法判断企业微信任务是否已创建，本期不自动重试。
- 小程序临时封面和企业微信附件字段需在测试租户验证。

## Suggested PR

- 标题：`feat(wecom): add material groups for customer group messaging`
- 描述：新增企业微信素材组/素材管理，支持文字、图片、小程序和链接，并将客户群群发切换为素材组编排；包含租户隔离、权限菜单、数据库迁移、管理端页面和定向测试。
