# Requirements Spec: pay-module-yue-support

## Scope

### In
- `yshop-module-pay` 模块支持余额支付（`yue`）作为一级支付渠道
- `PayOrderApi.createPayOrder()` 接受 `payType=yue` 并完成余额扣减 + 支付
- `PayOrderApi.refund()` 接受 `payType=yue` 并完成余额退款
- 余额支付需封装为独立的支付服务（非 egzosn 外部网关模式）

### Out
- 不重构 `AppStoreOrderServiceImpl.yuePay()` 现有调用路径（向后兼容）
- 不修改 miniapp、admin 前端
- 不修改 cash、integral 等非 yue 支付类型

### Deferred
- 统一所有消费端（order、score 等）改为通过 `PayOrderApi` 发起余额支付
- 将 `PayTypeEnum` 从订单模块迁移到支付模块

## Use Cases

### UC-1: C 端余额支付
- 角色：C 端用户（小程序/H5）
- 前置：用户登录且余额 >= 支付金额
- 主流程：
  1. 业务模块组装 `PayOrderCreateReqDTO`（orderId, amount, payType=yue, userId）
  2. 调用 `PayOrderApi.createPayOrder()`
  3. 支付模块校验余额充足性
  4. 扣除用户余额
  5. 返回成功结果

### UC-2: 余额退款
- 角色：管理端操作员 / 系统自动退款
- 前置：订单已通过余额支付且未退款
- 主流程：
  1. 业务模块组装 `PayRefundReqDTO`（orderId, refundAmount, totalAmount, payType=yue）
  2. 调用 `PayOrderApi.refund()`
  3. 支付模块将退款金额退回用户余额
  4. 返回退款结果

## Business Rules

1. 余额支付必须先校验余额 >= 支付金额，不足时返回明确错误，不降级
2. 余额扣减与订单支付结果通过 API 返回值传递，不需要 MQ 回调（区别于微信/支付宝）
3. 余额支付仅限已登录用户（userId > 0）
4. 余额退款以金额为单位，退回用户账户余额
5. 余额支付不需要 `outPayNo`（外部支付单号），不经过 egzosn 框架
6. `PayOrderRespDTO.data` 返回空 Map（余额支付无调起参数，区别于微信 JSAPI/支付宝 WAP）

## Edge Cases

- 并发扣减：同一用户几乎同时发起多笔余额支付，余额扣减需保证原子性（依赖数据库行级 UPDATE）
- 余额刚好等于支付金额：边界值正常扣减，余额归零
- 退款金额超出原支付金额：拒退，返回失败
- 余额退款时用户已注销：拒退或降级处理

## Acceptance Criteria

1. `PayOrderApi.createPayOrder()` 收到 `payType=yue` 时完成余额扣减，返回成功
2. 余额不足时返回明确错误（错误码含「余额不足」语义）
3. `PayOrderApi.refund()` 收到 `payType=yue` 时完成余额退还，返回 true
4. 现有 `AppStoreOrderServiceImpl` 编译通过，测试不变
5. `(cd backend && mvn -pl yshop-module-pay/yshop-module-pay-biz -am test)` 通过

## Assumptions

1. 余额支付不需要生成外部支付单号（`outPayNo`），与 weixin/ali/adapay 不同
2. `MemberUserApi` 需新增 `decPrice` 和 `incMoney` 方法，由 member 模块实现，支付模块通过 `-api` 调用
3. 支付模块与 member 模块的 `-api` 依赖已经存在（`PayOrderApiImpl` 已注入 `MemberUserApi`）
