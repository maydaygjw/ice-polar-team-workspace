# 合同变更：会员地址持久化商圈并按商圈选择目的地

## 地址关联规则

- 会员地址新增 `businessRegionId`，直接保存地址所属商圈。
- `destinationId` 必须属于 `businessRegionId`；目的地选择器必须在商圈选定后加载。
- 历史地址的 `businessRegionId` 允许为空；已有 `destinationId` 的历史地址由迁移脚本回填商圈。
- 新增或编辑地址时，传入的商圈和目的地必须属于当前租户且处于可用状态。

## 用户端接口

### `POST /app-api/address/addAndEdit`

请求字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| `businessRegionId` | Long | 地址所属商圈；新地址必填 |
| `destinationId` | Long | 商圈下的目的地；商圈启用目的地时必填 |

地址列表响应增加 `businessRegionId`，继续返回 `destinationId`。

## 管理端接口

`/admin-api/member/user-address/get`、`/page`、`/create`、`/update` 的地址 DTO 增加 `businessRegionId`。

管理端地址编辑流程为：先选择商圈，再加载并选择该商圈下的目的地；列表显示商圈和目的地。

## DB

- `yshop_user_address.business_region_id`：地址所属商圈 ID，可空以兼容历史数据。
- 已有地址通过 `destination_id -> business_region_destination.business_region_id` 回填。
- 迁移文件：`backend/sql/upgrade-2026-08-17-member-address-business-region.sql`。
