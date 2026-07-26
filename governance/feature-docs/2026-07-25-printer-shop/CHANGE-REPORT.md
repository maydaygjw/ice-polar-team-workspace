# printer-shop 交付变更报告

接入链科云打印（v3）：支付成功触发打印 → 链科回调推进状态 → 成功推配送 / 失败自动退款。一店一云盒一打印机（deviceId=店铺码=设备号）。

- 仓库：backend `yshop-drink`（gitee）、admin `yshop-drink-vue`（gitee），分支 `feat/printer-shop`。
- 范围：backend + admin；miniapp / dms 本期不涉及。
- 状态：编译通过、`PrintShopServiceTest` 6/6、admin `build:prod` 通过；审查 M1-M6 已修复。

## Backend 新增

| 路径 | 说明 |
|------|------|
| `device/printer/api/PrinterGateway.java` | 打印机能力网关接口（submit/query/cancel） |
| `device/printer/api/dto/PrintJobSubmitDTO.java` / `PrintJobResult.java` | 链科接口入参/出参（字段对齐官方 API） |
| `device/printer/service/LiankePrinterGateway.java` | OkHttp 调链科；jobFile=URL+urlFileExt |
| `device/printer/service/PrintShopService.java` | 核心编排：提交(Redisson锁幂等)/回调(三重校验+前进式状态机)/退款/重试 |
| `device/printer/service/PrintDeliveryGateway.java` | 配送平台占位（接口 TBD） |
| `device/printer/config/LiankePrintProperties.java` | `yshop.device.lianke` 配置 |
| `device/printer/enums/LiankeTaskStateEnum.java` | 链科 task_state → 设备订单状态映射 |
| `device/core/service/DeviceGatewayDispatcher.java` | 按设备类型分发 ice/printer 网关 |
| `device/mq/consumer/PrintPayNoticeConsumer.java` | 监听 `order.pay.notice`，过滤 ORDER_DEVICE 触发打印 |
| `device/controller/app/AppPrintCallbackController.java` | `/app-api/device/printer/callback`，全 catch 返回成功 |
| `device/controller/admin/printjob/PrintJobController.java` | `/admin-api/device/print-job` page/get/query/cancel/retry |
| `test/.../printer/service/PrintShopServiceTest.java` | 回调核心 6 单测 |
| `sql/upgrade-2026-07-25-printer-shop.sql` | 表结构增量 + 打印任务菜单/按钮权限，含回滚 |

## Backend 修改

| 路径 | 说明 |
|------|------|
| `device-api enums/DeviceTypeEnum.java` | +`PRINTER("printer","打印机")` |
| `device-biz/pom.xml` | +`yshop-module-pay-api`（PayNoticeMessage） |
| `dal DeviceManagementDO.java` | +`deviceKey`/`devicePort`/`deviceModel`（通用型号） |
| `dal DeviceOrderDO.java` | +`taskId`、`extraParams`(json 设备私有参数，打印机存 pageCount 等) |
| `deviceorder vo DeviceOrderRespVO.java` | +`taskId`/`extraParams` |
| `deviceorder vo DeviceOrderPageReqVO.java` + `DeviceOrderMapper.java` | +`taskId` 查询 |
| `order-api order/api/OrderApi.java` | +`pushOrderToDelivering`、`autoRefundOrder`(返回 boolean) |
| `order-biz order/api/OrderApiImpl.java` | 上两接口实现；退款失败保留 refund_status=1 并 ERROR 告警 |
| `yshop-server application.yaml` | 回调加白/忽略租户；`yshop.device.lianke` 走 env（LIANKE_PRINT_*，禁提交密钥） |

## Admin 新增

| 路径 | 说明 |
|------|------|
| `src/api/mall/device/printJob/index.ts` | 打印任务 API（page/get/query/cancel/retry） |
| `src/views/mall/device/printJob/index.vue` | 打印任务管理页（查询/详情/查询状态/取消/重试；页数从 extraParams 解析） |

复用：打印店管理=门店管理、打印机管理=商品管理，仅新建打印任务管理页。菜单经升级 SQL 挂「订单中心」(2175) 下。

## 契约 / 配置

- 库表：`yshop_device_order` +`task_id`,`extra_params`(json)；`yshop_device` +`device_key`,`device_port`,`device_model`。表保持通用，设备私有数据走 `extra_params`/`device_model`。
- MQ：复用 Redis Stream `order.pay.notice`，新增 consumer。
- 环境变量：`LIANKE_PRINT_HOST`(默认 https://cloud.liankenet.com/api)、`LIANKE_PRINT_API_KEY`、`LIANKE_PRINT_CALLBACK_BASE_URL`。

## 审查与测试

- 审查 6 Major(M1-M6) 全修复并复跑通过；附带 Minor m5/m6/m7。详见 `review-report.md`（结论 pass）。
- 单测 6/6；编译 BUILD SUCCESS；admin build:prod 通过。
- 预存失败项（与本功能无关）：全仓 `DesensitizeTest`、admin `ts:check` type-library 解析。

## 已知缺口（out-of-scope，后续 feature）

- 端到端下单链路（谁建 printer 设备订单、`fillJobFileAndSpec` 填充文件/规格）在小程序，本期占位。
- 真机联调：链科提交/查询/取消的真实 HTTP 字段映射待配置凭证后验证（含 Minor m1 jobFile 形式）。
- 配送平台 `PrintDeliveryGateway` 占位，未真实下单。
- 打印专属计价器（SKU 基础单价 + Option 加价，再乘页数 × 份数）随下单链路实现。
