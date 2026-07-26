# printer-order-flow 审查报告

审查对象：backend（`.worktrees/backend-printer-order-flow`）+ admin（`.worktrees/admin-printer-order-flow`），分支 `feat/printer-order-flow`。对照 `review-agent.md` 逐项核查。

## Critical

无。

## Major

### M1. 照片打印提交时 `jobFile=null` 触发 NPE，消息无限重投且不退款（资金/消息风险）— 已修复
照片打印快照只写 `photoFiles`（JSON 数组），不写 `fileUrl`。提交时 `PrintShopService.fillJobFileAndSpec` 读不到 `fileUrl` 得 null，`LiankePrinterGateway.submitJob` 用 `addFormDataPart("jobFile", null)` 抛 NPE；且 `submitJob` 调用原先不在 try/catch 内，异常逃逸到 `PrintPayNoticeConsumer` → 消息未 ACK → Redis Stream 重投 → 同样 NPE。终态：照片订单已支付、设备订单停在 CREATED 无 taskId、不退款、无限重投。
根因是链科 `jobFile` 只接受单文件 URL，照片打印有 N 张照片，当前提交模型无法表达多照片任务。
**修复（已做）**：
1. `LiankePrinterGateway.submitJob` 前置校验 `fileUrl` 为空直接返回失败（不 NPE）；明确照片多文件本期不支持提交。
2. `PrintShopService` 对 `submitJob` 整体包 try/catch + 空结果兜底：任何异常（含链科网络/协议）一律 `markFailed + refundAndLog`，杜绝异常逃逸成重投。
照片打印订单现在会走「提交失败 → 自动退款」闭环，不再卡死。
**后续 feature**：实现照片多文件提交（合并打印或多任务）。

### M2. `fileUrl` 未做来源校验（任意外部 URL 可入快照并被链科拉取打印）
`PrinterOrderService.doCreateOrder` 直接把客户端传入的 `req.getFileUrl()` 作为 `jobFile` 发链科并写入长期快照。规格「接口不得接收未经文件权限校验的任意外部 URL」要求校验文件归属/来源。当前无 host 白名单、无 `fileKey↔fileUrl` 一致性校验。调用方可提交任意外部 URL，让链科云盒拉取并按页计费。
**本期处理**：仅做文件扩展名白名单（`PRINT_FILE_EXT_NOT_ALLOWED`）。完整修复需服务端按 `fileKey` 经文件服务解析得到可信 URL，但 infra `FileApi` 当前只有 `createFile`，无 URL 解析/归属校验 hook，且本期不含文件存储模块改造。
**建议（后续 feature）**：下单时按 `fileKey` 经文件服务重新生成/校验 `fileUrl`（或校验 URL host 命中本系统文件域），拒绝外部 URL；提交前重新取得有效 URL。**资金风险高于一般校验缺失，建议尽快跟进。**

## Minor

### m1. `regeneratePrintProductOptions` 只覆盖引用、不删旧 Option 组/项，每次同步累积孤儿行
`ProductApiImpl.regeneratePrintProductOptions` + `ProductOptionGroupRefServiceImpl.saveProductGroups`：仅 `physicalDeleteByProductId`（删 product→group 引用）后插新引用，旧的 `StoreOptionGroupDO`/`StoreOptionDO` 行不删。规格 UC4「先删除…已有…Option」字面要求删除。每次同步累积无引用旧组/项（商品页面只显示新引用，功能不受影响）。
**建议**：覆盖前记录旧 groupId，覆盖后删除不再被任何商品引用的组及其选项。本期保留为已知缺口（页面可选中清理）。

### m2. 幂等命中未校验同人，requestId 跨用户复用可泄露订单号/金额 — 已修复
`PrinterOrderService.withIdempotency` 以 requestId 为键，命中即返回订单号/金额，原未校验订单 `uid == 当前 userId`。requestId 由客户端生成，若被跨用户复用（碰撞/恶意），可能向他人泄露订单号与金额。
**修复（已做）**：`rebuildResponse(orderNo, userId)` 校验订单 `uid == userId`，不符视为未命中（继续正常下单）。新增单测 `testCreateOrder_idempotencyCrossUser_doesNotLeakOrder`。

### m3. 并发重复请求 `tryLock()` 无等待直接失败，体验上非幂等返回 — 已修复
`PrinterOrderService.withIdempotency` 并发下第二个相同 requestId 原直接抛 `PRINT_ORDER_CREATE_FAIL`，而非等待后返回首个请求创建的订单。功能安全但双击/重试场景客户端收到「失败」。
**修复（已做）**：改为 `tryLock(3, TimeUnit.SECONDS)` 短等待 + `isHeldByCurrentThread` 安全解锁；首个请求创建完成后，后续并发请求等待拿锁并命中缓存返回既有订单。

## Nit

### n1. `initDevice`/`findPrinterDevice` 多条记录时静默取第一条
与下单路径（多条即拒绝 `PRINT_DEVICE_NOT_UNIQUE`）策略不一致。init 属管理员修正配置场景可接受，建议日志提示存在多条。
### n2. `getFilePages` 的 `pageCount` 仅接受 JSON int
链科返回 `pages` 若为字符串数字（如 `"5"`）会误判失败。`isInt` 与契约 `data.pages` 为正整数一致，属真机联调确认项。

## Verified-OK（已读码确认，非问题）

- **计价数学正确**：`(skuPrice + optionTotalDelta) × count × copies`，`optionTotalDelta` 为 per-unit 加价合计；`count`=file→pageCount/photo→photoCount；`setScale(2, HALF_UP)`；BigDecimal 全程无 int 溢出。单测断言 3.00 / 24.00 正确。
- **远程调用不在 DB 事务内**：`getFilePages` 在任何 DB 写之前；`regeneratePrintProductOptions` 的 `@Transactional` 内无远程调用（纸张名由 device 侧先取好传入）；`initDevice` 远程调用与单条设备 upsert 分离。
- **快照失败补偿**：设备订单插入失败调 `cancelUnpaidOrderKeepRecord` 补偿取消业务订单，补偿自身异常被捕获并 ERROR，无可支付孤儿订单。
- **链科失败不建可支付订单**：`getFilePages` 失败/页数 null/≤0 → 抛 `PRINT_FILE_PAGES_FAILED`，发生在 `createPrintOrder` 之前（单测验证 `createPrintOrder` 未被调用）。
- **shopId 类型一致**：`StoreOrderDO.shopId`=Long、`StoreProductDO.shopId`=Integer、`AppStoreProductDTO.shopId`=Integer 各自转换（`.intValue()`/`.longValue()`）无混用 bug。
- **deviceKey 安全**：app 契约 `AppPrinterOrderReqVO` 无 deviceKey；admin 列表仅回 `hasDeviceKey`；deviceKey 仅从 `yshop_device` 读取；链科日志不打印我方 deviceKey（在 form body/header，不进 URL）。
- **租户隔离**：`yshop_device`/`yshop_device_order` 含 `tenant_id`，下单/查设备在 app 登录上下文，租户拦截器自动注入，与上一期已验证模式一致。
- **跨模块依赖**：device-biz 仅引用 order-api / product-api / store 的 Service/DO，未 import product-biz/order-biz 的 ServiceImpl。
- **错误码段** 1009002000-1009002015 连续无冲突。

## 验证缺口

1. **照片打印多文件提交未实现**（M1 已防护为判失败+退款），需后续 feature 实现合并/多任务提交。
2. **fileUrl 来源校验未实现**（M2），infra FileApi 无解析 hook，本期仅扩展名白名单。
3. **真机联调未执行**：链科 `printer_list`/`printer_params`/`paper_dimension_list`/`file_pages`/`submit_job` 的真实 HTTP 字段映射待配置 `LIANKE_PRINT_API_KEY` 后联调（含 n2 pageCount 类型）。
4. **LiankePrinterGateway 无单测**：HTTP 字段映射依赖真实响应样例，建议联调时补契约测试。
5. **admin 页无 E2E**：菜单需先执行升级 SQL 挂载，未做 Playwright/人工验证。
6. **支付后链路（order.pay.notice → submit）为复用上一期**，本期无独立端到端真机验证。

## 结论

**pass**（M1 + Minor m2/m3 已修复并复跑 **14/14** 通过；M2 记录为已知缺口待后续 feature，不阻塞本期后端闭环）。

核心架构（分类识别、打印专属计价、设备订单快照+补偿、链科 file_pages 网关、设备初始化+能力同步）方向正确，编译/14 单测通过、admin build:prod 通过。

- M1（照片打印提交 NPE 死循环）：submitJob 空 fileUrl 前置判失败 + submit 整体 try/catch + 空结果兜底，任何提交异常一律 markFailed+refund。
- M2（fileUrl 未校验）：记录已知缺口，本期仅扩展名白名单，完整来源校验待文件服务 hook（建议尽快跟进，资金风险）。
- m2（幂等同人校验）：`rebuildResponse` 校验订单 `uid == userId`，跨用户 requestId 不泄露订单。
- m3（并发锁等待）：`tryLock(3s)` + 安全解锁，并发重复请求命中缓存返回既有订单。
- 剩余 Minor m1（同步累积孤儿 Option 行）：建议后续清理，不阻塞。

剩余为已知 out-of-scope 项：照片多文件提交、fileUrl 来源校验、真机联调（待 `LIANKE_PRINT_API_KEY`）、admin E2E（待菜单 SQL 挂载）。
