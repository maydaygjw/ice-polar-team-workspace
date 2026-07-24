# CHANGE-REPORT: order-pay-yue-migration

## 业务结果

order 模块的余额支付/退款从「直调 member-biz `userService.decPrice/incMoney`」迁移到统一支付入口 `PayOrderApi`(YUE 渠道)。支付原语(余额校验/扣减/退还)收口到 pay 模块,跨模块依赖方向由「order-biz → member-biz」纠正为「order-biz → pay-api」。对外行为等价:余额下单、余额不足提示、余额退款均不变。

本次包含两个 feature 的完整落地:
1. `pay-module-yue-support`:pay 模块新增 YUE 支付/退款能力(`YuePayService`),member 模块开放 `decPrice/incMoney` API。
2. `order-pay-yue-migration`(本报告):order 模块消费端迁移到该统一入口。

## 影响仓库

- `backend`:
  - **member**:`MemberUserApi` 新增 `decPrice/incMoney`;`MemberUserRespDTO` 新增 `nowMoney`;`MemberUserApiImpl` 实现两方法(委托现有 `MemberUserService`)。
  - **pay**:新增 `YuePayService`;`PayOrderApiImpl` 接 YUE 分支;`PayRefundReqDTO` 新增 `userId`;新增 `YUE_*` 错误码。
  - **order**:`AppStoreOrderServiceImpl.yuePay()`、`StoreOrderServiceImpl.orderRefund()` YUE 分支改为委托 `PayOrderApi`。

## 契约/迁移

- API:`MemberUserApi.decPrice/incMoney`、`PayOrderApi` YUE 行为(见 `pay-module-yue-support/contract-changes.md`、`order-pay-yue-migration/contract-changes.md`)。
- 错误码:余额不足由 order `PAY_YUE_NOT`(1008007011)改为 pay `YUE_BALANCE_NOT_ENOUGH`(1008009060),文案同为「余额不足」。
- DB/MQ/权限/依赖:无变化。
- 无 DB 迁移;随版本发布,回滚 `git revert` 即可。

## 验证结果

- `mvn -pl yshop-module-pay/yshop-module-pay-biz -am install -DskipTests`: **pass**
- `mvn -pl yshop-module-pay/yshop-module-pay-biz surefire:test`: **pass**(26 测试,含新增 `YuePayServiceTest` 6 用例)
- `mvn -pl yshop-module-mall/yshop-module-order-biz -am install -DskipTests`: **pass**
- order-biz 单测:唯一失败 `CommissionServiceImplTest` 经 stash 验证为**既有失败**,与本改动无关
- 未执行:小程序端到端(无本地环境),建议测试环境回归余额下单/余额不足/余额退款

## 残余风险

- 余额下单/退款 E2E 未跑,依赖测试环境回归确认。
- order 模块对 member 的其它直调(getUser/addConsumeAmount 等)未收敛,列为后续 Deferred。
- 既有 `CommissionServiceImplTest` 失败待独立修复(超出本 feature 范围)。

## 建议 PR

**标题**:`feat(pay): 余额支付收口 pay 模块并迁移 order 消费端到 PayOrderApi`

**描述**:见「业务结果/契约/验证」摘要;两个 feature 文档:`pay-module-yue-support`、`order-pay-yue-migration`。
