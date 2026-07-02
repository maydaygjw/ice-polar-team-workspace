# 合同变更：business-region-permission

## 摘要

本功能引入新的平台业务层级和管理端合同：

```text
租户 -> 部门 -> business-region -> 门店
```

平台级合同发生变更，已同步到 `governance/CONTRACTS.md`。

## 合同层状态

| 层级 | 状态 | 处理 |
|---|---|---|
| 平台层 `CONTRACTS.md` | 已变更 | 增加 `business-region` 层级、部门数据权限和多门店管理员规则。 |
| 功能层 `feature-docs/.../contract-changes.md` | 已变更 | 本文件定义接口级语义。 |
| 机器层 `CONTRACT/backend-api.json` | 待更新 | 后端实现完成后重新生成。 |

## 平台合同变更

### 业务层级

- 一个租户拥有多个部门。
- 每个租户必须有且只有一个默认 `business-region`。
- 一个部门拥有零个或多个 `business-region`。
- 一个 `business-region` 只能归属一个部门。
- 一个门店只能归属一个 `business-region`，并保存继承的部门 ID。
- 小程序用户后续会感知 `business-region`，不感知部门；本期暂不实现小程序端。
- 后台和管理端数据权限使用部门 ID。

### 门店管理员合同

- 一个用户可以管理多个门店。
- 一个门店可以有多个管理员。
- `yshop_store_shop.admin_id` 废弃为主关系。
- 迁移后 `yshop_store_shop_admin` 是用户-门店关系的事实来源。
- 登录态和当前用户上下文必须支持多个可管理门店 ID。

## 新增管理后台 API 合同

### `POST /admin-api/business-region/create`

请求：

```json
{
  "name": "城西商圈",
  "deptId": 103,
  "isDefault": false,
  "status": 0,
  "sort": 10,
  "province": "浙江省",
  "city": "杭州市",
  "district": "西湖区",
  "address": "文三路",
  "lng": "120.123",
  "lat": "30.123"
}
```

响应：

```json
{
  "code": 0,
  "data": 1001,
  "msg": "success"
}
```

### `PUT /admin-api/business-region/update`

请求包含 `id`，其余字段与创建接口一致。

### `GET /admin-api/business-region/page`

查询参数：

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `pageNo` | number | 是 | 页码 |
| `pageSize` | number | 是 | 每页数量 |
| `name` | string | 否 | 名称模糊查询 |
| `deptId` | number | 否 | 部门过滤 |
| `status` | number | 否 | 状态过滤 |

响应项：

```json
{
  "id": 1001,
  "name": "城西商圈",
  "deptId": 103,
  "deptName": "运营一部",
  "isDefault": false,
  "status": 0,
  "sort": 10,
  "province": "浙江省",
  "city": "杭州市",
  "district": "西湖区",
  "address": "文三路",
  "lng": "120.123",
  "lat": "30.123",
  "createTime": "2026-07-02 10:00:00"
}
```

### `GET /admin-api/business-region/simple-list`

返回当前管理员基于部门数据权限可见的启用 `business-region`，用于选择器。

### `PUT /admin-api/business-region/set-default?id=1001`

将指定 `business-region` 设置为当前租户默认商圈。后端必须在同一事务内取消该租户下其他默认商圈，保证每个租户只有一个默认商圈。

## 管理后台门店合同变更

### 门店创建/编辑

现有门店创建/编辑请求新增：

```json
{
  "businessRegionId": 1001
}
```

后端根据 `businessRegionId` 派生 `deptId`。前端不得独立提交 `deptId`。

### 门店响应

门店响应新增：

```json
{
  "businessRegionId": 1001,
  "businessRegionName": "城西商圈",
  "deptId": 103,
  "deptName": "运营一部"
}
```

## 新增门店管理员合同

### `POST /admin-api/store/shop-admin/assign`

请求：

```json
{
  "shopId": 2,
  "userIds": [129, 132, 133]
}
```

### `GET /admin-api/store/shop-admin/list-by-user?userId=129`

响应：

```json
{
  "code": 0,
  "data": [2, 3, 7],
  "msg": "success"
}
```

## 登录/用户信息合同变更

当前管理后台用户信息新增：

```json
{
  "shopId": 2,
  "shopIds": [2, 3, 7]
}
```

兼容规则：

- 迁移期保留 `shopId`。
- 新消费者必须使用 `shopIds`。
- `shopId = 0` 只代表旧逻辑中的“非单门店限制”；新权限判断必须使用 `shopIds` 或角色/租户权限。

## 小程序 API 合同

本期暂不新增或改造小程序 API。现有小程序下单链路不要求传入 `businessRegionId`；后端写入新业务数据时应能根据 `shopId` 派生 `business_region_id` 和 `dept_id`。

以下接口作为后续小程序阶段的候选合同，当前不纳入第一版实现。

### `GET /app-api/business-region/list`

返回当前租户下启用的 `business-region`。

响应：

```json
{
  "code": 0,
  "data": [
    {
      "id": 1001,
      "name": "城西商圈",
      "city": "杭州市",
      "district": "西湖区",
      "address": "文三路",
      "lng": "120.123",
      "lat": "30.123"
    }
  ],
  "msg": "success"
}
```

### `GET /app-api/business-region/shops?businessRegionId=1001`

返回指定 `business-region` 下启用的门店。

### 后续订单创建合同变更

小程序选择 `business-region` 后，订单创建请求应携带 `businessRegionId`。

后端校验：

```text
store_shop.id == shopId
store_shop.business_region_id == businessRegionId
```

创建成功后，后端写入：

- `shop_id`
- `business_region_id`
- `dept_id`

## 复用合同

| 合同 | 状态 | 原因 |
|---|---|---|
| 通用响应 `{code, data, msg}` | 复用 | 平台统一响应结构不变。 |
| 租户隔离 | 复用 | 新表包含 `tenant_id`，现有拦截器继续生效。 |
| 部门数据范围枚举 | 复用 | 现有角色数据范围满足需求。 |
| DMS 调用边界 | 复用 | 小程序仍只调用后端，后端按需调用 DMS；本期不改造小程序。 |

## 不适用合同

| 合同 | 原因 |
|---|---|
| 支付渠道合同 | 不改变微信支付/支付宝回调结构。 |
| DMS 内部 API | `business-region` 是后端经营归属上下文，后续可扩展到小程序，不改变 DMS 指令协议。 |

## 接口快照

后端实现完成后必须重新生成 `governance/CONTRACT/backend-api.json`。第一阶段因代码尚未实现，不能完成机器合同验证。
