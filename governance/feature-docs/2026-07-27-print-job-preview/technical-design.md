# 打印任务预览 - 技术设计

## 模块影响

| 模块 | 变更 | 说明 |
|------|------|------|
| `yshop-module-device-biz` | 新增/修改 | 预览服务 + 预览接口 + 调用方适配 |
| `yshop-module-product-api` | 新增/修改 | Option API 契约（去打印语义化 + 按名计价） |
| `yshop-module-product-biz` | 修改 | Option API 实现 |
| `admin` | 新增/修改 | 预览弹窗 + 列表页按钮 + API |

## 关键决策

### D1 预览独立成服务，不改下单链路

新建 `PrintJobPreviewService`，与 `PrinterOrderService`（下单）并列，**不改动下单路径**。下单链路涉及支付/退款/MQ/幂等，零风险隔离。计价口径通过复用同一 `ProductOptionOrderApi.priceAndValidate` 保证一致，而非共享私有方法。

### D2 计价复用 product 域，不在 device 重算

价格 = `(SKU 基础单价 + Option 加价) × 页数 × 份数`。
- SKU 基础价：`ProductApi.resolveSku(productId, "默认")`（单规格商品固定 SKU）。
- Option 加价：新增 `ProductOptionOrderApi.priceAndValidateByNames(productId, groupName, optionName)`，在商品已挂分组内按分组名+选项名定位选项后，**内部仍走 `priceAndValidate`**，与下单完全同口径（含组必选/min/max/单选/状态校验）。
- 页数：`PrinterGateway.getFilePages`（链科 file_pages，已有）。

理由：device 仅依赖 `product-api`，不依赖 `product-biz`；按名计价是领域通用能力，放 product-api 而非 device 本地拼装，避免 device 反向依赖 biz。

### D3 product Option API 去打印语义化

`ProductApi.regenerateProductOptions` 原签名 `(shopId, paperNames, colorNames, categoryNames)` 且 impl 硬编码分组名「纸张」「颜色」——打印语义泄漏进 product 域。

重构为 `(shopId, List<ProductOptionGroupSpecDTO>, categoryNames)`：分组定义（分组名+选项名列表）由调用方按业务提供，product 只负责「按分类名命中商品 → 按分组定义重建单选必选分组并挂载」。「纸张/颜色」语义收回 device 的 `PrintDeviceInitService`（打印业务的合理归属）。

理由：product API 必须领域通用，不感知打印/设备等具体业务。

### D4 价源：店铺文件打印类目首个有效商品

预览需挂到一个打印商品取 SKU 基础价与 Option 加价（计价必须有价源）。取「店铺文件打印类目首个有效商品」（`listProductsByCategoryNames(shopId, ["文件打印"])` 首个）。记录为已知缺口 K1：多文件打印商品时价可能因商品不同而异，后续可扩展为指定商品。

### D5 不真实打印 → 无状态、无落库

预览纯计算：仅读设备/商品/Option + 调链科 file_pages，**无任何 insert/update**，不创建设备订单/业务订单、不提交链科、不注册回调、不触发 MQ。因此无需幂等、无需退款、无需回调地址。

### D6 预览图走链科 isPreview 异步任务（提交 + 轮询）

需求增量：预览不仅要页数+计价，还要把**文件每页的预览图**展示给用户核对。

链科机制（已实测）：`POST /print/job` 带 `isPreview=1` 立即返回 `task_id`（只生成预览中间文件，不真实打印）；轮询 `GET /print/job?task_id=` 至 `task_state=SUCCESS`，从 `task_result.data.img_list` 取每页 JPG（`preview.liankenet.com`，带 `auth_key` 时效签名），`task_result.data.taskTicket` 为可复用预览凭证。失败时 `task_result.code!=200`（如设备端下载不到文件 → 502）。

因此拆为两步：
- **提交**：`POST /preview` 在原计价基础上，额外 `submitJob(isPreview=1)` 提交预览任务，返回 `taskId` + 计价结果。
- **轮询**：新增 `GET /preview-result?taskId=`，返回 `taskState` / `previewImages[]` / `taskTicket` / 失败原因；前端轮询至出图。

关键约束：
- 预览图**异步**，用户等待数秒~十几秒，前端「生成中…」轮询，不阻塞。
- 展示**全部页**缩略图（用户打印前逐页核对排版）。
- `taskTicket` 本期**仅返回前端、不落库**；后续真实打印复用中间文件时再设计持久化。
- 仍**不真实打印**：isPreview 任务只产预览中间文件，不下发打印机；不创建任何订单。
- 预览图 URL 带时效签名，仅用于即时展示，不做长期存储与引用。

## 契约增量

详见 `contract-changes.md`。要点：
- 新增 `POST /admin-api/device/print-job/preview`（权限 `device:print-job:create`）。
- `ProductApi.regenerateProductOptions` 签名变更（见 D3）。
- `ProductOptionOrderApi` 新增 `priceAndValidateByNames`。

## 迁移 / 回滚

- 迁移：执行 `sql/upgrade-2026-07-27-print-job-preview.sql`（幂等，新增按钮权限）。
- 回滚：无表结构变更，回退代码即可；菜单按钮权限可保留（无功能入口则不显示）。

## 风险

- R1（K1）多文件打印商品时价源取值可能不唯一 → 见 D4，后续扩展指定商品。
- R2（K2）Option 名称未命中按 0 计价并记 warn，不阻断预览；如需严格可改失败。
- R3 链科 file_pages 为测试期免费服务、无 SLA；预览失败仅提示，不影响其他链路。
