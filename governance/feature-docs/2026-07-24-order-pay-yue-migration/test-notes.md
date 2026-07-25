# Test Notes: order-pay-yue-migration

## 编译

- `(cd backend && mvn -pl yshop-module-mall/yshop-module-order-biz -am install -DskipTests)` → **pass**
  - 含 order-biz 及其依赖(pay-api/pay-biz/member-api 等)全量编译。

## 单测

- `(cd backend && mvn -pl yshop-module-mall/yshop-module-order-biz surefire:test)` → `Tests run: 17, Failures: 2, Errors: 3`
  - 失败全部位于 `CommissionServiceImplTest`(佣金精度 `expected 9.99 but was 10.00`、`UnnecessaryStubbing`)。
  - **已验证为既有失败**:`git stash` 本 feature 改动后在干净树上重跑,同样 2 失败 3 错误。与本次迁移无关。
  - order-biz 仅此一个测试类,无迁移相关测试可回归。

## 迁移正确性核验(静态)

- `AppStoreOrderServiceImpl.yuePay()`:不再出现 `userService.decPrice`,改为 `payOrderApi.createPayOrder(yue)`;订单态校验与 `paySuccess` 保留。
- `StoreOrderServiceImpl.orderRefund()` YUE 分支:不再出现 `userService.incMoney`,改为 `payOrderApi.refund(yue)`;`balance` 本地记账快照保留。
- `grep` 确认 order-biz 内仅剩 1 处 `incMoney`(`AppStoreOrderServiceImpl:1156` 充值到账),属 Out 范围,正确保留。
- 清理未用 import(`AppUserQueryVo`)。

## 未执行

- 小程序端到端余额支付/退款:无本地可运行环境,建议在测试环境回归「余额下单」「余额不足提示」「余额退款」三用例。
- 既有 `CommissionServiceImplTest` 失败:超出本 feature 范围,未修复。
