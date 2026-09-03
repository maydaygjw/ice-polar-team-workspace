# 企业微信素材组复制验证记录

## 已执行

| 仓库 | 命令 | 结果 |
|---|---|---|
| backend | `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomMaterialServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test` | 通过；8 项测试通过，包含完整复制、图片 URL 复用和名称冲突后缀 |
| admin | `pnpm build:dev` | 通过 |
| workspace | `git diff --check` | 通过 |

## 未完成或受限验证

- `admin: pnpm ts:check` 未通过。仓库当前存在大量与本功能无关的既有全局类型错误；本次新增素材 API 和页面未出现在错误列表中。
- 未执行真实企业微信 API、数据库部署和 Playwright E2E；本功能设计为不调用企业微信 API，但仍需测试环境验证权限、租户隔离和真实数据库事务。
- 未生成 OpenAPI 机器快照；需在完整运行环境可用后按治理流程生成。
