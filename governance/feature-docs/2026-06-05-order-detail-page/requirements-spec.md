## Feature: MiniApp 订单详情页

### Scope
- 在 `miniapp` 新增订单详情页
- 从 `pages/orders/orders` 进入订单详情页
- 展示订单状态、订单号、下单时间、支付时间、商品列表、门店信息、支付方式、金额明细、退款信息
- 按订单状态展示可执行操作：
  - 未支付订单可继续支付
  - 已完成且满足规则的订单可申请退款
  - 退款中/已退款订单仅展示状态

### Out Of Scope
- 不改 `admin/`
- 不新增评价、客服、物流轨迹
- 不新增数据库表或迁移脚本
- 不改 DMS 链路

### Data Model Changes
- 无数据库变更
- MiniApp 页面本地会对订单详情接口返回字段做展示态归一化

### API Requirements
- 复用现有 `GET /app-api/order/detail/{key}`
- `key` 支持订单号、唯一值 `unique` 或扩展订单号
- 返回字段需至少满足：
  - `orderId`
  - `unique`
  - `statusDto`
  - `cartInfo`
  - `shopName`
  - `payType`
  - `totalPrice`
  - `payPrice`
  - `couponPrice`
  - `boxFeePrice`
  - `deductionPrice`
  - `createTime`
  - `payTime`
  - `refundStatus`
  - `refundReasonWapExplain`
  - `refundReasonWapImg`
  - `remark`
  - `mark`

### Frontend Requirements
- 订单列表页支持点击整卡跳转详情页
- 订单详情页提供以下区块：
  - 顶部状态区
  - 商品信息区
  - 金额明细区
  - 门店与订单信息区
  - 底部操作区
- 与现有 `orders` 页视觉风格保持一致
- 页面加载、空数据、接口异常都要有明确反馈

### Edge Cases
- 订单不存在
- 订单不属于当前登录用户
- `cartInfo` 为空
- 支付时间为空
- 退款说明为空但退款状态存在
- 从退款页返回详情页后需要刷新
- 支付成功后需跳转到出冰进度页

### Acceptance Criteria
- 用户可从订单列表进入订单详情页
- 详情页展示的订单基础信息完整且与列表状态一致
- 未支付订单可在详情页继续支付
- 可退款订单可从详情页跳转退款页
- 接口异常时页面有可理解的错误提示
