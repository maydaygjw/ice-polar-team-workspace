## UI/UX Design: Adapay 分账结算

### Pages

| 页面 | 路径 | 说明 |
|------|------|------|
| 分账收款人管理 | `views/mall/store/profitSharingReceiver/index.vue` | 管理分账收款人（平台级 + 店铺级） |
| 店铺分账关联配置 | 嵌入 `views/mall/store/shop/ShopForm.vue` | 为店铺选择关联的分账收款人 |
| 分账结算记录 | `views/mall/store/profitSharingRecord/index.vue` | 查看日终自动分账结算结果 |

---

### Page 1: 分账收款人管理页

#### Layout

沿用 `withdrawal/index.vue` 标准列表页结构：

- `ContentWrap`（搜索栏）
- `ContentWrap`（表格 + 分页）
- `ProfitSharingReceiverForm`（新增/编辑弹窗）

#### Search Fields

| 字段 | 组件 | 说明 |
|------|------|------|
| 收款人名称 | `el-input` | 模糊搜索 |
| 级别 | `el-select` | 平台级 / 店铺级 |
| 角色 | `el-select` | 平台 / 配送方 / 销售方 |
| 店铺名称 | `el-select` | 级别=店铺级时可用，关联店铺下拉 |
| 状态 | `el-select` | 启用 / 禁用 |

#### Table Columns

| 列 | 字段 | 渲染 |
|----|------|------|
| ID | `id` | 居中 |
| 级别 | `recipientType` | `平台级` / `店铺级` |
| 角色 | `role` | `平台` / `配送方` / `销售方` |
| 店铺名称 | `shopName` | 平台级显示 `--` |
| 收款人名称 | `recipientName` | 居中 |
| Member 类型 | `memberType` | `个人` / `企业` |
| 结算账户绑定 | `settleAccountBound` | `已绑定` / `未绑定` |
| 状态 | `status` | `启用` / `禁用` |
| 创建时间 | `createTime` | `dateFormatter` |
| 操作 | — | 编辑 / 删除 |

#### Actions

- **新增**：打开 `ProfitSharingReceiverForm`（`create` 模式）
- **编辑**：打开 `ProfitSharingReceiverForm`（`update` 模式）
- **删除**：`message.delConfirm()` 二次确认后调用 `deleteProfitSharingReceiver(id)`

#### Form Dialog (`ProfitSharingReceiverForm.vue`)

| 字段 | 组件 | 校验规则 |
|------|------|----------|
| 级别 | `el-radio-group` | `required` |
| 角色 | `el-select` | `required` |
| 关联店铺 | `el-select` | 级别=店铺级时 `required`；级别=平台级时隐藏 |
| 收款人名称 | `el-input` | `required`, max 64 |
| Member 类型 | `el-radio-group` | `required`：`1`=个人，`2`=企业 |
| 个人实名信息 | 动态表单 | `memberType=1` 时显示：手机号、真实姓名、身份证号 |
| 企业信息 | 动态表单 | `memberType=2` 时显示：企业名称、营业执照号、法人姓名、法人身份证号、营业执照附件 |
| 结算银行卡 | 动态表单 | `required`：银行卡号、开户名、银行代码、开户行、账户类型 |
| 状态 | `el-switch` | 默认启用 |

> 创建收款人提交后，后端同步调用 Adapay 接口创建 Member 并绑定结算账户；成功后才入库。表单不再由管理员填写 `member_id`。

#### Empty / Error States

- **空列表**：`el-empty` + 描述 "暂无分账收款人，点击上方按钮添加"
- **删除失败**：`message.error()` 提示 "该收款人已关联店铺，无法删除"
- **同角色有效收款人冲突**：后端自动禁用旧记录或返回错误，前端按响应提示

---

### Page 2: 店铺分账关联配置

此功能嵌入现有 **店铺编辑页** (`ShopForm.vue`)，而非独立页面。

#### Layout

在 `ShopForm.vue` 的 `commissionRate` 表单项之后新增分账关联区块：

```
[抽成比例表单项]
[分账关联区块 — 新增]
[是否营业表单项]
```

#### Form Fields (新增到 `ShopForm.vue`)

| 字段 | 组件 | 校验规则 |
|------|------|----------|
| 分账收款人 | `el-select` | 可选，从已启用的平台级（角色=平台）+ 该店铺级收款人列表中选择 |
| 启用分账 | `el-switch` | 选择收款人后自动启用；解绑时关闭 |

交互逻辑：

- `el-select` 的 `options` 由 `getProfitSharingReceiverList({ status: 1, shopId: formData.id })` 提供。
- 下拉选项按级别分组：选项前缀区分 `平台级` / `店铺级`。
- 选择收款人后，启用分账开关自动打开；清空选择时，开关关闭。
- **本期不包含分账比例覆盖字段**，分账比例固定使用 `commissionRate`。

#### Empty / Error States

- **无可用收款人**：下拉框显示 "暂无可用收款人，请先前往分账收款人管理添加"
- **保存失败**：后端返回特定错误码，前端提示具体原因

---

### Page 3: 分账结算记录页

#### Layout

沿用 `storeRevenue/index.vue` 只读列表模式：

- `ContentWrap`（搜索栏）
- `ContentWrap`（表格 + 分页）
- 无新增/编辑弹窗，仅查看 + 失败重试

#### Search Fields

| 字段 | 组件 | 说明 |
|------|------|------|
| 店铺名称 | `el-input` | 模糊搜索 |
| 结算日期 | `el-date-picker` | `type="date"`，筛选某日 |
| 分账状态 | `el-select` | 待分账 / 分账中 / 成功 / 失败 / 已回退 |
| 是否已回退 | `el-select` | 是 / 否 |

#### Table Columns

| 列 | 字段 | 渲染 |
|----|------|------|
| ID | `id` | 居中 |
| 店铺名称 | `shopName` | 居中 |
| 订单号 | `orderId` | 居中，可点击跳转订单详情 |
| 订单金额 | `payPrice` | 居中，单位元 |
| 平台抽成 | `commissionAmount` | 居中，单位元 |
| 店铺分账 | `shopAmount` | 居中，单位元 |
| 分账状态 | `sharingStatus` | 待分账/分账中/成功（绿色）/失败（红色）/已回退（灰色） |
| 已回退 | `fallbackRevenue` | `是` / `否` |
| 失败原因 | `errorMsg` | 失败时显示，否则 `--` |
| 结算时间 | `sharingTime` | `dateFormatter` |
| 创建时间 | `createTime` | `dateFormatter` |
| 操作 | — | 重试（仅失败且未回退） |

#### Actions

- **重试**：仅 `sharingStatus=3` 且 `fallbackRevenue=0` 时显示，`message.confirm()` 二次确认后调用 `retryProfitSharingOrder(id)`

#### Empty / Error States

- **空列表**：`el-empty` + 描述 "暂无分账结算记录"
- **筛选无结果**：提示 "未找到符合条件的记录，请调整筛选条件"

---

### Component Patterns

全部复用现有 Element Plus 组件，无自定义组件：

| 组件 | 来源 | 用途 |
|------|------|------|
| `ContentWrap` | `@/components/ContentWrap` | 页面区块包裹 |
| `Dialog` | `@/components/Dialog` | 弹窗 |
| `Pagination` | `@/components/Pagination` | 分页 |
| `Icon` | `@/components/Icon` | 按钮图标 |
| `el-form` / `el-form-item` | Element Plus | 表单 |
| `el-input` | Element Plus | 文本输入 |
| `el-input-number` | Element Plus | 数字输入 |
| `el-select` / `el-option` | Element Plus | 下拉选择 |
| `el-radio-group` / `el-radio` | Element Plus | 单选 |
| `el-switch` | Element Plus | 状态开关 |
| `el-table` / `el-table-column` | Element Plus | 数据表格 |
| `el-button` | Element Plus | 操作按钮 |
| `el-empty` | Element Plus | 空状态 |
| `el-date-picker` | Element Plus | 日期选择 |

样式复用：

- 搜索栏：`class="-mb-15px"`, `label-width="68px"`, `!w-240px`
- 表单弹窗：`label-width="120px"`（标准）或 `"170px"`（复杂表单）
- 表格操作列：`link` 类型按钮，`v-hasPermi` 权限控制
- 金额列：右对齐或居中，保留两位小数

---

### Navigation

#### 菜单配置

后端动态菜单新增两项，挂于 **门店管理** 下：

```
门店管理
├── 门店列表
├── 提现管理
├── 店铺收支明细
├── 分账收款人管理      ← 新增，component: mall/store/profitSharingReceiver/index
└── 分账结算记录        ← 新增，component: mall/store/profitSharingRecord/index
```

> 店铺分账关联配置不单独建菜单，通过「门店列表 > 编辑」进入 `ShopForm.vue` 配置。

#### 路由

后端菜单表新增记录（前端无需硬编码路由）：

| 菜单名 | 路由路径 | 组件路径 | 父菜单 |
|--------|----------|----------|--------|
| 分账收款人管理 | `/profit-sharing-receiver` | `mall/store/profitSharingReceiver/index` | 门店管理 |
| 分账结算记录 | `/profit-sharing-record` | `mall/store/profitSharingRecord/index` | 门店管理 |

---

### Permission

新增权限点：

| 权限标识 | 说明 | 应用页面 |
|----------|------|----------|
| `pay:profit-recipient:create` | 新增分账收款人 | 分账收款人管理页 |
| `pay:profit-recipient:update` | 编辑分账收款人 | 分账收款人管理页 |
| `pay:profit-recipient:delete` | 删除分账收款人 | 分账收款人管理页 |
| `pay:profit-recipient:query` | 查看分账收款人 | 分账收款人管理页 |
| `pay:profit-sharing:query` | 查看分账结算记录 | 分账结算记录页 |
| `pay:profit-sharing:update` | 重试失败分账 | 分账结算记录页 |

> 店铺分账关联配置的编辑权限复用现有 `store:shop:update`。

---

### API Client Patterns

新增两个 API 模块，复用 `withdrawal/index.ts` 和 `storeRevenue/index.ts` 模式：

**`admin/src/api/mall/store/profitSharingReceiver/index.ts`**

```typescript
export interface ProfitSharingReceiverVO {
  id: number
  recipientType: number  // 1=平台级, 2=店铺级
  role: number           // 1=平台, 2=配送方, 3=销售方
  memberType: number     // 1=个人, 2=企业
  shopId?: number
  shopName?: string
  recipientName: string
  memberId: string
  settleAccountBound: number // 0=未绑定, 1=已绑定
  status: number         // 0=禁用, 1=启用
}

export const getProfitSharingReceiverPage = async (params) => { ... }
export const getProfitSharingReceiver = async (id: number) => { ... }
export const createProfitSharingReceiver = async (data) => { ... }
export const updateProfitSharingReceiver = async (data) => { ... }
export const deleteProfitSharingReceiver = async (id: number) => { ... }
export const getProfitSharingReceiverList = async (params) => { ... }
```

**`admin/src/api/mall/store/profitSharingRecord/index.ts`**

```typescript
export interface ProfitSharingRecordVO {
  id: number
  shopId: number
  shopName: string
  orderId: string
  payPrice: number
  commissionAmount: number
  shopAmount: number
  sharingStatus: number  // 0=待分账, 1=分账中, 2=成功, 3=失败, 4=已回退
  fallbackRevenue: number // 0=否, 1=是
  errorMsg?: string
  sharingTime?: string
  createTime: string
}

export const getProfitSharingRecordPage = async (params) => { ... }
export const getProfitSharingRecord = async (id: number) => { ... }
export const retryProfitSharingRecord = async (id: number) => { ... }
```

---

### File Structure

```
admin/src/
├── views/mall/store/
│   ├── profitSharingReceiver/
│   │   ├── index.vue
│   │   └── ProfitSharingReceiverForm.vue
│   ├── profitSharingRecord/
│   │   └── index.vue
│   └── shop/
│       └── ShopForm.vue          ← 修改：新增分账关联字段
├── api/mall/store/
│   ├── profitSharingReceiver/
│   │   └── index.ts
│   └── profitSharingRecord/
│       └── index.ts
```
