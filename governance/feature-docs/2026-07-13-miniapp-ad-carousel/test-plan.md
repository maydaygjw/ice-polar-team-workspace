# miniapp-ad-carousel — E2E Test Plan

## 1. Test Scenarios

| ID | Scenario | Description |
|----|----------|-------------|
| S1 | Admin ad CRUD | Create, edit, enable/disable ads in admin panel |
| S2 | Miniapp carousel display | Banner carousel renders correctly based on ad data |
| S3 | Ad tap navigation | Tapping an ad opens webview with external link |
| S4 | Quick-access grid | Grid items navigate to correct internal pages |
| S5 | Sorting & filtering | Ads ordered by `weigh DESC`, `is_switch=0` hidden |
| S6 | Edge cases | Empty state, single ad, missing link, disabled ads |

---

## 2. Test Cases

### S1 — Admin ad CRUD

#### TC-S1-001 — Create ad with all fields
- **Steps:**
  1. Log in to admin panel.
  2. Navigate to Ads management.
  3. Click "Add".
  4. Fill in: image URL, `link` = `https://example.com/promo`, `weigh` = 10, `is_switch` = 1.
  5. Save.
- **Expected Result:** Ad saved successfully; appears in ad list.
- **Priority:** P0

#### TC-S1-002 — Create ad without link (optional)
- **Steps:**
  1. Navigate to Ads management.
  2. Click "Add".
  3. Fill in: image URL, leave `link` empty, `is_switch` = 1.
  4. Save.
- **Expected Result:** Ad saved successfully; link field is empty.
- **Priority:** P0

#### TC-S1-003 — Edit ad link
- **Steps:**
  1. Open existing ad.
  2. Change `link` to a new URL.
  3. Save.
- **Expected Result:** Changes persisted; miniapp reflects new link after refresh.
- **Priority:** P1

#### TC-S1-004 — Disable ad (`is_switch` = 0)
- **Steps:**
  1. Open existing enabled ad.
  2. Set `is_switch` = 0.
  3. Save.
- **Expected Result:** Ad hidden from miniapp carousel.
- **Priority:** P0

#### TC-S1-005 — Admin form validation — link is optional
- **Steps:**
  1. Create ad with image URL only, no link.
  2. Submit form.
- **Expected Result:** Form submits without validation error on link field.
- **Priority:** P0

---

### S2 — Miniapp carousel display

#### TC-S2-001 — Multiple ads render as carousel
- **Precondition:** 3 ads with `is_switch=1`, different `weigh` values.
- **Steps:**
  1. Open miniapp scan page.
- **Expected Result:** Swiper banner visible with 3 slides; pagination dots shown; autoplay active.
- **Priority:** P0

#### TC-S2-002 — Single ad — no dots, no autoplay
- **Precondition:** Exactly 1 ad with `is_switch=1`.
- **Steps:**
  1. Open miniapp scan page.
- **Expected Result:** Banner image displayed; no pagination dots; no autoplay.
- **Priority:** P1

#### TC-S2-003 — No ads — carousel hidden
- **Precondition:** No ads with `is_switch=1`.
- **Steps:**
  1. Open miniapp scan page.
- **Expected Result:** Carousel section not rendered; page layout intact.
- **Priority:** P1

#### TC-S2-004 — Ad image loads correctly
- **Precondition:** Ad with valid image URL.
- **Steps:**
  1. Open miniapp scan page.
  2. Observe banner image.
- **Expected Result:** Image renders without distortion; aspect ratio maintained.
- **Priority:** P1

---

### S3 — Ad tap navigation

#### TC-S3-001 — Tap ad with link → webview opens
- **Precondition:** Ad with `link` = `https://example.com/promo`.
- **Steps:**
  1. Open miniapp scan page.
  2. Tap on banner ad.
- **Expected Result:** Navigates to `pages/webview/webview` with URL parameter; external page loads.
- **Priority:** P0

#### TC-S3-002 — Tap ad without link → non-clickable
- **Precondition:** Ad with empty `link` field.
- **Steps:**
  1. Open miniapp scan page.
  2. Tap on banner ad.
- **Expected Result:** No navigation triggered; no error.
- **Priority:** P0

#### TC-S3-003 — Webview page displays external content
- **Precondition:** Navigated to webview with valid URL.
- **Steps:**
  1. Verify webview page title.
  2. Verify external page content loads.
- **Expected Result:** Webview renders external URL; back button returns to scan page.
- **Priority:** P1

---

### S4 — Quick-access grid

#### TC-S4-001 — Each grid item navigates correctly
- **Precondition:** Quick-access grid configured with items (e.g., scan history, favorites, settings).
- **Steps:**
  1. Open miniapp scan page.
  2. Tap each quick-access grid item.
- **Expected Result:** Each tap navigates to the correct target page.
- **Priority:** P0

#### TC-S4-002 — Grid layout on different screen sizes
- **Steps:**
  1. Open scan page on iPhone SE, iPhone 14 Pro, Android devices.
- **Expected Result:** Grid layout responsive; no overflow or clipping.
- **Priority:** P1

---

### S5 — Sorting & filtering

#### TC-S5-001 — Ads sorted by `weigh DESC`
- **Precondition:** 3 ads with `weigh` = 5, 10, 3.
- **Steps:**
  1. Open miniapp scan page.
  2. Observe carousel slide order.
- **Expected Result:** Slides appear in order: weigh 10, 5, 3.
- **Priority:** P0

#### TC-S5-002 — `is_switch=0` ads are hidden
- **Precondition:** 2 ads: one `is_switch=1`, one `is_switch=0`.
- **Steps:**
  1. Open miniapp scan page.
- **Expected Result:** Only the enabled ad is displayed.
- **Priority:** P0

#### TC-S5-003 — API response filters correctly
- **Steps:**
  1. Call `GET /app-api/ad/list` directly.
- **Expected Result:** Response contains only ads with `is_switch=1`, ordered by `weigh DESC`.
- **Priority:** P1

---

### S6 — Edge cases

#### TC-S6-001 — Ad with invalid image URL
- **Precondition:** Ad with broken image URL, `is_switch=1`.
- **Steps:**
  1. Open miniapp scan page.
- **Expected Result:** Carousel shows placeholder or empty image; no crash.
- **Priority:** P2

#### TC-S6-002 — Ad with malformed link
- **Precondition:** Ad with `link` = `not-a-url`.
- **Steps:**
  1. Tap ad in miniapp.
- **Expected Result:** Webview opens but fails to load; graceful error handling.
- **Priority:** P2

#### TC-S6-003 — Rapid swipe on carousel
- **Steps:**
  1. Open scan page with multiple ads.
  2. Rapidly swipe left/right.
- **Expected Result:** Carousel remains stable; no visual glitches or crashes.
- **Priority:** P2

#### TC-S6-004 — Network failure during ad list fetch
- **Steps:**
  1. Disable network.
  2. Open miniapp scan page.
- **Expected Result:** Carousel hidden or shows error state; page remains usable.
- **Priority:** P2

---

## 3. Test Data Setup

### Database — `yshop_shop_ads`

| id | image | link | weigh | is_switch | create_time | update_time |
|----|-------|------|-------|-----------|-------------|-------------|
| 1 | `https://cdn.example.com/ad1.jpg` | `https://example.com/promo1` | 10 | 1 | 2026-06-01 | 2026-06-01 |
| 2 | `https://cdn.example.com/ad2.jpg` | `https://example.com/promo2` | 20 | 1 | 2026-06-01 | 2026-06-01 |
| 3 | `https://cdn.example.com/ad3.jpg` | (empty) | 5 | 1 | 2026-06-01 | 2026-06-01 |
| 4 | `https://cdn.example.com/ad4.jpg` | `https://example.com/promo4` | 15 | 0 | 2026-06-01 | 2026-06-01 |

### Setup scripts

- **Clean state:** `UPDATE yshop_shop_ads SET is_switch = 0;`
- **Happy path:** Insert rows 1–3 above.
- **Single ad:** Only row 2 with `is_switch=1`.
- **No ads:** All `is_switch=0` or table empty.
- **Sort verify:** Insert rows with `weigh` = 5, 10, 20 and verify order.

### Miniapp quick-access grid items

Ensure the following pages exist and are accessible:
- Scan history page
- Favorites page
- Settings page
- Help page

---

## 4. Environment Requirements

### Backend
- yshop API server running with latest migrations applied.
- `yshop_shop_ads` table exists with `link` column.
- `GET /app-api/ad/list` endpoint deployed.

### Admin
- Admin panel built and deployed with updated `AdsForm.vue`.
- Admin user account with ad management permissions.

### Miniapp
- WeChat Developer Tools or physical device.
- Miniapp version includes:
  - `pages/scan/scan` with swiper + grid
  - `pages/webview/webview` page
- Test devices:
  - iOS (iPhone 12 or later)
  - Android (Android 10 or later)
  - WeChat version >= 8.0

### Network
- Stable internet connection for CDN image loading.
- Ability to simulate offline mode (airplane mode / network throttling).

### Test Accounts
- Admin panel login credentials.
- WeChat test account for miniapp preview.

---

## Appendix — Traceability Matrix

| Requirement | Test Cases |
|-------------|-----------|
| Admin can create ad with link | TC-S1-001, TC-S1-002 |
| Link field is optional | TC-S1-002, TC-S1-005 |
| Carousel displays enabled ads | TC-S2-001, TC-S2-003, TC-S5-002 |
| Ads sorted by `weigh DESC` | TC-S5-001 |
| Tap ad opens webview | TC-S3-001 |
| Ad without link is non-clickable | TC-S3-002 |
| Single ad hides dots/autoplay | TC-S2-002 |
| Quick-access grid navigation | TC-S4-001 |
| API filters `is_switch=1` | TC-S5-003 |
