# 测试记录：订单每日序号

## Planned

- 验证同门店同日订单序号从 1 递增，且不同门店互不影响。
- 验证跨日重置、并发唯一性、事务回滚和加餐不重新分配。
- 验证 admin/app 响应映射及历史订单空值兼容。

## Execution

- `mvn -pl yshop-module-mall/yshop-module-order-biz -am -DskipTests compile`：通过，53 个 reactor 模块编译成功。
- `mvn -pl yshop-module-mall/yshop-module-order-biz -am -Dtest=OrderSequenceServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，1 个测试通过；验证门店编号参与计数器读写。
- `git diff --check`：通过。

## Not Run / Baseline Issues

- 未执行真实数据库并发、跨日和事务回滚集成测试；当前仅有服务层单元测试，数据库环境未纳入本次工作区验证。
- 完整依赖测试此前在既有 `yshop-module-pay-biz` 测试处失败：`YuePayServiceTest` 3 个错误（`userBillApi` 为空）和 `ProfitRecipientServiceImplTest` 1 个断言失败；未进入 order-biz 测试，判断为基线问题，与本次改动无直接关联。
