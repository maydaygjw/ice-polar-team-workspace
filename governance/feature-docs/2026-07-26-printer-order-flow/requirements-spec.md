# printer-order-flow 需求规格

## 背景

`2026-07-25-printer-shop` 已完成打印设备类型、链科任务提交/回调、失败退款和管理端打印任务能力，但没有完成“创建打印订单 → 获取实际页数 → 按商品基础价格与 Option 加价计价 → 支付 → 提交打印任务”的后端下单入口。

本 feature 补齐 backend 下单链路，并增加管理端打印设备初始化/能力同步页面。小程序不在当前代码库，本期不修改 miniapp。

## Scope

### In

- 新增 backend 打印订单创建接口。
- 新增 admin 打印设备管理/能力同步页面：按店铺查询设备、初始化链科打印机、同步能力并生成商品 Option。
- 店铺从 `yshop_device` 关联一个 `printer` 设备，设备保存链科 `deviceKey`、`devicePort`、`deviceModel`。
- 一个店铺可以有多个打印商品。
- 根据商品所属分类名称识别打印商品类型：
  - `文件打印`
  - `照片打印`
- 文件打印通过链科 `POST /api/print/file_pages` 获取实际页数。
- 文件打印、照片打印分别按商品 SKU 基础单价和 Option 加价计价。
- 纸张大小、颜色统一使用商品 Option，并允许通过 Option 配置加价。
- 横向/纵向等不影响价格的内容也使用商品 Option，加价由商品 Option 配置决定。
- 支付成功后复用 `order.pay.notice` 触发现有打印任务提交逻辑。
- 将商品类型、SKU、Option、文件、页数和份数写入 `DeviceOrderDO.extraParams` 快照。

### Out

- miniapp 页面、文件选择、上传和支付页面。
- 新增商品类型字段；本期不修改商品表结构。
- `yshop_device` 店铺关联的数据库唯一约束。
- 配送平台真实下单。
- DMS 改造。
- 本地 PDF/Word 页数解析。

## 领域模型

```text
店铺 1 ── N 打印商品
店铺 1 ── N printer 设备记录（业务上要求恰好一条，数据库暂不加唯一约束）
打印商品 1 ── N SKU（商品基础单价或其他 SKU 维度）
打印商品 1 ── N Option（纸张/颜色/横向/纵向等，可影响价格）
```

设备和商品不直接绑定。下单时由商品 `shopId` 找到店铺，再按现有店铺码/设备码约定查找 `deviceType=printer` 的设备。

## Use Cases

### UC1 文件打印下单

1. 调用方提交店铺、文件引用、打印商品、SKU、Option 和份数。
2. backend 校验商品属于店铺，并根据分类名称识别为 `文件打印`。
3. backend 根据纸张大小 Option 得到 `dmPaperSize`，读取店铺 printer 设备凭证。
4. backend 将文件 URL 传给链科 `file_pages`，取得实际页数。
5. backend 按 `(SKU 基础单价 + Option 加价) × 页数 × 份数` 计算订单金额。
6. backend 创建业务订单和 printer 设备订单，返回订单号。
7. 调用方使用现有支付接口支付；支付成功后由 MQ 触发打印提交。

### UC2 照片打印下单

1. 调用方提交店铺、照片文件列表、打印商品、SKU、Option 和份数。
2. backend 校验商品属于店铺，并根据分类名称识别为 `照片打印`。
3. 照片数量取上传照片数量，不调用 `file_pages`。
4. backend 按 `(SKU 基础单价 + Option 加价) × 照片数量 × 份数` 计算订单金额。
5. backend 创建业务订单和 printer 设备订单，后续支付和打印流程与文件打印一致。

### UC3 配置异常

- 未找到匹配的 printer 设备：拒绝下单。
- 找到多个匹配设备：拒绝下单并提示设备配置异常，不随机选取。
- 商品没有“文件打印”或“照片打印”分类：拒绝下单。
- 商品同时命中两个打印分类：拒绝下单，避免计价歧义。

### UC4 打印设备初始化

1. 管理员进入打印设备管理页面，按店铺查询设备；没有设备时录入云盒 `deviceId`、`deviceKey`。
2. 页面调用 backend 初始化接口，服务端读取全局 `ApiKey` 并调用链科 `GET /external_api/printer_list`。
3. 如果返回多台打印机，固定使用 `data.row[0]`，不增加人工选择步骤。
4. 保存首台打印机的 `driver_name` 到 `yshop_device.deviceModel`，保存 `port` 到 `yshop_device.devicePort`。
5. 调用 `GET /print/printer_params` 和 `GET /print/paper_dimension_list` 获取能力及纸张编码。
6. 页面展示解析后的能力，管理员二次确认后，先删除当前店铺下已有商品规格和 Option，再按设备能力重新生成纸张、颜色等商品 Option；新 Option 默认加价为 0，实际价格在商品管理页面配置。

## Business Rules

### 商品类型

- 分类名称去除首尾空格后精确匹配。
- `文件打印` 映射为 `FILE_PRINT`。
- `照片打印` 映射为 `PHOTO_PRINT`。
- 不使用商品名称、分类 ID 或前端传入的类型值替代分类名称判断。
- 创建订单时将解析出的类型和分类名称写入设备订单快照；后续分类改名不得改变历史订单含义。

### SKU 与 Option

- SKU 只提供文件单页或照片单张的基础价格，以及确实需要 SKU 表达的其他维度。
- 纸张大小、颜色、照片尺寸、相纸类型、横向/纵向等统一使用现有 `optionSelections`。
- Option 的加价使用系统已有的 Option 价格能力，服务端通过 `optionTotalDelta` 计入订单金额。
- 纸张大小 Option 必须能映射到链科 `dmPaperSize`；颜色 Option 快照保存并在提交打印时转换为链科支持的打印参数。
- SKU、Option 必须属于当前商品，不能只信任客户端传入的显示名称或价格。

### 文件页数

- 文件打印不由 backend 本地解析 PDF/Word 页数。
- backend 调用链科：`POST https://cloud.liankenet.com/api/print/file_pages`。
- 调用使用 `multipart/form-data`，至少包含：`deviceId`、`deviceKey`、`devicePort`、`printerModel`、`dmPaperSize`、`jobFile`。
- `jobFile` 是 PDF/Word 文件 URL；文件必须能被链科服务访问。
- 单次只处理一个文件；文件不超过 20MB；调用超时或链科失败时拒绝创建订单。
- 链科返回的 `data.pages` 是文件打印计价依据，必须为正整数。

### 设备与凭证

- `deviceKey` 只从后端 `yshop_device` 读取，不出现在客户端请求契约中。
- 设备必须是 `deviceType=printer` 且未删除。
- 一个云盒返回多台打印机时，初始化固定使用 `printer_list.data.row[0]`；不做人工选择和二次筛选。
- 初始化失败时不能只删除不生成；清理和重建必须通过事务或补偿流程保证最终一致。
- 本期不增加数据库唯一约束；服务层必须处理 0 条、多条和正常 1 条三种结果。

### 历史快照

`DeviceOrderDO.extraParams` 至少保存：

```json
{
  "productType": "FILE_PRINT",
  "categoryName": "文件打印",
  "productId": 100,
  "sku": "默认",
  "paper": "A4",
  "color": "黑白",
  "optionSnapshot": [
    {"groupName": "纸张", "optionName": "A4", "price": 0.10},
    {"groupName": "颜色", "optionName": "黑白", "price": 0.00}
  ],
  "pageCount": 5,
  "photoCount": 0,
  "copies": 2,
  "fileName": "合同.docx",
  "fileExt": "docx",
  "fileKey": "printer/2026/contract.docx",
  "dmPaperSize": 9
}
```

签名 URL 不作为长期快照保存；正式提交打印时重新生成或取得有效 URL。若当前文件服务只能提供不可重新生成的 URL，必须在实现前补充文件生命周期方案。

## Backend API Requirements

建议新增：

```text
POST /app-api/device/printer/order
```

接口请求至少包括：

- `shopId`
- `productId`
- 文件打印的文件引用和文件 URL，或照片打印的照片文件列表
- `spec`：沿用现有商品 SKU 规格表示
- `optionSelections`：沿用现有商品 Option 选择结构
- `copies`

接口不得接收或信任：

- `deviceKey`
- 最终支付金额
- 服务端计算的 `pageCount`
- 未经文件权限校验的任意外部 URL

返回订单号和订单金额；支付继续使用现有订单支付接口。

## Acceptance Criteria

- 文件打印能通过链科 `file_pages` 得到页数后再创建订单。
- 文件打印价格等于 `(SKU 基础单价 + Option 加价) × 链科页数 × 份数`。
- 照片打印不调用 `file_pages`，价格等于 `(SKU 基础单价 + Option 加价) × 照片数量 × 份数`。
- 纸张大小和颜色通过 Option 影响价格，并保存为快照。
- 商品分类无法唯一识别时拒绝下单。
- 店铺无 printer 或存在多条 printer 记录时拒绝下单。
- 创建的 `DeviceOrderDO` 类型为 `printer`，并具有完整 `extraParams`。
- 支付通知能找到该 printer 设备订单并复用现有任务提交链路。
- 链科页数接口超时、HTTP 失败、业务失败、页数缺失时不创建可支付订单。
- 不影响普通商品订单和制冰机订单。

## Assumptions

- `yshop_device` 已具备 `deviceKey`、`devicePort`、`deviceModel` 和 `deviceType` 字段。
- 店铺码、设备码和链科 `deviceId` 的现有关联约定继续有效。
- 商品分类名称由现有商品分类管理维护。
- 打印设备页面只负责设备初始化、能力解析和 Option 同步，不负责维护最终商品价格。
- 初始化清理范围是当前店铺下已有商品规格和 Option；页面必须展示影响范围并要求二次确认。
- 链科 `file_pages` 的成功响应页数字段已确认为 `data.pages`。
- 本期实现 backend 下单链路与 admin 打印设备管理/能力同步页；miniapp 不在当前代码库，不修改。
