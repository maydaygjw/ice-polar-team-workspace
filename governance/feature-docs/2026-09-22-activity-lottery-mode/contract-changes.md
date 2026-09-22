# 活动抽奖模式契约变更

## 1. Admin API

统一前缀仍为 `/admin-api/activity`，响应沿用 `CommonResult`，所有接口要求活动权限、租户隔离和现有部门/商圈数据权限。

### 模板请求变更

模板创建/更新增加：

```json
{
  "drawMode": "DRAW",
  "registrationStartTime": "09:00:00",
  "registrationEndTime": "18:00:00",
  "drawTime": "20:00:00",
  "prizes": [
    {
      "prizeId": 1001,
      "quantity": 10,
      "sort": 1,
      "probability": 5.00
    }
  ]
}
```

规则：

- `drawMode` 只能为 `DRAW` 或 `LOTTERY`，省略时按 `DRAW` 处理。
- `DRAW` 模式要求 `drawTime`，概率可为空且不参与统一开奖算法。
- `LOTTERY` 模式要求 `drawTime=null`；每个奖品必须提供 `probability`，范围 `0.00–100.00`，累计不超过 `100.00`。
- `registrationStartTime` 必须早于 `registrationEndTime`。
- `DRAW` 模式还要求报名结束时间不晚于开奖时间。
- 奖品数量仍必须为正整数；奖品顺序影响概率区间边界和后台展示顺序。

模板详情和分页响应增加：

```json
{
  "drawMode": "LOTTERY",
  "drawModeName": "抽奖",
  "drawTime": null,
  "prizes": [
    {
      "prizeId": 1001,
      "quantity": 10,
      "probability": 5.00,
      "prizeName": "奶茶兑换券"
    }
  ]
}
```

### 期次接口变更

- 期次详情、分页响应增加 `drawMode`、`drawModeName`。
- `LOTTERY` 模式的 `drawTime` 返回 `null`。
- `POST /admin-api/activity/period/draw` 仅适用于 `DRAW` 模式；对 `LOTTERY` 模式返回模式不支持业务错误。
- `LOTTERY` 模式期次不进入开奖任务扫描，后台不显示手动开奖动作。

## 2. App API

### 即时抽奖

`POST /app-api/activity/period/draw`

要求登录，用户身份从 Bearer Token 获取。

请求体：

```json
{
  "periodId": 123,
  "requestId": "6d7f0f0b-2ddf-4f6c-a1d4-4a2f4c8bc7b9"
}
```

`requestId` 长度建议限制为 64 个字符，客户端每次新抽奖生成新的值；网络重试必须复用原值。

成功响应：

```json
{
  "drawResult": "WIN",
  "winner": {
    "winnerId": 90001,
    "prizeId": 1001,
    "prizeName": "奶茶兑换券",
    "image": "https://oss.example/prize.png",
    "claimInstruction": "凭中奖记录到店核销"
  },
  "drawChances": 3,
  "drawChancesUsed": 1,
  "remainingDrawChances": 2
}
```

未中奖响应仍为成功响应：

```json
{
  "drawResult": "NO_WIN",
  "winner": null,
  "drawChances": 3,
  "drawChancesUsed": 2,
  "remainingDrawChances": 1
}
```

同一用户、同一期、同一 `requestId` 重试时返回第一次完整响应，不重复消耗次数、不重复生成中奖记录。

### 既有接口语义

- `/register` 不自动抽奖；报名成功后由客户端调用 `/draw`。
- `/increase-chances` 在 `LOTTERY` 模式下的截止点为报名结束时间。
- `/my-result` 继续返回报名记录和中奖记录，不新增抽奖尝试明细。
- 期次详情返回模式、报名窗口和奖品概率，客户端不得自行计算中奖结果。
- 本期仅定义 app-api 契约，不修改 `miniapp` 或其他客户端代码；客户端接入另行立项。

## 3. 错误语义

| 场景 | 建议语义 |
|---|---|
| 期次不是 `LOTTERY` 模式 | `ACTIVITY_LOTTERY_MODE_REQUIRED` |
| 期次不在报名时间窗口 | `REGISTRATION_CLOSED` 或现有统一活动状态错误 |
| 当前用户未有效报名 | `REGISTRATION_NOT_EXISTS` |
| 抽奖次数已用完 | `DRAW_CHANCE_NOT_ENOUGH` |
| requestId 为空或超长 | 参数校验错误 |
| 概率为空、越界或总和大于 100% | 模板配置校验错误 |
| 奖品库存耗尽 | 成功返回 `NO_WIN`，消耗一次机会 |
| singleWinner 用户已中奖 | 成功返回 `NO_WIN`，消耗一次机会 |
| 重复 requestId | 成功返回第一次结果 |

未中奖不是异常，不应使用错误码；客户端应根据 `drawResult` 展示结果。

## 4. 数据库契约

新增升级脚本：`backend/sql/upgrade-2026-09-22-activity-lottery-mode.sql`。

- `yshop_activity_template.draw_mode TINYINT NOT NULL DEFAULT 1`。
- `yshop_activity_template_prize.probability DECIMAL(5,2) NULL`。
- `yshop_activity_period.draw_mode TINYINT NOT NULL DEFAULT 1`。
- `yshop_activity_period_snapshot.draw_mode TINYINT NOT NULL DEFAULT 1`。
- `yshop_activity_period_prize.probability DECIMAL(5,2) NULL`。
- `yshop_activity_template.draw_time` 和 `yshop_activity_period.draw_time` 改为可空；业务层保证仅 `LOTTERY` 模式为空。
- 新增 `yshop_activity_draw_attempt`，包含租户、期次、报名、用户、requestId、结果、奖品、中奖记录、概率快照、批次号和抽奖时间。
- 新增唯一键 `tenant_id + period_id + user_id + request_id + deleted`，以及按期次、用户和时间查询的索引。
- 所有业务查询显式限制租户，不使用数据库级外键。

回滚必须包含新增表、字段、索引删除语句；不删除历史活动记录。

## 5. 权限和安全边界

- 使用现有活动模板、期次、报名和中奖权限，不新增后台“用户抽奖”代操作接口。
- App API 只允许当前登录用户抽取自己的有效报名记录。
- 客户端不能传入 `userId`、`tenantId`、`registrationId`、中奖结果、概率或奖品库存。
- `requestId` 只用于幂等，不参与随机算法。
