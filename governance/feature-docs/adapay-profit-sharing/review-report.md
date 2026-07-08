# Review Report — Adapay 分账结算银行列表后端化

## 审查结论

**PASS** — 实现与需求、设计、契约一致；后端编译通过，前端构建通过；可进入交付阶段。

## 审查清单

| 检查项 | 结果 | 说明 |
|--------|------|------|
| 实现满足 `requirements-spec.md` | ✅ | 银行选项改为来自后端银行字典表 |
| 技术方案符合 `technical-design.md` | ✅ | 新增 `yshop_pay_bank`、列表 API、缓存、后端校验 |
| 契约与 `contract-changes.md` 一致 | ✅ | 新增 `GET /admin-api/pay/bank/list`、`BankRespVO`、`BANK_NOT_EXISTS` 错误码 |
| 无密钥、无私密配置 | ✅ | 未涉及 |
| 租户隔离 | ✅ | 银行表全局共享，与决策一致；收款人表仍保持 `tenant_id` |
| DB 迁移存在且可回滚 | ✅ | `sql/upgrade-adapay-profit-sharing-bank.sql` 含建表、数据初始化、回滚语句 |
| 测试覆盖 | ⚠️ | 后端编译通过、前端 `build:dev` 通过；`ts:check` 因既有类型定义问题失败，与本次变更无关 |
| UI/UX 一致 | ✅ | `ProfitSharingReceiverForm.vue` 银行下拉改为调用后端 API |
| 分支名、提交范围 | ✅ | 在现有 `feat/adapay-profit-sharing` 分支 worktree 中实现，未提交 |

## 影响文件

### backend/

- `yshop-module-pay/yshop-module-pay-api/.../ErrorCodeConstants.java`
- `yshop-module-pay/yshop-module-pay-biz/.../service/profitrecipient/ProfitRecipientServiceImpl.java`
- `yshop-module-pay/yshop-module-pay-biz/.../controller/admin/bank/BankController.java`
- `yshop-module-pay/yshop-module-pay-biz/.../controller/admin/bank/vo/BankRespVO.java`
- `yshop-module-pay/yshop-module-pay-biz/.../service/bank/BankService.java`
- `yshop-module-pay/yshop-module-pay-biz/.../service/bank/BankServiceImpl.java`
- `yshop-module-pay/yshop-module-pay-biz/.../dal/dataobject/bank/PayBankDO.java`
- `yshop-module-pay/yshop-module-pay-biz/.../dal/mysql/bank/PayBankMapper.java`
- `yshop-module-pay/yshop-module-pay-biz/.../convert/bank/BankConvert.java`
- `sql/upgrade-adapay-profit-sharing-bank.sql`

### admin/

- `src/api/pay/bank/index.ts`（新增）
- `src/views/mall/store/profitSharingReceiver/ProfitSharingReceiverForm.vue`
- `public/bank-list.json`（删除）

## 验证结果

| 验证项 | 命令 | 结果 |
|--------|------|------|
| 后端编译 | `mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile` | ✅ SUCCESS |
| 前端构建 | `pnpm build:dev` | ✅ Build successful |
| 前端类型检查 | `pnpm ts:check` | ❌ 既有类型定义问题，与本次变更无关 |

## 风险与建议

1. **迁移脚本大小**：`upgrade-adapay-profit-sharing-bank.sql` 323KB、6 条批量 INSERT，执行时间需关注；建议在低峰期执行。
2. **缓存 key**：使用 `pay:bank:list` 缓存，keyword 为空时缓存全部列表；keyword 变化时缓存不同 key，避免大量 keyword 撑爆缓存。
3. **银行列表更新**：本期为只读字典表，Adapay 银行列表变更时需通过 SQL/脚本更新。
4. **权限复用**：银行列表接口复用 `pay:profit-recipient:query`，与分账收款人查看权限一致；若后续需要独立权限，可新增 `pay:bank:query`。

## 下一步

等待用户确认是否提交、推送、创建 PR。
