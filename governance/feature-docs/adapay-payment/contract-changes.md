## Contract Changes: Adapay Third-Party Payment Integration

### Overview

This feature adds Adapay as a new third-party payment channel alongside WeChat Pay and Alipay. The integration follows the existing eGzosN payment abstraction patterns exactly — no new endpoints, no new contract shapes, no protocol changes.

### New payType Value: "adapay"

**Enum extension in `PayTypeEnum`:**

```java
// Before (existing values):
ALI("alipay","支付宝支付"),
WEIXIN("weixin","微信支付"),
YUE("yue","余额支付"),
CASH("cash","现金支付"),
INTEGRAL("integral","积分兑换");

// After (add):
ADAPAY("adapay", "Adapay支付"),
```

**Where this value appears:**

| Location | Field | Notes |
|----------|-------|-------|
| `POST /app-api/order/pay` request | `paytype` | C-end passes `"adapay"` in the pay request body |
| `store_order.pay_type` column | `pay_type` | Stored in order record after successful payment |
| `PayNoticeMessage` MQ message | `payType` | Published to Redis Stream `order.pay.notice` |
| `merchant_details.pay_type` column | `pay_type` | Admin-configured payment channel identifier (e.g., `"adapay"` — the eGzosN platform name verified from `AdapayPaymentPlatform.PLATFORM_NAME`) |

### New PayIdEnum Value: "adapay_h5"

```java
// Before (existing values):
WX_H5("wx_h5","微信支付H5"),
WX_MINIAPP("wx_miniapp","微信支付小程序"),
// ...
ALI_H5("ali_h5","支付宝H5"),
// ...

// After (add):
ADAPAY_H5("adapay_h5", "Adapay支付H5"),
```

The `detailsId` used to look up `merchant_details` for Adapay H5 payments will be `adapay_h5{tenantId}` (e.g., `adapay_h5153`), following the exact pattern of `ali_h5{tenantId}`.

### Existing API Endpoints — No Changes

All existing endpoints continue to work unchanged:

| Endpoint | Impact |
|----------|--------|
| `POST /app-api/order/pay` | Accepts `paytype: "adapay"` as valid input (new case in switch statement) |
| `POST /pay/merchant-details/create` | Supports `payType: "adapay"` (new admin UI option); no API schema change |
| `PUT /pay/merchant-details/update` | Unchanged |
| `GET /pay/merchant-details/page` | Unchanged |
| `GET /pay/merchant-details/get` | Unchanged |
| `GET /pay/merchant/getInfo` | Returns merchant config by detailsId — no change needed |

### Callback Handling — No New Endpoints

Adapay payment callbacks arrive at the same eGzosN-built-in endpoint:

```
POST /admin-api/pay/notify/order
POST /admin-api/pay/notify/refund
```

These endpoints are excluded from tenant-id header requirements in `application.yaml`:

```yaml
yshop:
  tenant:
    ignore-urls:
      - /admin-api/pay/notify/**
```

The eGzosN framework automatically:
1. Receives the callback at `/admin-api/pay/notify/order`
2. Identifies the payment platform from the request payload
3. Dispatches to the registered `AdapayPayMessageHandler` (via `MerchantPayServiceConfigurer`)
4. Handler checks payment status and sends `PayNoticeMessage(type="adapay")`

### MQ Contract — Unchanged

- **Topic**: `order.pay.notice` (Redis Stream, unchanged)
- **Message**: `PayNoticeMessage { orderId: String, payType: String }` (unchanged)
- New message instance: `{ orderId: "xxx", payType: "adapay" }`
- Consumer: `PayNoticeConsumer.onMessage()` already handles any `payType` generically

### Platform-Level Contracts — No Changes

**No changes to `governance/CONTRACTS.md`.**

This feature:
- Does not introduce new cross-module calling patterns
- Does not add new endpoints or response shapes
- Does not modify any universal response format
- Does not introduce new entity ID types
- Extends only a feature-scoped enum (`PayTypeEnum`) which is already documented at the feature level

The `payType` enum extension (adding `"adapay"`) is a feature-level change documented here, not a platform-level contract change. The existing `PayTypeEnum` enum is not referenced in `CONTRACTS.md` — it is internal to the order module.

### Frontend Contract Changes

#### Admin Frontend: `MerchantDetailsForm.vue`

The payType `<el-select>` dropdown gains one new option:

```html
<!-- Before -->
<el-option label="支付宝支付" value="aliPay" />
<el-option label="微信支付V3" value="wxV3Pay" />

<!-- After (add) -->
<el-option label="Adapay支付" value="adapayPay" />
```

The detailsId `<el-select>` dropdown gains one new option:

```html
<!-- Before -->
<el-option label="微信支付小程序" :value="'wx_miniapp'+tenantId" />
<el-option label="微信支付公众号" :value="'wx_wechat'+tenantId" />
<el-option label="微信支付H5" :value="'wx_h5'+tenantId" />
<el-option label="支付宝H5" :value="'ali_h5'+tenantId" />

<!-- After (add) -->
<el-option label="Adapay支付H5" :value="'adapay_h5'+tenantId" />
```

No API client changes in `admin/src/api/pay/merchantDetails/index.ts` — the `MerchantDetailsVO` interface already has `payType: string` (fully generic).

#### Miniapp: No Changes

The miniapp is WeChat-pay-only. It does not support Adapay. No miniapp changes are needed.

### Summary of Changes

| Artifact | Type | Change |
|----------|------|--------|
| `PayTypeEnum.java` | Enum addition | `ADAPAY("adapay","Adapay支付")` |
| `PayIdEnum.java` | Enum addition | `ADAPAY_H5("adapay_h5","Adapay支付H5")` |
| `MerchantDetailsForm.vue` | UI option | Add `adapayPay` to payType dropdown |
| `MerchantDetailsForm.vue` | UI option | Add `adapay_h5` to detailsId dropdown |
| `CONTRACTS.md` | No change | Feature-level only; no platform contract impact |
| All APIs | No change | Existing endpoints accept new values |
| MQ messages | No change | Existing `PayNoticeMessage` schema unchanged |
