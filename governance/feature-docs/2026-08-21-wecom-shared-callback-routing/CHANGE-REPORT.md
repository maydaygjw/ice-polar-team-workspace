# 变更报告

## Summary

- 企业微信客户联系回调从 `accountId` 路由改为 `corpId` 路由。
- State 改为 `v1:t{tenantId}:r{businessRegionId}`，回调按目标租户和商圈发送欢迎语。
- `mp_wecom_account` 增加 `app_name`、`agent_id`，管理端支持录入、编辑和展示。

## Repositories

- `backend`：回调 Controller/Service、State 生成与解析、跨租户账号选择、消息字段、数据库迁移和测试。
- `admin`：企业微信配置表单、列表、类型和联系我提示文案。

## Contracts

- API：`GET/POST /app-api/mp/wecom/callback/{corpId}`。
- MQ：欢迎语消息携带目标 `tenantId` 和 `businessRegionId`，`accountId` 使用目标租户账号。
- DB：新增 `mp_wecom_account.app_name`、`agent_id`；历史应用名称回填 `name`。
- 权限：N/A，沿用现有权限。

## Migration

- 执行 `backend/sql/upgrade-2026-08-21-wecom-shared-callback-routing.sql`。
- 企业微信后台切换回调 URL，并更新已有联系我配置以生成新 State。

## Verification

- backend：目标 Maven 单元测试通过，24 个测试全部通过。
- admin：目标文件 ESLint 通过，`pnpm build:prod` 通过；全量 `pnpm ts:check` 受其他模块类型错误影响未通过，目标 `mp/wecom` 文件未出现在错误输出中。
- E2E：未执行，原因见 `test-notes.md`。

## Risks

- 同一 CorpID 的多条配置必须代表同一个共享应用，凭据不一致时回调会被拒绝。
- WelcomeCode 仍只能由一个应用发送，本设计不支持同 CorpID 多应用并行欢迎语。

## Suggested PR

`feat(mp): support shared wecom welcome callback routing`
