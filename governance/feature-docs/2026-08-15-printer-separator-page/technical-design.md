# 打印订单分隔页技术设计

## 1. 设计目标

在不修改用户文件、不改变打印计价、不新增设备订单表的前提下，将一个打印订单拆成两个有序的链科任务：

```text
正文任务成功
  → 渲染分隔页 HTML
  → 上传文件服务
  → 提交分隔页任务
  → 分隔页成功
  → DeviceOrder SUCCEEDED
  → 现有配送/完成流程
```

分隔页是订单履约的辅助任务，不是新的用户业务订单。

## 2. 模块影响

### backend

- `yshop-module-device-biz-print`
  - 新增分隔页数据组装、模板渲染、文件上传和链科任务提交服务。
  - 扩展 `PrintShopService` 的阶段状态机和回调处理。
  - 增加仅重试分隔页的管理端接口。
  - 扩展 `PrintJobSubmitDTO` 与 `LiankePrinterGateway` 的 HTML 转换参数。
  - 在打印订单快照中写入分隔页开关、模板版本和快照字段。
- `yshop-module-infra-api`
  - 提供临时文件上传、读取 URL 和清理能力，供打印模块上传生成的 HTML；打印模块不依赖 infra-biz 实现。
  - 复用 `TenantConfigApi` 读取当前租户的分隔页开关。
- `yshop-server`
  - 不新增回调白名单；分隔页复用现有链科打印回调地址。

### admin

- 在现有“打印任务”页面增加正文/分隔页阶段展示。
- 增加“仅重试分隔页”操作和分隔页任务详情。
- 不新增独立页面和前端依赖。
- 在现有租户参数管理页面增加分隔页开关快捷设置，底层仍使用 `infra_tenant_config`。

### miniapp / icepolar-dms

- N/A：小程序不增加用户操作；打印机仍由 backend 直连链科，不经过 DMS。

## 3. 关键决策

### 3.1 使用 HTML 作为分隔页源文件

链科 `POST /print/job` 已支持 HTML URL，服务端上传单页 HTML，并传 `urlFileExt=.html` 和 `htmlKernel=chrometopdf`。

选择 HTML 而不是直接拼接原 PDF 的原因：

- 原订单文件可能是 PDF、DOC、DOCX 等不同格式，不应在 backend 重新合并或转换。
- 动态字段通过模板渲染即可扩展。
- 不引入 PDF 合并库和 Office 转换运行时。
- CSS 可固定纸张、页边距、字体和单页布局。

模板由 backend 资源文件维护，第一版渲染订单编号、门店名称、文件名、正文页数和打印份数。所有动态值必须 HTML 转义，禁止把用户输入作为 HTML 片段直接注入。

### 3.2 分隔页独立提交，不与正文合并

正文任务和分隔页任务必须是两个链科任务，并且只在正文收到成功状态后提交分隔页。

- 正文任务使用原有文件 URL、份数和打印选项。
- 分隔页任务使用生成的 HTML URL，份数固定为 `1`。
- 分隔页使用订单的纸张编码；颜色固定黑白、方向固定竖向、双面固定单面。
- 分隔页不参与页数查询、商品数量和价格计算。

这样能避免正文任务尚未完成时分隔页插入队列，也能让分隔页失败时只重试分隔页。

### 3.3 复用 `task_id` 表示当前活动任务

不新增 `yshop_device_order` 列。`DeviceOrderDO.taskId` 始终指向当前需要查询或回调的链科任务：

1. 初始指向正文任务。
2. 正文成功后，保存正文任务 ID 到 `extra_params.separator.documentTaskId`，再将 `taskId` 更新为分隔页任务 ID。
3. 分隔页完成后，`taskId` 保留分隔页任务 ID，阶段写为完成。

这样现有后台查询和任务详情仍能定位当前活动任务；旧正文回调在任务切换后作为过期回调丢弃，不会重新提交分隔页。

### 3.4 分隔页失败不使用现有退款分支

正文失败沿用现有“设备订单失败 → 自动退款”逻辑。

分隔页失败时：

- 不自动退款，因为正文已经打印成功。
- 不推进配送/订单完成流程。
- `DeviceOrder.status` 保持 `PROCESSING`，在 `extra_params` 中记录 `SEPARATOR_FAILED` 和失败原因。
- 后台只允许提交分隔页重试，不允许通过普通打印重试重新打印正文。

分隔页重试成功后，才将设备订单置为 `SUCCEEDED` 并调用现有配送完成逻辑。

## 4. 分隔页模板与数据

### 4.1 模板资源

建议路径：

```text
yshop-module-device-biz-print/src/main/resources/templates/printer/separator-v1.html
```

模板必须满足：

- `@page` 固定订单选择的纸张尺寸或可映射的页面尺寸。
- `margin: 0`，避免浏览器默认边距造成额外分页。
- 内容区域限制在单页内。
- 使用服务端可用的中文字体配置，保证门店名称和文件名不会乱码。
- 模板版本写入订单快照，模板后续修改不影响已生成的历史分隔页。

### 4.2 数据模型

新增模块内部模型 `SeparatorPageData`，第一版包含以下全部字段：

```text
orderNo       业务订单编号
orderSequence 订单每日序号
shopName      门店名称
fileName      文件名
userAddress   收货地址
pageCount     正文页数
copies        打印份数
```

第一版模板读取以上全部字段。`orderNo` 使用 `DeviceOrderDO.bizOrderId`；管理端直接创建且没有业务订单号时，使用设备订单 `orderNo` 作为兼容回退。`orderSequence` 和 `userAddress` 从业务订单读取后写入订单创建时的快照。文本字段缺失时渲染为“-”，数值字段缺失时渲染为 `0` 或“-”。

### 4.3 临时 OSS 文件

不能使用 backend 本地临时路径，因为链科只能通过 URL 拉取文件。分隔页 HTML 使用 OSS 临时对象：

1. 服务端渲染 HTML 后，通过 `TemporaryFileApi` 上传到专用前缀，例如 `printer/separator/`。
2. API 返回对象 key、可访问 URL 和过期时间；提交链科时使用带有效期的 URL。
3. 对象保留时间覆盖链科排队、下载和重试窗口，默认保留 48 小时，具体时长可配置。
4. 分隔页任务成功、最终失败或取消后进入清理流程；清理失败由 OSS 生命周期规则兜底。
5. 管理员在文件过期后重试分隔页时，根据订单快照重新渲染并上传，不重新打印正文。
6. `extra_params` 保存对象 key、过期时间和模板快照，不长期保存签名 URL；不得保存设备凭证。

临时文件只解决生成文档的生命周期，不改变订单快照的长期保存要求。

### 4.4 订单快照结构

继续使用 `DeviceOrderDO.extraParams` JSON，不新增表或列。新订单增加如下结构：

```json
{
  "separator": {
    "eligible": true,
    "enabled": false,
    "templateVersion": "v1",
    "stage": "DOCUMENT",
    "status": "PENDING",
    "documentTaskId": null,
    "taskId": null,
    "objectKey": null,
    "expiresAt": null,
    "retryCount": 0,
    "snapshot": {
      "orderNo": "202608150001",
      "shopName": "打印店",
      "fileName": "合同.docx",
      "pageCount": 5,
      "copies": 2
    }
  }
}
```

阶段取值：

| 阶段 | 含义 |
|---|---|
| `DOCUMENT` | 正文任务执行中或尚未完成 |
| `SEPARATOR_PENDING` | 正文成功，等待生成/提交分隔页 |
| `SEPARATOR` | 分隔页任务已提交或执行中 |
| `SEPARATOR_FAILED` | 分隔页失败，可重试 |
| `COMPLETED` | 正文和分隔页均成功 |

`eligible` 表示订单是否属于文件打印分隔页范围；`enabled` 表示正文任务提交时固化的租户开关结果。租户参数缺失或不是 `true` 时写入 `enabled=false`。旧订单没有可识别的分隔页快照时不自动补打，避免部署后对已完成旧任务盲目重打正文。

租户参数固定为：

```text
key   = printer.separator.enabled
value = true / false
```

缺少该参数时默认关闭。订单开始执行后修改租户参数不改变该订单的既定流程。

## 5. 服务编排

### 5.1 `PrinterSeparatorService`

新增打印模块私有服务，职责保持单一：

1. 从设备订单和快照组装 `SeparatorPageData`。
2. 加载模板并进行安全变量替换/HTML 转义。
3. 调用 `TemporaryFileApi` 上传 HTML，取得链科可访问 URL。
4. 组装分隔页 `PrintJobSubmitDTO`。
5. 通过 `PrinterGateway.submitJob` 提交链科任务。

服务返回临时对象 key、过期时间、模板版本和链科任务 ID；链科读取 URL 只在提交请求期间使用，状态持久化由 `PrintShopService` 编排，避免模板服务直接操作设备订单。

### 5.2 正文成功回调

`PrintShopService.applyTaskState` 增加阶段判断：

1. 校验当前任务确实是正文任务，且当前状态允许前进。
2. 读取订单快照中的租户开关；关闭时沿用正文成功完成流程，不生成分隔页。
3. 开启时将阶段置为 `SEPARATOR_PENDING`。
4. 调用 `PrinterSeparatorService` 生成临时 HTML 并提交分隔页。
5. 成功后保存 `documentTaskId`、临时对象 key/过期时间、分隔页任务 ID，并将 `DeviceOrder.taskId` 改为分隔页任务 ID、状态置为 `QUEUED`。
6. 失败后保存 `SEPARATOR_FAILED` 和原因，保持设备订单 `PROCESSING`，不退款、不配送。

正文成功到分隔页提交的过程使用 `printer:separator:{bizOrderId}` 分布式锁，并在锁内二次读取订单状态，避免重复回调生成多个分隔页任务。

### 5.3 分隔页回调

回调仍使用 `POST /app-api/device/printer/callback`：

1. 通过 `device_id` 和当前 `taskId` 找到设备订单。
2. 根据 `separator.stage` 判断当前任务是分隔页任务。
3. `SUCCESS`：写入 `COMPLETED`，设备订单置为 `SUCCEEDED`，然后调用现有配送/业务完成逻辑。
4. `FAILURE` 或 `REVOKED`：写入 `SEPARATOR_FAILED`、失败原因和完成时间，不退款、不配送。
5. 重复或乱序回调按阶段和状态机忽略。

### 5.4 仅重试分隔页

新增 `PrintShopService.retrySeparator(deviceOrderNo)`，按 `yshop_device_order.order_no` 定位设备订单：

1. 只接受 `SEPARATOR_FAILED` 阶段。
2. 不读取或重新提交原正文文件。
3. 临时文件仍有效时复用对象 key 生成新的读取 URL；文件已过期或不存在时，按保存的快照重新生成。
4. 提交新的链科任务后更新 `separator.taskId`、`retryCount`、阶段和当前 `DeviceOrder.taskId`。
5. 使用同一分布式锁保证并发点击只产生一个分隔页任务。

## 6. 链科网关变化

`PrintJobSubmitDTO` 增加可选字段：

```text
htmlKernel = chrometopdf
```

`LiankePrinterGateway.submitJob` 仅在字段非空时追加 multipart 参数。正文任务保持现有参数不变；分隔页任务额外传：

```text
jobFile        = 分隔页 HTML URL
urlFileExt     = .html
dmCopies       = 1
dmColor        = 1
dmOrientation  = 1
dmDuplex       = 1
htmlKernel     = chrometopdf
```

链科异步返回 `task_id` 只代表任务受理；最终状态仍以回调或后台主动查询为准。

## 7. 管理后台设计落点

复用 `admin/src/views/mall/device/printJob/index.vue`：

- 列表新增“打印阶段”和“分隔页状态”列，数据从 `extraParams.separator` 解析。
- 详情增加分隔页任务 ID、模板版本、分隔页状态、失败原因和快照摘要。
- `SEPARATOR_FAILED` 只显示“重试分隔页”，调用新接口；隐藏普通“重试”按钮。
- 普通正文失败仍使用原有“重试”按钮。
- 重试确认文案明确说明“只打印分隔页，不会重新打印正文”。

复用 `admin/src/views/infra/tenantConfig/index.vue`：

- 增加“打印设备分隔页”快捷开关。
- 开关对应参数 `printer.separator.enabled`，不存在时首次开启自动创建租户参数。
- 参数值为 `true` 时开启，关闭时写入 `false`；缺失默认显示关闭。
- 说明文案明确：只影响之后提交的打印任务，不改变已开始执行的订单。

## 8. 失败与补偿

| 场景 | 处理 |
|---|---|
| HTML 渲染失败 | 保持正文已成功事实，记录 `SEPARATOR_FAILED`，后台重试时重新生成 |
| OSS 上传失败 | 同上，不退款、不重打正文 |
| 链科接受分隔页后本地落库失败 | 尝试取消链科任务；取消失败记录任务 ID，禁止自动重投，交由人工核对 |
| 分隔页回调缺失 | 后台对当前分隔页任务执行现有主动查询；成功/失败按同一阶段状态机处理 |
| 分隔页失败后重试 | 只提交分隔页，不修改正文任务 ID、快照和正文文件 |
| 重复支付通知 | 正文已有任务或已进入分隔页阶段时直接幂等返回 |

## 9. 风险与权衡

| 风险 | 缓解措施 |
|---|---|
| 链科 HTML 转换环境差异导致多页/乱码 | 固定 CSS、模板版本、字体；集成测试校验生成内容和链科预览结果 |
| HTML URL 过期 | 复用文件服务生成的 URL；重试时可根据快照重新上传 |
| 回调并发造成重复分隔页 | 订单级分布式锁 + 阶段二次校验 |
| 分隔页失败但正文已打印 | 不退款，订单停留在分隔页异常，后台只重试分隔页 |
| 旧订单状态无法识别 | 只有新订单显式开启分隔页；旧订单默认不补打 |
| 额外链科任务增加队列等待 | 分隔页只在正文成功后提交，避免前置占用打印队列 |
