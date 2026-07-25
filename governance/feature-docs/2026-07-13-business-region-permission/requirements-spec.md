# 需求规格：business-region、部门与多门店权限模型

## 功能概述

本功能引入基于 `business-region` 的经营区域模型，用于统一门店归属、后台部门数据权限和多门店管理员能力，并为后续小程序商圈切换预留稳定模型。

目标层级为：

```text
租户 -> 部门 -> business-region -> 门店 -> 业务数据
```

其中：

- `business-region` 是租户内的“商圈/经营区域”，本期先用于后台管理和门店归属，后续再用于小程序展示和切换。
- 部门是后台组织管理和数据权限边界。
- 每个租户必须有且只有一个默认 `business-region`。
- 一个 `business-region` 只能归属一个部门。
- 一个部门可以管理多个 `business-region`。
- 一个门店只能归属一个 `business-region`，并继承该 `business-region` 的部门。
- 一个后台用户可以通过用户-门店关系管理一个或多个门店。

## 范围

### 本期范围

- 新增 `business-region` 领域模型和管理能力。
- `business-region` 绑定部门。
- 门店绑定 `business-region`，并从 `business-region` 继承 `dept_id`。
- 将当前“一个管理员只能绑定一个门店”的模型改造为“用户-门店多对多关系”。
- 继续保留所有新增表和查询的租户隔离。
- 复用现有角色数据范围机制实现部门级数据权限。
- 为每个租户创建并维护一个默认 `business-region`。
- 为订单和核心门店业务数据逐步补充 `business_region_id`、`dept_id` 归属字段。
- 从 `yshop_store_shop.admin_id` 逗号字符串平滑迁移到关系表。

### 不在本期范围

- 不修改支付状态、订单状态机和退款状态语义。
- 不修改 DMS 硬件指令协议。
- 不做无法确定规则的历史数据人工重分类。
- 第一阶段不删除 `yshop_store_shop.admin_id` 字段，只废弃其作为主关系的地位。
- 不支持跨租户的 `business-region`。
- 本期不实现小程序端页面、区域切换、按区域下单和小程序端接口联调。

## 功能需求

### FR-1：business-region 管理

- 管理后台支持新增、编辑、删除、启停、分页查询和查看 `business-region`。
- `business-region` 必须属于一个租户和一个部门。
- 每个租户必须存在一个默认 `business-region`。
- 默认 `business-region` 不允许删除；如需停用，必须先指定新的默认 `business-region`。
- `business-region` 的后台查询和操作受部门数据权限约束。

### FR-2：门店归属 business-region

- 创建/编辑门店时必须选择 `business-region`。
- 后端根据所选 `business-region` 自动设置门店 `dept_id`。
- 门店列表和详情展示 `business-region` 与部门信息。
- 门店查询支持按 `business-region` 筛选。
- 门店部门不能由前端独立编辑，只能通过 `business-region` 派生。

### FR-3：多门店管理员

- 一个后台用户可以管理多个门店。
- 一个门店可以绑定多个后台管理员。
- 用户-门店关系以关系表为准，不再以 `admin_id` 逗号字符串为准。
- 迁移期内保留 `admin_id` 字段以兼容旧数据和旧逻辑。
- 门店管理员的后台查询应限制在其可管理门店范围内，除非其角色拥有更高层级权限。

### FR-4：部门数据权限

- 角色数据范围继续作为后台数据权限来源。
- 支持现有五类数据范围：全部、指定部门、本部门、本部门及以下、仅本人。
- 带 `dept_id` 的 `business-region`、门店和核心业务表通过 `DeptDataPermissionRule` 接入部门数据权限。

### FR-5：默认 business-region

- 每个租户初始化时创建一个默认 `business-region`。
- 历史门店迁移时全部挂到租户默认 `business-region`，除非迁移脚本有明确映射规则。
- 后续创建门店时，如管理后台未显式选择区域，后端可按兼容策略使用租户默认 `business-region`；正式表单完成后应强制显式选择。
- 默认 `business-region` 的部门归属默认使用租户根部门或运营部门。

### FR-6：核心业务数据归属

- 新订单和核心门店业务记录在需要直接权限过滤时写入 `business_region_id` 和 `dept_id`。
- 归属字段从门店复制。
- 历史订单快照不可变；回填归属字段不得改变订单状态、支付、退款和财务金额。

## 数据模型需求

### 新增实体

- `business_region`：租户内的经营区域，绑定一个部门。

### 新增关系

- `yshop_store_shop_admin`：后台用户与门店的多对多关系。

### 修改实体

- `yshop_store_shop`：增加 `business_region_id`、`dept_id`。
- 后续逐步修改核心业务表：
  - `yshop_store_order`
  - 设备管理相关表
  - `yshop_store_revenue`
  - `yshop_store_withdrawal`
  - 商品和门店运营相关主表。

## API 需求

### 管理后台 API

- 新增 `/admin-api/business-region/*` 管理接口。
- 门店创建、编辑、列表接口增加 `businessRegionId` 和展示字段。
- 门店管理员分配接口支持一个用户绑定多个门店、一个门店绑定多个用户。
- 当前登录用户信息需要返回可管理门店列表或门店 ID 列表。

### 小程序 API

- 本期暂不新增或改造小程序 API。
- 现有小程序下单链路不要求传入 `businessRegionId`。
- 后端在写入新业务数据时应能根据 `shopId` 派生 `business_region_id` 和 `dept_id`。

## 前端需求

### 管理后台

- 新增 `business-region` 管理页面。
- 门店表单增加 `business-region` 选择器。
- 门店列表展示 `business-region` 和部门。
- 用户/门店分配支持多门店选择。
- 角色数据权限 UI 继续复用现有角色管理能力。

### 小程序

- 本期暂不实现小程序端。
- 后续实现时再补充区域选择入口、状态处理和本地缓存策略。

## 边界场景

| 场景 | 预期行为 |
|---|---|
| `business-region` 下没有门店 | 后台仍可管理该区域；小程序端后续实现时展示空状态。 |
| 门店更换 `business-region` | 门店 `dept_id` 更新为新区域部门；新业务记录使用新归属。 |
| 旧门店没有区域 | 迁移时挂到租户默认 `business-region`。 |
| 用户管理多个门店 | 查询使用 `shop_id IN (...)`，不能只用单个 `shop_id = ?`。 |
| 用户没有分配门店且没有高层级权限 | 门店范围数据为空或操作被拒绝。 |
| 默认 `business-region` 被删除 | 后端拒绝删除，必须先设置新的默认区域。 |
| 请求区域和门店不匹配 | 管理后台写操作或后续小程序接口应被后端拒绝。 |
| 部门权限不可见某区域 | 后台不可查看或操作该区域及其门店。 |

## 验收标准

- [ ] 管理后台可以维护 `business-region` 并绑定部门。
- [ ] 门店创建/编辑必须选择 `business-region`，并自动写入派生 `dept_id`。
- [ ] 角色数据权限可以按部门过滤 `business-region` 和门店。
- [ ] 一个用户可以绑定多个门店。
- [ ] 门店范围后台列表可以展示用户被分配的全部门店数据。
- [ ] 每个租户都有且只有一个默认 `business-region`。
- [ ] 迁移脚本可为现有门店回填租户默认 `business-region`。
- [ ] 所有新增表和查询保持租户隔离。

## 待确认决策

1. 默认 `business-region` 的统一名称。
2. 默认 `business-region` 绑定租户根部门还是指定运营部门。
3. 门店管理员分配第一版做门店维度、用户维度，还是两者都做。
