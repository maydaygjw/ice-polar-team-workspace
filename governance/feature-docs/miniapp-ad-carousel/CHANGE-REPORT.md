# Change Report: miniapp-ad-carousel

## Overview

为小程序扫码页接入广告轮播图，并在轮播图下方构建金刚区（快捷入口网格）。后端复用现有 `yshop_shop_ads` 广告管理模块，通过扩展 `link` 字段和修复查询逻辑来支持，未新建独立模块。

## Affected Repositories & Branches

| Repo | Branch | Base Branch | Status |
|------|--------|-------------|--------|
| workspace root | `main` | — | docs only (no code changes) |
| `backend/` | `feat/miniapp-ad-carousel` | `master` | committed |
| `admin/` | `feat/miniapp-ad-carousel` | `master` | committed |
| `miniapp/` | `feat/miniapp-ad-carousel` | `main` | committed |

## Backend Changes (yshop-drink)

### Database
- **Migration**: `sql/upgrade-miniapp-ad-carousel.sql`
  - `ALTER TABLE yshop_shop_ads ADD COLUMN link VARCHAR(500) DEFAULT NULL COMMENT '跳转链接' AFTER image`

### Java Files Modified
| File | Change |
|------|--------|
| `ShopAdsDO.java` | + `private String link;` |
| `ShopAdsBaseVO.java` | + `@Schema(description="跳转链接") private String link;` |
| `AppShopAdsVO.java` | + `@Schema(description="跳转链接") private String link;` |
| `ShopAdsExcelVO.java` | + `@ExcelProperty("跳转链接") private String link;` |
| `AppAdController.java` | 修复查询：仅返回 `is_switch=1`，按 `weigh DESC, id DESC` 排序；使用 `.and()` 分组 `shopId` OR 条件 |

### API Contract Changes
- `GET /app-api/ad/list?shop_id={id}` 响应新增 `link` 字段，列表过滤和排序逻辑修复

## Admin Changes (yshop-drink-vue)

| File | Change |
|------|--------|
| `AdsForm.vue` | 新增「跳转链接」输入框；`formData` / `resetForm` 包含 `link` |
| `index.vue` | 列表表格新增「跳转链接」列（带 `show-overflow-tooltip`） |
| `api/mall/shop/ads/index.ts` | `AdsVO` 接口新增 `link?: string` |

## MiniApp Changes (icepolarminiapp)

| File | Change |
|------|--------|
| `pages/scan/scan.wxml` | 新增 `quick-access-section`（广告轮播 + 金刚区 5 图标网格） |
| `pages/scan/scan.js` | 新增 `fetchAdList()`、`onAdTap()`、5 个快捷入口导航方法；在 `onLoad` / `onShow` 中拉取广告 |
| `pages/scan/scan.wxss` | 新增轮播和金刚区样式（`ad-banner`、`ad-swiper`、`quick-access-grid` 等） |
| `app.json` | 注册 `pages/webview/webview` |
| `pages/webview/webview.{wxml,js,wxss,json}` | **新建** webview 页面，用于打开广告外部链接 |

### Carousel Configuration
- 高度：`280rpx`，圆角：`24rpx`
- 自动播放间隔：`5000ms`
- 单张广告时：不显示指示点、不自动播放
- 无广告时：隐藏轮播区域

### Quick-Access Grid (金刚区)
| 图标 | 标签 | 目标页面 | 导航方式 |
|------|------|----------|----------|
| `icon-order.svg` | 我的订单 | `pages/orders/orders` | `navigateTo` |
| `icon-coupon.svg` | 优惠券 | `pages/coupons/coupons` | `navigateTo` |
| `ice-machine-icon.svg` | 设备管理 | `pages/device-manage/device-manage` | `navigateTo` |
| `icon-location.svg` | 附近设备 | `pages/map/map` | `switchTab` |
| `icon-partnership.svg` | 合作加盟 | `pages/partnership/partnership` | `navigateTo` |

## Test Coverage

E2E 测试计划已覆盖以下场景：
- Admin 广告 CRUD（含 link 字段）
- 小程序轮播展示（单张/多张/无广告/隐藏）
- 广告点击跳转（有 link / 无 link）
- 金刚区快捷入口导航
- 排序与过滤（`weigh DESC`、`is_switch`）

## Security Check

| 检查项 | 结果 |
|--------|------|
| SQL 注入 | ✅ 使用 LambdaQueryWrapper，无字符串拼接 |
| XSS | ✅ 无用户输入直接渲染到 DOM |
| 硬编码密钥 | ✅ 无 |
| 租户隔离 | ✅ MyBatis Plus `TenantLineInnerInterceptor` 自动注入 `tenant_id` |
| 权限控制 | ✅ Admin API 保留原有权限校验 |

## Review Conclusion

**PASS** — 实现符合需求规范，合约一致，无安全风险，测试计划完整。

## Risks

| 风险 | 等级 | 说明 |
|------|------|------|
| 广告 API 行为变更 | 低 | 原 `GET /ad/list` 未被小程序调用，无存量消费者 |
| webview 页面缺失 | 低 | 已新建 `pages/webview/webview` 并注册到 `app.json` |
| `goToMap()` 使用 `switchTab` | 低 | `pages/map/map` 已在 `tabBar.list` 中，导航方式正确 |
| 图片懒加载兼容性 | 低 | 使用 WeChat 原生 `lazy-load`，基础库版本要求低 |

## Migration Required

执行以下 SQL 迁移脚本后方可上线：

```bash
mysql -u <user> -p <database> < backend/sql/upgrade-miniapp-ad-carousel.sql
```
