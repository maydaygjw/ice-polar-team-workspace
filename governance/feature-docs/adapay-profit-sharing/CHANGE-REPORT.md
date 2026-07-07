# CHANGE-REPORT: Adapay 分账结算

## 变更概述

本次为 Phase 3 文档对齐修复，同步 `requirements-spec.md`、`technical-design.md`、`contract-changes.md`、`ui-ux-design.md` 的 5 项规则调整到 `backend/` 和 `admin/`。

## 影响范围

| 模块/仓库 | 变更类型 | 说明 |
|-----------|----------|------|
| `backend/` | 修改 | MemberId 编码、结算可编辑、role 可选、list-by-shop 约束 |
| `admin/` | 修改 | 角色条件渲染、银行下拉、TypeScript 类型 |
| `governance/` | 修改 + 新增 | 4 份设计文档更新、bank-list.json |

## 新增文件

- `governance/feature-docs/adapay-profit-sharing/bank-list.json` — Adapay 支持银行列表（5260 条）
- `.worktrees/admin-adapay-profit-sharing/public/bank-list.json` — 前端静态副本

## 变更详情

| # | 变更 | 后端文件 | 前端文件 |
|---|------|----------|----------|
| 1 | **MemberId 编码规则** | `ProfitRecipientServiceImpl.java` | — |
| | | `generateMemberId()` → `m_{tenantId}_{memberType}_{idCard}_{storeId\|0}` | |
| | | 新增 `extractIdCard()` | |
| | | 创建前校验 `member_id` 唯一性 | |
| 2 | **结算账户可编辑** | `ProfitRecipientServiceImpl.java` | `ProfitSharingReceiverForm.vue` |
| | | `updateProfitRecipient()` 处理 `settleAccount` 变更 | 结算账户区域始终可见 |
| 3 | **店铺级无需角色** | `ProfitRecipientBaseVO.java`, `ErrorCodeConstants.java` | `ProfitSharingReceiverForm.vue`, `index.ts` |
| | | `role` 移除 `@NotNull`，新增 `validateRole()` | `v-if="recipientType==1"`，提交时清空 |
| 4 | **店铺只能选本店铺收款人** | `ProfitRecipientMapper.java` | — |
| | | `selectListByShop()` 移除平台级+角色=1 的 OR | |
| 5 | **银行下拉带编码** | — | `ProfitSharingReceiverForm.vue`, `bank-list.json` |
| | | | `el-select` + `filterable` 替换 `el-input` |

## 构建验证

| 验证项 | 结果 |
|--------|------|
| `mvn compile` (pay-biz, pay-api) | ✅ 通过 |
| `pnpm build:dev` (admin) | ✅ 通过 |
| `pnpm ts:check` | ✅ 0 错误 |

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

**PASS** — 5 项修复均已实现，编译与构建通过，实现与设计文档一致。
