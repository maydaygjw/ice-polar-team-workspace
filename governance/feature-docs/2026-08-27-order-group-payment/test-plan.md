# 拼单支付测试计划

## 后端单元与集成验证

- 普通 AdaPay 新支付尝试生成 `{订单号}-1-1`，重试递增最后一段；历史两段式记录不被修改。
- 拼单创建校验租户开关、门店三态配置、AdaPay 渠道、2～10 份及每份最低 0.10 元。
- 发起人必须先成功支付 1 份；其他登录用户可支付，游客请求被认证层拒绝；同一用户可追加多份。
- 主订单行锁下验证成功份数、创建中份数的预占，不能超额支付；重复回调不重复计数。
- 金额拆分验证两位小数及尾差仅落到最后一份。
- 首份成功后按租户分钟参数固化截止时间；拼满后只执行一次原有支付成功流程。
- 发起人取消、超时关闭、现有可退款状态下的整单退款，均按成功支付记录逐笔原路退款。
- 非发起人不能取消或申请退款；退款失败时事务不应把订单标记为已退款。

## 管理端验证

- 门店编辑页可选择“继承租户配置 / 启用 / 禁用”，保存和重新打开后值一致。
- 租户参数页沿用现有字符型参数，配置 `order.group-payment.enabled` 和 `order.group-payment.timeout-minutes`。
- 租户关闭时，门店即使选择启用也不能发起拼单。

## 已执行命令

- `mvn -pl yshop-module-mall/yshop-module-order-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-pay/yshop-module-pay-biz -am -Dtest=PayOutOrderNoServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，1 个测试通过。
- backend/admin `git diff --check`：通过。
- `pnpm ts:check`：未执行成功，admin worktree 尚未安装 `node_modules`，命令提示 `vue-tsc: command not found`。

## 待环境具备后的验收

- 安装 admin 依赖后执行 `pnpm ts:check` 和目标环境构建。
- 使用 AdaPay 沙箱/测试租户覆盖并发支付、回调乱序、超时和多支付人退款。
- 执行数据库迁移后验证新旧 `pay_out_order_no` 记录兼容，以及唯一索引冲突重试。
