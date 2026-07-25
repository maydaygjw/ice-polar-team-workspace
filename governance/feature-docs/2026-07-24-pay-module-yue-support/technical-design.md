# Technical Design: pay-module-yue-support

## Module Impact

| Module | Impact | Description |
|--------|--------|-------------|
| `yshop-module-pay-api` | 无变化 | 现有 `PayOrderApi`、DTO 已满足需求 |
| `yshop-module-pay-biz` | 新增 + 修改 | 新增 `YuePayService`；修改 `PayOrderApiImpl` |
| `yshop-module-member-api` | 新增方法 | `MemberUserApi` 新增 `decPrice`、`incMoney` |
| `yshop-module-member-biz` | 新增实现 | `MemberUserApiImpl` 实现新增方法 |
| `yshop-module-order-biz` | 无变化 | 保持现有 `yuePay()` 不变 |

## Key Decisions

### D-1: 余额支付不经过 egzosn PayServiceManager

**决策**：`YuePayService` 直接调用 `MemberUserApi.decPrice/incMoney`，不通过 `PayServiceManager`。

**理由**：余额支付是内部账户操作，无外部支付网关、无回调、无证书配置。`PayServiceManager` 是 egzosn 框架的第三方支付抽象，不适用于内部余额。

**权衡**：`PayOrderApiImpl.createPayOrder()` 的 YUE 分支独立于 WEIXIN/ALI/ADAPAY 的 egzosn 路径，代码路径不同但接口一致。

### D-2: MemberUserApi 新增 decPrice / incMoney

**决策**：在 `MemberUserApi`（`-api` 模块）新增两个方法：
- `void decPrice(Long uid, BigDecimal price)` — 扣减余额
- `void incMoney(Long uid, BigDecimal price)` — 增加余额

**理由**：支付模块通过 `-api` 调用 member 模块是合法的跨模块依赖方向。现有 `MemberUserService.decPrice/incMoney` 在 `-biz` 中，支付模块无法直接访问。

**权衡**：增加了 `MemberUserApi` 的方法数，但避免了 module-pay 直接依赖 module-member-biz。

### D-3: 不生成 outPayNo

**决策**：余额支付不调用 `PayOutOrderNoService.generateOutPayNo()`。

**理由**：`outPayNo` 用于关联外部支付网关的支付单号。余额支付无外部网关，无需外部单号映射。`PayRefundReqDTO.orderId` 直接用作业务单号。

### D-4: 向后兼容，不重构 order 模块

**决策**：本功能仅在 `PayOrderApi` 层新增 YUE 支持，不修改 `AppStoreOrderServiceImpl.yuePay()`。

**理由**：降低风险。order 模块现有调用路径稳定运行，重构需单独评估。消费端可渐进迁移到 `PayOrderApi`。

## Flow

```
业务模块 (order/score/...)
     │
     │ PayOrderApi.createPayOrder(payType=yue)
     ▼
PayOrderApiImpl
     │
     │ switch(payType): case YUE
     ▼
YuePayService.pay(reqDTO)
     │
     ├─→ MemberUserApi.getUser(userId)  → 查询用户余额
     ├─→ 校验 nowMoney >= amount
     ├─→ MemberUserApi.decPrice(uid, amount)
     └─→ 返回 PayOrderRespDTO(tradeType=YUE, data=emptyMap)
```

```
业务模块
     │
     │ PayOrderApi.refund(payType=yue)
     ▼
PayOrderApiImpl
     │
     │ switch(payType): case YUE
     ▼
YuePayService.refund(reqDTO)
     │
     ├─→ MemberUserApi.incMoney(uid, refundAmount)
     └─→ 返回 true
```

## Risks

| Risk | Level | Mitigation |
|------|-------|------------|
| 并发余额扣减导致超扣 | Low | `decPrice` Mapper 使用 `UPDATE ... SET now_money = now_money - ? WHERE id = ?`，MySQL 行锁保证原子性 |
| MemberUserApi 新增方法影响其他调用方 | Low | 新增方法，非破坏性变更 |
| incMoney 无条件调用（uid 可能无效） | Low | 调用方保证 uid 有效；incMoney 内部有 `price > 0` 防护 |
