## Feature: 小程序端积分获取功能

### Scope

**In Scope**
1. 积分规则配置（admin 后台 + 后端 API）
   - 消费返积分比例（订单实付金额 × 比例）
   - 每日签到基础积分
   - 连续签到阶梯奖励（如连续 7 天额外奖励）
2. 签到功能（后端 API + 小程序端）
   - 每日签到获取积分
   - 连续签到天数统计
   - 签到状态查询（今日是否已签到）
3. 消费返积分（后端）
   - 在 `paySuccess()` 中增加按规则返积分逻辑
   - 与现有商品级 `giveIntegral` 并存（两者叠加）
4. 用户积分展示（小程序端）
   - 个人中心显示积分余额
   - 积分中心页面（积分余额 + 签到 + 积分明细入口）
   - 积分明细页面（复用现有账单流水 API）

**Out of Scope**
- 积分兑换/积分商城（已有功能，保持不变）
- 积分手动调整（admin 已有用户编辑功能）
- 积分过期机制
- 邀请好友得积分
- 积分抵扣支付金额

### Data Model Changes

1. **New Table: `yshop_score_rule`**
   - 积分规则配置表（租户级）

2. **New Table: `yshop_user_sign`**（可选，也可用 Redis 存储签到记录）
   - 用户签到记录表

3. **Alter Table: `yshop_user`** — 无需变更，已有 `integral`/`signNum`

### API Requirements

**Backend (Admin API)**
- `GET /admin-api/score/rule` — 获取积分规则
- `POST /admin-api/score/rule` — 创建/更新积分规则

**Backend (App API)**
- `GET /app-api/score/rule` — 获取当前租户积分规则（小程序展示用）
- `POST /app-api/score/sign` — 签到
- `GET /app-api/score/sign/status` — 查询今日签到状态
- `GET /app-api/score/bill` — 积分明细（复用现有 `getBillList` 或新增）

**MiniApp**
- 积分中心页面 `/pages/score/center`
- 积分明细页面 `/pages/score/bill`
- 个人中心显示积分余额（修改现有页面）

### Edge Cases

1. 跨天签到：用户昨天未签到，今天签到应重置连续天数为 1
2. 重复签到：同一天多次调用签到 API 应幂等返回已签到
3. 消费返积分与商品 giveIntegral 叠加：订单同时享受两种积分奖励
4. 退款订单：已发放的消费积分是否需要回退？（V1 不回退，降低复杂度）
5. 多租户：不同租户积分规则独立

### Acceptance Criteria

- [ ] 管理员可在后台配置积分规则（返积分比例、签到积分、连续签到奖励）
- [ ] 用户支付成功后，按规则获得积分（与商品 giveIntegral 叠加）
- [ ] 用户每日可签到一次，获得积分
- [ ] 连续签到 7 天获得额外奖励积分
- [ ] 小程序积分中心正确显示积分余额、签到按钮、积分明细
- [ ] 签到按钮状态正确（已签到/未签到）
- [ ] 积分明细列表展示收支记录
