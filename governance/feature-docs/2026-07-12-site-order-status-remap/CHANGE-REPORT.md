# Site Order Status Remap — Change Report

## Business Result

服务订单状态枚举 (`SiteOrderStatusEnum`) 重新编号，与 `OrderInfoEnum` 对齐。合并「准备中」和「待服务」为一个状态，新增「已拒绝」补全退款路径。

## Affected Repositories

### `backend` — 3 文件

| 文件 | 变更 |
|------|------|
| `SiteOrderStatusEnum.java` | 重编号：删除 `PENDING_SERVICE(1)`，新增 `REFUND_REJECTED(-3)` |
| `AppSiteOrderServiceImpl.java` | `assignStaff()` 不再更新 status；`startSite()` 校验 status=0；`completeSite()` 校验 status=1 |
| `sql/upgrade-2026-07-11-site-order-status-remap.sql` | 新增：DB 数据迁移 |

### `admin` — 2 文件

| 文件 | 变更 |
|------|------|
| `views/site/order/constants.ts` | `SITE_ORDER_STATUS_OPTIONS` 重编号 + 新增「已拒绝」；`getStatusTagType` 适配 |
| `views/site/order/index.vue` | `canStart` → `status === 0`；`canComplete` → `status === 1` |

## Enum Mapping

| 旧 | 新 | 语义 |
|----|----|------|
| `PREPARING(0)` | `PREPARING(0)` | 语义扩大，覆盖原「待服务」 |
| `PENDING_SERVICE(1)` | ❌ 删除 | 合并到 PREPARING |
| `IN_SERVICE(2)` | `IN_SERVICE(1)` | 服务中 |
| `PENDING_REVIEW(3)` | `PENDING_REVIEW(2)` | 待评价 |
| `COMPLETED(4)` | `COMPLETED(3)` | 已完成 |
| — | `REFUND_REJECTED(-3)` | 新增 |
| `REFUNDING(-1)` `REFUNDED(-2)` `CANCELED(-4)` | 不变 | |

## DB Migration

```sql
UPDATE yshop_store_order SET status = 0 WHERE status = 1 AND order_type = 'site';
UPDATE yshop_store_order SET status = 1 WHERE status = 2 AND order_type = 'site';
UPDATE yshop_store_order SET status = 2 WHERE status = 3 AND order_type = 'site';
UPDATE yshop_store_order SET status = 3 WHERE status = 4 AND order_type = 'site';
```

## Verification

| Artifact | Result |
|----------|--------|
| Backend compile | ✅ PASS |
| Admin build | ✅ PASS |
| PENDING_SERVICE 残留 | ✅ 无 |

预存失败项（非本次变更引起）: `DesensitizeTest.test`, admin ts:check 缺少类型定义文件。

## Risks

- **前后端必须同步部署** — 灰度期间新旧混合会导致按钮判断错乱
- DB 迁移依赖 `order_type = 'site'` 精确筛选，建议部署前执行 `SELECT status, COUNT(*) FROM yshop_store_order WHERE order_type = 'site' GROUP BY status` 确认

## Commit

```
feat(site): remap order status values to align with OrderInfoEnum

Merge PREPARING and PENDING_SERVICE into status=0, add REFUND_REJECTED(-3).
assignStaff no longer changes status; audit+staff_id distinguish pre/post-approval.
```
