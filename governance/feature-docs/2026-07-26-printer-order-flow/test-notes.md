# printer-order-flow 测试说明

当前阶段只完成文档，尚未执行实现测试。以下是实现后的最小验证集合。

## 单元测试

### 打印设备初始化

- 管理端可按店铺查询设备并触发初始化/能力同步。
- `printer_list.data.row` 有多条记录时使用第一条。
- 第一条记录的 `driver_name`、`port` 正确保存到设备型号和端口。
- 返回空列表、首条记录缺少型号或端口时初始化失败。
- 初始化调用 `printer_params` 和 `paper_dimension_list`，生成纸张/颜色 Option。
- 初始化前清理当前店铺下已有商品规格和 Option。
- 首次生成 Option 默认加价为 0。
- 页面二次确认后，能够为店铺下文件打印/照片打印商品重新生成纸张/颜色 Option。
- 初始化失败时删除操作回滚或执行补偿恢复。

### 分类解析

- `文件打印` → `FILE_PRINT`。
- `照片打印` → `PHOTO_PRINT`。
- 未知分类拒绝。
- 同时命中两个分类拒绝。
- 首尾空格按规范化后匹配。

### SKU 与 Option

- SKU 不属于当前商品时拒绝。
- SKU 价格来自数据库，不使用请求价格。
- 纸张/颜色 Option 映射到正确 `dmPaperSize`、打印参数和快照。
- Option 不属于商品、禁用、必选项缺失时拒绝。
- 纸张/颜色 Option 的 `optionTotalDelta` 正确计入单价；横向/纵向等零加价 Option 不改变金额。

### 链科 file_pages 网关

Mock 需要验证：

- 请求方法为 `POST`。
- 路径为 `/print/file_pages`。
- Header 含 `ApiKey`。
- multipart 字段包含 `deviceId/deviceKey/devicePort/printerModel/dmPaperSize/jobFile`。
- 文件 URL 不被写入普通日志。
- 成功响应 `data.pages` 正确映射为内部 `pageCount`。
- HTTP 4xx/5xx、业务失败、超时、空响应、页数为 0 或缺失均返回失败。

Mock 成功响应固定使用 `data.pages`，并覆盖页数为 0、负数、缺失和非数字场景。

## 订单服务测试

- 文件打印：`(SKU 基础单价 + Option 加价) × file_pages 页数 × copies`。
- 照片打印：`(SKU 基础单价 + Option 加价) × photoCount × copies`，且不调用 file_pages。
- 无 printer 设备拒绝。
- 多 printer 设备拒绝，不随机选择。
- 设备 key 从数据库读取，客户端传入的 key 被忽略或拒绝。
- 业务订单与 DeviceOrder 快照关联一致。
- 分类改名后历史快照仍保留原 `productType/categoryName`。
- 业务订单创建失败时不留下可支付但无设备订单的记录。
- 重复请求不会重复创建打印业务订单。

## 支付后链路

- `order.pay.notice` 能找到 `deviceType=printer` 的 DeviceOrder。
- 提交 `/print/job` 时文件 URL、纸张编码、份数和打印机参数来自快照。
- 提交失败进入失败状态并触发既有退款流程。
- 提交成功只生成一个 `taskId`。

## 集成/API 场景

建议用本地 Mock 链科服务，不调用真实 `cloud.liankenet.com`：

1. 准备一个文件打印商品，分类为“文件打印”，配置纸张大小和颜色两个 Option，并设置不同加价。
2. 准备一个照片打印商品，分类为“照片打印”，配置纸张大小和颜色 Option 及基础 SKU。
3. 准备一个店铺 printer 设备及脱敏测试凭证。
4. Mock `file_pages` 返回固定页数。
5. 创建文件打印订单，确认金额和 `extraParams`。
6. 创建照片打印订单，确认不调用 `file_pages`。
7. 执行支付通知和打印任务提交测试。
8. 执行链科失败、超时和多设备配置异常场景。

## 验收门禁

- 新增 backend 单测通过。
- device-biz 相关 Maven 测试通过。
- 至少完成 `file_pages` 请求字段和响应解析的 Mock 契约测试。
- 不在日志、测试报告或文档中记录完整 ApiKey、deviceKey 或签名 URL。
- 小程序不在本 feature 范围内；admin 打印设备管理页本期实现并通过 `pnpm build:prod` 构建验证，Playwright/人工 E2E 待菜单挂载后另行验证。

---

# 执行记录（2026-07-26）

## Backend 构建 / 单测

- 编译：`mvn -pl yshop-module-mall/yshop-module-device-biz,yshop-module-order-biz,yshop-module-product-biz -am compile` → BUILD SUCCESS。
- 单测：`mvn -pl yshop-module-mall/yshop-module-device-biz -am test -Dtest=PrinterOrderServiceTest,PrintDeviceInitServiceTest` → **14/14 通过**（Fail 0 Err 0）。
  - `PrinterOrderServiceTest`（11）：文件打印计价 `(0.20+0.10)×5×2=3.00` + 快照断言；照片打印 `(1.50+1.50)×4×2=24.00` 且不调 file_pages；类型未识别/双分类/SKU 缺失/设备 0 条/设备多条/页数失败/缺文件/份数非法 全拒绝；幂等跨用户 requestId 不泄露他人订单。
  - `PrintDeviceInitServiceTest`（3）：同步委托 productApi、productApi 失败包装为 SYNC_FAILED、店铺缺失拒绝。
- 集成/链科真机：未执行（无 `LIANKE_PRINT_API_KEY` 凭证）；file_pages 请求字段/响应解析以 Mock 契约 + 单测覆盖，真机联调待凭证。

## Admin 构建

- `pnpm install` + `pnpm build:prod` → BUILD_EXIT=0。
- 页面 `views/mall/device/printDevice/index.vue` 通过 eslint 校验。Playwright/人工 E2E 待菜单挂载。

## 已知验证缺口（详见 review-report.md）

- 照片打印多文件本期不支持链科提交（提交模型为单文件 URL），已加防护：空 jobFile 提交直接判失败+退款，不 NPE/不重投。
- fileUrl 来源未校验（无文件服务解析 hook，infra FileApi 仅 create）；下单仅做扩展名白名单。见 review-report M2。
- 每次同步 Option 累积无引用旧组/项（saveProductGroups 仅覆盖引用）。见 review-report m1。
