# 活动微信打款技术设计

## 模块影响

- `backend/yshop-module-pay`：扩展现有会员转账记录和商家转账服务，提供共享转账能力、后台全量分页查询、最终状态回调与兜底查单。
- `backend/yshop-module-activity`：注册微信打款兑奖规则；活动兑奖调用 Pay API，按活动中奖/推荐奖励来源派生稳定转账单号和备注。
- `admin`：活动奖品规则编辑增加微信打款参数；新增财务用户转账查询页；会员详情读取共享记录并展示类型/备注。
- `h5`、`miniapp`：本期不修改。后端返回用户确认收款所需参数，客户端调起微信确认收款属于后续阶段；配置现金兑奖规则前需排期完成该阶段。

## 关键决策

### 共享转账记录归 Pay 模块

复用现有 `yshop_pay_member_transfer_record`，将其业务语义扩展为用户转账明细，不另建活动专用支付记录表。新增转账类型和业务备注；手动会员打款、活动普通中奖现金和活动推荐奖励现金共享同一状态、金额和查询模型。推荐奖励现金类型必须可单独筛选，备注写入活动、期次和推荐层级。

会员详情和财务菜单读取同一个 Pay 查询服务。会员详情继续按会员 ID 限定查询；财务菜单仅按新权限返回当前租户及当前后台数据权限内的记录。

### Activity 依赖 Pay API

Activity 只依赖 `yshop-module-pay-api` 的 DTO/服务接口，不直接依赖 Pay Biz 类，不处理商户密钥、OpenID 或微信签名。Pay 模块根据当前租户读取小程序支付配置和会员 `routineOpenid`，统一调用 APIv3 商家转账。

活动兑奖规则快照保存转账金额和规则版本。Activity 兑奖上下文携带奖励来源类别及来源记录 ID，用于生成转账类型、业务备注和确定性商户单号；来源 ID 不写入 Pay 转账表。

### 交易状态与兑奖状态分开

转账受理不等于用户到账。共享记录展示微信转账单状态；微信通知终态 `SUCCESS`、`FAIL`、`CANCELLED` 更新转账记录。仅最终 `SUCCESS` 才确认现金奖励已到账。推荐奖励兑奖状态在待用户确认/处理中阶段保持处理中；失败或撤销后按原兑奖规则回到可重试状态。

后端创建转账前先持久化幂等意图和确定性商户单号，再请求微信；活动兑奖来源只用于派生该稳定商户单号及业务备注，不冗余写入转账表。结果未知时保留原单号，以原单号查单或重试，不能生成新单。避免在持有活动兑奖数据库事务时等待外部网络；按“记录意图提交—调用微信—记录响应”的边界更新状态。

### 复用支付设置的异步回调地址

商家转账请求使用商户配置中的既有 `notifyUrl`，无需再维护一份回调 URL。当前 URL 指向订单支付回调处理器，不能保持现有“所有请求都交给订单支付 SDK”的处理方式；需在同一个公网 HTTPS 回调入口按 `event_type` 分流：普通支付 `TRANSACTION.SUCCESS` 保持现有处理，商家转账 `MCHTRANSFER.BILL.FINISHED` 进入转账处理。两种通知各自完成签名验证、资源解密、业务字段校验及正确的 HTTP 应答。

转账回调按商户单号定位同租户记录并校验金额/商户号；重复通知幂等应答。通知用于推进最终状态，后台定时对长期非终态订单查单兜底，避免只依赖通知。

### 配置与运营边界

转账场景 ID 和场景报备字段必须对应商户平台已开通/报备的真实业务场景；本功能不在代码中假设所有租户场景相同。上线前需核实现金推荐奖励应使用的商家转账场景和报备信息。

当前用户客户端尚未调起确认收款。微信用户确认所需 `package_info` 由兑奖 API 返回，短时有效，不写入共享明细；在 H5/小程序完成调起前，不应对终端用户宣称奖励已到账。

## 数据迁移与回滚

- Flyway 扩展现有转账记录表，增加类型和业务备注字段；历史记录回填为会员人工打款类型，并从现有微信备注初始化业务备注。
- 保留既有租户+商户单号唯一约束，不新增活动来源字段或索引；活动来源通过稳定商户单号保证幂等。
- 回滚只能移除未被业务数据使用的新字段/索引。已有活动打款记录后采用前向修复，不删除财务流水或微信流水。

## 风险

- 微信支付 APIv3 商家转账权限、接口安全 IP、绑定 AppID、商户资金和场景报备均是上线前置条件。
- 当前会员手动打款使用 `routineOpenid`，活动领取人也必须在当前租户下存在可用的小程序 OpenID；缺失时不得创建转账。
- 商家转账用户确认页的调起及页面反馈未纳入本期。后端/管理端完成后，用户侧现金到账仍需后续客户端阶段才能闭环。
- 财务汇总查询需保证租户/数据权限过滤、金额精确到分、状态文案覆盖未知状态，并保护商户单号和失败原因的访问权限。

## 契约引用

- API、DTO、数据库、权限与外部回调见 [contract-changes.md](contract-changes.md)。
- 活动规则表单、财务明细和会员详情展示见 [ui-ux-design.md](ui-ux-design.md)。
- 微信支付官方依据：商家转账[开发指引](https://pay.weixin.qq.com/doc/v3/merchant/4012715211)、[发起转账](https://pay.weixin.qq.com/doc/v3/merchant/4012716434)、[商家转账回调通知](https://pay.weixin.qq.com/doc/v3/merchant/4012712115)、小程序支付[支付成功回调通知](https://pay.weixin.qq.com/doc/v3/merchant/4012791902)、[JSAPI调起用户确认收款](https://pay.weixin.qq.com/doc/v3/merchant/4012716430)。

官方文档本地副本路径：

- `../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/开发指引-4012715211.md`
- `../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/API列表/发起转账/发起转账-4012716434.md`
- `../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/API列表/发起转账/商家转账回调通知-4012712115.md`
- `../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/支付产品/小程序支付/API列表/支付成功回调通知-4012791902.md`
- `../../../.agents/skills/wechatpay-payment-integration/assets/微信支付官网文档/APIv3/普通商户/转账产品/商家转账/API列表/发起转账/JSAPI调起用户确认收款-4012716430.md`

当前回调入口实现位置：[AppOrderController.java](../../../backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/controller/app/order/AppOrderController.java)，现有 `payBack` 处理订单支付通知；复用时需增加事件分发，不能将转账通知当作普通支付通知传给现有处理器。
