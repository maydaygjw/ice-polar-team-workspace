## Technical Design: 小程序端积分获取功能

### Database Changes

#### New Table: `yshop_score_rule`

```sql
CREATE TABLE `yshop_score_rule` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL DEFAULT '0',
  `order_gain_rate` decimal(5,2) NOT NULL DEFAULT '0.00' COMMENT '消费返积分比例(1元=X积分)',
  `sign_base_score` int NOT NULL DEFAULT '0' COMMENT '每日签到基础积分',
  `sign_continuous_enabled` tinyint NOT NULL DEFAULT '0' COMMENT '连续签到奖励是否启用 0=否 1=是',
  `sign_continuous_days` int NOT NULL DEFAULT '7' COMMENT '连续签到天数门槛',
  `sign_continuous_bonus` int NOT NULL DEFAULT '0' COMMENT '连续签到奖励积分',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `update_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='积分规则配置表';
```

#### New Table: `yshop_user_sign`

```sql
CREATE TABLE `yshop_user_sign` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL DEFAULT '0',
  `uid` bigint NOT NULL COMMENT '用户ID',
  `sign_date` date NOT NULL COMMENT '签到日期',
  `score` int NOT NULL DEFAULT '0' COMMENT '获得积分',
  `continuous_days` int NOT NULL DEFAULT '1' COMMENT '连续签到天数',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_uid_date` (`uid`,`sign_date`),
  KEY `idx_uid` (`uid`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户签到记录表';
```

### API Design

#### Admin API

```
GET  /admin-api/score/rule/detail      → ScoreRuleRespVO
POST /admin-api/score/rule/save        → Body: ScoreRuleSaveReqVO → Long (id)
```

**ScoreRuleRespVO / ScoreRuleSaveReqVO:**
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

#### App API

```
GET  /app-api/score/rule               → ScoreRuleRespVO
POST /app-api/score/sign               → AppSignResultVO
GET  /app-api/score/sign/status        → AppSignStatusVO
GET  /app-api/score/bill               → PageResult<AppUserBillVO>
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

### Module Impact

| Module | Change Type | Description |
|--------|-------------|-------------|
| `yshop-module-score` | 修改 | 新增 score-rule 相关 DO/Mapper/Service/Controller |
| `yshop-module-score` | 修改 | 新增 user-sign 相关 DO/Mapper/Service/Controller |
| `yshop-module-order` | 修改 | `AppStoreOrderServiceImpl.paySuccess()` 增加返积分逻辑 |
| `yshop-module-member` | 复用 | `UserBillService.getBillList()` 复用为积分明细 API |
| `yshop-module-member` | 修改 | `MemberUserService` 增加 `incScore()` 方法（现有只有 `decScore()`） |
| `miniapp` | 新增 | 积分中心页面、积分明细页面、个人中心修改 |
| `admin` | 新增 | 积分规则配置页面 |

### Sequence Diagram

#### 消费返积分

```
WeChat Pay Callback
    ↓
AppStoreOrderServiceImpl.paySuccess()
    ├── 更新订单状态
    ├── 扣库存/增销量
    ├── 计算 commission
    ├── [NEW] ScoreRuleService.getRule(tenantId)
    ├── [NEW] 计算返积分 = payPrice × orderGainRate + gainIntegral(商品级)
    ├── [NEW] MemberUserService.incScore(uid, score)
    ├── [NEW] UserBillService.income(...) — 积分流水
    └── 发送通知
```

#### 签到

```
MiniApp 点击签到
    ↓
POST /app-api/score/sign
    ↓
ScoreSignService.sign(uid)
    ├── 查询今日是否已签到
    ├── 查询昨天是否签到 → 计算 continuousDays
    ├── 查询积分规则
    ├── 计算今日积分（基础 + 连续奖励）
    ├── MemberUserService.incScore(uid, score)
    ├── UserBillService.income(...) — 积分流水
    ├── 保存签到记录
    └── 更新 user.signNum
```

### Risk Assessment

| Risk | Level | Mitigation |
|------|-------|------------|
| 与现有 `giveIntegral` 冲突 | Low | 两者叠加，逻辑清晰独立 |
| 重复签到并发 | Medium | 数据库唯一索引 `uk_uid_date` + 业务层幂等检查 |
| 退款积分回退 | Low | V1 不回退，在 CHANGE-REPORT 中注明 |
| 连续签到跨天边界 | Low | 以服务器日期为准，`sign_date` 为 date 类型 |
