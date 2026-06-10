## Test Plan: 小程序端积分获取功能

### Unit Tests

| Module | Test Target | Cases |
|--------|-------------|-------|
| score-biz | ScoreRuleService | getScoreRule returns rule by tenant; saveScoreRule creates/updates correctly |
| score-biz | ScoreSignService | sign on first day returns base score; sign consecutive day returns bonus; duplicate sign throws error |
| member-biz | MemberUserService | incScore adds to integral correctly |

### E2E Tests

#### Scenario 1: 消费返积分
1. 配置积分规则：orderGainRate = 2.00
2. 小程序用户下单支付 10 元
3. 验证用户积分增加 20
4. 验证积分流水记录正确

#### Scenario 2: 每日签到
1. 配置积分规则：signBaseScore = 5
2. 小程序用户点击签到
3. 验证返回获得 5 积分
4. 再次点击签到 → 提示已签到
5. 验证积分余额增加 5

#### Scenario 3: 连续签到奖励
1. 配置积分规则：signBaseScore = 5, continuousDays = 7, continuousBonus = 20
2. 模拟连续签到 6 天
3. 第 7 天签到 → 验证获得 25 积分（5 + 20）
4. 验证 isContinuousBonus = true

#### Scenario 4: 签到状态查询
1. 未签到用户查询 → isTodaySigned = false
2. 签到后查询 → isTodaySigned = true, continuousDays 正确

#### Scenario 5: 积分明细
1. 消费返积分后查看明细 → 显示"消费返积分"记录
2. 签到后查看明细 → 显示"每日签到"记录

#### Scenario 6: Admin 积分规则配置
1. 管理员访问积分规则页面
2. 修改返积分比例为 1.5
3. 保存成功
4. 刷新页面验证值已保存

### Regression Tests
- 现有积分商城兑换功能不受影响
- 现有订单确认收货 giveIntegral 发放不受影响
- 现有用户账单查询不受影响
