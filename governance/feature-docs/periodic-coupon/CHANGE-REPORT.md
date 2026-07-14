# CHANGE-REPORT — 普通券与周期券

## Summary

- 新增普通券/周期券类型。
- 周期券支持发放起止时间、每 N 天发放一次，并强制领取后有效期 X 天。
- 同一用户在同一发放周期最多领取一次，下一周期可再次领取。
- 周期券固定为无码/页面领取，不生成通用码或一卡一码。
- 管理端新增券类型、发放周期配置和列表展示；不新增前台展示开关。

## Repositories

- `backend`：新增字段、周期领取校验、领取周期记录、唯一索引和迁移脚本。
- `admin`：新增周期券配置表单及列表券类型展示。

## Contracts

- 创建/修改优惠券请求新增 `couponKind`、`issueCycleDays`。
- 周期券使用现有 `takingEffectTime`、`expirationTime` 作为领取窗口，`expirationType` 固定为 `2`。
- 领取关系新增可空 `periodDate`；普通券保持为空。

## Migration

执行 `backend/sql/upgrade-2026-07-14-periodic-coupon.sql`，包含回滚语句。

## Verification

- 后端编译通过。
- 周期计算单元测试 3/3 通过。
- 管理端目标文件 ESLint 通过，生产构建通过。
- 完整后端测试被既有 `DesensitizeTest` 失败阻断；管理端 `ts:check` 被既有类型声明缺失阻断，详见 `test-notes.md`。

## Risks

- 周期券库存仍为全局库存，不按周期重置。
- 周期券不支持兑换码入口。
- OpenAPI 静态快照需在目标环境重新生成。

## Suggested PR

`feat(coupon): support periodic coupons`
