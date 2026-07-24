# Requirements Spec: order-pay-yue-migration

将 order 模块的余额支付/退款从「直调 member-biz `userService.decPrice/incMoney`」迁移到统一支付入口 `PayOrderApi`(YUE 渠道由 `pay-module-yue-support` 已就绪的 `YuePayService` 承接)。`paySuccess` 业务编排保持在 order 模块不变。

## Scope

### In
- `AppStoreOrderServiceImpl.yuePay()` 改为委托 `PayOrderApi.createPayOrder(payType=yue)` 完成余额校验+扣减
- `StoreOrderServiceImpl.orderRefund()` 的 YUE 分支改为委托 `PayOrderApi.refund(payType=yue)` 完成余额退还
- 迁移后 order 模块不再直接调用 `userService.decPrice/incMoney` 处理余额支付/退款

### Out
- `paySuccess()` 业务编排(订单状态、门店流水、佣金、消费累计、购买次数、账单、桌台/同城、MQ 通知)**不迁移**,保持 order 模块现状
- 充值/会员卡到账(`incMoney`)、积分扣减(`decScore`)等**非订单余额支付**路径不动
- 不修改微信/支付宝/Adapay 渠道;不修改前端
- 不删除 `MemberUserService.decPrice/incMoney`(其它路径仍在用)

### Deferred
- order 模块对 member 模块的其它直调(`getUser/getAppUser/addConsumeAmount/incPayCount` 等)收敛到 `MemberUserApi`,不在本期

## Use Cases

### UC-1: 下单余额支付(委托)
- 前置:用户登录、订单未支付、余额 >= 支付金额
- 主流程:
  1. `yuePay(orderId, uid)` 查订单、校验未支付(保持 order 侧职责)
  2. 组装 `PayOrderCreateReqDTO(orderId, amount=payPrice, payType=yue, userId=uid)`
  3. 调 `PayOrderApi.createPayOrder()` → `YuePayService` 校验余额并 `decPrice`
  4. 余额不足时 `YuePayService` 抛 `YUE_BALANCE_NOT_ENOUGH`
  5. 成功后 `yuePay` 继续调 `paySuccess(YUE)` 完成业务编排

### UC-2: 余额退款(委托)
- 前置:订单为 `payType=yue`、退款申请已受理(refundStatus=1)、未退款
- 主流程:
  1. `orderRefund()` 进入 YUE 分支
  2. 组装 `PayRefundReqDTO(orderId, refundAmount=price, totalAmount=payPrice, payType=yue, userId=uid)`
  3. 调 `PayOrderApi.refund()` → `YuePayService` `incMoney(uid, price)`
  4. 本地保留 `balance` 计算用于用户账单记账(不变)

## Business Rules

1. order 模块保留订单态校验(订单存在、未支付、退款状态机);支付模块只负责余额原子扣减/退还
2. 余额不足、非法用户的错误语义由 `YuePayService` 的 `YUE_*` 错误码承载(见 contract-changes)
3. 余额支付/退款**无 outPayNo、无 MQ 回调**,同步返回(区别于第三方渠道)
4. 委托后行为对外等价:同一订单余额支付一次、退款退回余额,`paySuccess` 副作用与迁移前一致
5. 部分退款:`refundAmount` 传入本次退款金额(可 < payPrice),由 `orderRefund` 控制,不在支付侧重复校验订单总额

## Edge Cases

- 余额不足:迁移前抛 order 的 `PAY_YUE_NOT`,迁移后抛 pay 的 `YUE_BALANCE_NOT_ENOUGH`,均为「余额不足」语义,前端按错误文案提示
- 并发余额支付:仍由 `MemberUserMapper.decPrice` 行级 UPDATE 保证原子性(不变)
- 委托调用抛异常时,`yuePay`/`orderRefund` 的 `@Transactional` 回滚,余额与订单态一致(不变)
- `paySuccess` 内部对余额单读取 `nowMoney` 记账:扣减后读取,值已反映扣减,行为与迁移前一致

## Acceptance Criteria

1. `yuePay()` 内部不再出现 `userService.decPrice`,改为 `PayOrderApi.createPayOrder`
2. `orderRefund()` YUE 分支不再出现 `userService.incMoney`,改为 `PayOrderApi.refund`
3. 余额支付成功路径:扣减余额 + `paySuccess` 全副作用不变
4. 余额不足:抛 `YUE_BALANCE_NOT_ENOUGH`,不扣减,订单态不变
5. 余额退款成功:余额增加 `refundAmount`,门店流水/佣金冲回/账单等编排不变
6. `(cd backend && mvn -pl yshop-module-mall/yshop-module-order-biz -am install -DskipTests)` 编译通过
7. order-biz 相关测试通过,无回归

## Assumptions

1. `pay-module-yue-support` 已落地:`PayOrderApi` 支持 YUE,`YuePayService` 提供支付/退款,`PayRefundReqDTO` 含 `userId`
2. order-biz 已依赖 `yshop-module-pay-api`(已确认),可直接注入 `PayOrderApi`
3. `paySuccess` 对余额单的副作用与「扣款动作」正交,委托扣款不改变其输入
