# Technical Design: order-pay-yue-migration

## Module Impact

| Module | Impact | Description |
|--------|--------|-------------|
| `yshop-module-order-biz` | 修改 | `AppStoreOrderServiceImpl.yuePay()`、`StoreOrderServiceImpl.orderRefund()` YUE 分支改为委托 `PayOrderApi` |
| `yshop-module-pay-*` | 无变化 | `PayOrderApi`/`YuePayService` 已就绪,直接复用 |
| `yshop-module-member-*` | 无变化 | `MemberUserApi.decPrice/incMoney` 已就绪;`MemberUserService` 不删 |

## Key Decisions

### D-1: 委托而非解耦重写

**决策**:`yuePay()` 仅把「校验余额 + 扣减」替换为 `PayOrderApi.createPayOrder(yue)`;`paySuccess()` 及其业务编排(订单状态/门店流水/佣金/账单/MQ)**原样保留在 order 模块**。

**理由**:`paySuccess` 对余额单的副作用与扣款动作正交,重写会引入资损回归风险。委托是最小等价变更。

**权衡**:order 模块仍持有业务编排,未完全「支付能力收敛」;但支付原语(扣减/退还)已收口到 pay 模块,符合本期目标。

### D-2: order 保留订单态校验,pay 只做余额原语

**决策**:订单存在性、未支付、退款状态机仍在 order 侧校验;`YuePayService` 只做余额充足性校验 + 原子扣减/退还。

**理由**:`PayOrderApi` 是无订单上下文的支付原语层,订单语义属 order 模块职责。避免在 pay 模块反向依赖 order。

### D-3: 错误码语义等价替换

**决策**:余额不足由 order 的 `PAY_YUE_NOT` 改为 pay 的 `YUE_BALANCE_NOT_ENOUGH`(文案同为「余额不足」)。

**理由**:支付语义归 pay 模块统一承载。对外均为「余额不足」提示,前端无感知差异。

**权衡**:错误码数值变化(1008007011 → 1008009060),依赖错误码做逻辑判断的调用方需同步——本期余额支付入口仅小程序结算页,按文案提示,不受影响。

### D-4: orderRefund 本地保留 balance 记账

**决策**:YUE 分支调 `PayOrderApi.refund` 后,`balance = balance.add(price)` 的本地计算保留,用于后续 `billService.income` 用户账单记账。

**理由**:账单记账是 order 侧业务编排,不属于支付原语;`balance` 仅为记账快照,不影响余额真实值(由 `YuePayService.incMoney` 写入)。

## Flow

### 下单余额支付(迁移后)

```
小程序 POST /app-api/order/pay {paytype:yue}
  └─ orderPay() case YUE
       └─ yuePay(orderId, uid)
            ├─ getOrderInfo + 未支付校验          (order 侧,不变)
            ├─ PayOrderApi.createPayOrder(yue)
            │     └─ YuePayService.pay()
            │          ├─ 校验 userId / nowMoney>=amount
            │          └─ MemberUserApi.decPrice()  ← 原语收口到 pay
            └─ paySuccess(orderId, YUE)            (order 侧编排,不变)
                 └─ 订单状态/门店流水/佣金/账单/MQ
```

### 余额退款(迁移后)

```
orderRefund(id, price, ...)
  └─ YUE 分支
       ├─ PayOrderApi.refund(yue)
       │     └─ YuePayService.refund()
       │          └─ MemberUserApi.incMoney(uid, price)  ← 原语收口到 pay
       ├─ balance = balance.add(price)                  (本地记账快照,不变)
       └─ 门店流水/佣金冲回/账单/退库存                  (order 侧编排,不变)
```

## 迁移 / 回滚

- 迁移:纯代码改动,无 DB/MQ/schema 变更,随版本发布。
- 回滚:`git revert` 本 feature 提交即恢复直调路径;`PayOrderApi`/`YuePayService` 保留无影响(无其它调用方依赖 order 的旧直调)。

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| `paySuccess` 副作用被误改 | Medium | 本期不改 `paySuccess`;委托点仅在 `yuePay`/`orderRefund` YUE 分支,差异可控 |
| 余额不足错误码数值变化影响调用方 | Low | 余额支付入口仅小程序,按文案提示;无按码判断的调用方 |
| 委托后事务边界变化 | Low | `YuePayService` 与 `yuePay`/`orderRefund` 同为 `REQUIRED`,并入同一事务,异常统一回滚 |
| 双路径并存期混乱 | Low | 迁移后 order 不再直调 decPrice/incMoney,`PayOrderApi` 成唯一入口,无双写 |
