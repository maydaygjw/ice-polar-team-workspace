# 契约变更：订单渠道与推荐人记录

## API

### App 下单接口

| 属性 | 变更 |
|---|---|
| 方法 | `POST` |
| 路径 | `/app-api/order/create` |
| 变更类型 | 向后兼容扩展 |
| 新增参数 | `channelCode`、`referrerUserId`，均可选 |
| 返回 | 不变，不返回新增字段 |
| 鉴权 | 沿用现有登录鉴权 |

请求字段：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---:|---|
| `channelCode` | String | 否 | 渠道标识，最大 64 字符；空字符串按未传处理 |
| `referrerUserId` | Long | 否 | 推荐人用户 ID；必须属于当前租户，且不能是下单用户 |

### Admin 下单接口

| 属性 | 变更 |
|---|---|
| 方法 | `POST` |
| 路径 | `/admin-api/order/store-order/create` |
| 变更类型 | 向后兼容扩展 |
| 新增参数 | `channelCode`、`referrerUserId`，均可选 |
| 返回 | 不变 |
| 权限 | 沿用现有订单创建权限；推荐人校验规则与 App 下单一致 |

### Admin 订单推广查询接口

| 属性 | 约定 |
|---|---|
| 方法 | `GET` |
| 路径 | `/admin-api/order/store-order/promotion-page` |
| 权限 | `order:store-order:query` |
| 范围 | 仅查询 `yshop_store_order` 中渠道标识或推荐人非空的记录；积分订单使用独立订单表 |
| 参数 | `channelCode`、`referrerUserId`、`uid`、`orderId`、`createTime`、`pageNo`、`pageSize` |
| 返回 | 订单推广专用分页 VO，包含页面展示所需归因字段；不改变普通订单 App 响应 |

### 内部订单 API

统一订单 API 的下单 DTO 增加同名可选字段，保证以下调用方透传：

- 家政服务模块 → `OrderApi#createAppOrder`
- 设备订单模块 → `OrderApi#createAppOrder`
- 其他使用统一订单 API 创建 `yshop_store_order` 的业务模块

桌面预约订单 DTO 同步增加同名字段，保证桌面预约创建的预约订单也能透传归因信息。

内部接口返回值不变。

## DB

目标表：`yshop_store_order`

| 字段 | 类型 | 可空 | 说明 |
|---|---|---:|---|
| `channel_code` | `varchar(64)` | 是 | 订单来源渠道标识 |
| `referrer_user_id` | `bigint` | 是 | 推荐人用户 ID |

建议索引：

- `(tenant_id, referrer_user_id)`，支持后续按租户查询推荐关系。
- `(tenant_id, channel_code)`，支持后续按租户统计渠道订单。

迁移脚本：

```text
backend/sql/upgrade-2026-09-06-order-attribution.sql
```

管理端菜单脚本：

```text
backend/sql/upgrade-2026-09-06-order-promotion-menu.sql
```

迁移必须使用可空字段，不能改写 `backend/sql/yixiang-drink.sql`。本次为非破坏性新增字段，回滚为删除新增索引和字段；执行回滚前应确认没有依赖这两个字段的返佣数据。

## 权限与数据范围

- 推荐人校验必须在当前租户上下文内执行。
- 用户没有商圈归属概念，不校验推荐人与订单门店的商圈关系。
- 不因新增字段放宽现有订单查询、租户隔离或数据权限。
- 新增字段不向 App 订单列表和详情响应暴露。

## MQ / 外部系统 / 依赖

N/A：本次不新增消息、外部系统或第三方依赖；字段仅随订单创建链路持久化。

## 兼容性与机器契约

- 未传字段的现有调用方保持兼容。
- 实现完成后重新生成并收集 backend OpenAPI 快照；实现前不手工修改机器快照。
- 不新增错误码；推荐人校验复用现有参数/业务校验错误语义，具体错误文案在实现阶段与现有规范保持一致。
