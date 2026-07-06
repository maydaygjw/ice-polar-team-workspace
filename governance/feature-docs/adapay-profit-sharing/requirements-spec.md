## Feature: Adapay 分账结算

### Scope

**In Scope**

1. 分账收款人管理（平台级 + 店铺级），支持分账角色（平台/配送方/销售方）
2. 店铺绑定一个分账收款人并启用/禁用分账
3. Adapay 支付时设置延迟分账（`pay_mode=delay`）
4. 日终自动结算 Job，按店铺 `commission_rate` 执行分账
5. 分账订单查询与失败重试；分账失败自动回退到现有 `RevenueJob` 虚拟余额结算
6. 支付时校验分账收款人配置，缺失时拒绝支付

**Out of Scope**

- 非 Adapay 支付渠道的分账（微信、支付宝）
- 分账比例覆盖字段：本期仅使用 `yshop_store_shop.commission_rate`
- 分账回退接口的完整实现：退款触发分账回退不在本期主流程

**Deferred**

- 分账比例覆盖（per-shop override ratio）
- 分账结算记录导出
- 个人/企业 member 详细字段：本期先实现 Adapay `member_id` 和结算账户绑定核心字段

---

### Data Model Changes

**新建表**

| 表 | 说明 |
|----|------|
| `yshop_adapay_profit_recipient` | 分账收款人（平台级/店铺级），含分账角色 |
| `yshop_adapay_profit_sharing_order` | 分账订单记录 |
| `yshop_adapay_profit_sharing_log` | 分账操作日志 |

**修改表**

| 表 | 字段 | 说明 |
|----|------|------|
| `yshop_store_shop` | `profit_sharing_recipient_id` | 绑定的分账收款人ID |
| `yshop_store_shop` | `profit_sharing_enabled` | 0=未启用, 1=已启用分账 |

> 分账金额在 `yshop_adapay_profit_sharing_order` 创建时固化，基于 `commission_amount`（支付时快照），不依赖后续可能变化的 `commission_rate`。

---

### API Requirements

**Admin API — 分账收款人管理**

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin-api/pay/profit-recipient/create` | `pay:profit-recipient:create` | 创建收款人；同租户同角色只能有一个 `status=1` 的收款人 |
| PUT | `/admin-api/pay/profit-recipient/update` | `pay:profit-recipient:update` | 更新；`recipientType`/`shopId`/`role` 不可变更 |
| DELETE | `/admin-api/pay/profit-recipient/delete` | `pay:profit-recipient:delete` | 已绑定店铺的收款人拒绝删除 |
| GET | `/admin-api/pay/profit-recipient/get` | `pay:profit-recipient:query` | 按 ID 查询 |
| GET | `/admin-api/pay/profit-recipient/page` | `pay:profit-recipient:query` | 分页查询，支持按级别/角色/店铺/状态/名称筛选 |
| GET | `/admin-api/pay/profit-recipient/list-by-shop` | `pay:profit-recipient:query` | 查询店铺可用收款人列表 |

**Admin API — 店铺分账绑定**

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| PUT | `/admin-api/store/shop/bind-profit-recipient` | `store:shop:update` | 绑定/解绑；`enabled=true` 时校验收款人有效且 `status=1` |

**Admin API — 分账订单查询**

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| GET | `/admin-api/pay/profit-sharing-order/page` | `pay:profit-sharing:query` | 分页查询，支持按订单号/店铺/状态/时间筛选 |
| GET | `/admin-api/pay/profit-sharing-order/get` | `pay:profit-sharing:query` | 按 ID 查询详情 |
| POST | `/admin-api/pay/profit-sharing-order/retry` | `pay:profit-sharing:update` | 仅 `sharing_status=3`（失败）可重试 |

**Internal API**

| 调用方 | 接口 | 说明 |
|--------|------|------|
| `order-biz` -> `pay-api` | `ProfitSharingOrderApi.createSharingOrder(dto)` | 支付成功时创建分账挂起记录 |
| `store-biz` -> `pay-api` | `ProfitRecipientApi.listByShop(shopId)` | 查询店铺可选收款人列表 |

> **权限标识**：统一使用 `pay:profit-recipient:*`、`pay:profit-sharing:*`、`store:shop:update`。

---

### Frontend Requirements

**管理后台**

| 页面 | 路径 | 功能 |
|------|------|------|
| 分账收款人管理 | `views/mall/store/profitSharingReceiver/index.vue` | CRUD + 分页列表 + 搜索 |
| 分账收款人表单 | `views/mall/store/profitSharingReceiver/ProfitSharingReceiverForm.vue` | 新增/编辑弹窗 |
| 分账结算记录 | `views/mall/store/profitSharingRecord/index.vue` | 只读列表 + 搜索 + 失败重试 |
| 店铺分账配置 | 嵌入 `views/mall/store/shop/ShopForm.vue` | 选择分账收款人 + 启用开关（无分账比例覆盖） |

**菜单**

- `分账收款人管理` -> 挂于 `门店管理` 下
- `分账结算记录` -> 挂于 `门店管理` 下

**小程序端**

无变更。分账流程对 C 端用户完全透明。

---

### Edge Cases

| 场景 | 行为 |
|------|------|
| 店铺启用分账但未绑定收款人 | 支付时拒绝，提示配置缺失 |
| 租户某角色无有效平台级收款人 | 创建分账记录时报错 `PROFIT_SHARING_ROLE_RECIPIENT_MISSING` |
| 创建同角色第二个有效收款人 | 后端自动将原有效收款人置为禁用，或拒绝创建（按实现选择） |
| 删除已被店铺绑定的收款人 | 后端拒绝，返回 `PROFIT_RECIPIENT_BOUND` |
| 分账金额计算校验失败 | `platform_amount + shop_amount != pay_price` 时拒绝执行 |
| 日终分账调用 Adapay 失败 | 更新 `sharing_status=3`，记录 `error_msg`，自动回退到 `RevenueJob` 虚拟余额结算 |
| 日终 Job 执行超时/失败 | 分页处理（每批 100 条）；`sharing_status` 状态机保证幂等；失败记录可手动重试 |
| 多租户数据隔离 | 所有查询强制带 `tenant_id`；MyBatis Plus `TenantLineInnerInterceptor` 自动注入 |
| 店铺 `commission_rate` 后续变更 | 不影响已创建的分账记录（金额已固化） |

---

### Acceptance Criteria

**AC-1: 分账收款人管理**

- [ ] 管理员可创建平台级/店铺级收款人，每个收款人需指定角色（平台/配送方/销售方）
- [ ] 同一租户同一角色最多只有一个 `status=1` 的有效收款人
- [ ] 已绑定的收款人无法删除
- [ ] 收款人列表支持按级别、角色、店铺、状态、名称筛选

**AC-2: 店铺绑定**

- [ ] 店铺编辑页可选择一个已启用的分账收款人进行绑定
- [ ] 绑定后店铺 `profit_sharing_enabled=1`
- [ ] 解绑后 `profit_sharing_enabled=0`，`profit_sharing_recipient_id=null`

**AC-3: 支付延迟分账**

- [ ] Adapay 支付时设置 `pay_mode=delay`
- [ ] 支付成功回调后自动创建分账挂起记录（`sharing_status=0`）
- [ ] 分账金额按 `commission_amount`（平台）和 `pay_price - commission_amount`（店铺）固化
- [ ] 若缺少有效平台/店铺收款人，支付拒绝并返回明确错误

**AC-4: 日终自动结算**

- [ ] 每日 00:05 触发结算 Job
- [ ] 遍历 `sharing_status=0` 且 `create_time < 今日 00:00` 的订单
- [ ] 调用 Adapay `PaymentConfirm.create` 执行分账
- [ ] 成功更新 `sharing_status=2`，失败更新 `sharing_status=3`
- [ ] 分账失败自动回退到现有 `RevenueJob` 虚拟余额结算
- [ ] Job 支持幂等执行（同一订单不会重复分账）

**AC-5: 分账订单运维**

- [ ] 管理后台可分页查询分账订单，支持按状态筛选
- [ ] 失败订单可手动重试（仅 `sharing_status=3`）
- [ ] 分账操作日志记录请求/响应数据

**AC-6: 权限控制**

- [ ] 分账收款人 CRUD 需 `pay:profit-recipient:*` 权限
- [ ] 分账订单查询需 `pay:profit-sharing:query` 权限
- [ ] 分账订单重试需 `pay:profit-sharing:update` 权限
- [ ] 店铺绑定需 `store:shop:update` 权限
