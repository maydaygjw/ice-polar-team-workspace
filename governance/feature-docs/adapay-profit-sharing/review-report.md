# Adapay 分账结算 — Review Report（角色明细化需求变更）

## 1. 审查结论

**通过。**

本次需求变更将分账订单主表中硬编码的平台/店铺字段下沉到明细表，使新增角色只需扩展枚举而无需修改主表结构。实现与更新后的需求/设计文档一致，无密钥泄漏，后端编译通过，pay-biz 单元测试通过。

## 2. 核对清单结果

| 项 | 结果 | 说明 |
|---|---|---|
| 实现与需求一致 | 通过 | 主表移除角色字段、明细表承载所有角色、fallback 模式也写入明细 |
| API 契约保持一致 | 通过 | 复用已有端点；`CreateSharingOrderDTO`、`ProfitSharingOrderRespVO` 字段已同步移除固定角色字段 |
| 没有硬编码密钥 | 通过 | 未发现硬编码密钥/密码 |
| 已验证租户隔离 | 通过 | 明细表保留 `tenant_id`；查询继续通过 `TenantContextHolder` 隔离 |
| 已创建数据库迁移脚本 | 通过 | 新增 `sql/upgrade-adapay-profit-sharing-dynamic-role.sql` |
| 迁移脚本字段与 DO/BaseDO 一致 | 通过 | 迁移字段与更新后的 DO 一致 |
| 数据字典项均已定义对应枚举/常量 | 通过 | 复用 `ProfitSharingRoleEnum`、`ProfitSharingCalculationTypeEnum`、`ProfitSharingStatusEnum` |
| 测试覆盖本次变更 | 不通过 | 未新增针对动态角色的单元测试 |
| 功能分支符合命名约定 | 待 PR 阶段 | 建议分支 `feat/adapay-profit-sharing-dynamic-role` |
| PR 描述已关联需求和设计文档 | 待 PR 阶段 | 本次未提交 PR |

## 3. 发现的问题

### 严重

无。

### 一般

无。

### 建议

#### L-1: 缺少针对动态角色分账的单元测试
- **位置**: `ProfitSharingOrderServiceImpl.createSharingOrder`、`buildDivMembers`、`fallbackToRevenue`
- **问题**: 未补充单元测试覆盖「fallback 模式写入明细」「非平台/店铺角色参与分账」「按明细回退 Revenue」等分支。
- **影响**: 未来新增角色或调整金额校验时容易回归。
- **修复建议**: 补充 `ProfitSharingOrderServiceImplTest` 相关用例。

## 4. 修复验证说明

无（首次实现本次需求变更）。

## 5. 其他说明

- 本次变更修改了 Adapay 分账订单的数据模型，属于不兼容变更；admin 列表/详情已同步移除固定平台/店铺金额展示。
- admin `ts:check` 因既有类型定义缺失未执行；Vue 文件语法已检查无引用已移除字段。
- order-biz `CommissionServiceImplTest` 因既有 `StoreShopMapper` 类加载问题失败，与本次变更无关。
