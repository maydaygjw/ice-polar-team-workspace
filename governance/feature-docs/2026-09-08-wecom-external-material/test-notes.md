# 企业微信素材组外部素材验证记录

## 当前状态

本特性已进入实现阶段，代码位于 backend/admin worktree；浏览器 E2E 尚未执行。

## 已完成

| 范围 | 验证 | 结果 |
|---|---|---|
| 文档 | `git diff --check` | 通过 |
| 需求/契约 | Provider 配置表、`externalType`/`externalMaxCount`、同类型有序列表和素材组预算规则已在规格、设计和测试计划中对齐 | 通过 |
| backend | `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile` | 通过 |
| backend | `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomMaterialServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test` | 通过；9 项，包含 Provider 参数持久化验证 |
| backend | 外部素材预览接口、统一结果模型和 Provider 配置模型编译验证 | 通过 |
| admin | `pnpm i --frozen-lockfile` | 通过 |
| admin | `NODE_OPTIONS=--max-old-space-size=8192 pnpm ts:check` | 受既有全局自动导入/类型错误阻断；本次素材文件仅出现同类既有 `ref`/`computed` 等错误 |
| admin | `NODE_OPTIONS=--max-old-space-size=8192 pnpm build:prod` | 通过；修复素材表单末尾误插入模板节点后构建退出码为 0 |

## 待完成

- 在测试环境验证提供方失败、数量边界、租户隔离、企业微信发送和 E2E 流程；当前 admin 全量 `pnpm ts:check` 仍被仓库既有大量全局类型错误阻断。
- 在测试环境验证提供方失败、数量边界、租户隔离、企业微信发送和 E2E 流程。
- 生成并校验 OpenAPI 机器快照；未实现前不宣称契约已部署。
