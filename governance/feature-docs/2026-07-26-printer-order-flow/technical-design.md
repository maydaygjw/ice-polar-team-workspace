# printer-order-flow 技术设计

## 1. 设计目标

在不增加商品类型字段、不增加设备唯一约束、不修改 miniapp 的前提下，补齐 backend 的打印订单创建和计价链路：

```text
打印订单请求
  → 商品/分类/SKU/Option 校验
  → 查找店铺 printer 设备
  → 文件打印调用链科 `file_pages`
  → 打印专属计价
  → 创建业务订单 + DeviceOrder 快照
  → 现有支付
  → order.pay.notice
  → PrintShopService 提交 /print/job
```

## 2. 模块职责

### device-biz

- 暴露 `/app-api/device/printer/order`。
- 根据商品所属店铺查找 printer 设备。
- 组织文件页数查询、打印参数和设备订单快照。
- 复用 `PrintShopService`、`PrintPayNoticeConsumer` 和 `PrinterGateway`。

### order-biz / order-api

- 创建业务订单并保存支付金额。
- 增加打印订单计价所需的 API DTO 字段或独立打印订单 DTO。
- 保持普通商品计价逻辑不变。
- admin 提供打印设备管理/能力同步页面，承载店铺设备查询、初始化和商品 Option 同步。
- 通过既有 `OrderApi` 接口跨模块调用，禁止 device-biz 直接依赖 order-biz 实现。

### product-biz / product-api

- 复用商品分类、SKU、Option 查询和校验能力。
- 复用 `ProductOptionOrderApi.priceAndValidate` 获取 Option 快照。
- 不新增商品类型字段；打印类型解析在打印订单服务中完成。

### infra

- N/A：本 feature 不新增文件存储模块；文件引用和 URL 能力按现有文件服务使用。

## 3. 打印类型解析

商品已有 `shopId` 和分类关联。打印订单服务加载商品的全部分类名称，进行规范化后判断：

```java
"文件打印" -> FILE_PRINT
"照片打印" -> PHOTO_PRINT
```

解析结果必须是唯一值。分类名称同时命中两个类型、没有命中或分类查询异常时直接拒绝下单。

解析出的类型只用于本次订单创建和计价，创建后写入 `extraParams`，保证分类后续改名不影响历史订单。

## 4. SKU 与 Option 解析

### SKU

1. 根据请求中的 `productId` 加载商品。
2. 使用现有 `spec` 规则查找该商品的 SKU 属性值记录。
3. SKU 只提供商品基础单价或其他确需 SKU 表达的维度，不承载纸张大小和颜色。
4. 只使用数据库 SKU 价格，不信任请求价格。

文件打印示例：

```text
商品：文件打印
SKU：默认
SKU 基础单价：0.20 元/页
Option：纸张=A4（+0.10），颜色=黑白（+0.00）
页数：5
份数：2
订单商品金额：0.20 × 5 × 2 = 2.00 元
```

照片打印示例：

```text
商品：照片打印
SKU：默认
SKU 基础单价：1.50 元/张
Option：纸张=6寸（+0.50），颜色=彩色（+1.00）
照片数：4
份数：2
订单商品金额：1.50 × 4 × 2 = 12.00 元
```

### Option

调用现有 `ProductOptionOrderApi.priceAndValidate`：

- 校验 Option 是否属于商品、是否启用、是否满足必选/多选规则。
- 允许使用系统已有的 `optionTotalDelta`，纸张大小和颜色的加价必须计入打印单价。
- 将返回的组名、选项名和价格写入设备订单快照。

打印单价统一为 `SKU 基础单价 + optionTotalDelta`；普通商品的 Option 计价逻辑不变。

## 5. 打印设备初始化与能力同步

设备管理页面触发 backend 初始化，不依赖下单时实时发现打印机：

1. 使用设备的 `deviceId`、`deviceKey` 调用 `/external_api/printer_list`。
2. 固定取返回值 `data.row[0]` 作为目标打印机；返回为空时初始化失败。
3. 将首条记录的 `driver_name` 写入 `yshop_device.deviceModel`，将 `port` 写入 `yshop_device.devicePort`。
4. 使用 `driver_name` 调用 `/print/printer_params`，获取颜色、纸张、方向、双面等能力。
5. 使用 `driver_name` 调用 `/print/paper_dimension_list`，建立纸张名称到 `paper_id`/`dmPaperSize` 的映射。
6. 页面展示解析后的能力，管理员二次确认后，先清理当前店铺下已有商品规格和 Option，再将纸张大小、颜色等能力同步到店铺打印商品的商品 Option；新增 Option 默认加价 0。

管理端页面职责：

- 按店铺查询 `yshop_device`，展示设备类型、初始化状态、打印机型号、端口和最近同步时间。
- 新增或编辑云盒凭证；`deviceKey` 只写入服务端，不在列表和普通响应中明文展示。
- 点击“初始化/同步能力”后展示打印机、纸张、颜色、方向、双面等解析结果。
- 展示将被清理的当前店铺商品规格和 Option 数量，管理员二次确认后执行清理。
- 清理完成后为店铺下的文件打印、照片打印商品重新生成商品 Option。
- 初始化失败时通过事务回滚或补偿恢复已删除的数据，禁止留下“规格/Option 已清空但能力未生成”的中间状态。
- 商品基础价和 Option 加价继续在商品管理页面维护。

当前按第一条打印机记录处理多打印机云盒，后续多打印机选择另起 feature。

## 6. 链科文件页数网关

在 `PrinterGateway` 增加内部能力，协议细节只放在 `LiankePrinterGateway`：

```java
PrintFilePagesResult getFilePages(PrintFilePagesRequest request);
```

外部请求：

```text
POST {LIANKE_PRINT_HOST}/print/file_pages
Header: ApiKey: {LIANKE_PRINT_API_KEY}
Content-Type: multipart/form-data
```

表单字段：

| 字段 | 来源 |
|---|---|
| `deviceId` | printer 设备 `deviceCode`/店铺设备码 |
| `deviceKey` | `yshop_device.device_key` |
| `devicePort` | `yshop_device.device_port` |
| `printerModel` | `yshop_device.device_model` |
| `dmPaperSize` | 纸张大小 Option 映射 |
| `jobFile` | backend 可访问的 PDF/Word URL |

### 响应处理

链科成功响应已确认如下：

```json
{
  "code": 200,
  "data": {
    "pages": 3
  },
  "msg": "success"
}
```

页数读取路径为 `data.pages`，必须为正整数。HTTP 失败、业务码非 200、响应为空或页数无效时，适配器返回失败结果。

适配器向业务层只返回标准结果：

```java
class PrintFilePagesResult {
    boolean success;
    Integer pageCount; // 对应 data.pages
    String message;
}
```

链科返回页数为空、非正数、HTTP 失败、业务失败或请求超时，统一视为“无法计算页数”，不创建订单。

### URL 约束

- `jobFile` 必须是链科可访问的 URL。
- backend 不应把任意外部 URL 直接转发给链科；至少校验文件来源域名、扩展名和大小。
- 订单快照保存文件对象标识和文件元数据，不长期保存短时签名 URL。
- 正式提交 `/print/job` 时重新取得有效 URL；如果现有文件服务无法重新签名，需要在实现前补充文件生命周期设计。

## 7. 下单与事务

推荐新增 `PrinterOrderService`，由 device-biz 的 App Controller 调用：

1. 校验用户、租户、商品、店铺和文件引用。
2. 解析商品类型和 SKU/Option。
3. 查找 printer 设备；结果必须恰好一条。
4. 文件打印调用 `getFilePages`；照片打印计算照片数量。
5. 计算打印商品金额。
6. 通过 `order-api` 创建业务订单。
7. 同事务写入 `DeviceOrderDO`：
   - `deviceType=printer`
   - `operationType=print_order`
   - `bizOrderId=业务订单号`
   - `status=CREATED`
   - `extraParams=打印快照`
8. 任一步失败都不得返回可支付的完整订单。

服务层不依赖数据库唯一约束，但应使用店铺/文件/请求幂等键防止重复创建。建议第一版以 `requestId` 或订单创建幂等注解保护重复请求。

## 8. 支付后提交

现有 `PrintPayNoticeConsumer` 继续监听 `order.pay.notice`，`PrintShopService` 根据业务订单号查询 `deviceType=printer` 的设备订单。

`fillJobFileAndSpec` 改为从 `extraParams` 填充：

- `fileUrl`
- `urlFileExt`
- `dmPaperSize`
- `dmCopies`
- 其他链科支持的打印参数

正式提交仍使用现有 `/print/job`，提交成功后写入 `taskId`，失败走已有失败状态和自动退款流程。

## 9. 数据库与迁移

- N/A：不新增商品类型字段。
- N/A：不新增 `shop_id` 或设备唯一约束。
- 复用既有 `yshop_device.device_key/device_port/device_model`。
- 复用既有 `yshop_device_order.task_id/extra_params`。
- 不修改 `sql/yixiang-drink.sql`。

## 10. 风险与决策

| 风险 | 处理 |
|---|---|
| 分类改名导致订单类型变化 | 创建订单时写入类型和分类名称快照 |
| 店铺有多条 printer 设备 | 服务层拒绝，不随机选择；后续再考虑唯一约束 |
| 云盒有多台打印机 | 初始化固定取 `data.row[0]`，记录该简化决策；后续再支持人工选择 |
| 初始化清理误伤商品配置 | 页面展示影响范围并二次确认；删除与重建使用事务/补偿机制 |
| 链科 file_pages 无 SLA | 设置连接/读取超时，失败不创建可支付订单 |
| 文件 URL 过期 | 保存可重新取得 URL 的文件标识，提交时重新生成 |
| Option 加价配置错误 | 服务端按 `optionTotalDelta` 计价并保存快照，普通商品不受影响 |
| 普通订单被误识别为打印订单 | 必须同时满足打印分类、打印商品订单入口和 printer 设备校验 |
