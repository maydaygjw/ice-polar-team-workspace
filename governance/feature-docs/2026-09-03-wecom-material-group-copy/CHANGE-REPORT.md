# 企业微信素材组复制变更报告

## Summary

- 企业微信素材组列表新增复制功能。
- 复制仅限当前租户、同一企业微信配置，服务端自动生成唯一副本名称。
- 组内全部素材按原顺序复制，图片直接复用已有企业微信图片 URL，不调用外部 API。

## Repositories

- `backend`：新增素材组复制接口、事务服务逻辑、请求 VO 和单元测试。
- `admin`：新增复制 API client、复制按钮、加载状态和成功后新组选择。

## Contracts

- 新增 `POST /admin-api/mp/wecom-material-group/copy`，请求 `{ "id": number }`，返回新组 ID。
- 复用素材组创建权限；无数据库、MQ、外部 API 变化。

## Verification

- backend 定向测试：通过，8 项。
- admin `pnpm build:dev`：通过。
- admin `pnpm ts:check`：受既有全局类型错误阻断。
- `git diff --check`：通过。

## Risks

- 真实部署、权限/租户隔离 E2E 和高并发名称冲突尚未验证。

## References

- `governance/feature-docs/2026-09-03-wecom-material-group-copy/`
