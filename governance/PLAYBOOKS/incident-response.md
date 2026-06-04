# Incident Response & Online Issue Diagnosis SOP

> 线上问题排查标准作业程序。devops-agent 收到用户报障后按此流程执行。

---

## 1. Environment Information

### 1.1 Servers

| Service | Host | IP | Deploy User | Code Path | Log Path |
|---------|------|-----|-------------|-----------|----------|
| yshop-drink (backend) | rprod18 | 139.196.173.216 | root | /opt/holun/yshop-drink | /opt/holun/yshop-drink/yshop-server/app.log |
| icepolar-dms | — | — | — | — | — |
| yshop-drink-vue (admin) | — | — | — | — | — |
| icepolarminiapp | — | — | — | — | — |

### 1.2 Database

| Property | Value |
|----------|-------|
| Engine | MySQL 8.0 |
| Connection info | Read from server config: `cat /opt/holun/yshop-drink/yshop-server/src/main/resources/application-local.yaml` (or active profile) |
| Key tables | `yshop_store_order`, `yshop_coupon_user`, `yshop_coupon`, `yshop_user`, `yshop_store_product` |

### 1.3 Log Locations

| Service | Log File | Rotation |
|---------|----------|----------|
| yshop-drink | `/opt/holun/yshop-drink/yshop-server/app.log` | No auto-rotation configured; use `tail -n` |

---

## 2. Diagnosis Workflow

```
Receive report
    ↓
[1] Gather clues — order ID, user ID, timestamp, error message, screenshot
    ↓
[2] Query application logs (SSH → tail/grep around incident time)
    ↓
[3] Query database records (MySQL CLI → inspect related tables)
    ↓
[4] Cross-reference with source code (read relevant Controller/Service/Mapper)
    ↓
[5] Form root-cause hypothesis
    ↓
[6] Document findings in a brief diagnosis report
    ↓
[7] If code fix needed → reach relevant developer agent
    If config/env fix needed → fix and verify
    If external dependency issue → document workaround and escalate
```

---

## 3. Common Commands

### 3.1 SSH into server

```bash
ssh root@139.196.173.216
```

### 3.2 Query application logs

```bash
# Last N lines
ssh root@139.196.173.216 "tail -n 200 /opt/holun/yshop-drink/yshop-server/app.log"

# Grep by order ID
ssh root@139.196.173.216 "grep -n 'ORDER_ID' /opt/holun/yshop-drink/yshop-server/app.log | tail -n 50"

# Grep by timestamp (e.g. 2025-06-04 14:30)
ssh root@139.196.173.216 "grep -n '2025-06-04 14:3' /opt/holun/yshop-drink/yshop-server/app.log | tail -n 50"

# Follow live logs
ssh root@139.196.173.216 "tail -f /opt/holun/yshop-drink/yshop-server/app.log"
```

### 3.3 Query database

```bash
# Read DB credentials from config
ssh root@139.196.173.216 "grep -A5 'datasource' /opt/holun/yshop-drink/yshop-server/src/main/resources/application-local.yaml"

# Connect to MySQL (example — use actual credentials from config)
ssh root@139.196.173.216 "mysql -h HOST -P PORT -u USER -p'PASSWORD' -e 'USE DB; SELECT ...'"
```

---

## 4. Scenario Checklists

### 4.1 Order/Payment Issue

Given: order ID + symptom (e.g. "unpaid after coupon applied")

```
□ Check order record:
  SELECT order_id, uid, paid, status, pay_price, coupon_id, coupon_price, total_price,
         create_time, pay_time, pay_type
  FROM yshop_store_order
  WHERE order_id = 'ORDER_ID';

□ Check coupon record (if coupon was used):
  SELECT id, user_id, status, title, value, least, start_time, end_time
  FROM yshop_coupon_user
  WHERE id = COUPON_ID_FROM_ORDER;

□ Check user record:
  SELECT id, now_money, openid, routine_openid
  FROM yshop_user
  WHERE id = UID_FROM_ORDER;

□ Check application logs for exceptions around order creation / payment time
```

**Expected coupon lifecycle:**
1. User receives coupon → `yshop_coupon_user.status = 0` (unused)
2. Order created with coupon → `yshop_coupon_user.status = 1` (used) — done in `AppStoreOrderServiceImpl.createOrder`
3. Order paid → `yshop_store_order.paid = 1`
4. Order cancelled (if unpaid timeout) → `regressionCoupon()` restores `status = 0`

**Common failure modes:**
- `coupon_id` set on order but `coupon_user.status` still 0 → `getById()` returned null in `createOrder`
- `pay_price` on order ≠ frontend `finalAmount` → coupon not applied on backend
- `paid = 0` after user claims "payment success" → frontend skipped payment when `finalAmount = 0` but backend `payPrice > 0`

### 4.2 Device / Ice-Making Issue

Given: IMEI + order ID + symptom (e.g. "device not dispensing ice")

```
□ Check device order mapping:
  SELECT * FROM yshop_device_order WHERE order_no = 'ORDER_ID' AND imei = 'IMEI';

□ Check DMS order status via backend API or DMS logs

□ Check application logs for DMS command execution errors
```

### 4.3 Coupon Issue

Given: coupon ID or user ID + symptom (e.g. "coupon not shown" / "cannot claim")

```
□ Check coupon definition:
  SELECT id, title, is_switch, receive, distribute, start_time, end_time
  FROM yshop_coupon
  WHERE id = COUPON_ID;

□ Check user's coupon list:
  SELECT id, coupon_id, status, start_time, end_time
  FROM yshop_coupon_user
  WHERE user_id = UID AND coupon_id = COUPON_ID;

□ Verify tenant_id consistency across coupon_user and order tables
```

---

## 5. Diagnosis Report Template

When escalating to a developer agent, produce a report with:

```markdown
## Incident: [Brief description]

**Time:** [Incident timestamp]
**Reporter:** [User/agent who reported]
**Affected:** [Order ID / User ID / Scope]

### Observed Symptom
[What the user sees]

### Log Evidence
```
[Relevant log excerpts]
```

### Database Evidence
```sql
[Key query results]
```

### Code Path
[Relevant files and line numbers]

### Root Cause Hypothesis
[Most likely cause]

### Recommended Fix
[What code/config change is needed]

### Assigned To
[backend-agent / frontend-agent / miniapp-agent]
```

---

## 6. Escalation Rules

| Situation | Action |
|-----------|--------|
| Fix requires Java code change | Reach **backend-agent** with diagnosis report |
| Fix requires Vue/Admin UI change | Reach **frontend-agent** with diagnosis report |
| Fix requires Mini Program change | Reach **miniapp-agent** with diagnosis report |
| Fix is config/env only (nginx, DB, JVM params) | Fix directly, document change |
| External dependency failure (DMS down, WeChat Pay API error) | Document workaround, reach **coordinator-agent** |
| Data inconsistency requiring manual DB fix | Document step-by-step SQL, get approval before executing |

---

## 7. Safety Rules

1. **Never modify business logic code** — devops-agent only reads code for diagnosis; fixes are delegated to developer agents
2. **Never execute destructive SQL** (DELETE, UPDATE without WHERE, DROP) without explicit user approval
3. **Never hardcode credentials** in diagnosis scripts or reports
4. **Always verify on test environment first** before applying config changes to production
5. **Document every incident** — root cause, timeline, resolution, prevention measure
