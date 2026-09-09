# 企业微信素材组外部素材变更报告

## Summary

- 外部素材提供方支持返回一个或多个同类型、有序素材。
- 系统新增 Provider 配置表，集中维护 `externalType`、`externalMaxCount` 和参数定义；管理员不输入这些协议属性。
- 外部素材引用使用 Provider 配置的 `externalMaxCount` 作为预留预算参与素材组数量校验。
- 明确素材组非文字数量预算：普通非文字素材数量 + 各 Provider `externalMaxCount` 之和不得超过 9。
- 新增饭火轮新店小程序 Provider：调用 `GetNewStoreList`，`logo/name/id` 分别映射为封面、标题和页面 `storeId` 参数；最多随机取 3 个，空结果跳过。

## Repositories

- `backend`：已在 worktree 实现 Provider 配置表模型/查询接口、外部引用字段、数量预算校验、一口价文本 Provider 和统一有序结果解析/发送框架；后续 Provider 可按同一结果模型接入。
- `admin`：已在 worktree 实现 Provider 选择、只读数量展示、按参数定义生成表单和已保存外部素材动态预览。
- `miniapp` / `icepolar-dms`：无变更。

## Contracts

- 复用素材创建/更新接口，增加 `EXTERNAL` 类型及 `externalProvider`、`externalParams`；`externalType` 和 `externalMaxCount` 从 Provider 配置表解析。
- 提供方返回同类型列表；非空数量不超过 `Provider.externalMaxCount`，允许空结果跳过。
- 已新增数据库升级脚本；OpenAPI 机器快照需在应用启动环境中生成，当前未伪造快照。

## Verification

- 文档一致性：通过 `git diff --check`。
- backend 模块编译：通过。
- backend 定向单元测试：9 项通过，包含 Provider 参数持久化验证。
- admin 生产构建：通过；`pnpm ts:check` 仍受仓库既有全局自动导入类型错误阻断，见 `test-notes.md`。

## Risks

- 动态结果必须按配置上限预留组容量；若只按实际返回数校验，可能在发送时超过企业微信限制。

## References

- `requirements-spec.md`
- `technical-design.md`
- `contract-changes.md`
