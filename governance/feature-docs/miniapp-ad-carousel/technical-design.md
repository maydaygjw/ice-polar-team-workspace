# Technical Design: MiniApp Ad Carousel Banner

## Overview

Add a carousel ad banner (轮播广告图) to the miniapp scan page (`pages/scan/scan`), reusing the existing `yshop_shop_ads` backend feature. The banner displays active ads for the current shop, supports auto-play, and allows tapping to navigate to an external link.

## Key Technical Decisions

1. **No new module** — Extend existing `yshop_shop_ads` table and CRUD instead of creating a new ad module.
2. **Add `link` column** — Required for clickable ads. The existing table only stores `image` with no navigation target.
3. **Fix app API filtering** — `GET /ad/list` currently returns ALL ads regardless of `is_switch` and does NOT order by `weigh`. Both must be fixed for a usable carousel.
4. **No ADR required** — This extends an existing pattern (image ads → clickable carousel). No new architectural pattern is introduced.

---

## Database Changes

### Migration Script

Create `sql/upgrade-miniapp-ad-carousel.sql`:

```sql
-- Add link column for clickable ads
ALTER TABLE `yshop_shop_ads`
  ADD COLUMN `link` VARCHAR(500) DEFAULT NULL COMMENT '跳转链接' AFTER `image`;
```

> **Rule compliance**: Per `governance/CLAUDE.md` red lines, never modify `sql/yixiang-drink.sql` directly; always create `sql/upgrade-*.sql`.

### Schema After Change

| Column | Type | Comment |
|--------|------|---------|
| `id` | bigint PK | |
| `image` | varchar(255) | Ad image URL |
| `link` | varchar(500) NEW | External/internal navigation link |
| `is_switch` | tinyint(1) | 1 = visible, 0 = hidden |
| `weigh` | int | Sort weight (higher = earlier) |
| `shop_id` | varchar(500) | Comma-separated shop IDs; `0` = all shops |
| `shop_name` | varchar(1000) | Derived shop name(s) |
| `tenant_id` | bigint | Tenant isolation |
| `deleted` | bit(1) | Soft delete |

---

## API Changes

### 1. App API — `GET /ad/list` (Modified)

**Current behavior**: Returns all ads for a shop (including `is_switch=0`), unordered.

**New behavior**:
- Filter: `is_switch = 1` only
- Order: `weigh DESC, id DESC`
- Response includes `link` field

**Response shape** (unchanged envelope):
```json
{
  "code": 0,
  "data": {
    "list": [
      { "id": 1, "image": "https://...", "link": "https://..." }
    ],
    "isActive": true
  }
}
```

### 2. Admin API — No endpoint changes

Existing CRUD (`/shop/ads/*`) continues to work. The `link` field is included in create/update payloads via VO changes (see below).

---

## Module Impact

| Module | Files | Change Type |
|--------|-------|-------------|
| `backend/yshop-module-mall/yshop-module-shop-biz` | DO, VO, Convert, Controller, Service | Extend |
| `admin/src/views/mall/shop/ads` | `AdsForm.vue`, `index.vue`, API types | Extend |
| `miniapp/pages/scan` | `scan.wxml`, `scan.js`, `scan.wxss` | Extend |

---

## Backend Changes

### 1. Data Object

**File**: `backend/yshop-module-mall/yshop-module-shop-biz/src/main/java/co/yixiang/yshop/module/shop/dal/dataobject/shopads/ShopAdsDO.java`

Add field:
```java
/**
 * 跳转链接
 */
private String link;
```

### 2. Admin Base VO

**File**: `backend/yshop-module-mall/yshop-module-shop-biz/src/main/java/co/yixiang/yshop/module/shop/controller/admin/shopads/vo/ShopAdsBaseVO.java`

Add field:
```java
@Schema(description = "跳转链接")
private String link;
```

### 3. App Response VO

**File**: `backend/yshop-module-mall/yshop-module-shop-biz/src/main/java/co/yixiang/yshop/module/shop/controller/app/ad/vo/AppShopAdsVO.java`

Add field:
```java
@Schema(description = "跳转链接")
private String link;
```

### 4. Convert Interface

**File**: `backend/yshop-module-mall/yshop-module-shop-biz/src/main/java/co/yixiang/yshop/module/shop/convert/shopads/ShopAdsConvert.java`

No manual change required — MapStruct auto-maps the new `link` field across `ShopAdsDO`, `ShopAdsBaseVO`, and `AppShopAdsVO` because field names match.

### 5. App Controller

**File**: `backend/yshop-module-mall/yshop-module-shop-biz/src/main/java/co/yixiang/yshop/module/shop/controller/app/ad/AppAdController.java`

Replace the query logic in `getList()`:

```java
List<ShopAdsDO> appShopAdsVOS = appShopAdsService.list(
    new LambdaQueryWrapper<ShopAdsDO>()
        .eq(ShopAdsDO::getShopId, 0)
        .or()
        .eq(ShopAdsDO::getShopId, shopId)
        .eq(ShopAdsDO::getIsSwitch, 1)   // NEW: only visible ads
        .orderByDesc(ShopAdsDO::getWeigh) // NEW: sort by weight
        .orderByDesc(ShopAdsDO::getId)
);
```

### 6. Excel VO (Optional but recommended for consistency)

**File**: `backend/yshop-module-mall/yshop-module-shop-biz/src/main/java/co/yixiang/yshop/module/shop/controller/admin/shopads/vo/ShopAdsExcelVO.java`

Add:
```java
@ExcelProperty("跳转链接")
private String link;
```

---

## Admin Changes

### 1. AdsForm.vue

**File**: `admin/src/views/mall/shop/ads/AdsForm.vue`

Add form item after the "图片" field:

```vue
<el-form-item label="跳转链接" prop="link">
  <el-input v-model="formData.link" placeholder="请输入跳转链接（可选）" />
</el-form-item>
```

Update `formData` ref:
```ts
const formData = ref({
  id: undefined,
  image: undefined,
  link: undefined,      // NEW
  isSwitch: undefined,
  weigh: undefined,
  shopId: 0
})
```

Update `resetForm()`:
```ts
formData.value = {
  id: undefined,
  image: undefined,
  link: undefined,      // NEW
  isSwitch: 1,
  weigh: undefined,
  shopId: 0
}
```

### 2. API Type (if strictly typed)

**File**: `admin/src/api/mall/shop/ads/index.ts`

Add to `AdsVO` interface:
```ts
export interface AdsVO {
  id: number
  image: string
  link?: string        // NEW
  switch: boolean
  weigh: number
  shopId: string
}
```

### 3. List Page (Optional)

**File**: `admin/src/views/mall/shop/ads/index.vue`

Optionally add a column to display the link (truncated) for admin visibility.

---

## MiniApp Changes

### 1. scan.wxml — Add Swiper Banner

Insert a `<swiper>` block between the `top-nav` and `main-content` sections:

```xml
<!-- 广告轮播 -->
<view class="ad-banner" wx:if="{{adList.length > 0}}">
  <swiper
    class="ad-swiper"
    indicator-dots="{{adList.length > 1}}"
    autoplay="{{true}}"
    interval="4000"
    duration="500"
    circular="{{adList.length > 1}}"
  >
    <swiper-item wx:for="{{adList}}" wx:key="id" bindtap="onAdTap" data-link="{{item.link}}">
      <image class="ad-image" src="{{item.image}}" mode="aspectFill" lazy-load="true" />
    </swiper-item>
  </swiper>
</view>
```

### 2. scan.js — Fetch Ads & Handle Tap

Add to `data`:
```js
data: {
  // ... existing fields ...
  adList: []
}
```

Add method `fetchAdList()`:
```js
fetchAdList() {
  const app = getApp();
  const shopId = app.globalData.shopId || config.shopId;
  request({
    url: '/app-api/ad/list',
    data: { shop_id: shopId },
    contentType: 'form'
  }).then((res) => {
    if (res && res.list) {
      this.setData({ adList: res.list });
    }
  }).catch((err) => {
    console.error('获取广告列表失败：', err);
  });
}
```

Add tap handler:
```js
onAdTap(e) {
  const link = e.currentTarget.dataset.link;
  if (link) {
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(link)}`
    });
  }
}
```

Call `fetchAdList()` in `onLoad()` (after existing logic) and `onShow()` (to refresh after admin changes).

> **Note**: If `link` is an external URL, the miniapp needs a webview page (`pages/webview/webview`) or use `wx.navigateToMiniProgram` / `wx.openEmbeddedMiniProgram` depending on the link type. For Phase 1, assume a generic `webview` wrapper page exists or will be created. If no link is provided, the ad is displayed as non-clickable (image only).

### 3. scan.wxss — Banner Styles

Add to `scan.wxss`:

```css
/* 广告轮播 */
.ad-banner {
  width: 100%;
  margin-bottom: 24rpx;
  border-radius: 24rpx;
  overflow: hidden;
  box-shadow: 0 4rpx 16rpx var(--brand-shadow-card);
}

.ad-swiper {
  width: 100%;
  height: 280rpx;
}

.ad-image {
  width: 100%;
  height: 100%;
  border-radius: 24rpx;
}
```

> Height `280rpx` (~140px) is a standard banner ratio. Adjust based on actual design assets.

---

## Data Flow / Sequence

```
Admin creates ad
  → POST /shop/ads/create (with image + optional link + weigh + isSwitch=1 + shopId)
    → Backend saves to yshop_shop_ads

User opens miniapp scan page
  → onLoad() / onShow()
    → GET /app-api/ad/list?shop_id=8
      → Backend queries:
          is_switch = 1
          AND (shop_id = 0 OR shop_id = 8)
          ORDER BY weigh DESC, id DESC
      → Returns [{id, image, link}]
    → MiniApp renders <swiper> with ad images

User taps an ad with link
  → onAdTap
    → wx.navigateTo({ url: '/pages/webview/webview?url=...' })
      → Opens in-app webview (or mini-program jump)
```

---

## Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| App API behavior change breaks existing consumers | Low | The current `GET /ad/list` is unused by the miniapp (no references found). The only consumer would be this new feature. The `isActive` flag remains unchanged. |
| `link` field is null for legacy ads | Low | MapStruct and MyBatis Plus handle `null` gracefully. MiniApp `wx:if` / `data-link` handle missing link safely (non-clickable). |
| Admin form `link` validation | Low | No validation rules added; link is optional. If stricter validation is needed later, add a URL regex in `ShopAdsBaseVO`. |
| Tenant isolation leak | Low | Existing `tenant_id` column + MyBatis Plus tenant interceptor already applies. No new query paths bypass it. |
| Webview page missing | Medium | If `pages/webview/webview` does not exist, tapping a linked ad will fail. Fallback: guard with `wx.canIUse('web-view')` or create the webview page as part of this feature. |
| Swiper performance with many ads | Low | Swiper with `lazy-load` and 3-5 images is negligible. If ads grow > 10, consider pagination or capping. |

---

## Checklist for Implementation

- [ ] Create `sql/upgrade-miniapp-ad-carousel.sql` and apply to DB
- [ ] Add `link` field to `ShopAdsDO`
- [ ] Add `link` field to `ShopAdsBaseVO` and `AppShopAdsVO`
- [ ] Update `AppAdController.getList()` query with `is_switch=1` and `weigh DESC`
- [ ] Add `link` to `ShopAdsExcelVO` (optional)
- [ ] Update admin `AdsForm.vue` with link input
- [ ] Update admin `AdsVO` TypeScript interface
- [ ] Add swiper banner to miniapp `scan.wxml`
- [ ] Add `fetchAdList()` and `onAdTap()` to miniapp `scan.js`
- [ ] Add `.ad-banner`, `.ad-swiper`, `.ad-image` styles to `scan.wxss`
- [ ] Ensure `pages/webview/webview` exists (or create it) for external link handling
- [ ] Test: create ad with link → verify carousel shows → verify tap navigates
- [ ] Test: create ad without link → verify carousel shows → verify tap does nothing
- [ ] Test: set `is_switch=0` → verify ad disappears from carousel
- [ ] Test: multiple ads with different `weigh` → verify sort order
