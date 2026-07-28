# 变更报告

## 业务结果

- 新增企业微信配置维护，可保存企业 ID（CorpID）和客户联系 Secret。
- 新增手动同步全部客户群能力，按 cursor 分页获取群列表和详情，保存群基本信息及成员快照。
- 新增客户群分页查询页面；重复同步按群 ID 更新，不产生重复数据。
- Secret 加密存储并在管理端脱敏，数据按租户隔离。

## 影响仓库

- `backend`：`yshop-module-mp` 新增企业微信配置/客户群 API、服务、外部 API client、DO/Mapper、错误码和数据库升级脚本。
- `admin`：新增企业微信配置和客户群页面、API client。
- `miniapp` / `icepolar-dms`：无变更。

## 契约与迁移

- 新增管理端 API，详见 `contract-changes.md`。
- 新增 `mp_wecom_account`、`mp_wecom_customer_group`，脚本为 `backend/sql/upgrade-2026-07-28-wecom-customer-group-sync.sql`。
- 平台架构补充企业微信客户联系 API 外部系统依赖。
- OpenAPI 机器快照因本地服务前置条件未满足暂未更新。

## 验证结果

- 后端模块编译：通过。
- 新增 `WecomConvertTest`：2 项通过。
- 管理端 ESLint、Prettier、生产构建：通过。
- 全量后端测试：被既有 `DesensitizeTest` 基线失败阻断。
- `pnpm ts:check`：被仓库既有类型入口解析问题阻断。
- 真实企业微信 API、Playwright E2E、OpenAPI 生成：未执行，原因见 `test-notes.md`。

## 残余风险

- 需要测试企业验证 Secret 的客户联系权限和群详情响应字段。
- 大规模客户群同步可能需要后续异步任务化。
- 交付前需要补生成 `governance/CONTRACT/backend-api.json`。

## 建议 PR

标题：`feat(mp): add enterprise WeChat customer group sync`

正文要点：新增企业微信配置维护与客户群同步；影响 `backend`、`admin`；包含两张租户隔离表和菜单权限迁移；后端编译、转换测试、管理端 ESLint/Prettier/生产构建通过；保留基线测试、真实企业微信 API、E2E 和 OpenAPI 快照验证项。
