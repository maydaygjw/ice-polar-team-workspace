# Incident Response & Online Issue Diagnosis SOP

> 线上问题排查标准作业程序。devops-agent 收到用户报障后按此流程执行。

---

## 1. Environment Information

> 服务器连接、部署路径、进程/端口健康检查等运维信息见 `deployment.md`。
> 本节只保留问题排查所需的线索信息。

### 1.1 Log Locations

| Service | Log File |
|---------|----------|
| yshop-drink | `/opt/holun/yshop-drink/yshop-server/app.log` |
| icepolar-dms | `/opt/holun/icepolar/icepolar-dms/scripts/main.log` |
| icepolar-dms simulator | `/opt/holun/icepolar/icepolar-dms/scripts/simulator.log` |

> 无自动轮转，使用 `tail -n` 按需读取。

### 1.2 Database

| Property | Value |
|----------|-------|
| Engine | MySQL 8.0 |
| Connection info | Read from server config: `cat /opt/holun/yshop-drink/yshop-server/src/main/resources/application-local.yaml` (or active profile) |
| Key tables | `yshop_store_order`, `yshop_coupon_user`, `yshop_coupon`, `yshop_user`, `yshop_store_product` |

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

### 3.2.1 Query DMS logs

```bash
# Last N lines of DMS main service log
ssh root@139.196.173.216 "tail -n 200 /opt/holun/icepolar/icepolar-dms/scripts/main.log"

# Last N lines of DMS simulator log
ssh root@139.196.173.216 "tail -n 200 /opt/holun/icepolar/icepolar-dms/scripts/simulator.log"

# Grep by IMEI
ssh root@139.196.173.216 "grep -n 'IMEI' /opt/holun/icepolar/icepolar-dms/scripts/main.log | tail -n 50"

# Grep by order ID
ssh root@139.196.173.216 "grep -n 'ORDER_ID' /opt/holun/icepolar/icepolar-dms/scripts/main.log | tail -n 50"

# Check DMS port (production uses 8001)
ssh root@139.196.173.216 "ss -tlnp | grep 8001"

# Check DMS process
ssh root@139.196.173.216 "ps -ef | grep 'start_main.sh' | grep -v grep"

# Check simulator process
ssh root@139.196.173.216 "ps -ef | grep 'start_simulator.sh' | grep -v grep"
```

### 3.3 Query database

```bash
# Read DB credentials from config
ssh root@139.196.173.216 "grep -A5 'datasource' /opt/holun/yshop-drink/yshop-server/src/main/resources/application-local.yaml"

# Connect to MySQL (example — use actual credentials from config)
ssh root@47.101.64.142 "mysql -h localhost -P 13306 -u root -p'admin123456' -e 'USE DB; SELECT ...'"
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
| External dependency failure (DMS down, WeChat Pay API error) | Document workaround, notify user and log the incident |
| Data inconsistency requiring manual DB fix | Document step-by-step SQL, get approval before executing |

---

## 7. Safety Rules

1. **Never modify business logic code** — devops-agent only reads code for diagnosis; fixes are delegated to developer agents
2. **Never execute destructive SQL** (DELETE, UPDATE without WHERE, DROP) without explicit user approval
3. **Never hardcode credentials** in diagnosis scripts or reports
4. **Always verify on test environment first** before applying config changes to production
5. **Document every incident** — root cause, timeline, resolution, prevention measure
