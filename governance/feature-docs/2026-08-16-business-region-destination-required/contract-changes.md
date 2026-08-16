# 合同变更：商圈启用目的地后强制关联会员地址

## 商圈配置

管理后台商圈创建、更新和查询接口增加：

```json
{
  "enableDestination": true
}
```

用户端商圈列表响应也返回 `enableDestination`。历史商圈默认为 `false`。

## 用户端接口

### `GET /app-api/business-region/destination/list?businessRegionId={id}`

返回指定启用商圈的目的地列表，会员端在商圈启用目的地时用于选择目的地。

### `POST /app-api/address/addAndEdit`

请求增加：

| 字段 | 类型 | 说明 |
|------|------|------|
| `businessRegionId` | Long | 当前地址关联的商圈，用于保存时校验 |
| `destinationId` | Long | 关联目的地；商圈启用目的地时必填 |

地址列表响应增加 `destinationId`。

当请求带有 `businessRegionId` 且该商圈启用目的地时，后端要求 `destinationId` 存在并属于该商圈。订单创建时还会根据门店所属商圈再次校验地址目的地，防止绕过地址接口提交旧地址或跨商圈目的地。

## DB

- `business_region.enable_destination`：是否启用目的地，`0` 否、`1` 是，默认 `0`。
- `yshop_user_address.destination_id`：会员地址关联的目的地 ID，可空。
- 迁移文件：`backend/sql/upgrade-2026-08-16-business-region-destination-required.sql`。
