# miniapp-print-access CHANGE-REPORT

## Summary

- 打通小程序 C 端打印接入的后端能力：**打印机发现**、**打印计价预览**、**实时打印进度**、**配送对接（霍伦 brick）与配送进度**。
- 配送对接：`PrintDeliveryGateway` 占位类 → 接口；新增 `BrickDeliveryGateway` 真实实现（HTTP 直连 brick `publishById`），打印完成（DeviceOrder SUCCEEDED）自动发布配送单并落库平台配送单号。
- 配送状态：新增回调 `POST /app-api/device/printer/delivery/callback`，brick 每次状态变更推送 → uid 校验 + `id+orderState` 幂等 + 秒回 200 → 异步推进业务订单（送达/完成 → businessStatus=2 已送达/可评价）。
- C 端查询：新增 5 个 app-api（发现列表/详情、计价预览、打印进度、配送进度）；支付/退款/收货/评价复用既有通用订单接口，不新增。
- miniapp 不改：本期只冻结 C 端契约（OpenAPI），小程序后续自行对接。

## Repositories

- `backend`（worktree `.worktrees/backend-miniapp-print-access`，分支 `feat/miniapp-print-access`，基线 `origin/master`）：
  - `yshop-module-device-api`：新增 `DeliveryPublishResult` DTO、错误码 `PRINT_ORDER_NOT_EXISTS`。
  - `yshop-module-device-biz-print`：`PrintDeliveryGateway`→接口；新增 `printer/delivery/`（`BrickDeliveryGateway`、`BrickDeliveryProperties`、`DeliveryStatusService`、`BrickOrderStateEnum`、`DeliveryStatusEnum`）；新增 `AppDeliveryCallbackController`、`AppPrinterShopController`、`PrinterAppService`、`PrintShopQueryService` 及 7 个 app VO；`PrintShopService` SUCCEEDED 分支落配送快照。
  - `yshop-module-mall`(store-api/store-biz)：`StoreShopQueryApi` 新增 `listByShopCodes`。
  - `yshop-server`：`application.yaml` 加配送回调白名单 + `yshop.delivery.brick` 配置块。

## Contracts

- API（app-api 新增）：
  - `GET /app-api/device/printer/shop/nearby` — 附近可打印门店列表（已初始化 printer 设备）
  - `GET /app-api/device/printer/shop/detail?shopId=` — 打印店详情（能力/在线/可下单，不回显 deviceKey）
  - `POST /app-api/device/printer/preview` — 打印计价预览（与下单同一计价口径）
  - `GET /app-api/device/printer/progress?orderNo=` — 打印进度（登录+归属校验）
  - `GET /app-api/device/printer/delivery/progress?orderNo=` — 配送进度（登录+归属校验）
  - `POST /app-api/device/printer/delivery/callback` — brick 配送状态回调（白名单免登录）
- 外部系统：霍伦 brick `POST /order/order/publishById`（出向，`access-token` 走配置 `BRICK_DELIVERY_TOKEN`）；配送状态 HTTP 回调（入向）。
- DB：无新增表/列；配送快照存 `yshop_device_order.extra_params` JSON；无升级 SQL。
- 配置：新增 `yshop.delivery.brick.*`（host/token/orderSourceType=YXG/callbackBaseUrl）；token 走环境变量。**merchantUserId/bizRegionCode/destinationId 不配置**，发布单时从店铺/订单实时取（店铺 id、businessRegionId、收货地址 id），需与 brick 主数据 id 一致。
- MQ：无新增；复用 `DeviceOrder` 状态推进 + 本地事件。

## Verification

- `mvn -pl yshop-module-device/yshop-module-device-biz-print -am compile -DskipTests`: **pass**
- `mvn -pl yshop-module-mall/yshop-module-store-biz -am compile -DskipTests`: **pass**
- `mvn -pl yshop-module-device/yshop-module-device-biz-print test`: **pass，Tests run 31, Failures 0, Errors 0**（含新增 `DeliveryStatusServiceTest` 6 用例）
- 未执行：全仓 `mvn test`（基线既有失败 `DesensitizeTest`，与本 feature 无关）；brick 出向/回调真实 HTTP 需联调。

## Risks

- brick 对 YXG 放开 HTTP 回调为**前置约定**，未放开则降级主动查单（契约 §3.2 备选）。
- 配送发布失败不阻塞 SUCCEEDED（业务订单已配送中），仅记日志留人工入口；配送失败与打印退款解耦。
- 配送回调无签名：靠 uid 匹配本地已发布单 + 状态机 + 幂等防伪造（已接受）。

## References

- `governance/feature-docs/2026-07-28-miniapp-print-access/`(requirements/contract/technical-design/test-notes/review-report)
- 基线：`2026-07-25-printer-shop`、`2026-07-26-printer-order-flow`、`2026-07-27-print-job-preview`
- 配送平台契约：霍伦 brick `order-service`/`push-service` 源码整理（用户提供）
