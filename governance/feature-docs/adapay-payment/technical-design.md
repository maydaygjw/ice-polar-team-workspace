## Technical Design: Adapay Third-Party Payment Integration

### Database Changes

**No schema migration required.**

The `merchant_details` table is designed generically — all columns (`appid`, `mch_id`, `key_private`, `key_public`, `notify_url`, `return_url`, `sign_type`, etc.) are platform-agnostic. The `pay_type` column stores the platform identifier as a string (e.g., `aliPay`, `wxV3Pay`). Adapay configuration is stored in the same rows with:

- `pay_type` = `adapayPay` (platform class constant `AdapayPaymentPlatform.PLATFORM_NAME`)
- `details_id` = `adapay_h5` + tenantId (following existing convention)

No ALTER TABLE or migration SQL is needed. A new PayIdEnum entry and admin UI option are sufficient.

### Module Impact

| Module | Change | Detail |
|--------|--------|--------|
| `yshop-module-pay-api` (pom.xml) | Add dependency | `com.holuntech:pay-java-adapay:2.14.14-SNAPSHOT` |
| `yshop-module-pay-api` | New class | `AdapayPayMessageHandler.java` |
| `yshop-module-pay-api` | Modify class | `MerchantPayServiceConfigurer.java` — register platform + handler |
| `yshop-module-order-api` | Modify enum | `PayTypeEnum.java` — add `ADAPAY` |
| `yshop-framework/yshop-common` | Modify enum | `PayIdEnum.java` — add `ADAPAY_H5` |
| `yshop-module-order-biz` | Modify method | `AppStoreOrderServiceImpl.pay()` — add ADAPAY case |
| `yshop-module-order-biz` | Modify method | `AppStoreOrderServiceImpl.paySuccess()` — add ADAPAY display text |
| `admin/` | Modify file | `MerchantDetailsForm.vue` — add payType/detailsId options |
| `miniapp/` | No change | WeChat-only miniapp; Adapay is web-side |

### New Classes Needed

#### 1. AdapayPayMessageHandler

File: `backend/yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/config/handlers/AdapayPayMessageHandler.java`

Pattern: mirror `WxPayMessageHandler` and `AliPayMessageHandler`.

```java
@Component
@Slf4j
public class AdapayPayMessageHandler implements PayMessageHandler<AdapayPayMessage, PayService> {

    @Resource
    private PayNoticeProducer payNoticeProducer;

    @Override
    public PayOutMessage handle(AdapayPayMessage payMessage, Map<String, Object> context,
                                 PayService payService) throws PayErrorException {
        log.info("======adapay pay notice ========");
        log.info("payMessage:{}", payMessage);

        // Check payment status — depends on AdapayPayMessage API
        // Expected: check payMessage status field for "success"
        if (/* payment succeeded */) {
            String orderId = payMessage.getOutTradeNo();
            log.info("orderId：{}", orderId);
            payNoticeProducer.sendPayNoticeMessage(orderId, "adapay");
            return payService.getPayOutMessage("SUCCESS", "OK");
        }

        return payService.getPayOutMessage("FAIL", "失败");
    }
}
```

Key unknowns (must be resolved during implementation):
- Exact success status value from `AdapayPayMessage`
- Exact `PayMessage` subclass name provided by `pay-java-adapay` (assumed: `AdapayPayMessage`)
- Payment platform constant name (assumed: `AdapayPaymentPlatform.PLATFORM_NAME`)

#### 2. MerchantPayServiceConfigurer Changes

```java
// Add field:
@Resource
private AdapayPayMessageHandler adapayPayMessageHandler;

// Add in configure(PayMessageConfigurer):
PaymentPlatform adapayPlatform = PaymentPlatforms.getPaymentPlatform(
    AdapayPaymentPlatform.PLATFORM_NAME);
configurer.addHandler(adapayPlatform, adapayPayMessageHandler);
```

#### 3. PayTypeEnum Addition

```java
ADAPAY("adapay", "Adapay支付"),
```

#### 4. PayIdEnum Addition

```java
ADAPAY_H5("adapay_h5", "Adapay支付H5"),
```

### Configuration Changes

**application-local.yaml / application-dev.yaml / application-prod.yaml:**

No new configuration keys needed. The existing callback URL configuration (`yshop.pay.order-notify-url`, `yshop.pay.refund-notify-url`) already covers all payment platforms — the eGzosN framework dispatches callbacks by parsing the incoming request to identify the platform.

**Callback URL pattern:** `{domain}/admin-api/pay/notify/order`
- The eGzosN `pay-spring-boot-starter` provides a built-in callback controller at this path
- It detects the platform from the incoming request payload and dispatches to the registered `PayMessageHandler`
- The `MerchantPayServiceConfigurer.configure(PayMessageConfigurer)` registration ensures Adapay callbacks are routed to `AdapayPayMessageHandler`

### Sequence Diagram

```
Order Flow: Adapay H5 Payment

  User Browser        yshop-drink           Adapay Gateway       Redis Stream       Order Consumer
      |                    |                      |                    |                   |
      |  1. POST /order/pay|                      |                    |                   |
      |  (paytype=adapay)  |                      |                    |                   |
      |------------------>>|                      |                    |                   |
      |                    |                      |                    |                   |
      |                    | 2. MerchantPayOrder  |                    |                   |
      |                    |    + PayServiceManager.getOrderInfo()     |                    |
      |                    |--------------------->>|                   |                   |
      |                    |                      |                   |                   |
      |  3. Redirect to     |  4. Adapay H5       |                   |                   |
      |     Adapay checkout |     pay page URL    |                   |                   |
      |<-------------------|<---------------------|                   |                   |
      |                    |                      |                   |                   |
      |  5. User completes payment on Adapay page |                   |                   |
      |===================>>|                      |                   |                   |
      |                    |                      |                   |                   |
      |                    |  6. POST /admin-api/ |                   |                   |
      |                    |     pay/notify/order |                   |                   |
      |                    |<---------------------|                   |                   |
      |                    |                      |                   |                   |
      |                    | 7. eGzosN dispatches |                   |                   |
      |                    |    to AdapayPayMessageHandler            |                   |
      |                    |    via MerchantPayServiceConfigurer      |                   |
      |                    |                      |                   |                   |
      |                    | 8. AdapayPayMessageHandler.handle()      |                   |
      |                    |    checks status == SUCCESS              |                   |
      |                    |                      |                   |                   |
      |                    | 9. sendPayNoticeMessage(orderId,"adapay")|                   |
      |                    |----------------------------------------->>|                   |
      |                    |                      |                   |                   |
      |                    |                      |           10. PayNoticeConsumer      |
      |                    |                      |             onMessage()             |
      |                    |                      |              paySuccess(orderId,     |
      |                    |                      |              "adapay")               |
      |                    |                      |                   |---------------->>|
      |                    |                      |                   |                  |
      |                    |                      |                   |   11. Update order|
      |                    |                      |                   |   status to PAID |
      |                    |                      |                   |   payType=adapay |
      |                    |                      |                   |   payTime=now    |
      |                    |                      |                   |                  |
      |                    |  12. return          |                   |                  |
      |                    |      PayOutMessage("SUCCESS","OK")        |                  |
      |                    |--------------------->>|                   |                  |
      |                    |                      |                   |                  |
```

### Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Unknown Adapay adapter API surface** — The exact class names (`AdapayPayMessage`, `AdapayPaymentPlatform.PLATFORM_NAME`, success status field) in the `pay-java-adapay` adapter are not verified. | High | Inspect the adapter JAR before writing handler code. Confirm class names, platform identifier constant, and message structure. |
| **H5 redirect URL mismatch** — Adapay H5 payment return URL must be configured in both `merchant_details` and the Adapay merchant dashboard. | Medium | Document that `.return_url` in merchant_details must match the Adapay dashboard configuration. |
| **Callback signature verification** — Adapay's signature algorithm may differ from WeChat/Alipay. The eGzosN adapter should handle this, but verify. | Medium | Test callback end-to-end in a sandbox environment. The `pay-java-adapay` adapter should implement `PayService.verify()` correctly. |
| **Admin UI payType dropdown** — Current form has only 2 options (aliPay, wxV3Pay). Adding "adapayPay" shows fields like `certificateSerialNo` and `wechatPayPublicKey` which are irrelevant for Adapay. | Low | UI is functional but confusing. Acceptable for MVP. Future: conditional field display based on selected payType. |
| **PayTypeEnum `adapay` vs `PayIdEnum` `adapay_h5`** — Two different naming conventions exist: PayTypeEnum uses `adapay` (matching existing `alipay`, `weixin`) while PayIdEnum uses `adapay_h5` (matching existing `ali_h5`, `wx_h5`). | Low | Document this distinction clearly. PayTypeEnum value is stored in orders; PayIdEnum is used only for merchant_details id lookup. |
| **No Adapay sandbox/test environment** — Unlike WeChat/Alipay which have well-known sandbox environments, Adapay's test environment may differ. | Medium | Verify `isTest` flag behavior with the Adapay adapter. May need to use separate merchant credentials for test vs production. |
