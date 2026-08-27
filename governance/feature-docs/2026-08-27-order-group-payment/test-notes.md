# 拼单支付验证记录

## 通过

- 后端订单模块编译：`mvn -pl yshop-module-mall/yshop-module-order-biz -am -DskipTests compile`
- AdaPay 支付单号定向测试：`mvn -pl yshop-module-pay/yshop-module-pay-biz -am -Dtest=PayOutOrderNoServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`
- 管理端构建：`pnpm build:dev`
- backend/admin `git diff --check`

## 基线问题

- 后端订单模块全量测试命令执行到既有 pay-biz 测试时失败：`YuePayServiceTest` 3 个 NPE，`ProfitRecipientServiceImplTest` 1 个断言失败；拼单相关定向测试通过。
- 管理端 `pnpm ts:check` 在默认堆限制下 OOM；提高堆上限后仍报告仓库已有的大量自动导入和生成类型错误。新增 `groupPaymentEnabled` 未出现在错误列表中。

## 未执行

- 未连接真实 AdaPay、Redis 和数据库，因此并发支付、真实回调、逐笔原路退款和迁移脚本需要测试环境验收。
- 本期不包含 miniapp，未执行用户侧拼单页和分享流程验收。
