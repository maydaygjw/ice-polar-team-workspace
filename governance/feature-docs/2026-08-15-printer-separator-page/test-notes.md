# 验证记录

## 后端

- `mvn -pl yshop-module-device/yshop-module-device-biz-print -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-device/yshop-module-device-biz-print -am test`：通过，43 个测试通过。
- 开关增量回归：`mvn -q -pl yshop-module-device/yshop-module-device-biz-print -am -Dtest=PrintShopServiceTest,PrintOrderStrategyTest,PrinterAppServiceTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，相关 29 个测试通过。
- 开关增量编译：`mvn -q -pl yshop-module-device/yshop-module-device-biz-print -am -DskipTests compile`：通过。
- 新增状态机覆盖：正文成功后提交分隔页、分隔页成功后配送、分隔页失败不退款并保留处理中。
- 租户开关约定：缺失或非 `true` 默认关闭；正文任务提交时固化开关结果。

## 管理端

- `pnpm ts:check`：未执行成功。当前 worktree 未安装 `node_modules`，环境缺少 `vue-tsc`（`sh: vue-tsc: command not found`）。
- 浏览器/E2E：N/A，本功能暂未配置可用的管理端运行环境和打印机联调环境。

## 手工验证重点

1. 文件订单的 `extra_params.separator` 应包含模板版本、门店、文件名、正文页数、份数快照。
2. 正文 `SUCCESS` 后设备订单不能立即进入 `SUCCEEDED`，应切换到分隔页任务。
3. 分隔页 `SUCCESS` 后才推送配送；分隔页失败/取消不得退款。
4. 管理端“重试分隔页”使用设备订单号，只提交新的分隔页任务，不重新提交正文。
5. 租户参数管理切换 `printer.separator.enabled` 后，新提交的文件打印订单按开关执行；已开始执行的订单流程不变。
