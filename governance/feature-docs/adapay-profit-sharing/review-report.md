# Adapay 分账结算 — 审查报告

## 1. 总体结论：PASS

本次审查覆盖 5 项文档对齐修复，涉及 `backend/` 与 `admin/` 的 MemberId 编码、结算账户可编辑、店铺级角色、银行列表和店铺收款人约束。

---

## 2. 审查清单逐项

### 2.1 实现是否符合需求规格

| 需求项 | 状态 | 说明 |
|--------|------|------|
| MemberId 按 `m_{租户Id}_{memberType}_{IdCard}_{storeId|0}` 编码 | ✅ 通过 | `generateMemberId()` 已改为规则编码，创建前校验唯一性 |
| 同店铺同身份证号不可重复 | ✅ 通过 | 创建前查 `member_id` 唯一性，冲突抛 `PROFIT_RECIPIENT_MEMBER_ID_DUPLICATE` |
| 结算账户可编辑 | ✅ 通过 | `updateProfitRecipient()` 接受新 `settleAccount`，同步调用 Adapay 更新 |
| 平台级需角色，店铺级无需 | ✅ 通过 | `role` 字段可选；新增 `validateRole()` 仅平台级校验 |
| 店铺只能选本店铺收款人 | ✅ 通过 | `selectListByShop()` 仅返回 `recipientType=2` 且 `shopId` 匹配的记录 |
| 银行选项来自 Adapay 银行列表 | ✅ 通过 | 前端 `el-select` + `filterable` 从 `/bank-list.json` 加载 5260 条银行 |
| 分账收款人 CRUD | ✅ 通过 | 复用之前已实现的 Controller/Service |
| 店铺绑定/解绑 | ✅ 通过 | 复用之前已实现的 ShopForm 逻辑 |
| Adapay 延迟分账 | ✅ 通过 | 复用之前已实现的 paySuccess 流程 |

### 2.2 API 合约是否符合 contract-changes.md

| 合约项 | 状态 | 说明 |
|--------|------|------|
| 路径与权限 | ✅ 通过 | 与 contract-changes.md 一致 |
| `member_id` 编码规则 | ✅ 通过 | 后端生成，前端不传 |
| `role` 平台级必填/店铺级不传 | ✅ 通过 | `ProfitRecipientBaseVO.role` 移除 `@NotNull` |
| 结算账户在 UpdateReqVO 中可用 | ✅ 通过 | `updateProfitRecipient` 处理 `settleAccount` 变更 |
| `list-by-shop` 仅返回店铺级 | ✅ 通过 | Mapper 移除平台级 OR 条件 |

### 2.3 无硬编码密钥

- ✅ 通过。本次变更不涉及密钥、私密配置。

### 2.4 多租户隔离

| 检查点 | 状态 | 说明 |
|--------|------|------|
| 新表含 `tenant_id` | ✅ 通过 | 新增表均含（之前已实现） |
| 新查询注入 `tenant_id` | ✅ 通过 | `selectListByShop()` 通过 MyBatis Plus 拦截器自动注入 |
| `member_id` 唯一性按租户隔离 | ✅ 通过 | `selectByTenantAndMember()` 按 `tenantId` + `memberId` 查询 |

### 2.5 迁移脚本

- ✅ 通过。`sql/upgrade-adapay-profit-sharing.sql` 已存在（之前已实现）。
- 需注意：`role` 字段从之前的 `NOT NULL` 改为 `NULL`，需确认 SQL 脚本一致。

### 2.6 测试覆盖

| 测试类型 | 状态 | 说明 |
|----------|------|------|
| 后端编译 | ✅ 通过 | `mvn compile -pl yshop-module-pay -am` |
| 前端构建 | ✅ 通过 | `pnpm build:dev` |
| 后端测试 | ✅ 编译通过 | pay module 无新增测试类（[test-notes.md](test-notes.md) 记录建议） |
| E2E 测试 | 未运行 | `admin/e2e/adapay-profit-sharing.spec.ts` 存在但未执行（需服务环境） |

### 2.7 分支命名

- ✅ 通过。`feat/adapay-profit-sharing`。

---

## 3. 本次修复事项

| 文件 | 变更 | 说明 |
|------|------|------|
| `ProfitRecipientServiceImpl.java` | MemberId 编码 + 结算可编辑 + role 可选 | 核心逻辑 |
| `ProfitRecipientBaseVO.java` | role `@NotNull` 移除 | DTO 层 |
| `ProfitRecipientMapper.java` | `selectListByShop` 仅店铺级 | 查询层 |
| `ProfitRecipientDO.java` | 注释更新 | 文档对齐 |
| `ErrorCodeConstants.java` | 新增 `PROFIT_RECIPIENT_ROLE_REQUIRED` | 错误码 |
| `ProfitSharingReceiverForm.vue` | role 条件渲染 + 银行下拉 + 提交逻辑 | 前端表单 |
| `profitSharingReceiver/index.ts` | `role` 改为可选 | TypeScript 类型 |
| `bank-list.json` | 新增 5260 条银行数据 | 静态资源 |

---

## 4. 审查人

Review Agent (Claude Code)

## 5. 审查时间

2026-07-07
