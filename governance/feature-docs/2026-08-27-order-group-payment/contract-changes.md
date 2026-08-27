# 拼单支付契约变更

## 1. 业务范围

- 支付渠道：仅 AdaPay。
- 影响仓库：`backend`、`admin`。
- `miniapp` 本期不实现，但后端契约需要为后续小程序接入保留。
- 不新增 `yshop_store_order_group_payment` 表，支付尝试继续使用 `pay_out_order_no`。

## 2. 数据库契约

### `yshop_store_order`

新增：

- `group_status`：`0/NULL` 非拼单，`1` 拼单中，`2` 已拼满。
- `group_total_count`：总份数，2～10。
- `group_paid_count`：成功支付份数。
- `group_start_time`：首份支付成功时间。
- `group_expire_time`：冻结后的拼单截止时间。

### `pay_out_order_no`

新增：

- `group_member_no`
- `pay_attempt_no`
- `payer_user_id`
- `share_count`
- `pay_amount`
- `refund_status`
- `refund_id`
- `refund_time`

所有新 AdaPay 支付记录的 `out_pay_no` 格式为：

```text
{order_id}-{group_member_no}-{pay_attempt_no}
```

普通订单的 `group_member_no` 固定为 `1`。历史两段式记录不修改，新字段不回填。

数据库迁移脚本：`backend/sql/upgrade-2026-08-27-order-group-payment.sql`。

## 3. API 契约

### 现有下单接口

新增拼单参数和结果字段：

| 方向 | 字段 | 说明 |
|---|---|---|
| 请求 | `groupEnabled` | 是否选择拼单 |
| 请求 | `groupTotalCount` | 拼单总份数，包含发起人 |
| 响应 | `groupStatus` | 拼单状态 |
| 响应 | `groupTotalCount` | 总份数 |
| 响应 | `groupPaidCount` | 已支付份数 |
| 响应 | `groupExpireTime` | 截止时间，首份成功前为空 |

仅在租户和门店最终允许时接受 `groupEnabled=true`。非拼单订单保持现有字段语义。

### 现有支付接口

拼单支付请求增加：

| 字段 | 说明 |
|---|---|
| `orderId` | 主订单号 |
| `shareCount` | 本次支付份数 |
| `payType` | 固定为 AdaPay |

响应继续返回 AdaPay 所需支付参数，并增加支付尝试标识：

| 字段 | 说明 |
|---|---|
| `data.data.order_no` | AdaPay 三段式外部支付单号；系统主订单号仍由请求中的 `orderId`/`uni` 表示 |
| `groupMemberNo` | 拼单人序号 |
| `payAttemptNo` | 支付尝试序号 |
| `shareCount` | 本次支付份数 |
| `payAmount` | 本次支付金额 |

不新增顶层 `outPayNo` 响应字段，兼容原有 AdaPay 返回结构。服务端内部仍保存同值的 `pay_out_order_no.out_pay_no`，并使用它处理回调和退款。

请求失败时不得产生可继续支付的未关闭支付尝试。

### 拼单查询接口

后续小程序接入需要提供统一拼单页查询能力，至少返回：

- 订单基础信息和订单状态
- 拼单状态、总份数、已支付份数、剩余可支付份数
- 每份金额和最后一份尾差金额
- 截止时间
- 当前登录用户已支付份数
- 是否为发起人、是否允许申请退款

本期只冻结字段语义，不实现 `miniapp` 调用。

## 4. 支付回调契约

AdaPay 回调必须携带：

- `outPayNo`
- `adapayPaymentId`
- 支付结果

回调消费者通过 `outPayNo` 找到一条支付尝试记录。只有该记录从创建中转为成功时，才增加主订单已支付份数；重复回调保持幂等。

支付尝试成功但主订单已经关闭或超时的情况，沿用现有 AdaPay 退款处理规则，不增加本功能专用异常状态。

## 5. 退款契约

- 退款入口和可退款状态沿用现有订单规则。
- 用户侧只有发起人可以申请整单退款。
- 后端按订单查询所有成功支付尝试。
- 每条支付尝试按自身 `adapay_payment_id`、`out_pay_no` 和 `pay_amount` 原路退款。
- 不允许使用主订单单一 `transaction_id` 代替支付尝试明细。

## 6. 配置契约

租户参数：

- `order.group-payment.enabled`：拼单总开关，字符型值 `"0"`/`"1"`。
- `order.group-payment.timeout-minutes`：拼单付款时限，字符型分钟数字字符串。

租户参数沿用现有参数管理页面和 `infra_tenant_config` 表，不新增参数类型、不修改参数表结构；业务层负责读取和转换参数值。

门店：

- `groupPaymentEnabled`：`NULL` 继承租户、`0` 禁用、`1` 启用。

租户关闭优先级高于门店启用。首份成功支付时把最终分钟数转为订单截止时间。

## 7. 权限与租户隔离

- 拼单支付要求登录用户身份，不允许游客。
- 发起人身份使用主订单 `uid` 判断。
- 用户侧退款校验当前用户必须为发起人。
- 所有订单、支付尝试和配置查询必须带租户上下文。
- 管理端门店配置沿用现有门店数据权限；租户参数沿用现有租户参数权限。

## 8. 外部依赖

- AdaPay：继续使用现有支付下单、回调、关闭和退款能力；拼单只改变每次支付的业务单号和金额。
- Redis 延迟队列/MQ：承载拼单截止处理和支付通知；消息必须幂等。
- 微信支付：N/A，本期不支持拼单支付。
