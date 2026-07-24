# Review Report: order-pay-yue-migration

## 结论:通过

两处委托改动均为最小等价变更,未发现副作用遗漏或资金安全风险。

## 核验项

| 项 | 结果 | 说明 |
|----|------|------|
| 需求覆盖 | ✅ | AC1-5 全部满足:yuePay/orderRefund YUE 分支改委托,无残留直调 decPrice/incMoney(除 Out 范围充值) |
| 契约一致 | ✅ | 复用 `pay-module-yue-support` 已定义 API,无新签名;错误码语义等价替换已记录 |
| 无 outPayNo 副作用 | ✅ | `PayOrderApiImpl.createPayOrder` YUE 分支在 `generateOutPayNo` 前 return,不产生 outPayNo、不触发渠道锁定,与迁移前一致 |
| 事务边界 | ✅ | `YuePayService` 与 `yuePay`/`orderRefund` 均 `REQUIRED`,并入同一事务,异常统一回滚 |
| paySuccess 编排 | ✅ | 未改动;订单状态/门店流水/佣金/账单/MQ 保持 order 侧 |
| 余额原子性 | ✅ | 仍由 `MemberUserMapper.decPrice` 行级 UPDATE 保证,未变 |
| 编译 | ✅ | order-biz 及依赖全量编译通过 |
| 测试回归 | ✅ | order-biz 唯一失败 `CommissionServiceImplTest` 经 stash 验证为既有失败,与本改动无关 |

## 关注点(非阻塞)

1. **错误码数值变化**:余额不足 `1008007011`(order `PAY_YUE_NOT`)→ `1008009060`(pay `YUE_BALANCE_NOT_ENOUGH`)。文案同为「余额不足」,小程序按文案提示,无按码判断的调用方。`PAY_YUE_NOT` 常量保留未删(另一废弃副本仍引用)。
2. **未用 import 已清理**:`AppUserQueryVo` 移除。
3. **E2E 未跑**:无本地运行环境,余额下单/余额不足/余额退款三用例建议测试环境回归(见 test-notes)。

## 验证缺口

- 缺集成级测试覆盖「yuePay 委托 → YuePayService 扣减」全链路;`YuePayServiceTest` 仅覆盖支付模块内部。可在后续补 order 侧委托单测。
