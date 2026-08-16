# 合同变更：商圈目的地维护

## API

所有接口实际挂在管理后台 `/admin-api` 前缀下，前端 client 使用去掉网关前缀的路径。

### `POST /admin-api/business-region/destination/create`

请求字段：

```json
{
  "businessRegionId": 1001,
  "name": "城西医院 1 号楼",
  "code": "HOSPITAL-B1",
  "address": "浙江省杭州市西湖区文三路 1 号",
  "detailAddress": "住院部 1 号楼",
  "lng": "120.123",
  "lat": "30.123",
  "tags": "医院,住院部",
  "sort": 10
}
```

响应为 `CommonResult<Long>`。

### `PUT /admin-api/business-region/destination/update`

请求字段同创建接口并增加 `id`；响应为 `CommonResult<Boolean>`。

### `DELETE /admin-api/business-region/destination/delete?id={id}`

响应为 `CommonResult<Boolean>`。

### `GET /admin-api/business-region/destination/get?id={id}`

响应项包含 `id`、`businessRegionId`、`name`、`code`、`address`、`detailAddress`、`lng`、`lat`、`tags`、`sort` 和 `createTime`。其中 `address` 为地图取点返回的地址，`detailAddress` 为可选的人工填写地址，仅用于记录。

### `GET /admin-api/business-region/destination/page`

查询参数：`pageNo`、`pageSize`、`businessRegionId`（必填）、`name`、`code`。响应为标准分页结果。

业务错误：目的地不存在返回现有错误响应；商圈不存在、租户不匹配或部门数据权限不可见时拒绝请求。

## DB

- 新增 `business_region_destination` 表。
- 字段：`id`、`tenant_id`、`business_region_id`、`dept_id`、`name`、`code`、`address`、`detail_address`、`lng`、`lat`、`tags`、`sort`、`creator`、`create_time`、`updater`、`update_time`、`deleted`。
- 索引：`(tenant_id, business_region_id, sort)` 和 `(tenant_id, business_region_id, code)`。
- 迁移文件：初始表结构使用已锁定的 `backend/sql/upgrade-2026-08-05-business-region-destination.sql`；历史环境补充 `detail_address` 字段使用 `backend/sql/upgrade-2026-08-17-business-region-destination-detail-address.sql`。
- 回滚：删除该表及其索引；该操作会删除目的地维护数据，仅允许在部署回滚场景执行。

## 权限与数据范围

- 复用 `store:business-region:query/create/update/delete`。
- 新表注册到 store 模块 `DeptDataPermissionRule` 的 `dept_id` 列映射。
- `dept_id` 始终由后端从所属商圈复制，前端不提交可编辑的部门字段。

## 机器快照

`governance/CONTRACT/backend-api.json` 未在本地更新：仓库的 OpenAPI 生成 profile 要求本地 MySQL、Redis 和 8888 端口可用；本次仅完成静态编译和单元测试，部署环境可用后应按 `governance/CONTRACT/README.md` 重新生成快照。
