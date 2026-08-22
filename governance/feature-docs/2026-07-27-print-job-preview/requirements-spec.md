# 打印任务预览 - 需求规格

## Scope

在管理后台「打印任务」页新增「新建打印任务」入口，提供**打印文件预览图**能力：选择店铺设备、上传打印文件、选择纸张/颜色/份数后，提交异步预览任务并展示文件图片。**本期不真实打印**：不创建任何订单/设备订单；页数和计价由独立接口负责。

## 背景与现状

- 打印任务 = 设备订单（`yshop_device_order`, type=printer），当前仅有「小程序支付成功 → 自动提交链科」一条链路。
- 后台「打印任务」页（`mall/device/printJob`）只有 查询/取消/重试/详情，无手动新建入口。
- 计价逻辑已存在于 `PrinterOrderService.doCreateOrder`：`(SKU 基础单价 + Option 加价) × 数量(页数) × 份数`。
- 链科 `file_pages` 取页数接口已在 `PrinterGateway.getFilePages` 实现。

## Use Cases

### UC1 打开新建打印任务弹窗
1. 管理员进入「打印任务」页，点击搜索栏「新建打印任务」按钮（权限 `device:print-job:create`）。
2. 系统弹出预览弹窗，展示：店铺选择（ShopSelect）、文件上传、纸张/颜色/份数选择。

### UC2 上传文件并生成预览图
1. 管理员选择店铺（确定打印机设备与打印商品）。
2. 上传 PDF/Word 文件（复用 `UploadFile` 组件，拿到可访问 URL）。
3. 选择纸张、颜色（来自该店铺打印商品的 Option 分组）、份数（默认 1）。
4. 点击「生成预览」，系统：
   - 校验店铺恰好一台 printer 设备且凭证完整；
   - 不调用链科 `file_pages`；
   - 提交链科异步预览任务；
   - 返回并展示预览图，不计算价格。
5. 管理员查看预览，点「关闭」结束。**不落任何数据**。

## Business Rules

- BR1 店铺必须恰好存在一台 printer 设备且 deviceKey/devicePort/deviceModel 完整，否则提示设备未配置。
- BR2 文件仅允许 PDF/Word（`pdf/doc/docx`），大小 ≤ 20MB（对齐链科 file_pages 限制）。
- BR3 页数和计价仅由独立 `page-count` 接口计算；图片预览不依赖该接口。
- BR4 计价只信任服务端：SKU 基础单价、Option 加价均从数据库取，前端不传价格。
- BR5 纸张/颜色选项来源于店铺打印商品已同步的 Option 分组（与设备能力一致）。
- BR6 全程不创建业务订单、不创建设备订单；图片预览允许提交链科 `isPreview=1` 任务并产生 taskId，但不真实打印。

## Frontend Requirements

- 「打印任务」页搜索栏新增「新建打印任务」按钮（`v-hasPermi="['device:print-job:create']"`）。
- 预览弹窗字段：
  - 店铺：复用全局 `ShopSelect` 组件；
  - 文件：复用全局 `UploadFile` 组件（`fileType=['pdf','doc','docx']`，`fileSize=20`，`limit=1`）；
  - 纸张/颜色：根据所选店铺打印商品的 Option 分组动态渲染单选；
  - 份数：数字输入，默认 1，最小 1。
- 预览结果区：打印机、纸张/颜色/方向/双面、份数和异步预览图。
- 仅「关闭」按钮，无「确认打印」（本期不真实打印）。

## 接口需求（契约增量）

新增管理后台预览接口（不真实打印）：

```
POST /admin-api/device/print-job/preview
```

请求：`{ shopId, fileUrl, fileExt, paperName, colorName, copies }`
响应：`{ copies, deviceModel, paperName, colorName, orientationName, duplexName, taskId }`

- 图片预览不调用 `PrinterGateway.getFilePages`；页数和计价接口继续复用该能力。

## Edge Cases

- 店铺无 printer 设备 / 多台 / 凭证不全 → 提示设备未配置，不展示预览。
- 文件格式非法或超 20MB → 前端 `beforeUpload` 拦截 + 服务端二次校验。
- 链科 `file_pages` 失败/页数无效 → 提示取数失败，不展示计价。
- 店铺打印商品未同步纸张/颜色 Option → 纸张/颜色下拉为空并提示先去初始化设备。
- 份数为 0 或负数 → 前端校验拦截。

## Acceptance Criteria

- AC1 打印任务页出现「新建打印任务」按钮，无权限时不显示。
- AC2 选择店铺、上传文件、选纸张/颜色/份数后，能提交异步预览任务并展示预览图。
- AC3 传入 `jpPageRange=1-10` 时，只预览指定页码范围；为空时预览全部页。
- AC4 关闭弹窗后，打印任务列表、设备订单、业务订单均**无新增**记录。
- AC5 设备未配置/文件非法/取数失败均有明确错误提示。
- AC6 backend 编译通过、admin `ts:check` + `build:prod` 通过；页数/计价由独立接口负责。

## Assumptions

- 页数/计价需挂到店铺下唯一打印商品以取 SKU 基础价与 Option 加价（计价必须有价源）；店铺多打印商品时取该店铺文件打印类目中首个有效商品。——若需「指定商品」可后续扩展。
- 文件存储 URL 链科可公网访问（下单链路已验证）。
- 不真实打印 → 无需回调地址、无需 MQ、无需退款逻辑。
- 菜单/按钮权限 SQL 随功能一并交付，脚本幂等。
