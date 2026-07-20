# 商品不限制库存 UI/UX 设计

## 管理端

### 商品表单

- 文件：`admin/src/views/mall/product/storeProduct/StoreProductForm.vue`
- 基础信息库存输入、组合规格库存输入、单规格 SKU 库存输入均允许输入 `-1`。
- 输入框右侧或 placeholder 增加提示：`“填 -1 表示不限制库存”`。
- 库存字段当前无表单校验规则，保持不校验，避免限制负数输入。

### 选项表单

- 文件：`admin/src/views/mall/product/storeOption/StoreOptionForm.vue`
- `el-input-number` 的 `:min` 由 `0` 调整为 `-1`，`:precision="0"` 保留。
- placeholder 增加：`“-1 表示不限制库存”`。
- 后端校验保持 `@NotNull`，不限制最小值。

### 商品/规格/选项列表

- 库存列展示为 `不限制库存` 时，`stock == -1`。
- 商品列表的“已售罄”筛选（`stock == 0`）不受 `-1` 影响；`-1` 不视为售罄。

### 导入预览

- 文件：`admin/src/views/mall/product/productImport/index.vue`
- 库存列展示：`-1` 渲染为 `不限制库存`。
- 导入不额外校验库存为负数。

### 店铺导入

- 文件：`admin/src/views/mall/product/productImport/index.vue`
- 参数页增加开关“不限制库存”。
- 开启后，预览表库存列统一显示“不限制库存”，源文件库存值被忽略。
- 关闭时，源文件库存为 `-1` 显示“不限制库存”，其他值显示具体数字。
- 确认导入时，`unlimitedStock` 随参数提交。

- 无本期变更；商品详情、购物车、下单接口由后端返回库存充足。
- 若现有 UI 展示“库存充足”文案，保持现状。

## 交互状态

| 库存值 | 含义 | 列表展示 | 下单行为 |
|---|---|---|---|
| `-1` | 不限制库存 | 不限制库存 | 跳过校验扣减 |
| `0` | 无库存 | 已售罄 / 0 | 库存不足 |
| `> 0` | 有限库存 | 具体数字 | 校验并扣减 |
