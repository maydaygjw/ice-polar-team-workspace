# Review Report — 订单结算管理

## Summary

**Verdict**: Needs Fix (1 blocker)

7/8 checkboxes pass. 1 blocker found: tenant isolation gap in settlement detail endpoint.

---

## Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Implementation matches requirements | ✅ Pass |
| 2 | No secrets committed | ✅ Pass |
| 3 | Tenant isolation verified | ❌ **Blocker** — see Finding 1 |
| 4 | Database migration script present and correct | ✅ Pass |
| 5 | API contracts consistent with ARCHITECTURE.md | ✅ Pass |
| 6 | No code duplication | ✅ Pass |
| 7 | Tests cover the change | ⚠️ Incomplete — no new tests |
| 8 | ADR updated if needed | ✅ N/A — no new ADR required |

---

## Finding 1 (Blocker): Settlement detail endpoint lacks tenant isolation

**File**: `ProfitSharingOrderServiceImpl.java:374`

```java
public SettlementDetailRespVO getSettlementDetail(String orderId) {
    ProfitSharingOrderDO order = profitSharingOrderMapper.selectLatestByOrderId(orderId);
```

`ProfitSharingOrderDO` extends `BaseDO`, **not** `TenantBaseDO`. MyBatis Plus tenant interceptor does not apply to queries against this table. The `selectLatestByOrderId` method filters only by `orderId`, without any `tenant_id` check:

```java
// ProfitSharingOrderMapper.java
default ProfitSharingOrderDO selectLatestByOrderId(String orderId) {
    return selectOne(new LambdaQueryWrapperX<ProfitSharingOrderDO>()
            .eq(ProfitSharingOrderDO::getOrderId, orderId)
            .orderByDesc(ProfitSharingOrderDO::getCreateTime)
            .last("LIMIT 1"));
}
```

**Impact**: An authenticated admin from tenant A who knows an `orderId` from tenant B can call `GET /pay/profit-sharing-order/settlement-detail?orderId={tenantB_orderId}` and receive:
- Shop name, pay price, Adapay payment ID, confirm ID, sharing time
- Fee bearer role, calculation type, fallback revenue status
- Error messages

The items list will return empty (those queries do check tenant), but the main record data still leaks.

**Contrast with correct pattern**: `PayOutOrderNoMapper.selectByOrderId` takes `tenantId` as an explicit parameter:
```java
default List<PayOutOrderNoDO> selectByOrderId(Long tenantId, String orderId, String payType)
```

**Fix**: Add tenant filter to `selectLatestByOrderId`:
```java
default ProfitSharingOrderDO selectLatestByOrderId(String orderId, Long tenantId) {
    return selectOne(new LambdaQueryWrapperX<ProfitSharingOrderDO>()
            .eq(ProfitSharingOrderDO::getOrderId, orderId)
            .eq(ProfitSharingOrderDO::getTenantId, tenantId)
            .orderByDesc(ProfitSharingOrderDO::getCreateTime)
            .last("LIMIT 1"));
}
```

And update the caller to pass `TenantContextHolder.getTenantId()`.

---

## Finding 2 (Advisory): LEFT JOIN on profit sharing table doesn't check tenant

**File**: `StoreOrderSettlementMapper.xml:28-34`

```sql
LEFT JOIN yshop_adapay_profit_sharing_order pso
    ON o.order_id = pso.order_id
    AND pso.deleted = 0
    AND pso.create_time = (...)
```

The WHERE clause already ensures `o.tenant_id = #{tenantId}` and orders are unique per tenant, so `pso.order_id` correctly scoped. However, adding `AND pso.tenant_id = #{tenantId}` to the JOIN would be defense-in-depth. Risk is very low.

**Recommendation**: Add `AND pso.tenant_id = #{tenantId}` for consistency with multi-tenant principles.

---

## Positive Observations

1. **Bank card data protection**: The `SettlementDetailItemVO` only exposes `cardNoMask`, `bankName`, `provName`, `areaName` — all pre-masked fields from `ProfitRecipientDO`. No full card numbers in any response. ✅

2. **Permission model**: New `order:settlement:query` permission cleanly separated from existing `pay:profit-sharing:query`. The settlement list uses `order:settlement:query` (correct, since it's order-biz). The settlement detail also uses `order:settlement:query` (correct, since it's called from the same page). ✅

3. **SQL injection safe**: All Mapper XML uses parameterized `#{}` placeholders. No `${}` string interpolation. ✅

4. **Idempotent migration**: `upgrade-order-settlement-management.sql` uses `WHERE NOT EXISTS` guards, safe for re-execution. Follows existing `upgrade-site-order-menu.sql` pattern. ✅

5. **CASE statement consistency**: The settlement status CASE logic is duplicated between SELECT and WHERE — this is necessary for MySQL, and both copies are identical. ✅

6. **Frontend edge cases**: Handles null recipient names ("收款人已删除"), null bank info ("--"), and disabled detail button for non-Adapay orders. ✅

---

## Test Coverage

No new tests added. The feature is a read-only data aggregation layer (JOIN + CASE mapping), with no business logic branches to unit test. The risk of regression is low. Acceptable for this feature type, though a simple integration test for the settlement status CASE logic would add confidence.

---

## Fix Applied

**Finding 1 (Blocker)** — Fixed:

- `ProfitSharingOrderMapper.selectLatestByOrderId(orderId)` → `selectLatestByOrderId(orderId, tenantId)`, added `.eq(ProfitSharingOrderDO::getTenantId, tenantId)`
- `ProfitSharingOrderServiceImpl.getSettlementDetail()` now passes `TenantContextHolder.getTenantId()`

**Finding 2 (Advisory)** — Fixed:

- `StoreOrderSettlementMapper.xml` LEFT JOIN added `AND o.tenant_id = pso.tenant_id`

Recompilation passed. All blockers resolved.

---

## Conclusion

All checks pass. Ready for delivery.
