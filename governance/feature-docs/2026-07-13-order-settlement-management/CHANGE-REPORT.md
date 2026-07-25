# CHANGE-REPORT — 订单结算管理

## 业务结果

在管理后台「订单中心」新增「订单结算管理」页面，以订单为维度统一展示 Adapay 支付订单的结算状态。财务/运营人员可查看每笔订单是否结算完成、分账明细、收款人银行卡信息。

## 影响仓库

| 仓库 | 分支 | 变更性质 |
|------|------|----------|
| `backend` | `feat/order-settlement-management` | 新增 API + Mapper + SQL |
| `admin` | `feat/order-settlement-management` | 新增页面 + API 模块 |

`miniapp/`、`icepolar-dms/` 无变更。

## 契约

### 新增 API

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/order/store-order/settlement-page` | `order:settlement:query` | 订单结算分页列表 |
| GET | `/pay/profit-sharing-order/settlement-detail?orderId=` | `order:settlement:query` | 结算明细（含收款人银行卡脱敏信息） |

### 新增权限

| 权限字符串 | 说明 |
|------------|------|
| `order:settlement:query` | 查看订单结算列表和明细 |

### DB 迁移

`sql/upgrade-2026-07-12-order-settlement-management.sql` — 在 `system_menu` 表中注册菜单项和按钮权限。

### 无变更项

- DB Schema：无表结构变更
- MQ/事件：无新增
- 依赖：无变更

## 验证结果

| 检查 | 结果 |
|------|------|
| Backend 编译 (order-biz + pay-biz) | ✅ Pass |
| Admin 构建 (build:prod) | ✅ Pass |
| Review (租户隔离 + 数据脱敏 + SQL 注入) | ✅ Pass（1 个 Blocker 已修复） |

## 残余风险

- 列表 LEFT JOIN 性能：索引覆盖 `(tenant_id, pay_time)` + `(order_id, create_time)`，初期数据量可控。后续若数据增长，可考虑汇总表。
- 无自动化测试覆盖：功能为只读聚合查询层，业务逻辑极薄，手动验证可接受。

## 建议 PR

**标题**:
```
feat(order): add order settlement management page with Adapay profit-sharing details
```

**描述**:
```markdown
## Summary
- 新增「订单结算管理」页面，位于订单中心菜单下
- 以订单为维度展示结算状态（未结算/待分账/分账中/已结算/分账失败）
- 弹窗查看分账明细 + 收款人银行卡脱敏信息
- 支持按订单号、店铺、订单状态、结算状态、支付时间筛选

## Repositories
- `backend`: 新增 settlement-page 和 settlement-detail 两个 API 端点
- `admin`: 新增页面组件 + API 模块

## Contracts
- API: 新增 `GET /order/store-order/settlement-page` 和 `GET /pay/profit-sharing-order/settlement-detail`
- DB: 新增 `upgrade-2026-07-12-order-settlement-management.sql` 菜单注册
- 权限: 新增 `order:settlement:query`

## Verification
- `mvn compile` (order-biz + pay-biz): pass
- `pnpm build:prod` (admin): pass
- Review: passed (tenant isolation + card data masking verified)

## Risks
- LEFT JOIN 查询性能：索引覆盖，初期数据量可控
```

🤖 Generated with [Claude Code](https://claude.com/claude-code)
