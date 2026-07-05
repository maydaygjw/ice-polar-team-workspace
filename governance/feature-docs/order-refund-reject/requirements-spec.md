## Feature: Order Refund Reject

### Scope

**In-scope**

- Admin 拒绝退款功能：新增拒绝接口、校验、状态变更、操作日志。
- 退款状态扩展：在现有 `refund_status` 上新增 `3 = 已拒绝`，复用已有 `refund_reason` 字段记录拒绝原因。
- 支持用户在被拒绝后**再次申请退款**（多次退款申请），由管理员在拒绝时控制是否允许。
- 管理后台订单列表：增加“拒绝退款”按钮、拒绝原因弹窗、状态显示更新。
- 小程序订单列表/详情：显示“退款已拒绝”状态，并在被拒后允许重新发起退款申请。
- 退款单查询过滤同步包含“已拒绝”订单。

**Out-of-scope**

- 新增数据库表（仅新增一列 `refund_reapply` 控制是否允许再次申请）。
- 修改确认退款的钱包/微信/支付宝退款逻辑。
- 新增权限点（复用 `order:store-order:update`）。
- 发送微信模板消息、短信、推送等用户通知。
- 改变非退款相关的订单状态语义。

**约束引用**

- `governance/CONTRACTS.md`：Admin API 前缀为 `/admin-api`，使用统一 `CommonResult` 结构；跨模块调用须通过 `-api` 模块，本功能仅在 `yshop-module-order-biz` 内部改动。
- `governance/ARCHITECTURE.md`：订单状态由 `paid + refund_status + status` 组合表达；租户隔离由 MyBatis Plus 自动注入，无需额外处理；历史订单金额、佣金不可变，拒绝退款不得触发资金/库存/佣金变更。

### Data Model Changes

| 位置 | 变更 |
|------|------|
| `OrderInfoEnum` | 新增 `REFUND_STATUS_3(3, "已拒绝")` |
| `StoreOrderDO.refundStatus` | 合法取值扩展为 `0=正常 / 1=退款中 / 2=已退款 / 3=已拒绝` |
| `StoreOrderDO.refundReason` | 用于存放管理员拒绝原因（已有字段，注释“不退款的理由”），重新申请时清空 |
| `StoreOrderDO.refundReapply` | 新增 tinyint(1) 字段：`0=拒绝后不可再申请 / 1=拒绝后可再申请` |
| `OrderLogEnum` | 新增 `REFUND_ORDER_REJECT("reject_refund", "管理员拒绝退款")` |
| `AdminOrderStatusEnum` | `STATUS_5` 对应退款单过滤逻辑扩展为 `refund_status IN (1,2,3)` |
| 数据库 | 新增列 `refund_reapply` 并更新 `refund_reason` 注释 |

### API Requirements

#### 1. Admin 拒绝退款

- **Endpoint**: `POST /admin-api/order/store-order/reject-refund`
- **Permission**: `@PreAuthorize("@ss.hasPermission('order:store-order:update')")`
- **Request VO**: `StoreOrderRejectRefundVO`

| 字段 | 类型 | 约束 |
|------|------|------|
| id | Long | 必填 |
| refundReason | String | 必填，长度 1~255 |

- **Service**: `StoreOrderService.orderRejectRefund(Long id, String refundReason, Boolean allowReapply)`
- **行为**:
  1. 校验订单存在。
  2. 校验 `refundStatus == 1`（退款中），否则抛出 `ORDER_STATUS_ERROR`。
  3. 设置 `refundStatus = 3`，`refundReason = 输入原因`，`refundReapply = allowReapply ? 1 : 0`。
  4. 写入订单状态日志：`changeType = reject_refund`，`changeMessage = "管理员拒绝退款，原因：{reason}"`。
  5. 不修改资金、库存、佣金、流水。

#### 2. Admin 确认退款加固

- `StoreOrderServiceImpl.orderRefund` 增加前置校验：仅当 `refundStatus == 1` 时可确认退款；其余状态均抛 `ORDER_STATUS_ERROR`。
- 已拒绝（`3`）订单不可再通过确认退款按钮直接退款，避免状态竞态。

#### 3. 用户重新申请退款

- **Endpoint**: 现有 `POST /app-api/order/refund`
- **Service**: `AppStoreOrderServiceImpl.orderApplyRefund`
- **行为变更**:
  - 允许申请条件扩展为：`refundStatus == 0` 或 (`refundStatus == 3` 且 `refundReapply == 1`)。
  - `refundStatus == 1` 仍抛 `ORDER_REFUNDING`。
  - `refundStatus == 2` 仍抛 `ORDER_REFUNDED`。
  - `refundStatus == 3` 且 `refundReapply == 0` 抛 `ORDER_REFUND_REJECTED_NOT_REAPPLY`。
  - 重新申请时：设置 `refundStatus = 1`，覆盖用户填写的 `refundReasonWap`、`refundReasonWapExplain`、`refundReasonWapImg`，**清空 `refundReason`**（管理员旧拒绝原因仅以状态日志留存）。
  - 写入状态日志 `REFUND_ORDER_APPLY`。

### Frontend Requirements

#### 管理后台 (`admin`)

- `StoreOrderServiceImpl.handleOrderStatus` 增加映射：`refundStatus == 3 -> "退款已拒绝"`。
- `admin/src/views/mall/order/storeOrder/index.vue`：
  - 在 `statusStr == '退款中'` 行增加“拒绝退款”按钮，与“确认退款”并列。
  - 点击后弹出输入框，要求填写拒绝原因（必填，最多 500 字）。
  - 调用 `POST /order/store-order/reject-refund`；成功后刷新列表。
- `admin/src/api/mall/order/storeOrder/index.ts`：新增 `rejectRefundStoreOrder(data)` 方法。
- 订单详情/记录弹窗中应能查看拒绝原因及对应操作日志。

#### 小程序 (`miniapp`)

- `miniapp/pages/orders/orders.js`：
  - `getRefundStatusText` 增加 `refundStatus === 3` 返回 `"退款已拒绝"`。
  - `canApplyRefund` 条件扩展为 `rawStatus === 2 && (refundStatus === 0 || refundStatus === 3)`。
- `miniapp/pages/order-detail/order-detail.js`：
  - `normalizeOrderStatus` 增加 `refundStatus === 3` 分支，返回 `"退款已拒绝"` 及说明文案。
  - `refundStatusText` 映射增加 `"退款已拒绝"`。
  - `canApplyRefund` 同上扩展。
- `miniapp/pages/refund/refund.js`：
  - 被拒后重新进入页面时正常提交即可，后端负责覆盖旧数据；提交成功提示“退款申请已提交”。

### Edge Cases

| 场景 | 处理 |
|------|------|
| 非退款中订单点击拒绝 | 后端校验 `refundStatus == 1`，否则返回 `ORDER_STATUS_ERROR`；前端按钮仅在 `statusStr == '退款中'` 时显示。 |
| 管理员 A 打开确认弹窗，管理员 B 已拒绝 | 确认接口校验 `refundStatus == 1`，失败给出状态错误提示。 |
| 已拒绝订单用户再次申请 | 仅当 `refundReapply == 1` 时后端允许；覆盖用户退款资料并清空 `refundReason`，状态回到 `1`。 |
| 已拒绝但 `refundReapply == 0` | 禁止再次申请，返回 `ORDER_REFUND_REJECTED_NOT_REAPPLY`。 |
| 已退款订单（`2`）再申请 | 仍禁止，返回 `ORDER_REFUNDED`。 |
| 拒绝原因超长/为空 | 接口校验 1~500 字符，前端同步限制。 |
| 退款单筛选 | 后台“退款单”过滤数组由 `{1,2}` 改为 `{1,2,3}`，确保已拒绝订单可被检索。 |
| 多门店管理员 | 沿用现有 `shop_id IN (shopIds)` 与租户拦截，无需额外处理。 |

### Acceptance Criteria

1. 管理后台在退款中订单行同时展示“确认退款”和“拒绝退款”按钮。
2. 点击“拒绝退款”必须输入 1~255 字符原因；管理员可勾选是否允许用户再次申请；原因保存在 `yshop_store_order.refund_reason`，`refund_status` 变为 `3`，`refund_reapply` 记录是否允许再次申请。
3. 拒绝后订单状态显示为“退款已拒绝”，且出现在后台“退款单”筛选结果中。
4. 订单记录列表中新增一条 `change_type = refund_order_reject` 的记录，内容包含拒绝原因。
5. 已拒绝订单在小程序订单列表/详情显示“退款已拒绝”，并展示“申请退款”入口。
6. 对于 `refundReapply == 1` 的已拒绝订单，用户点击“申请退款”可重新提交，提交后订单回到“退款中”，旧管理员拒绝原因不再显示在订单上。
7. 确认退款接口仅接受 `refund_status == 1` 的订单；被拒后无法直接确认退款。
8. 已退款（`2`）订单禁止再次申请退款。
9. 新增数据库列 `refund_reapply`，确认退款流程的财务、库存、佣金逻辑保持不变。
