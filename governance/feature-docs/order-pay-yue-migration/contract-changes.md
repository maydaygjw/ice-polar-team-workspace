# Contract Changes: order-pay-yue-migration

## API

无新增/变更的跨模块 API 签名。`PayOrderApi.createPayOrder/refund`、`MemberUserApi.decPrice/incMoney` 均由 `pay-module-yue-support` 定义,本期仅新增消费方(order 模块)。

### 行为变化(对外)

| 场景 | 迁移前 | 迁移后 |
|------|--------|--------|
| 余额不足 | 抛 order `PAY_YUE_NOT`(1008007011「余额不足」) | 抛 pay `YUE_BALANCE_NOT_ENOUGH`(1008009060「余额不足」) |
| 非法用户(下单) | 由 order `getAppUser` 间接触发 | 抛 pay `YUE_USER_INVALID`(1008009061) |

错误文案保持一致(「余额不足」),前端按文案提示,无感知。

### 调用方/实现方

- 新增调用方:`AppStoreOrderServiceImpl.yuePay()`、`StoreOrderServiceImpl.orderRefund()`(order-biz)
- 实现方:`YuePayService`(pay-biz),内部经 `MemberUserApi` 调 member-biz

## DB

N/A: 无 schema 变更。余额仍存 `yshop_user.now_money`。

## MQ

N/A: 余额支付/退款无 MQ 回调,与迁移前一致。

## Permissions

N/A: 复用现有 C 端鉴权,无新权限码。

## Dependencies

N/A: order-biz 已依赖 `yshop-module-pay-api`,无需新增依赖。
