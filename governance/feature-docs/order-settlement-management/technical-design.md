# 技术设计 — 订单结算管理

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-order-biz` | 修改 | 新增 `StoreOrderSettlementController`、Service、Mapper XML（LEFT JOIN 分账表） |
| `yshop-module-order-api` | 修改 | 新增结算列表 RespVO、PageReqVO |
| `yshop-module-pay-biz` | 修改 | 新增 `settlement-detail` 端点（含收款人银行卡信息） |
| `yshop-module-pay-api` | 修改 | 新增 `SettlementDetailRespVO`、`SettlementDetailItemVO` |
| `admin/` | 修改 | 新增订单结算管理页面 + API 模块 |
| `yshop-module-mall` (sql) | 修改 | 新增菜单注册升级脚本 |

### 跨模块依赖

```
yshop-module-order-biz ──→ yshop-module-pay-api (无，仅 Mapper 层 JOIN)
yshop-module-pay-biz     ──→ 无新增依赖
```

订单结算列表在 order-biz 通过 Mapper XML 直接 LEFT JOIN `yshop_adapay_profit_sharing_order`，不跨模块调用 Service。结算明细通过 pay-biz 新端点获取。

## 架构决策

1. **列表聚合在 order-biz**：以订单为主表的 LEFT JOIN 查询，在 order-biz 的 Mapper XML 中完成。`yshop_store_order` 与 `yshop_adapay_profit_sharing_order` 在同一 MySQL 实例，跨表 JOIN 无性能问题。

2. **取最新分账记录**：同一 `order_id` 可能存在多条分账记录（重试场景）。使用子查询 `MAX(create_time)` 取最新一条，确保结算状态准确。

3. **结算状态计算**：在 SQL 层或 Java 层计算派生状态：
   - 非 Adapay 支付 或 无分账记录 → `0`（未结算）
   - `sharing_status=0` → `1`（待分账）
   - `sharing_status=1` → `2`（分账中）
   - `sharing_status=2` 或 `4` → `3`（已结算）
   - `sharing_status=3` → `4`（分账失败）

4. **明细端点独立**：结算明细通过独立的 `/pay/profit-sharing-order/settlement-detail` 端点获取，按 `orderId` 查询。该端点在 pay-biz 模块，可直接访问分账明细表 + 收款人表，返回包含银行卡脱敏信息的完整数据。

5. **弹窗展示明细**：前端使用 `el-dialog` 弹窗展示结算明细，与「行内展开」模式不同。弹窗打开时调用明细 API 获取数据。

6. **手续费仅展示标记**：明细中仅展示「是/否」承担手续费（`fee_flag`），不展示手续费金额。手续费金额源于 Adapay 账单 CSV，不在分账表中。

7. **多租户与数据权限**：列表查询基于 `TenantBaseDO` 自动注入 `tenant_id` 过滤；不涉及部门级数据权限。

8. **只读页面**：本页面不提供任何写操作按钮，仅查询展示。失败重试等操作引导用户跳转至已有的「分账结算记录」页面。

9. **无新 ADR**：复用现有模块分层、多租户拦截器、分页查询模式。不新增架构范式。

## 数据模型

无需新建表或修改现有表结构。仅新增菜单注册 SQL。

### 查询模型

**列表查询（Mapper XML in order-biz）**：

```sql
SELECT
  o.id, o.order_id, o.shop_id, o.shop_name, o.pay_price, o.pay_type,
  o.status AS order_status, o.pay_time, o.create_time,
  pso.id AS profit_sharing_order_id,
  pso.sharing_status,
  pso.adapay_payment_id,
  pso.sharing_time,
  pso.fallback_revenue
FROM yshop_store_order o
LEFT JOIN yshop_adapay_profit_sharing_order pso
  ON o.order_id = pso.order_id
  AND pso.deleted = 0
  AND pso.create_time = (
    SELECT MAX(create_time) FROM yshop_adapay_profit_sharing_order
    WHERE order_id = o.order_id AND deleted = 0
  )
WHERE o.deleted = 0
  AND o.tenant_id = #{tenantId}
  -- 动态筛选条件
ORDER BY o.pay_time DESC
```

**明细查询（in pay-biz）**：

```
yshop_adapay_profit_sharing_order (按 order_id, 取最新)
  → yshop_adapay_profit_sharing_order_item (按 sharing_order_id)
    → yshop_adapay_profit_recipient (按 recipient_id, 获取银行卡脱敏信息)
```

### 菜单 SQL

```sql
-- 订单结算管理菜单
INSERT INTO system_menu (name, permission, type, sort, parent_id, path, component, component_name, icon, status, deleted, create_time, update_time)
VALUES ('订单结算管理', 'order:settlement:query', 2, 2, 2175, 'settlement',
        'order/settlement/index', 'OrderSettlement', 'ep:money', 0, 0, NOW(), NOW());
```

父菜单 ID=2175 即「订单中心」。权限字符串 `order:settlement:query`。

## API 设计

### 端点 1：结算列表

```
GET /order/store-order/settlement-page
```

**权限**: `order:settlement:query`

**请求参数** (`StoreOrderSettlementPageReqVO`):

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderId | String | 否 | 订单号 |
| shopId | Long | 否 | 店铺 ID |
| orderStatus | Integer | 否 | 订单状态 (0-6) |
| settlementStatus | Integer | 否 | 结算状态 (0-4) |
| payTimeStart | LocalDateTime | 否 | 支付时间起 |
| payTimeEnd | LocalDateTime | 否 | 支付时间止 |
| pageNo | Integer | 是 | 页码 |
| pageSize | Integer | 是 | 每页条数 |

**响应** (`StoreOrderSettlementRespVO`):

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Long | 订单自增 ID |
| orderId | String | 订单号 |
| shopId | Long | 店铺 ID |
| shopName | String | 店铺名称 |
| payPrice | BigDecimal | 实付金额 |
| payType | String | 支付方式 (adapay/weixin/alipay/yue/cash) |
| orderStatus | Integer | 订单状态 |
| payTime | LocalDateTime | 支付时间 |
| createTime | LocalDateTime | 创建时间 |
| profitSharingOrderId | Long | 分账订单 ID (可为 null) |
| settlementStatus | Integer | 结算状态: 0=未结算, 1=待分账, 2=分账中, 3=已结算, 4=分账失败 |
| sharingTime | LocalDateTime | 分账时间 (可为 null) |

### 端点 2：结算明细

```
GET /pay/profit-sharing-order/settlement-detail
```

**权限**: `order:settlement:query`

**请求参数**:

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| orderId | String | 是 | 订单号 |

**响应** (`SettlementDetailRespVO`):

| 字段 | 类型 | 说明 |
|------|------|------|
| orderId | String | 订单号 |
| shopId | Long | 店铺 ID |
| shopName | String | 店铺名称 |
| payPrice | BigDecimal | 实付金额 |
| adapayPaymentId | String | Adapay 支付 ID |
| adapayConfirmId | String | Adapay 确认 ID |
| sharingTime | LocalDateTime | 分账时间 |
| sharingStatus | Integer | 原始分账状态 (0-4) |
| calculationType | Integer | 计算方式: 1=计费规则, 2=佣金回退 |
| feeBearerRole | Integer | 手续费承担角色 |
| fallbackRevenue | Integer | 是否已回退 |
| errorMsg | String | 失败原因 (可为 null) |
| items | List\<SettlementDetailItemVO\> | 分账明细列表 |

**SettlementDetailItemVO**:

| 字段 | 类型 | 说明 |
|------|------|------|
| role | Integer | 角色: 1=平台, 2=店铺, 3=配送方, 4=销售方 |
| roleName | String | 角色名称 |
| recipientId | Long | 收款人 ID |
| recipientName | String | 收款人名称 |
| amount | BigDecimal | 分账金额 |
| feeFlag | Integer | 是否承担手续费: 0=否, 1=是 |
| bankName | String | 银行名称 (脱敏) |
| cardNoMask | String | 银行卡号摘要 (脱敏) |
| provName | String | 开户省份 |
| areaName | String | 开户城市 |

## 流程设计

### 结算状态计算流程

```
查询 yshop_store_order
  → LEFT JOIN yshop_adapay_profit_sharing_order (latest by create_time)
      → 无分账记录 且 pay_type=adapay
          → settlementStatus = 0 (未结算)
      → 无分账记录 且 pay_type≠adapay
          → settlementStatus = 0 (未结算)
      → sharing_status = 0 → settlementStatus = 1 (待分账)
      → sharing_status = 1 → settlementStatus = 2 (分账中)
      → sharing_status = 2 → settlementStatus = 3 (已结算)
      → sharing_status = 3 → settlementStatus = 4 (分账失败)
      → sharing_status = 4 → settlementStatus = 3 (已结算，回退)
```

### 明细弹窗流程

```
用户点击「查看明细」
  → 仅 settlementStatus != 0 时可用（有分账记录）
  → 调用 GET /pay/profit-sharing-order/settlement-detail?orderId=xxx
  → 弹窗展示：
      1. 基本信息区：支付ID、确认ID、分账时间、计算方式、是否回退
      2. 分账明细表：角色/收款人/金额/手续费标记
      3. 收款人银行卡信息（每行明细下方或 hover 展示）
  → 分账失败时额外展示 error_msg
```

## 前端设计

### 路由

路径 `/order/settlement`，组件 `views/mall/order/settlement/index.vue`。

由后端 `system_menu` 表注册为动态路由，componentName 为 `OrderSettlement`。Vite 的 `import.meta.glob` 自动发现 `../views/**/*.{vue,tsx}` 下的组件。

### 页面结构

```
ContentWrap (筛选区)
  ├── el-form
  │   ├── 订单号 (el-input)
  │   ├── 店铺 (el-select, 远程搜索)
  │   ├── 订单状态 (el-select)
  │   ├── 结算状态 (el-select)
  │   ├── 支付时间 (el-date-picker, daterange)
  │   └── 搜索/重置 按钮

ContentWrap (列表区)
  ├── el-table
  │   ├── 订单号
  │   ├── 店铺名称
  │   ├── 订单金额
  │   ├── 支付方式
  │   ├── 支付时间
  │   ├── 订单状态 (tag)
  │   ├── 结算状态 (tag, 颜色编码)
  │   ├── 分账时间
  │   └── 操作 (查看明细按钮)

el-dialog (结算明细弹窗)
  ├── 基本信息 Descriptions
  ├── 分账明细 el-table
  └── 收款人银行卡信息（明细行内展示）
```

### 结算状态颜色编码

| 状态 | Tag 颜色 |
|------|----------|
| 未结算 | `info` (灰) |
| 待分账 | `warning` (橙) |
| 分账中 | `` (蓝) |
| 已结算 | `success` (绿) |
| 分账失败 | `danger` (红) |

### 权限

| 权限字符串 | 说明 |
|------------|------|
| `order:settlement:query` | 查看订单结算列表 + 结算明细 |

### 租户数据范围

| 角色 | 数据范围 |
|------|----------|
| 超管/平台财务 | 所有租户 |
| 租户管理员 | 仅当前租户 |

## 风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 大表 LEFT JOIN 性能 | 中 | 索引覆盖：`yshop_store_order(tenant_id, pay_time)` + `yshop_adapay_profit_sharing_order(order_id, create_time)`；分页限制 pageSize |
| 子查询 `MAX(create_time)` 性能 | 低 | 单订单的分账记录数有限（重试场景 2-3 条），索引 `(order_id, create_time)` 快速定位 |
| 收款人已删除导致明细查询失败 | 低 | LEFT JOIN 收款人表；空值时展示「收款人已删除」 |
| 菜单注册 SQL 与现有 system_menu ID 冲突 | 低 | 使用自增主键，不硬编码 ID |
| 前端组件 glob 匹配不到新页面 | 低 | component 路径遵循现有约定 (`order/settlement/index`)，glob 模式 `../views/**/*.{vue,tsx}` 可匹配 |

## 分支计划

| 仓库 | 分支名 |
|------|--------|
| `backend/` | `feat/order-settlement-management` |
| `admin/` | `feat/order-settlement-management` |

`miniapp/`、`icepolar-dms/` 无变更。

## 契约层状态

| 层 | 状态 | 引用 |
|----|------|------|
| DB schema | 无变更（仅菜单 SQL） | 本节 |
| API | 新增 | §API 设计 |
| 事件/MQ | N/A | 无新增事件 |
| 依赖 | 无变更 | 复用现有模块 |
| ADR | 不需要 | 无新架构范式 |
