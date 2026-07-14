# 契约变更 — 普通券与周期券

## API

现有端点保持不变，创建/修改优惠券请求新增字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `couponKind` | Integer | `1` 普通券，`2` 周期券；缺省按普通券 |
| `issueCycleDays` | Integer | 周期券每 N 天可领取一次，必须大于 0 |
| `takingEffectTime` | datetime | 周期券发放开始时间 |
| `expirationTime` | datetime | 周期券发放截止时间 |
| `expirationType` | Integer | 周期券必须为 `2`（领取后有效期） |
| `expirationDay` | Long | 周期券领取后有效天数，必须大于 0 |
| `getType` | Integer | 周期券必须为 `0`（无码/页面领取） |

周期券配置不合法时返回优惠券配置错误；周期外或周期内重复领取分别返回不可领取/已达周期领取上限语义。

## Database

升级脚本：`backend/sql/upgrade-2026-07-14-periodic-coupon.sql`

- `yshop_store_product_coupon.coupon_kind`：默认 `1`。
- `yshop_store_product_coupon.issue_cycle_days`：周期券发放间隔天数。
- `yshop_store_product_coupon_relation.period_date`：周期券当前发放周期日期，可为空。
- 唯一索引：`(coupon_id, uid, period_date)`；普通券的 NULL 值不改变历史多次关系行为。

脚本包含回滚语句。

## 权限与租户

复用现有优惠券管理权限和租户隔离，不新增权限。周期领取关系沿用现有优惠券关系表的租户字段和 MyBatis 租户拦截器。
