# Order Detail Page — UI/UX Design Specification

**Project:** 冰立得 (Binglide) WeChat Mini Program  
**Page:** `pages/order-detail/order-detail`  
**Navigates from:** `pages/orders/orders` (tap on order card)  
**API:** `GET /app-api/order/detail/{orderId}`  
**Last Updated:** 2026-06-04

---

## 1. Page Layout Structure

The page is a single vertical scroll view. Content is organized into **5 stacked sections**, each wrapped in a card container. The layout follows a top-to-bottom information hierarchy: status first, then products, then financials, then metadata, then actions.

### Section Order (top to bottom)

| # | Section | Purpose | Approx. Height |
|---|---------|---------|----------------|
| 1 | **Status Header** | Dominant status badge + order ID + copy action | 180–240rpx |
| 2 | **Product List** | Full cart items with images, specs, quantities, per-item prices | Variable |
| 3 | **Price Breakdown** | Itemized cost: total, freight, coupon, integral, final pay | 320–400rpx |
| 4 | **Order Metadata** | Shop, device IMEI, payment type, timestamps, user info | 360–480rpx |
| 5 | **Action Bar** | Contextual CTA(s) based on order state | 120–160rpx |

### Spacing Rules

- Page horizontal padding: `32rpx` (16px)
- Gap between cards: `16rpx` (8px)
- Card internal padding: `28rpx` (14px) horizontal, `24rpx` (12px) vertical
- Section divider inside card: `1rpx solid var(--brand-gray-100)`
- Bottom safe-area padding: `calc(120rpx + env(safe-area-inset-bottom))`

### Skeleton Structure (WXML conceptual)

```
<scroll-view class="order-detail-page">
  <!-- 1. Status Header Card -->
  <view class="detail-card detail-card--status">
    <status-badge />
    <order-id-row />
  </view>

  <!-- 2. Product List Card -->
  <view class="detail-card detail-card--products">
    <product-item wx:for="{{cartInfo}}" />
  </view>

  <!-- 3. Price Breakdown Card -->
  <view class="detail-card detail-card--pricing">
    <price-row label="商品总额" value="{{totalPrice}}" />
    <price-row label="运费" value="{{freightPrice}}" />
    <price-row label="优惠券" value="-{{couponPrice}}" highlight />
    <price-row label="积分抵扣" value="-{{useIntegral}}" highlight />
    <price-divider />
    <price-row label="实付金额" value="{{payPrice}}" total />
  </view>

  <!-- 4. Order Metadata Card -->
  <view class="detail-card detail-card--meta">
    <meta-row icon="shop" label="门店" value="{{shopName}}" />
    <meta-row icon="device" label="设备编号" value="{{imei}}" />
    <meta-row icon="payment" label="支付方式" value="{{payTypeText}}" />
    <meta-row icon="time" label="下单时间" value="{{createTime}}" />
    <meta-row icon="time-check" label="支付时间" value="{{payTime}}" />
  </view>

  <!-- 5. Action Bar (sticky bottom) -->
  <view class="action-bar">
    <action-button />
  </view>
</scroll-view>
```

---

## 2. Color Scheme

### Global Page Background

- `background: linear-gradient(to bottom, var(--brand-blue-50), var(--brand-surface))`
- Matches existing `orders.wxss` page background for visual continuity between list and detail.

### Per-Section Color Assignments

#### Section 1 — Status Header Card

| Element | Background | Text | Notes |
|---------|-----------|------|-------|
| Card surface | `var(--brand-surface)` | — | White card with `box-shadow: 0 2rpx 12rpx var(--brand-shadow-card)` |
| Status badge bg | Status-dependent (see Status Badges below) | Status-dependent | Pill shape, full width centered |
| Order ID label | — | `var(--brand-text-muted)` | 20rpx |
| Order ID value | — | `var(--brand-text-secondary)` | Monospace font |
| Copy button | `var(--brand-blue-50)` | `var(--brand-primary)` | 8rpx radius, active: `var(--brand-blue-100)` |

#### Section 2 — Product List Card

| Element | Background | Text | Notes |
|---------|-----------|------|-------|
| Card surface | `var(--brand-surface)` | — | White |
| Product image placeholder | `linear-gradient(135deg, var(--brand-blue-50), var(--brand-cyan-50))` | — | 20rpx radius, 88x88rpx |
| Product title | — | `var(--brand-text-primary)` | 30rpx, weight 600 |
| Spec text | — | `var(--brand-text-muted)` | 24rpx |
| Unit price | — | `var(--brand-text-secondary)` | 26rpx |
| Quantity | — | `var(--brand-text-muted)` | 24rpx |
| Subtotal | — | `var(--brand-text-primary)` | 28rpx, weight 600 |

#### Section 3 — Price Breakdown Card

| Element | Background | Text | Notes |
|---------|-----------|------|-------|
| Card surface | `var(--brand-surface)` | — | White |
| Label (e.g., "商品总额") | — | `var(--brand-text-muted)` | 26rpx |
| Positive value | — | `var(--brand-text-primary)` | 26rpx |
| Discount value (coupon, integral) | — | `var(--brand-success)` | 26rpx, prefixed with "-" |
| Divider | `var(--brand-gray-100)` | — | 1rpx, dashed optional |
| Total label ("实付金额") | — | `var(--brand-text-secondary)` | 28rpx, weight 500 |
| Total value | — | `var(--brand-primary)` | 40rpx, weight 700 |
| Total currency symbol | — | `var(--brand-primary)` | 28rpx, weight 600 |

#### Section 4 — Order Metadata Card

| Element | Background | Text | Notes |
|---------|-----------|------|-------|
| Card surface | `var(--brand-surface)` | — | White |
| Icon container | `var(--brand-blue-50)` | `var(--brand-primary)` | 40rpx circle |
| Label (e.g., "门店") | — | `var(--brand-text-muted)` | 24rpx |
| Value | — | `var(--brand-text-secondary)` | 28rpx |
| IMEI value | — | `var(--brand-text-muted)` | 26rpx, monospace |
| Timestamp | — | `var(--brand-text-muted)` | 24rpx |

#### Section 5 — Action Bar

| Element | Background | Text | Notes |
|---------|-----------|------|-------|
| Bar background | `var(--brand-surface)` with top border | — | `border-top: 1rpx solid var(--brand-gray-100)` |
| Primary CTA | `var(--brand-primary-gradient)` | `var(--brand-surface)` | Full-width pill or 320rpx wide |
| Secondary CTA | `var(--brand-surface)` | `var(--brand-blue-700)` | Border `2rpx solid var(--brand-blue-200)` |
| Danger CTA | `var(--brand-surface)` | `var(--brand-error)` | Border `1rpx solid var(--brand-border-error-subtle)` |

---

## 3. Typography Scale

All sizes use the existing `--text-*` scale from `brand-assets/fonts/typography.wxss`.

| Token | Size | Usage |
|-------|------|-------|
| `--text-xs` | 20rpx | Timestamps, IMEI, spec labels |
| `--text-sm` | 24rpx | Meta labels, spec text, quantity, payment chip text |
| `--text-base` | 28rpx | Body text, meta values, price labels |
| `--text-md` | 30rpx | Product titles |
| `--text-lg` | 32rpx | Status badge text, section headers |
| `--text-xl` | 36rpx | Page title (if any) |
| `--text-2xl` | 40rpx | Total pay amount number |

### Font Weights

- **700 (Bold):** Total amount, status badge text, product title
- **600 (Semi-bold):** Section headers, subtotals, CTA buttons
- **500 (Medium):** Meta labels, price row labels, copy button
- **400 (Regular):** Body text, timestamps, descriptions

### Line Heights

- `--leading-tight` (1.25): Headlines, status badges, amounts
- `--leading-normal` (1.5): Body text, metadata, descriptions

---

## 4. Component Specifications

### 4.1 Cards (`.detail-card`)

```
.detail-card {
  background: var(--brand-surface);
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  box-shadow: 0 2rpx 12rpx var(--brand-shadow-card);
  margin-bottom: 16rpx;
}
```

- No hover state (mobile). Active state on tappable inner elements only.
- No elevation change on scroll.

### 4.2 Status Badges

Reuses existing `.status-badge` pattern from `orders.wxss` but enlarged for detail prominence.

| Status | Background | Text Color | Dot Color |
|--------|-----------|------------|-----------|
| `completed` (已完成) | `var(--brand-green-100)` | `var(--brand-green-700)` | `var(--brand-success)` |
| `pending` (待支付) | `var(--brand-warning-light)` | `var(--brand-warning-text)` | `var(--brand-warning)` |
| `processing` (制冰中) | `var(--brand-info-light)` | `var(--brand-blue-800)` | `var(--brand-primary)` |
| `cancelled` (已取消) | `var(--brand-error-light)` | `var(--brand-error-text)` | `var(--brand-error)` |
| `refunded` (已退款) | `var(--brand-gray-100)` | `var(--brand-gray-600)` | `var(--brand-gray-400)` |

**Detail page variant:**
- Padding: `12rpx 24rpx`
- Font size: `var(--text-lg)` (32rpx)
- Font weight: 600
- Border radius: `999rpx`
- Includes pulsing dot animation (reused from orders page)

### 4.3 Refund Status Badge

Displayed inline next to the main status badge when `refundStatus > 0`.

| Refund Status | Background | Text Color |
|--------------|-----------|------------|
| `1` (退款中) | `var(--brand-warning-light)` | `var(--brand-warning-text)` |
| `2` (已退款) | `var(--brand-blue-50)` | `var(--brand-blue-700)` |

### 4.4 Product Item Row

```
.product-item {
  display: flex;
  gap: 20rpx;
  padding: 16rpx 0;
  border-bottom: 1rpx solid var(--brand-gray-100);
}
.product-item:last-child {
  border-bottom: none;
}
```

- **Image:** 88rpx x 88rpx, `border-radius: 20rpx`, gradient placeholder (same as orders list). If `image` URL exists, use `<image>` with `mode="aspectFill"`.
- **Title:** 30rpx, weight 600, max 2 lines (`-webkit-line-clamp: 2`)
- **Spec:** 24rpx, `var(--brand-text-muted)`, e.g., "规格: 大杯"
- **Price row:** flex between, left = unit price, right = `x{number}`
- **Subtotal:** Right-aligned, 28rpx weight 600

### 4.5 Price Row

```
.price-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12rpx 0;
}
.price-row--total {
  padding-top: 20rpx;
  margin-top: 12rpx;
  border-top: 1rpx dashed var(--brand-gray-200);
}
```

- Labels left-aligned, values right-aligned
- Discount rows use `var(--brand-success)` for the value
- Total row uses larger typography (see Section 3)

### 4.6 Metadata Row

```
.meta-row {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 14rpx 0;
}
.meta-row__icon {
  width: 40rpx;
  height: 40rpx;
  background: var(--brand-blue-50);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.meta-row__content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4rpx;
}
```

- Icon: 20rpx x 20rpx SVG/PNG, tinted `var(--brand-primary)`
- Label: 24rpx, `var(--brand-text-muted)`
- Value: 28rpx, `var(--brand-text-secondary)`
- If value is empty/null, show "—" in `var(--brand-text-muted)`

### 4.7 Action Buttons

Reuses existing `.action-btn` pattern from `orders.wxss`.

| Variant | Background | Text | Border | Shadow |
|---------|-----------|------|--------|--------|
| Primary | `var(--brand-primary-gradient)` | White | None | `0 4rpx 12rpx var(--brand-shadow-blue-medium)` |
| Secondary | White | `var(--brand-blue-700)` | `2rpx solid var(--brand-blue-200)` | None |
| Danger | White | `var(--brand-error)` | `1rpx solid var(--brand-border-error-subtle)` | `0 2rpx 8rpx var(--brand-shadow-error-soft)` |

**Sizing:**
- Height: `64rpx`
- Min-width: `160rpx`
- Padding: `0 24rpx`
- Border radius: `999rpx`
- Font: 26rpx, weight 600

**Active state:**
- Primary: `opacity: 0.92; transform: scale(0.97)`
- Secondary/Danger: `background: var(--brand-blue-50)` / `var(--brand-error-light)`; `transform: scale(0.97)`

---

## 5. Interaction Flow

### 5.1 Entry Navigation

**Trigger:** User taps an `order-card` in `pages/orders/orders`.

**Navigation:**
```javascript
wx.navigateTo({
  url: `/pages/order-detail/order-detail?orderId=${item.orderId}`
});
```

**Transition:** Standard WeChat Mini Program slide-in from right (platform default). No custom transition needed.

### 5.2 Page Load Sequence

1. **Instant:** Page shell renders with navigation bar title "订单详情"
2. **0–300ms:** Skeleton screen visible (see Loading States)
3. **300ms+:** API `GET /app-api/order/detail/{orderId}` returns
4. **On success:** Content fades in (opacity 0 → 1, 200ms ease)
5. **On error:** Error state card replaces skeleton

### 5.3 Loading States

#### Skeleton Screen

Shown while `isLoading === true` and `orderDetail === null`.

- Full-page overlay with 5 placeholder card blocks
- Each block: white rounded rectangle with shimmer animation
- Shimmer: `linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)` animated left-to-right
- Duration: 1.2s infinite
- No spinner (skeleton preferred for content-heavy pages per UX guidelines)

#### Partial Loading

If page is re-entered from background with stale data:
- Show existing data immediately
- Trigger background refresh
- If data changes, crossfade update (150ms)

### 5.4 Error States

#### Network Error

- Replace skeleton with error card centered on page
- Icon: 120rpx cloud-off or connection illustration (reused from existing error patterns)
- Title: "加载失败"
- Description: "网络连接异常，请检查网络后重试"
- CTA: "重新加载" primary button

#### Order Not Found (404)

- Title: "订单不存在"
- Description: "该订单可能已被删除或您无权查看"
- CTA: "返回订单列表" ghost button

### 5.5 User Interactions

| Action | Element | Feedback |
|--------|---------|----------|
| Tap "复制" (order ID) | Copy button | `wx.showToast({ title: '已复制', icon: 'success', duration: 1500 })` |
| Tap product image | Image | None (no zoom in MVP) |
| Tap "立即支付" | Primary CTA | Navigate to payment flow |
| Tap "申请退款" | Secondary CTA | `wx.navigateTo({ url: '/pages/refund/refund?orderId=...' })` |
| Tap "取消订单" | Danger CTA | Show `wx.showModal` confirmation dialog |
| Pull down | Scroll view | Trigger page reload (same as `orders` page pattern) |

### 5.6 Exit

- Standard WeChat swipe-back gesture (iOS) or back button (Android)
- `wx.navigateBack()` preserves orders list scroll position and state
- No confirmation dialog on exit (no unsaved form data)

---

## 6. Responsive Considerations

### 6.1 Viewport Width

The design is mobile-first for WeChat Mini Program. Primary target: 375px–414px width (iPhone SE through Pro Max).

| Width Range | Adjustments |
|-------------|-------------|
| < 375px (small phones) | Reduce card padding to `24rpx` horizontal; shrink product image to `80rpx` |
| 375–414px (default) | Specification as written |
| > 414px (large phones, tablets) | Max content width `750rpx`, centered; increase card padding to `32rpx` |

### 6.2 Landscape Orientation

- Page remains scrollable vertically
- Action bar stays fixed at bottom
- Product list items expand to use full width
- Metadata rows switch to 2-column grid if width > 600px:
  ```
  @media (min-width: 600px) {
    .detail-card--meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16rpx;
    }
  }
  ```

### 6.3 Safe Areas

- Top: Respect `env(safe-area-inset-top)` for any fixed header (none in this page — uses native navigation bar)
- Bottom: `padding-bottom: calc(120rpx + env(safe-area-inset-bottom))` on page container
- Action bar height: `120rpx` including safe area

### 6.4 Dynamic Type / Font Scaling

- All text uses rpx units which scale with screen width
- Support system font scaling: use `min-font-size` guards where needed
- Ensure `-webkit-line-clamp` elements do not break layout at large font sizes
- Status badge must wrap gracefully if text becomes multi-line

### 6.5 Dark Mode (Future-Ready)

While the current miniapp does not implement dark mode, the spec uses CSS variables throughout. A future dark mode would map:

| Light Token | Dark Token |
|-------------|-----------|
| `--brand-surface` | `#1F2937` |
| `--brand-background` | `#111827` |
| `--brand-text-primary` | `#F9FAFB` |
| `--brand-text-secondary` | `#E5E7EB` |
| `--brand-text-muted` | `#9CA3AF` |
| `--brand-gray-100` | `#374151` |

---

## 7. Accessibility Checklist

- [ ] All status badges include text label (not color-only)
- [ ] Copy button has `aria-label="复制订单编号"` equivalent (WeChat: set descriptive text)
- [ ] Touch targets for all buttons >= 44x44rpx
- [ ] Product images have `alt` / `aria-label` with product title
- [ ] Price breakdown uses semantic grouping (visual dividers)
- [ ] Loading skeleton respects `prefers-reduced-motion` (static placeholder if reduced motion enabled)
- [ ] Error states provide clear recovery action
- [ ] Color contrast: all text meets WCAG AA (4.5:1) against its background

---

## 8. Asset Requirements

| Asset | Size | Format | Usage |
|-------|------|--------|-------|
| Icon: shop/store | 20x20rpx | SVG/PNG | Metadata row — shop |
| Icon: device/IMEI | 20x20rpx | SVG/PNG | Metadata row — device |
| Icon: payment | 20x20rpx | SVG/PNG | Metadata row — payment type |
| Icon: clock | 20x20rpx | SVG/PNG | Metadata row — create time |
| Icon: check-circle | 20x20rpx | SVG/PNG | Metadata row — pay time |
| Icon: copy | 20x20rpx | SVG/PNG | Copy order ID button |
| Product placeholder | 88x88rpx | CSS gradient | Product image fallback |

All icons should use a consistent stroke width (2rpx) and corner radius (4rpx), tinted with `var(--brand-primary)`.

---

## 9. State Matrix

The page adapts its visible content and actions based on order state.

| State | Status Badge | Visible Actions | Hidden Elements |
|-------|-------------|-----------------|-----------------|
| `pending` (待支付) | Orange "待支付" | "立即支付" (primary), "取消订单" (danger) | Pay time row, Refund badge |
| `processing` (制冰中) | Blue "制冰中" | None (or "查看进度" if linked) | Pay time may be present |
| `completed` (已完成) | Green "已完成" | "申请退款" (secondary, if within window) | — |
| `cancelled` (已取消) | Red "已取消" | None | Pay time row |
| `paid` + refunding | Green + Blue "退款中" | None | — |
| `paid` + refunded | Gray "已退款" | None | — |

---

## 10. BEM Class Reference

```
.order-detail-page          /* page root */
.detail-card               /* generic card */
.detail-card--status       /* status header variant */
.detail-card--products     /* product list variant */
.detail-card--pricing      /* price breakdown variant */
.detail-card--meta         /* metadata variant */
.status-badge              /* status pill */
.status-badge--{state}     /* state modifier */
.refund-badge              /* refund status pill */
.refund-badge--{status}    /* refund status modifier */
.product-item              /* single product row */
.product-item__image       /* product image container */
.product-item__info        /* product text content */
.product-item__spec        /* spec line */
.product-item__price-row   /* unit price + quantity */
.price-row                 /* generic price row */
.price-row--total          /* final total variant */
.price-row--discount       /* discount row variant */
.meta-row                  /* metadata row */
.meta-row__icon            /* icon container */
.meta-row__content         /* label + value */
.meta-row__label           /* label text */
.meta-row__value           /* value text */
.action-bar                /* sticky bottom bar */
.action-btn                /* generic action button */
.action-btn--primary       /* primary CTA */
.action-btn--secondary     /* secondary CTA */
.action-btn--danger        /* destructive CTA */
.skeleton                  /* skeleton placeholder */
.skeleton--shimmer         /* shimmer animation variant */
.error-state               /* error display */
.error-state__icon         /* error illustration */
.error-state__title        /* error title */
.error-state__description  /* error message */
```

---

*End of Specification*
