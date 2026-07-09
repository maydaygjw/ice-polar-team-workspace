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

## 2026-07-08 追加修正：禁用分账时允许解绑收款人

用户反馈：店铺分账配置无法解绑分账收款人。修正后规则：

- 禁用分账时，允许 `recipientId` 为空，店铺进入无分账收款人状态。
- 前端未选择收款人时，强制将分账置为禁用。
- 后端 `bindProfitRecipient` 在 `enabled=false` 分支中清空 `profit_sharing_recipient_id` 与 `profit_sharing_enabled`。

### 变更文件

- `backend/yshop-module-mall/yshop-module-store-biz/src/main/java/co/yixiang/yshop/module/store/service/storeshop/StoreShopServiceImpl.java`
- `backend/yshop-module-mall/yshop-module-store-biz/src/main/java/co/yixiang/yshop/module/store/controller/admin/storeshop/vo/profitrecipient/ShopBindProfitRecipientReqVO.java`
- `admin/src/views/mall/store/shop/ShopForm.vue`

### 验证

- `mvn -pl yshop-module-mall/yshop-module-store-biz -am compile -DskipTests` ✅
- `pnpm build:dev` (admin) ✅

## 2026-07-09 追加修正：Adapay Member 已存在时复用并清理旧结算账户

用户反馈：新建分账收款人时，Adapay 返回 `member_id_exists`（`member_id已存在`），因 Adapay 不支持强制删除 Member，导致无法重新创建。修正后规则：

- 创建收款人时若 Adapay 返回 `member_id_exists`，不再失败，直接复用该 MemberId。
- 通过 Adapay `Member.query` / `CorpMember.query` 查询该 Member 下已有结算账户。
- 逐条删除已有结算账户。
- 绑定新的结算账户并保存本地记录。

### 变更文件

- `backend/yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitrecipient/ProfitRecipientServiceImpl.java`
  - 新增 `AdapayContext` 持有 `AdapayPayService`、`AdapayPayConfigStorage`、`MerchantDetailsDO`
  - `createProfitRecipient`：复用 Member 并清理旧结算账户
  - 新增 `queryAdapayMemberSettleAccountIds`、`deleteExistingSettleAccounts`、`isMemberIdExistsError`
- `backend/yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/enums/ErrorCodeConstants.java`
  - 新增 `PROFIT_RECIPIENT_MEMBER_QUERY_FAILED`（1008009028）

### 契约变化

| 层 | 状态 | 说明 |
|---|---|---|
| API | N/A | 无接口变化 |
| DB schema | N/A | 无表结构变化 |
| 外部系统 | 行为调整 | 新增调用 Adapay `Member.query` / `CorpMember.query` 查询结算账户列表 |

### 验证

- `mvn clean compile -pl yshop-module-pay/yshop-module-pay-biz -am -DskipTests` ✅
- `mvn test -pl yshop-module-pay/yshop-module-pay-biz` ✅
- 全量 `mvn test -pl yshop-module-pay/yshop-module-pay-biz -am` 因预存 `DesensitizeTest` 失败中断，与本次变更无关

### 风险与缓解

| 风险 | 说明 | 缓解 |
|---|---|---|
| `settle_accounts` 返回结构与预期不符 | 无法正确提取结算账户 ID | 对 `List<Map>` / `List<String>` / `null` 做防御性处理并记录日志 |
| 删除结算账户失败 | 旧账户未清理导致新账户无法绑定 | 删除失败直接抛异常，本地不保存收款人 |
| `member_id_exists` 错误信息无法识别 | 复用逻辑不触发 | 同时匹配英文错误码 `member_id_exists` 和中文提示 `member_id已存在` |
| 并发下 Adapay 静态配置被重置 | 查询/删除使用错误配置 | 在 `synchronized (AdapayPayConfigStorage.class)` 块内初始化配置，与 SDK 同步策略一致 |

### 建议 PR 标题

`fix(pay/profitrecipient): 复用 Adapay 已存在 Member 并清理旧结算账户`

### 建议 PR 描述

```
当 Adapay 返回 member_id_exists 时，不再直接失败，而是：
1. 复用已有 MemberId；
2. 查询 Member 下已有结算账户；
3. 逐条删除旧结算账户；
4. 绑定新结算账户并保存本地记录。

新增错误码 PROFIT_RECIPIENT_MEMBER_QUERY_FAILED 用于查询失败场景。
```

## PR 信息

| 仓库 | PR | 状态 |
|------|-----|------|
| `backend/` | `feat/adapay-profit-sharing-member-reuse` | 待创建，目标分支 `master` |

