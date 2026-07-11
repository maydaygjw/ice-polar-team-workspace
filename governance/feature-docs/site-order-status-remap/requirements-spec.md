# Site Order Status Remap — Requirements Spec

## Scope

将 `SiteOrderStatusEnum` 的正向状态值重新映射，与 `OrderInfoEnum`（`yshop-framework/yshop-common`）对齐。

- **变更范围**：后端 `yshop-module-site` + Admin 前端 `views/site/order/`
- **不变**：负值状态（退款/取消）、审核状态、支付状态、小程序、DMS
- **废弃语义**：「待服务」作为独立状态取消，合并到 `status=0`

## 状态值映射

| 语义 | 当前值 | 新值 | OrderInfoEnum 对齐 |
|------|--------|------|---------------------|
| 准备中（原准备中 + 待服务） | 0 / 1 | **0** | `STATUS_0` 默认 |
| 服务中 | 2 | **1** | `STATUS_1` 待收货 |
| 待评价 | 3 | **2** | `STATUS_2` 已收货 |
| 已完成 | 4 | **3** | `STATUS_3` 已完成 |
| 退款中 | -1 | -1 ✅ | `STATUS_NE1` 申请退款 |
| 已退款 | -2 | -2 ✅ | `STATUS_NE2` 退款成功 |
| **已拒绝（新增）** | — | **-3** | `REFUND_STATUS_3` 已拒绝 |
| 已取消 | -4 | -4 ✅ | — |

## Lifecycle（新）

```
创建 → 0(准备中/待服务) → 开始服务 → 1(服务中) → 完成 → 2(待评价) → 3(已完成)
              ↑                                         ↓
       审核通过 + 分配技师                      退款中(-1) → 已退款(-2)
                                                         → 已拒绝(-3)
                                                         → 已取消(-4)
```

### 审核前后如何区分

`PREPARING(0)` + `PENDING_SERVICE(1)` 合并后，审核前后通过 `audit_status` + `staff_id` 组合完全可区隔，无需 status 来隔离：

| status | audit_status | staff_id | 阶段 |
|--------|-------------|----------|------|
| 0 | 0(待审核) | null | 刚创建，等待审核 |
| 0 | 2(已拒绝) | null | 审核拒绝，用户可修改 |
| 0 | 1(审核通过) | null | 审核通过，等待分配技师 |
| 0 | 1(审核通过) | 已设置 | 审核通过+已分配，**可开始服务** |

原 `PENDING_SERVICE(1)` = `audit_status=1 + staff_id IS NOT NULL + status=0`。前端 `canStart` 判断改为 `row.status === 0 && row.auditStatus === 1 && !!row.staffId`。

## Affected Repositories

### Backend (`yshop-drink`)

| 文件 | 变更 |
|------|------|
| `SiteOrderStatusEnum.java` | 删除 `PENDING_SERVICE(1)`，重新编号 |
| `AppSiteOrderServiceImpl.java` | 移除 `PENDING_SERVICE` 引用；`assignStaff()` 不再更新 status |

### Admin Frontend (`yshop-drink-vue`)

| 文件 | 变更 |
|------|------|
| `views/site/order/constants.ts` | 更新 `SITE_ORDER_STATUS_OPTIONS`、`getStatusTagType()` |
| `views/site/order/index.vue` | 更新 `canStart`、`canComplete` 状态判断值 |

### Not Affected

- MiniApp（通过 `statusDto.title` 字符串匹配，不依赖数字值）
- DMS（不涉及服务订单）
- 审核状态 (`SiteOrderAuditStatusEnum`)、支付状态 (`SiteOrderPayStatusEnum`)
- OrderInfoEnum 本身（不改动框架通用层）

## Database Migration

```sql
-- yshop_store_order 表中服务订单的 status 列迁移
-- 前提：能通过 order_type='site' 精确筛选服务订单
UPDATE yshop_store_order SET status = 0 WHERE status = 1 AND order_type = 'site';  -- 待服务→准备中
UPDATE yshop_store_order SET status = 1 WHERE status = 2 AND order_type = 'site';  -- 服务中
UPDATE yshop_store_order SET status = 2 WHERE status = 3 AND order_type = 'site';  -- 待评价
UPDATE yshop_store_order SET status = 3 WHERE status = 4 AND order_type = 'site';  -- 已完成
```

## Acceptance Criteria

1. 后端编译通过，site-module 测试全部通过
2. Admin 前端 `pnpm ts:check && pnpm build:prod` 通过
3. 创建订单 → status 为 0
4. 分配技师 → 仅改 staffId，status 仍为 0
5. 开始服务 → status 变为 1（旧 2）
6. 完成服务 → status 变为 2（旧 3）
7. 订单列表筛选、详情页状态标签正确显示
8. 已有服务订单数据迁移后状态语义正确

## Assumptions

- `yshop_store_order.order_type = 'site'` 能精确区分服务订单，迁移 SQL 不会误伤商城订单
- 无外部系统或 MQ 消息依赖具体的 status 数值
- 无 Redis 缓存的 status 值需要刷新

## Risks

- **High**: 破坏性数据库变更，前后端部署需同步
- 灰度期间新旧代码混合会导致服务订单 status 解读错误
- 迁移 SQL 若无法精确筛选服务订单，会误伤商城订单
