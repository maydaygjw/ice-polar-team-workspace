# CHANGE-REPORT — 普通券与周期券（重新实现方案）

## Summary

- 修正周期券模型：周期券新增独立的发放起止时间。
- 发放窗口内按 `issueCycleDays` 分周期发放，同一用户每周期最多领取一次，跨周期可再次领取；每次领取生成一张独立用户券和一条领取关系。
- `taking_effect_time`、`expiration_time` 保留为领取后用户券有效起止时间，不再承担发放窗口语义。
- 周期券用券时间固定为“领取后立即生效，有效期 X 天”，固定时间和无限制时间不可选。
- 保持领取关系表逻辑不变，不新增周期日期字段、周期桶或周期唯一索引。
- 用户券发放时固化 `taking_effect_time`、`expiration_time`，后续统一按用户券自身起止时间判断有效性。
- 周期券固定为无码/页面领取，不生成通用码或一卡一码。
- 管理端新增券类型、发放时间配置和列表展示；不新增前台展示开关。

## Repositories

- `backend`：新增券类型、发放起止时间字段、用户券有效期快照字段和发放窗口校验；领取/核销关系逻辑保持不变。
- `admin`：新增周期券发放时间配置及列表券类型展示。

## Contracts

- 创建/修改优惠券请求新增 `couponKind`、`issueStartTime`、`issueEndTime`。
- 周期券请求新增 `issueCycleDays`，按发放开始时间切分领取周期。
- 创建/修改优惠券请求新增店铺范围配置，支持不限制、指定多店铺和排除多店铺。
- 优惠券必须绑定一个商圈；店铺范围限定在该商圈内。
- 周期券使用 `issueStartTime`、`issueEndTime` 作为领取窗口；`takingEffectTime`、`expirationTime` 仍表示领取后用户券有效期。
- 领取关系表新增 `taking_effect_time`、`expiration_time` 快照字段；重复领取通过多条关系记录表达。

## Migration

实现阶段已创建 `backend/sql/upgrade-2026-07-15-periodic-coupon.sql`，新增券类型、发放窗口、商圈/店铺范围和领取关系有效期快照字段，并包含回滚语句。

## Verification

- 已完成后端 coupon 模块 clean compile，以及订单模块 clean compile。
- 已完成管理端优惠券相关文件 ESLint 校验和 `pnpm build:local`；`pnpm ts:check` 仍受仓库既有 tsconfig 类型入口缺失影响，未进入业务源码检查。
- 尚未执行真实数据库迁移和接口集成测试，新的验证要求见 `test-notes.md`。

## Risks

- 周期券库存仍为全局库存，不按时间窗口重置。
- 周期领取频率依赖发放开始时间和 `issueCycleDays`；不新增周期日期字段或周期唯一索引。
- 店铺范围与商品范围独立，领券和用券链路统一执行店铺包含/排除判断。
- 商圈和门店归属执行租户及数据权限校验，历史单店铺券回填商圈。
- 周期券不支持兑换码入口。
- OpenAPI 静态快照需在实现后重新生成。

## Suggested PR

`feat(coupon): rework periodic coupon issuance`
