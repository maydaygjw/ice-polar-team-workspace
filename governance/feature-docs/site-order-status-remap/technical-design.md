# Site Order Status Remap — Technical Design

## Architecture Decision

**选择**：直接在 `SiteOrderStatusEnum` 中重新编号，删除 `PENDING_SERVICE(1)` 枚举项。

**理由**：`PREPARING` 和 `PENDING_SERVICE` 在业务上是一个过渡阶段（分配技师是内部动作，对 C 端用户无感知），合并到同一个 status=0 消除了不必要的状态跳变，同时也与 `OrderInfoEnum` 的编号体系对齐。

**替代方案（已否决）**：保留 `PENDING_SERVICE` 但改变其数值。这会导致更多隐式映射，不如直接合并更干净。

## Key Decisions

1. **`assignStaff()` 不再更新 `status`**。分配技师仅修改 `yshop_site_order.staff_id/staff_name/staff_mobile`，status 保持在 0。
2. **创建订单后 status 仍为 0**，审核前后通过 `audit_status` + `staff_id` 组合区隔（见下图），无需用 status 码来隔离「待服务」阶段。
3. **新增 `REFUND_REJECTED(-3)`**，对齐 `OrderInfoEnum.REFUND_STATUS_3(3, "已拒绝")`，补全退款/取消路径。
4. **负值状态（-1/-2/-4）不受影响**，仅在中间插入 -3。
5. **`OrderInfoEnum` 不做任何修改**。这是框架通用层，服务订单不直接依赖它。

### 审核前后区分逻辑

合并 `PREPARING(0)` + `PENDING_SERVICE(1)` 后，原「待服务」阶段的语义通过组合条件表达：

| status | audit_status | staff_id | 阶段 |
|--------|-------------|----------|------|
| 0 | 0 | — | 等待审核 |
| 0 | 2 | — | 审核拒绝，用户可修改 |
| 0 | 1 | null | 审核通过，等待分配 |
| 0 | 1 | 已设置 | 审核通过，已分配，**可开始服务** |

前端 `canStart` 判断：`row.status === 0 && row.auditStatus === 1 && !!row.staffId`

## Contracts Changed

### Enum Contract

| 旧 | 新 | 说明 |
|----|----|------|
| `PREPARING(0)` | `PREPARING(0)` | 语义扩展：覆盖原「待服务」阶段 |
| `PENDING_SERVICE(1)` | ❌ 删除 | 语义合并到 PREPARING |
| `IN_SERVICE(2)` | `IN_SERVICE(1)` | 值变更 |
| `PENDING_REVIEW(3)` | `PENDING_REVIEW(2)` | 值变更 |
| `COMPLETED(4)` | `COMPLETED(3)` | 值变更 |
| `REFUNDING(-1)` | `REFUNDING(-1)` | 不变 |
| `REFUNDED(-2)` | `REFUNDED(-2)` | 不变 |
| — | **`REFUND_REJECTED(-3)`** | **新增**，对齐 `OrderInfoEnum.REFUND_STATUS_3` |
| `CANCELED(-4)` | `CANCELED(-4)` | 不变 |

### API Behavior Change

| API | 旧行为 | 新行为 |
|-----|--------|--------|
| `assignStaff` | status→1 | 仅改 staff 字段，status 不变 |
| `startSite` | 校验 status=1 | 校验 status=0 |
| `completeSite` | 校验 status=2 | 校验 status=1 |

> 前端通过 `status` + `staffId` + `auditStatus` 联合判断可操作按钮，不依赖 status 的独立语义。

### DB Migration

```sql
-- upgrade-YYYY-MM-DD-site-order-status-remap.sql
UPDATE yshop_store_order SET status = 0 WHERE status = 1 AND order_type = 'site';
UPDATE yshop_store_order SET status = 1 WHERE status = 2 AND order_type = 'site';
UPDATE yshop_store_order SET status = 2 WHERE status = 3 AND order_type = 'site';
UPDATE yshop_store_order SET status = 3 WHERE status = 4 AND order_type = 'site';
```

`order_type='site'` 验证通过：`SiteOrderMapper.xml` 已使用 `o.order_type = 'site'` 过滤。

### Permission / Tenant

无变更。

## Implementation Plan

### Step 1: DB Migration Script

创建 `sql/upgrade-YYYY-MM-DD-site-order-status-remap.sql`

### Step 2: Backend Enum

修改 `SiteOrderStatusEnum.java`：重编号，删除 `PENDING_SERVICE`

### Step 3: Backend Service

修改 `AppSiteOrderServiceImpl.java`：
- `assignStaff()` 删除 `orderApi.updateOrderStatus(orderId, PENDING_SERVICE)`
- `cancelSiteOrder()` / `updateRejectedSiteOrder()` 校验 `PREPARING.getStatus()` 不变
- `startSite()` 校验改为 `PREPARING.getStatus()`
- `completeSite()` 校验改为 `IN_SERVICE.getStatus()`

### Step 4: Admin Frontend

修改 `constants.ts` + `index.vue` 的状态值和按钮判断逻辑

## Rollback Plan

回滚 SQL：
```sql
UPDATE yshop_store_order SET status = 4 WHERE status = 3 AND order_type = 'site';
UPDATE yshop_store_order SET status = 3 WHERE status = 2 AND order_type = 'site';
UPDATE yshop_store_order SET status = 2 WHERE status = 1 AND order_type = 'site';
-- status=0 未变，但无法区分原 PREPARING 和从 PENDING_SERVICE 回滚过来的
-- 最坏情况：全部 status=0 的服务订单保留为 PREPARING，人员可重新分配
```

回滚代码：Git revert。

## Risk Mitigation

- **前后端必须同步部署**。灰度期间新前端 + 旧后端会导致「开始服务」「完成服务」按钮判断错乱。
- **迁移前检查**：
  ```sql
  SELECT status, COUNT(*) FROM yshop_store_order WHERE order_type = 'site' GROUP BY status;
  ```
