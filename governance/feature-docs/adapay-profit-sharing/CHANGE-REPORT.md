# CHANGE-REPORT: Adapay 分账结算

## 变更概述

本次在 `feat/adapay-profit-sharing` 分支追加银行列表后端化实现：银行列表由前端静态 JSON 改为后端 `yshop_pay_bank` 表维护，前端通过 `GET /pay/bank/list` 动态获取，创建/更新收款人时后端校验 `bankCode`。

> 2026-07-08 需求澄清：结算账户编辑口径已调整为“更换结算账户”模式，旧卡号不明文展示，未选择更换时可保存基础信息。

## 影响范围

| 模块/仓库 | 变更类型 | 说明 |
|-----------|----------|------|
| `backend/` | 修改 | MemberId 编码、结算账户更换、role 可选、list-by-shop 约束、**银行字典表与列表 API** |
| `admin/` | 修改 | 角色条件渲染、银行下拉、TypeScript 类型、**银行列表 API 调用** |
| `governance/` | 修改 + 新增 | 4 份设计文档更新、bank-list.json |

## 新增文件

- `governance/feature-docs/adapay-profit-sharing/bank-list.json` — Adapay 支持银行列表（5260 条）
- `.worktrees/admin-adapay-profit-sharing/public/bank-list.json` — 前端静态副本（**待移除**）
- `sql/upgrade-adapay-profit-sharing-bank.sql` — 银行字典表建表与数据初始化

## 变更详情

| # | 变更 | 后端文件 | 前端文件 |
|---|------|----------|----------|
| 1 | **MemberId 编码规则** | `ProfitRecipientServiceImpl.java` | — |
| | | `generateMemberId()` → `m_{tenantId}_{memberType}_{idCard}_{storeId\|0}` | |
| | | 新增 `extractIdCard()` | |
| | | 创建前校验 `member_id` 唯一性 | |
| 2 | **结算账户更换** | `ProfitRecipientServiceImpl.java` | `ProfitSharingReceiverForm.vue` |
| | | `updateProfitRecipient()` 处理可选 `settleAccount` 变更 | 编辑时默认显示绑定状态，显式更换时展开新账户表单 |
| 3 | **店铺级无需角色** | `ProfitRecipientBaseVO.java`, `ErrorCodeConstants.java` | `ProfitSharingReceiverForm.vue`, `index.ts` |
| | | `role` 移除 `@NotNull`，新增 `validateRole()` | `v-if="recipientType==1"`，提交时清空 |
| 4 | **店铺只能选本店铺收款人** | `ProfitRecipientMapper.java` | — |
| | | `selectListByShop()` 移除平台级+角色=1 的 OR | |
| 5 | **银行下拉带编码** | — | `ProfitSharingReceiverForm.vue`, `bank-list.json` |
| | | | `el-select` + `filterable` 替换 `el-input` |
| 6 | **银行列表后端化** | `BankController.java`, `BankServiceImpl.java`, `BankMapper.java`, `BankDO.java` | `ProfitSharingReceiverForm.vue`, `api/pay/bank/index.ts` |
| | | 新增 `yshop_pay_bank` 表与 `BankRespVO`；创建/更新收款人时校验 `bankCode` | 移除 `public/bank-list.json`；表单通过 `GET /pay/bank/list` 加载银行列表 |

## 构建验证

| 验证项 | 结果 |
|--------|------|
| `mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile` | ✅ SUCCESS |
| `pnpm build:dev` (admin) | ✅ Build successful |
| `pnpm ts:check` | ❌ 既有类型定义问题，与本次变更无关 |

## 测试覆盖

- 预存 `DesensitizeTest` 失败与本次变更无关
- E2E 测试 `adapay-profit-sharing.spec.ts` 存在但未运行（需服务环境）
- 测试建议记录在 `test-notes.md`

## 预存技术债务

以下为之前 Review 报告的遗留项，与本次 5 点修复无关：

- `-biz` 模块间直接依赖（order-biz/store-biz → pay-biz）
- 分账核心逻辑在 Service 与 Job 中重复
- OpenAPI 快照未包含新增接口
- 支付前收款人校验位置（在 `paySuccess` 而非 `pay`）

## 分支信息

| 仓库 | 功能分支 | 目标分支 |
|------|----------|----------|
| `backend/` | `feat/adapay-profit-sharing` | `master` |
| `admin/` | `feat/adapay-profit-sharing` | `master` |

## Review 结论

**PASS** — 银行列表后端化已实现，后端编译与前端构建通过，实现与设计文档一致。

## 建议 PR 标题

`feat(adapay-profit-sharing): 银行列表后端化`

## 建议 PR 描述

- 业务目标：将 Adapay 分账收款人表单中的银行列表由前端静态 JSON 改为后端数据库维护，便于统一管理与校验。
- 主要变更：
  - 后端新增 `yshop_pay_bank` 表、`BankController`、`BankService`、`PayBankMapper`，提供 `GET /admin-api/pay/bank/list`。
  - 创建/更新分账收款人时，后端强制校验 `bankCode` 必须存在且启用。
  - 前端移除 `public/bank-list.json`，新增 `src/api/pay/bank/index.ts`，表单通过 API 加载银行列表。
- 契约变化：新增 `GET /admin-api/pay/bank/list`、`BankRespVO`、`BANK_NOT_EXISTS` 错误码；`settleAccount.bankCode` 来源改为后端银行字典表。
- DB 迁移：`sql/upgrade-adapay-profit-sharing-bank.sql`（建表 + 5260 条银行数据初始化）。
- 验证：`mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile` 通过，`pnpm build:dev` 通过。`pnpm ts:check` 因既有类型定义问题失败，与本次变更无关。
