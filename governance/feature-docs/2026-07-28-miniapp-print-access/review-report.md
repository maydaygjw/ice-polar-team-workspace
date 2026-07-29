# miniapp-print-access 审查报告

## 结论

**通过**。实现符合契约与技术设计；打印主链路零改动，配送对接与 C 端查询为纯增量。

## 审查项

| 项 | 结果 | 说明 |
|---|---|---|
| 契约一致性 | 通过 | 出向 publishById 三条铁律（sourceIdList 非空 / 顶层 sourceId 一致 / uid=orderNo 查重）落到 `BrickDeliveryGateway.buildOrderVO`；入向回调 uid 校验 + `id+orderState` 幂等 + 秒回 200 |
| 状态机正确性 | 通过 | 业务主状态语义已核对：`pushOrderToDelivering`→1(配送中)；`updateOrderStatus(2)`→已送达/可评价（且内置触发 Adapay 分账）；`takeOrder`→3(已完成)。与 printer-shop D5 一致 |
| 打印主链路 | 通过 | `PrintShopService` 仅 SUCCEEDED 分支 dispatch 返回值改为落库快照，接口注入点不变；既有 `PrintShopServiceTest` 12 用例全绿 |
| 架构边界 | 通过 | 跨模块只经 api：device→order 走 `OrderApi`、device→store 走新增 `StoreShopQueryApi.listByShopCodes`、复用 `ProductOptionOrderApi`；配送协议收口在 device-biz-print，不渗他模块 |
| 数据权限 | 通过 | progress/delivery/progress 加 `@PreAuthenticated` + `checkOrderOwnership`(业务订单 uid 归属校验)；preview 不泄露可信价（服务端计价）；发现/详情不回显 deviceKey |
| 租户隔离 | 通过 | 复用现有 mapper（BaseDO 租户字段）；回调端点免登录且加入 `ignore-urls`，不进租户拦截器 |
| 安全红线 | 通过 | token/apiKey/deviceKey 仅环境变量；日志脱敏（brick 无敏感 query）；回调无签名靠 uid+状态机+幂等防伪造 |
| DB 变更 | 通过 | 零新增表/列；配送快照存 `extra_params` JSON；无需升级 SQL |
| 测试 | 通过 | 打印模块 31 用例全绿（含新增 `DeliveryStatusServiceTest` 6 用例覆盖幂等/推进/终态） |

## 验证缺口（需联调）

- `BrickDeliveryGateway.dispatch` 与 `AppDeliveryCallbackController` 依赖外部 brick 系统，单测未覆盖真实 HTTP；需联调验证。
- 前置约定：brick 需对 YXG 放开 HTTP 回调；未放开则降级主动查单（契约 §3.2 备选）。

## 已知非阻塞项

- 全仓 `mvn test` 有基线既有失败 `DesensitizeTest`(framework，中文脱敏期望），与本 feature 无关。
