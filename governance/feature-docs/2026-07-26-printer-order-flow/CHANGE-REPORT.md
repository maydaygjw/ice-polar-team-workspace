# printer-order-flow 交付变更报告

补齐打印下单后端链路：创建打印订单 → 链科取实际页数 → 按（SKU 基础价 + Option 加价）× 数量 × 份数计价 → 现有支付 → `order.pay.notice` 触发打印任务提交；并新增管理端打印设备初始化/能力同步页。

- 仓库：backend `yshop-drink`（gitee）、admin `yshop-drink-vue`（gitee），分支 `feat/printer-order-flow`。
- 范围：backend + admin；miniapp 不在当前代码库，本期不改。
- 状态：编译通过、`PrinterOrderServiceTest`+`PrintDeviceInitServiceTest` **14/14**、admin `build:prod` 通过；审查 Major M1 与 Minor m2/m3 已修复，M2 记录为已知缺口。

## Backend 新增

| 路径 | 说明 |
|------|------|
| `device/printer/api/dto/PrintFilePagesRequest.java` / `PrintFilePagesResult.java` | 链科 file_pages 入参/出参 |
| `device/printer/api/dto/LiankePrinterInfo.java` / `LiankePrinterParams.java` | printer_list / printer_params 响应 |
| `device/printer/enums/PrintProductTypeEnum.java` | 分类名→FILE_PRINT/PHOTO_PRINT 唯一解析 |
| `device/printer/service/PrintSpecResolver.java` | 纸张名→dmPaperSize（缓存+TTL+失败回退）、颜色→dmColor |
| `device/printer/service/PrinterOrderService.java` | 下单编排：校验→分类→SKU/Option 计价→设备(恰好一条)→file_pages→创建订单+快照；requestId 幂等 |
| `device/printer/service/PrintDeviceInitService.java` | 设备初始化（printer_list 取首台）+能力预览+Option 同步 |
| `device/controller/app/AppPrinterOrderController.java` | `POST /app-api/device/printer/order` |
| `device/controller/app/vo/AppPrinterOrderReqVO.java` / `AppPrinterOrderRespVO.java` | 下单请求/响应 |
| `device/controller/admin/printdevice/PrintDeviceController.java` | `/admin-api/device/print-device` list-by-shop/init/sync-options |
| `device/controller/admin/printdevice/vo/*.java` | RespVO / InitReq / InitResp / SyncReq / SyncResp |
| `order-api order/api/dto/PrintOrderCreateDTO.java` | 打印业务订单创建入参 |
| `product-api .../dto/ProductSkuDTO.java` / `ProductSummaryDTO.java` | SKU / 商品摘要 |
| `test/.../PrinterOrderServiceTest.java` / `PrintDeviceInitServiceTest.java` | 计价/校验/同步 单测 13 |

## Backend 修改

| 路径 | 说明 |
|------|------|
| `device-api enums/ErrorCodeConstants.java` | +打印错误码 1009002000-1009002015（含 INIT/SYNC_FAILED） |
| `device/printer/api/PrinterGateway.java` | +`getFilePages`/`getPaperDimensions`/`getPrinterList`/`getPrinterParams` |
| `device/printer/service/LiankePrinterGateway.java` | 4 个新接口实现；`submitJob` 支持 dmColor、空 jobFile 前置判失败 |
| `device/printer/config/LiankePrintProperties.java` | +file_pages 连接/读取超时 |
| `device/printer/service/PrintShopService.java` | `fillJobFileAndSpec` 从快照填充 fileUrl/规格；submit 整体 try/catch + 空结果兜底（M1 修复） |
| `device/printer/api/dto/PrintJobSubmitDTO.java` | +`dmColor` |
| `order-api order/api/OrderApi.java` | +`createPrintOrder` |
| `order-biz order/api/OrderApiImpl.java` | 打印业务订单直接落库（复用现有支付，payType=no，支付成功覆盖） |
| `product-api product/ProductApi.java` | +`getCategoryNames`/`resolveSku`/`listProductsByCategoryNames`/`regenerateProductOptions`（领域通用、按目标分类名驱动，不含打印/设备语义） |
| `product-biz product/ProductApiImpl.java` | 上述实现；Option 同步 @Transactional，BeanUtils 属性拷贝 |

## Admin 新增

| 路径 | 说明 |
|------|------|
| `src/api/mall/device/printDevice/index.ts` | 打印设备 API（list-by-shop/init/sync-options） |
| `src/views/mall/device/printDevice/index.vue` | 打印设备管理页：按店铺查设备、录入 deviceKey 初始化并预览能力、二次确认后同步生成纸张/颜色 Option |

菜单/按钮权限：`device:print-device:query/init/sync`，待升级 SQL 挂载后 E2E。

## 契约 / 配置

- 新增 `POST /app-api/device/printer/order`；admin `/admin-api/device/print-device/*`。不含 deviceKey/最终金额/页数入参。
- 复用 `yshop_device.device_key/device_port/device_model`、`yshop_device_order.extra_params`（打印快照）；无库表结构变更。
- 环境变量沿用 `LIANKE_PRINT_*`；`file_pages` 超时走 `yshop.device.lianke.file-pages-*`（默认 5s/15s）。

## 审查与测试

- 审查 Major M1（照片打印提交 NPE 死循环不退款）与 Minor m2（幂等同人校验）、m3（并发锁等待）已修复并复跑 **14/14**；M2（fileUrl 未校验）记录为已知缺口。详见 `review-report.md`（结论 pass）。
- 单测 14/14；编译 BUILD SUCCESS；admin build:prod 通过。
- 真机联调未执行（待 `LIANKE_PRINT_API_KEY`）。

## 已知缺口（out-of-scope，后续 feature）

- 照片打印多文件提交：本期防护为判失败+退款，真实合并/多任务提交待实现（M1）。
- fileUrl 来源校验：infra FileApi 无解析 hook，本期仅扩展名白名单（M2，资金风险，建议尽快跟进）。
- 每次同步 Option 累积无引用旧组/项（m1，建议后续清理）。
- admin 打印设备页菜单需升级 SQL 挂载后 E2E 验证。
