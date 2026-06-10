## Feature-level Contract Changes: score-integration

### Contract Layer Status

| Layer | Status | Notes |
|-------|--------|-------|
| Platform (`CONTRACTS.md`) | Reused as-is | 通用响应结构、租户隔离规则无变化 |
| Feature (this file) | **Changed** | 新增 score-rule / score-sign API |
| Machine (`backend-api.json`) | Will update | Phase 3 通过 `extract-openapi` 生成 |

### New Admin API

```
GET  /admin-api/score/rule/detail
Response: CommonResult<ScoreRuleRespVO>

POST /admin-api/score/rule/save
Body: ScoreRuleSaveReqVO
Response: CommonResult<Long>
```

### New App API

```
GET  /app-api/score/rule
Response: CommonResult<ScoreRuleRespVO>
Permission: @PreAuthenticated

POST /app-api/score/sign
Response: CommonResult<AppSignResultVO>
Permission: @PreAuthenticated

GET  /app-api/score/sign/status
Response: CommonResult<AppSignStatusVO>
Permission: @PreAuthenticated

GET  /app-api/score/bill
Params: page, limit
Response: CommonResult<PageResult<AppUserBillVO>>
Permission: @PreAuthenticated
```

### Modified App API

```
POST /app-api/order/create
Existing: StoreOrderDO.gainIntegral = sum(product.giveIntegral)
NEW: StoreOrderDO.gainIntegral = sum(product.giveIntegral) + payPrice × scoreRule.orderGainRate
Note: 商品级 giveIntegral 与订单级比例返积分叠加
```

### DTOs

**ScoreRuleRespVO:**
```json
{
  "id": 1,
  "orderGainRate": 1.00,
  "signBaseScore": 5,
  "signContinuousEnabled": 1,
  "signContinuousDays": 7,
  "signContinuousBonus": 20
}
```

**AppSignResultVO:**
```json
{
  "score": 5,
  "continuousDays": 3,
  "isContinuousBonus": false
}
```

**AppSignStatusVO:**
```json
{
  "isTodaySigned": true,
  "continuousDays": 3,
  "todayScore": 5
}
```

### Cross-Module Call

```
yshop-module-order-biz → yshop-module-score-api (ScoreRuleApi)
yshop-module-score-biz → yshop-module-member-api (MemberUserApi, UserBillApi)
```

### Permission Rules

| Endpoint | Required Permission |
|----------|---------------------|
| `/admin-api/score/rule/*` | `system:score:rule` (新增) |
| `/app-api/score/*` | 登录即可 (`@PreAuthenticated`) |
