# 契约变更 — 普通券与周期券（重新实现）

## API

现有端点保持不变，创建/修改优惠券请求新增字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `couponKind` | Integer | `1` 普通券，`2` 周期券；缺省按普通券 |
| `businessRegionId` | Long | 必填；优惠券所属商圈，一张券只能选择一个商圈 |
| `issueStartTime` | datetime | 周期券发放开始时间；仅用于判断可领取窗口 |
| `issueEndTime` | datetime | 周期券发放结束时间；仅用于判断可领取窗口 |
| `issueCycleDays` | Integer | 周期券每个领取周期的自然日长度，必须大于 `0`；周期起点为 `issueStartTime` |
| `shopScopeType` | Integer | 店铺范围：`1` 不限制，`2` 指定店铺，`3` 排除店铺 |
| `shopIds` | Long[] | 指定或排除的店铺 ID；不限制模式为空；指定/排除模式至少一个 |
| `takingEffectTime` | datetime | 普通券固定时间有效期字段；用户券发放后为该张券固化的生效时间，不表示发放开始时间 |
| `expirationTime` | datetime | 普通券固定时间有效期字段；用户券发放后为该张券固化的失效时间，不表示发放结束时间 |
| `expirationType` | Integer | 周期券固定为 `2`（领取后立即生效） |
| `expirationDay` | Long | 周期券模板的领取后有效天数，必须大于 `0`；仅用于发放时计算用户券有效期 |
| `getType` | Integer | 周期券必须为 `0`（无码/页面领取） |

周期券配置不合法时返回优惠券配置错误；发放窗口外返回不可领取语义。同一周期内重复领取返回已达当前周期领取上限；进入下一周期后按现有库存和用户累计领取限制创建新的领取关系，并固化该张用户券的有效起止时间。后端必须拒绝周期券使用固定时间或无限制时间。

周期券必须提供 `issueCycleDays`。同一用户在同一周期内重复领取返回已达当前周期领取上限；进入下一周期后可以再次领取。系统不落库周期日期，不新增 `periodDate` 或周期唯一索引。

店铺范围配置与商品范围独立，且限定在 `businessRegionId` 内。`shopScopeType=1` 时不限制店铺且 `shopIds` 为空，表示该商圈内所有店铺适用；`shopScopeType=2` 时仅 `shopIds` 中且属于该商圈的店铺适用；`shopScopeType=3` 时该商圈内除 `shopIds` 外的店铺适用。商圈和店铺 ID 必须通过租户和数据权限校验。

用户券查询和购物车可用券接口返回的 `takingEffectTime`、`expirationTime` 必须来自领取关系表的有效期快照。`expirationDay` 仅是券模板配置，不再作为已发放用户券的有效性判断依据；如旧 DTO 继续返回该字段，仅作兼容展示，不得参与计算。

## Database

计划升级脚本：`backend/sql/upgrade-2026-07-15-periodic-coupon.sql`；实现时不得修改初始化 SQL，脚本需包含回滚语句。

- `yshop_store_product_coupon.coupon_kind`：默认 `1`。
- `yshop_store_product_coupon.business_region_id`：必填商圈 ID。
- `yshop_store_product_coupon.issue_start_time`：周期券发放开始时间。
- `yshop_store_product_coupon.issue_end_time`：周期券发放结束时间。
- `yshop_store_product_coupon.issue_cycle_days`：周期券领取周期长度，必须为正整数。
- `yshop_store_product_coupon.shop_scope_type`：店铺范围类型，默认兼容旧单店铺模式；新数据取值 `1` 不限制、`2` 指定、`3` 排除。
- `yshop_store_product_coupon.shop_scope_values`：指定或排除的店铺 ID 集合。
- `yshop_store_product_coupon.taking_effect_time`、`expiration_time`：保留原字段，不改名、不复用为发放时间；继续作为普通券模板的固定有效期配置。
- `yshop_store_product_coupon_relation.taking_effect_time`：新增，保存该张用户券固化后的生效时间。
- `yshop_store_product_coupon_relation.expiration_time`：新增，保存该张用户券固化后的失效时间；无限期券允许为空。
- `yshop_store_product_coupon_relation`：不新增周期字段或周期唯一索引；领取、核销和多次领取关系逻辑保持不变。

旧 `shop_id` 数据保持兼容；迁移或读取时按原单店铺语义映射为指定店铺，并根据门店归属回填 `business_region_id`。新接口不得继续把单个 `shopId` 作为唯一店铺范围表达。

脚本包含回滚语句。

## 权限与租户

复用现有优惠券管理权限和租户隔离，不新增权限。周期领取关系沿用现有优惠券关系表的租户字段和 MyBatis 租户拦截器；每次领取插入一条普通领取关系记录。
