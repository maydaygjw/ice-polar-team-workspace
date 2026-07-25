# miniapp-ad-carousel — UI/UX Design Spec

## 1. Design Overview

### Purpose
Add a **金刚区 (Quick-Access Grid)** with an **ad banner carousel** to the scan page (`pages/scan/scan`). The 金刚区 serves as the primary navigation hub for secondary features (orders, coupons, nearby devices, etc.), while the carousel banner provides promotional/advertising space for campaigns, new products, or partner content.

### Visual Direction
- **Style**: Flat Design Mobile (Touch-First) — clean, modern, no heavy shadows
- **Mood**: Fresh, cool, trustworthy — aligned with 冰立得's ice-machine brand identity
- **Density**: Medium — 5 quick-access icons + 1 carousel banner, balanced whitespace

### Design Principles
1. **Content-first**: The scan area remains the primary CTA; 金刚区 is secondary
2. **Touch-friendly**: All tappable elements >= 44x44pt (88rpx)
3. **Brand consistency**: Use existing CSS variables from `brand-assets/colors/color-palette.wxss`
4. **Performance**: Reserve space for async-loaded carousel to prevent CLS

---

## 2. Layout & Positioning

### Page Structure (Top to Bottom)

```
scan-page
├── top-nav                    (existing: brand logo + name)
├── main-content
│   ├── card-wrapper           (existing: device connection card)
│   ├── quick-access-section   (NEW: 金刚区 + carousel)
│   │   ├── ad-carousel        (NEW: swiper banner)
│   │   └── quick-access-grid  (NEW: 5 icon buttons)
│   └── help-section           (existing)
└── fab-mock                   (existing: dev only)
```

### Placement Rules
- The **quick-access-section** is inserted **between** the `card-wrapper` and `help-section`
- It sits **outside** the card wrapper to create visual separation between the primary scan action and secondary navigation
- On the scan page, the section appears **below** the status card (both connected and unconnected states)
- The section uses the page's gradient background (`--brand-background` to `--brand-blue-50`)

### Spacing
- Top margin from card-wrapper: `32rpx`
- Bottom margin to help-section: `24rpx`
- Horizontal padding: inherits from `.scan-page` (`32rpx`)

---

## 3. Carousel Spec

### Container
```
Width:  100% (of quick-access-section)
Height: auto (aspect-ratio driven)
Padding: 0
```

### Banner Dimensions
```
Aspect Ratio:  16:9  (industry standard for ad banners)
Border Radius: 24rpx  (matches existing .card style)
Overflow:      hidden
```

On a 375px iPhone:
- Banner width: ~311px (after 32rpx page padding)
- Banner height: ~175px (311 * 9/16)

### Swiper Configuration
| Property | Value | Rationale |
|----------|-------|-----------|
| `indicator-dots` | `true` | Users need to know multiple banners exist |
| `indicator-color` | `rgba(255,255,255,0.4)` | Subtle inactive dots on dark images |
| `indicator-active-color` | `#FFFFFF` | High contrast active dot |
| `autoplay` | `true` | Auto-rotate to surface all content |
| `interval` | `5000` | 5s — not too aggressive, not too slow |
| `duration` | `500` | Smooth 500ms slide transition |
| `circular` | `true` | Infinite loop for seamless feel |
| `display-multiple-items` | `1` | One banner at a time |
| `previous-margin` | `0` | Full-width banner |
| `next-margin` | `0` | Full-width banner |

### Dot Indicator Style
```css
.swiper-dots {
  bottom: 16rpx;
}
.swiper-dot {
  width: 8rpx;
  height: 8rpx;
  border-radius: 50%;
  margin: 0 6rpx;
  background: rgba(255, 255, 255, 0.4);
}
.swiper-dot--active {
  width: 20rpx;
  border-radius: 4rpx;
  background: #FFFFFF;
}
```

### Image Requirements
- Format: WebP with JPEG fallback (WeChat Mini Program supports WebP)
- Max file size: 80KB per banner image
- Recommended resolution: 750x422px (2x for retina)
- Content safe zone: Keep text/logo within central 80% to avoid being clipped by rounded corners

---

## 4. 金刚区 Grid Spec

### Layout
```
Grid: 5 columns, 1 row
Gap:  16rpx horizontal, 24rpx vertical
```

On narrow screens (< 320px width), fall back to 4 columns + 1 in a second row.

### Container
```css
.quick-access-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  padding: 32rpx 24rpx;
  background: var(--brand-surface);
  border-radius: 24rpx;
  box-shadow: 0 4rpx 24rpx var(--brand-shadow-card);
  margin-top: 24rpx;
}
```

### Grid Item (Each Icon Button)
```css
.quick-access-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12rpx;
  min-width: 88rpx;   /* touch target */
  min-height: 88rpx;  /* touch target */
}

.quick-access-icon-wrap {
  width: 96rpx;
  height: 96rpx;
  border-radius: 24rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--brand-blue-50) 0%, var(--brand-blue-100) 100%);
  box-shadow: 0 4rpx 12rpx var(--brand-shadow-blue-soft);
}

.quick-access-icon {
  width: 48rpx;
  height: 48rpx;
}

.quick-access-label {
  font-size: var(--text-xs);
  color: var(--brand-text-secondary);
  font-weight: 500;
  text-align: center;
  max-width: 120rpx;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
```

### Proposed 5 Icons (Phase 1)
| Position | Icon | Label | Navigation Target |
|----------|------|-------|-------------------|
| 1 | `icon-orders.svg` | 我的订单 | `/pages/orders/orders` |
| 2 | `icon-coupon.svg` | 优惠券 | `/pages/coupons/coupons` |
| 3 | `icon-map.svg` | 附近设备 | `/pages/map/map` (switchTab) |
| 4 | `icon-device.svg` | 设备管理 | `/pages/device-manage/device-manage` |
| 5 | `icon-partner.svg` | 合作加盟 | `/pages/partnership/partnership` |

### Press State
```css
.quick-access-item:active .quick-access-icon-wrap {
  transform: scale(0.95);
  background: linear-gradient(135deg, var(--brand-blue-100) 0%, var(--brand-blue-200) 100%);
}
.quick-access-item:active .quick-access-label {
  color: var(--brand-primary);
}
```
- Transition: `transform 0.15s ease, background 0.15s ease`

---

## 5. Color & Typography

### Colors (from existing design system)
| Element | Variable | Value |
|---------|----------|-------|
| Grid background | `--brand-surface` | `#FFFFFF` |
| Icon container bg | `--brand-blue-50` / `--brand-blue-100` | `#E3F2FD` / `#BBDEFB` |
| Label text | `--brand-text-secondary` | `#374151` |
| Label active | `--brand-primary` | `#2196F3` |
| Carousel dot inactive | `rgba(255,255,255,0.4)` | — |
| Carousel dot active | `#FFFFFF` | — |

### Typography
| Element | Font | Size | Weight | Color |
|---------|------|------|--------|-------|
| Grid item label | `--font-body` | `var(--text-xs)` (20rpx) | 500 | `--brand-text-secondary` |

### Shadows
- Grid card: `0 4rpx 24rpx var(--brand-shadow-card)` (existing pattern)
- Icon container: `0 4rpx 12rpx var(--brand-shadow-blue-soft)`

---

## 6. Interaction Spec

### Carousel Interactions

| Gesture | Action |
|---------|--------|
| Swipe left/right | Navigate to next/previous banner |
| Tap on banner | Navigate to banner link (if `linkUrl` provided) |
| Auto-play | Advances every 5000ms; pauses on user touch, resumes on release |

### Tap-to-Navigate (Banner)
```javascript
onBannerTap(e) {
  const { linkUrl, linkType } = e.currentTarget.dataset;
  if (!linkUrl) return;

  if (linkType === 'miniapp') {
    wx.navigateTo({ url: linkUrl });
  } else if (linkType === 'webview') {
    wx.navigateTo({ url: `/pages/webview/webview?url=${encodeURIComponent(linkUrl)}` });
  } else if (linkType === 'external') {
    // Requires business license for wx.openEmbeddedMiniProgram
    wx.showModal({ title: '提示', content: '即将打开外部小程序', success: (res) => {
      if (res.confirm) wx.navigateToMiniProgram({ appId: linkUrl });
    }});
  }
}
```

### Grid Item Interactions

| Gesture | Action |
|---------|--------|
| Tap | Navigate to target page |
| Long press | None (no context menu needed) |

### Accessibility
- Each grid item must have `aria-label` (or WeChat equivalent) describing the action
- Carousel images must have `alt` text describing the promotion
- Respect `prefers-reduced-motion`: when enabled, disable autoplay and use instant transitions

---

## 7. States

### 7.1 Loading State

When carousel data is fetching:
```
Show: Skeleton placeholder in banner area
Skeleton: Animated shimmer gradient over gray placeholder
Height: Same as banner (aspect-ratio 16:9 container)
Duration: Until data loads or timeout (max 3s)
```

Skeleton CSS:
```css
.carousel-skeleton {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: linear-gradient(90deg, var(--brand-gray-100) 25%, var(--brand-gray-200) 50%, var(--brand-gray-100) 75%);
  background-size: 200% 100%;
  border-radius: 24rpx;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
```

Grid items show immediately (static data); no loading state needed.

### 7.2 Empty State (No Ads)

When API returns empty banner list:
```
Behavior: Hide carousel entirely
Layout: Grid shifts up to fill space
Transition: Fade out carousel over 300ms
```

```css
.quick-access-section--no-ads {
  margin-top: 0;
}
```

### 7.3 Error State

When banner API fails:
```
Behavior: Show carousel with a single "default" brand banner
Default banner: Static brand image (e.g., "冰立得 — 极致纯净 源头品质")
No retry button in UI (silent fail)
Log error to monitoring
```

Default banner asset: `/images/banner-default.png`

### 7.4 Single Banner State

When only 1 banner exists:
```
indicator-dots: false
autoplay: false
swipe: disabled (no-op)
```

---

## 8. Responsive Considerations

### Breakpoints (WeChat Mini Program)
WeChat Mini Programs use `rpx` which auto-scales based on 750px width. No explicit breakpoints needed for most cases.

### Small Screens (< 320px effective width)
- Grid: 4 columns + 1 wrapped to second row
- Icon wrap: `80rpx x 80rpx`
- Label: `18rpx` (slightly smaller, still >= 12px)

### Large Screens / Tablets
- Grid: 5 columns, centered with max-width `600rpx`
- Banner: Max-width `600rpx`, centered
- Page padding increases to `48rpx`

### Landscape Orientation
- Grid: 5 columns (horizontal space is ample)
- Banner: Maintain 16:9 ratio, max-height `240rpx`
- Ensure no content is hidden behind safe areas

### Safe Areas
- Respect top safe area for status bar (handled by page padding)
- Respect bottom safe area for home indicator (add `padding-bottom: env(safe-area-inset-bottom)`)

---

## 9. Asset Requirements

### New Icons Needed (SVG, 48x48px viewBox)
| Asset Name | Description | Style |
|------------|-------------|-------|
| `icon-orders.svg` | Clipboard/list icon | Outline, 2px stroke, `--brand-primary` color |
| `icon-coupon.svg` | Ticket/coupon icon | Outline, 2px stroke, `--brand-primary` color |
| `icon-map.svg` | Map pin icon | Outline, 2px stroke, `--brand-primary` color |
| `icon-device.svg` | Machine/gear icon | Outline, 2px stroke, `--brand-primary` color |
| `icon-partner.svg` | Handshake icon | Outline, 2px stroke, `--brand-primary` color |

Icon design rules:
- Stroke width: 2px (consistent with existing icon style)
- Corner radius: 2px (sharp but not harsh)
- No fills (outline style)
- Monochrome: use currentColor for theming

### New Images Needed
| Asset Name | Description | Spec |
|------------|-------------|------|
| `banner-default.png` | Fallback brand banner | 750x422px, < 50KB, brand gradient background + slogan |
| `banner-promo-1.png` | Example promo banner 1 | 750x422px, < 80KB |
| `banner-promo-2.png` | Example promo banner 2 | 750x422px, < 80KB |

### Existing Assets Reused
- Card shadow: `var(--brand-shadow-card)`
- Blue shadow: `var(--brand-shadow-blue-soft)`
- Background gradient: existing page gradient

---

## 10. Implementation Notes

### WeChat Mini Program Specifics

**WXML Structure:**
```xml
<!-- 金刚区 + 广告轮播 -->
<view class="quick-access-section">
  <!-- 广告轮播 -->
  <view class="ad-carousel" wx:if="{{banners.length > 0}}">
    <swiper
      class="ad-swiper"
      indicator-dots="{{banners.length > 1}}"
      indicator-color="rgba(255,255,255,0.4)"
      indicator-active-color="#FFFFFF"
      autoplay="{{banners.length > 1}}"
      interval="5000"
      duration="500"
      circular="{{banners.length > 1}}"
      bindchange="onBannerChange"
    >
      <swiper-item wx:for="{{banners}}" wx:key="id">
        <image
          class="ad-banner"
          src="{{item.imageUrl}}"
          mode="aspectFill"
          data-link-url="{{item.linkUrl}}"
          data-link-type="{{item.linkType}}"
          bindtap="onBannerTap"
          lazy-load="true"
        />
      </swiper-item>
    </swiper>
  </view>

  <!-- 金刚区网格 -->
  <view class="quick-access-grid">
    <view
      class="quick-access-item"
      wx:for="{{quickAccessItems}}"
      wx:key="id"
      data-url="{{item.url}}"
      data-switch-tab="{{item.isTabBar}}"
      bindtap="onQuickAccessTap"
    >
      <view class="quick-access-icon-wrap">
        <image class="quick-access-icon" src="{{item.icon}}" mode="aspectFit" />
      </view>
      <text class="quick-access-label">{{item.label}}</text>
    </view>
  </view>
</view>
```

**Data Model:**
```javascript
// banners (from API)
{
  id: string,
  imageUrl: string,
  linkUrl: string | null,
  linkType: 'miniapp' | 'webview' | 'external' | null,
  sort: number
}

// quickAccessItems (static config)
{
  id: string,
  label: string,
  icon: string,
  url: string,
  isTabBar: boolean
}
```

### Performance Checklist
- [ ] Reserve carousel space with `aspect-ratio` before images load (prevent CLS)
- [ ] Use `lazy-load` on banner images
- [ ] Limit banner count to max 6 (API should enforce this)
- [ ] Preload next banner image: `wx.getImageInfo` on `bindchange`
- [ ] Debounce rapid swiper changes (WeChat swiper handles this natively)

---

## 11. Pre-Delivery Checklist

- [ ] All touch targets >= 88rpx (44pt)
- [ ] No emoji used as icons (SVG only)
- [ ] Press feedback on all tappable elements
- [ ] Animation timing 150-300ms for micro-interactions
- [ ] Light mode: text contrast >= 4.5:1
- [ ] Carousel autoplay pauses on user interaction
- [ ] Skeleton shown while loading; no layout shift
- [ ] Empty state gracefully hides carousel
- [ ] Error state shows default banner (no broken UI)
- [ ] Tested on 375px (iPhone SE), 414px (iPhone Pro Max), and tablet
- [ ] Safe areas respected (no content under notch/home indicator)
- [ ] Accessibility labels on all interactive elements
