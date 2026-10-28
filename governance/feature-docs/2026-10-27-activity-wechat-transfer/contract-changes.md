# 活动微信打款契约变更

## Admin API

### 活动兑奖规则配置

活动模板奖品规则参数新增 `WECHAT_TRANSFER` 类型，参数为 `amount`（元，正数，最多两位小数）。创建/更新模板、期次奖品快照和兑奖读取均使用同一规则版本；不得从当前模板重新读取历史期次的金额。

`WECHAT_TRANSFER` 的用户领取生成微信商家转账。转账记录类型按来源区分：`ACTIVITY_WINNER_CASH`（普通活动中奖现金）和 `ACTIVITY_REFERRAL_REWARD_CASH`（推荐奖励现金）。推荐奖励记录备注包含活动名称、期次和推荐层级。用户详情手动打款记录类型为 `MEMBER_MANUAL`。

### 用户转账全局分页

新增 `GET /admin-api/pay/user-transfer/page`，权限 `pay:user-transfer:query`。请求沿用分页参数，可选筛选 `transferType`、微信 `state`、`userId`、备注关键字和创建时间范围。响应为统一记录分页，字段包括：

- 记录 ID、会员 ID/可读用户信息、转账类型、金额（分）、微信状态；
- `outBillNo`、`transferBillNo`、业务备注、微信转账备注、失败原因、创建时间。

活动名称、期次和推荐层级统一写入业务备注，不建活动期次字段，也不提供结构化活动过滤。列表本身不直接改写状态；财务人员可调用 `POST /admin-api/pay/user-transfer/refresh?outBillNo={outBillNo}` 查询微信最新转账单并同步本地状态。刷新接口要求 `pay:user-transfer:query` 权限，只接受当前租户已保存的商户单号。

既有 `GET /admin-api/pay/member-transfer/page?userId={id}` 保持兼容，继续按单个会员分页读取同一底层记录，并新增响应字段 `transferType` 和业务 `remark`。不得允许通过会员详情权限省略 `userId` 查询全租户明细。详情页不显示记录操作按钮；会员人工打款创建、已有状态查询/撤销接口权限和请求格式保持原状。

## Activity API

既有用户兑奖接口对非微信打款规则保持原响应结构和语义。微信打款兑奖新增面向登录用户的准备/领取响应（后端契约供后续客户端接入）：

`POST /app-api/activity/period/referral-reward/claim`：请求 `referralRewardId`；用户 ID 和租户从登录态取得。仅能领取本人当前租户下有效的待兑奖推荐奖励。返回 `claimStatus`、统一转账 `outBillNo`、`state` 和供微信客户端确认收款用的 `packageInfo`。客户端必须等用户确认后由回调/查单取得最终结果；`packageInfo` 不作为财务记录持久字段。

普通中奖现金兑奖沿用 `winnerId` 兑奖身份，但响应需提供相同的转账状态和 `packageInfo` 信息。API 响应升级必须与旧 `Boolean` 响应兼容策略一并实现；H5/小程序消费端本期不更新，现金规则应保持不可投产/启用，直到客户端接入完成。

兑奖失败保持待兑奖并可重试；同一来源在请求超时/结果未知时复用同一商户单号，先查单后处理。仅确认微信原订单为失败或已撤销后才允许创建新的转账尝试。

## Pay API

Activity 调用 `yshop-module-pay-api` 提供的共享用户转账能力。请求包含当前租户会员 ID、稳定商户单号、金额（分）、转账类型和业务备注；不接收客户端提供的 OpenID、商户号或密钥。Activity 根据被兑领奖励/中奖记录生成稳定商户单号，重试复用原单号；Pay 使用既有租户+商户单号唯一约束幂等，不把来源 ID、来源类别或活动期次重复落到转账表。响应包含商户单号、微信转账单号、当前状态及可选 `packageInfo`。

转账类型枚举：

| 值 | 展示名称 | 来源 |
|---|---|---|
| `MEMBER_MANUAL` | 会员人工打款 | 会员详情人工发起 |
| `ACTIVITY_WINNER_CASH` | 活动中奖现金打款 | 活动中奖记录兑奖 |
| `ACTIVITY_REFERRAL_REWARD_CASH` | 推荐奖励现金打款 | 活动推荐阶梯奖励兑奖 |

稳定商户单号与租户构成幂等关联；允许终态失败/撤销后再次发起新尝试，但未知/处理中状态不得创建第二笔活动来源转账。

## 微信支付回调

转账请求 `notify_url` 复用商户配置中的异步回调 `notifyUrl`，必须是公网 HTTPS 且不带查询参数。现有订单回调入口扩展为通知分发器，按 `event_type` 区分支付成功 `TRANSACTION.SUCCESS` 与转账终态 `MCHTRANSFER.BILL.FINISHED`；支付成功仍走原订单处理，转账通知走共享转账记录处理。回调须验证微信签名、解密资源并核对商户号、商户单号、金额和租户映射；重复通知幂等。只接受合法状态迁移，终态仅 `SUCCESS`、`FAIL`、`CANCELLED`。

回调到达后更新共享转账记录；对应活动推荐奖励成功时设置为已兑奖，失败/撤销时保持可重试。对长期未终态订单由后端查单兜底。未验签、无法解密或信息不匹配的通知不得更改财务状态。

## DB Schema

Flyway 增量扩展 `yshop_pay_member_transfer_record`：

| 字段 | 用途 |
|---|---|
| `transfer_type` | 转账类型；历史数据回填 `MEMBER_MANUAL` |
| `remark` | 业务备注，活动奖励写入活动名称、期次和推荐层级；会员人工打款写入人工打款说明 |
| 既有 `transfer_remark` | 微信侧可见备注，仍遵守微信接口长度限制；与本地业务备注分开 |

仅增加按租户、类型、状态、创建时间和会员的查询索引；不新增活动来源字段和唯一索引。幂等依赖 Activity 生成并复用的稳定 `out_bill_no` 及现有 `tenant_id + out_bill_no` 唯一约束。转账金额仍以分保存，不存储 OpenID、`package_info` 或支付密钥。

活动期次奖品规则参数已按期次快照保存，本功能不需要活动侧新增持久表；仅需确保现金规则的金额和版本进入既有快照。

## 权限与兼容

- 新增 `pay:user-transfer:query` 菜单/按钮权限，授予需要财务只读查询的角色。
- `member:user:transfer` 保留会员详情发起打款权限；会员记录分页必须带会员 ID。
- 新增查询和回调按当前租户隔离，并施加后台数据权限；回调通过已验签的商户单号定位本地记录，不依赖管理端权限。
- 会员详情现有创建/查单/撤销接口保持兼容；既有转账行回填为 `MEMBER_MANUAL` 并保留原备注与状态。
- 管理端及 App API OpenAPI 快照在实现阶段更新；本文件为实现前 Feature Contract。

## 官方微信支付依据

- 商家转账开发流程与状态：[本地《开发指引》](../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/开发指引-4012715211.md)，[官方链接](https://pay.weixin.qq.com/doc/v3/merchant/4012715211)
- 创建转账与 `package_info`：[本地《发起转账》](../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/API列表/发起转账/发起转账-4012716434.md)，[官方链接](https://pay.weixin.qq.com/doc/v3/merchant/4012716434)
- 终态回调验签、解密及幂等：[本地《商家转账回调通知》](../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/API列表/发起转账/商家转账回调通知-4012712115.md)，[官方链接](https://pay.weixin.qq.com/doc/v3/merchant/4012712115)
- 小程序支付成功回调类型：[本地《支付成功回调通知》](../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/支付产品/小程序支付/API列表/支付成功回调通知-4012791902.md)，[官方链接](https://pay.weixin.qq.com/doc/v3/merchant/4012791902)
- 用户确认收款所需参数：[本地《JSAPI调起用户确认收款》](../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/API列表/发起转账/JSAPI调起用户确认收款-4012716430.md)，[官方链接](https://pay.weixin.qq.com/doc/v3/merchant/4012716430)
