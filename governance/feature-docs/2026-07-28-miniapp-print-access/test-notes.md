# miniapp-print-access 测试记录

## 范围

- 仓库：`backend`（worktree `.worktrees/backend-miniapp-print-access`，分支 `feat/miniapp-print-access`）。
- 模块：`yshop-module-device-api`、`yshop-module-device-biz-print`、`yshop-module-mall`(store-api/store-biz)、`yshop-server`(yaml)。

## 编译 / 构建

| 命令 | 结果 |
|---|---|
| `mvn -pl yshop-module-device/yshop-module-device-biz-print -am compile -DskipTests` | pass |
| `mvn -pl yshop-module-mall/yshop-module-store-biz -am compile -DskipTests` | pass |

## 单元测试

| 命令 | 结果 |
|---|---|
| `mvn -pl yshop-module-device/yshop-module-device-biz-print test` | **pass：Tests run 25, Failures 0, Errors 0** |

> 覆盖：`PrintShopServiceTest`(12)、`PrintDeviceInitServiceTest`(3)、`PrintOrderStrategyTest`(10)。
> 含既有用例 `callback_successAdvancesAndPushesToDelivering` 校验 SUCCEEDED → `pushOrderToDelivering` + `printDeliveryGateway.dispatch`。
> 日志中 `自动退款失败`/`配送下单未受理` 等 ERROR 为测试模拟的失败分支，符合预期。

## 未执行及原因

- `mvn test`（全仓）：`-am` 会带入 `yshop-spring-boot-starter-web` 的**既有失败** `DesensitizeTest`（中文姓名脱敏期望 `<芋***>` 实为 `<y****>`)，与本 feature 无关，为基线问题。本期只跑打印模块测试。
- E2E：小程序不改、配送平台 brick 为外部系统，回调/发布单需真实环境联调；本期接口级单测已覆盖状态机/幂等逻辑。

## 新增逻辑待联调验证（依赖外部系统）

- `BrickDeliveryGateway.dispatch`：需真实 brick host/token + 商家主数据联调（发布单 + 三条铁律）。
- `AppDeliveryCallbackController`：需 brick 对 YXG 放开 HTTP 回调后联调（幂等/状态推进到 businessStatus=2）。
