# Site Order Status Remap — Contract Changes

## Enum Remap

`SiteOrderStatusEnum` (`yshop-module-site-api`):

```diff
- PREPARING(0, "准备中"),
- PENDING_SERVICE(1, "待服务"),          // 删除
- IN_SERVICE(2, "服务中"),
- PENDING_REVIEW(3, "待评价"),
- COMPLETED(4, "已完成"),
+ PREPARING(0, "准备中"),               // 语义扩展：覆盖原「待服务」
+ IN_SERVICE(1, "服务中"),              // 原值 2→1
+ PENDING_REVIEW(2, "待评价"),          // 原值 3→2
+ COMPLETED(3, "已完成"),              // 原值 4→3
  REFUNDING(-1, "退款中"),              // 不变
  REFUNDED(-2, "已退款"),               // 不变
+ REFUND_REJECTED(-3, "已拒绝"),        // 新增，对齐 OrderInfoEnum.REFUND_STATUS_3
  CANCELED(-4, "已取消"),              // 不变
```

## API Behavior Change

| API (admin) | 变更 |
|-------------|------|
| `POST assignStaff` | 不再更新 `yshop_store_order.status`，仅更新 `yshop_site_order` 的人员字段 |
| `POST startSite` | 前置校验：`status == 1`（PENDING_SERVICE）→ `status == 0`（PREPARING） |
| `POST completeSite` | 前置校验：`status == 2`（IN_SERVICE 旧值）→ `status == 1`（IN_SERVICE 新值） |

## DB Migration

Migration script: `sql/upgrade-YYYY-MM-DD-site-order-status-remap.sql`

Status column in `yshop_store_order` for `order_type='site'` records:

| 操作 | 条件 | 目标值 |
|------|------|--------|
| 1→0 合并 | WHERE status=1 AND order_type='site' | status=0 |
| 2→1 | WHERE status=2 AND order_type='site' | status=1 |
| 3→2 | WHERE status=3 AND order_type='site' | status=2 |
| 4→3 | WHERE status=4 AND order_type='site' | status=3 |

## Frontend Constants

`admin/src/views/site/order/constants.ts` — `SITE_ORDER_STATUS_OPTIONS`:

```diff
- { label: '准备中', value: 0 },
- { label: '待服务', value: 1 },
- { label: '服务中', value: 2 },
- { label: '待评价', value: 3 },
- { label: '已完成', value: 4 },
+ { label: '准备中', value: 0 },
+ { label: '服务中', value: 1 },
+ { label: '待评价', value: 2 },
+ { label: '已完成', value: 3 },
+ { label: '退款中', value: -1 },
+ { label: '已退款', value: -2 },
+ { label: '已拒绝', value: -3 },
+ { label: '已取消', value: -4 },
```

Button guards in `index.vue`:

```diff
- canStart: row.status === 1 && row.auditStatus === 1 && !!row.staffId
+ canStart: row.status === 0 && row.auditStatus === 1 && !!row.staffId
- canComplete: row.status === 2
+ canComplete: row.status === 1
```

## Unchanged Contracts

- `OrderInfoEnum`（框架通用层）— N/A
- `SiteOrderAuditStatusEnum` — N/A
- `SiteOrderPayStatusEnum` — N/A
- 小程序 API 契约 — N/A
- 权限/租户/数据范围 — N/A
- MQ / 外部系统 — N/A
