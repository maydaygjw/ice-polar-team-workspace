# 活动推荐阶梯奖励契约变更

## Admin API

统一前缀 `/admin-api/activity`，响应使用现有 `CommonResult`。沿用活动模板、奖品和中奖查询权限；不新增权限点。

### 模板配置

现有模板创建、更新、详情和分页响应增加 `referralRewards`：

```json
[
  { "type": "ORDINARY", "threshold": 3, "prizeId": 1001, "quantity": 100 },
  { "type": "ORDINARY", "threshold": 5, "prizeId": 1002, "quantity": 50 },
  { "type": "NEWCOMER", "threshold": 2, "prizeId": 1003, "quantity": 30 }
]
```

- `type`：`ORDINARY` 普通推荐或 `NEWCOMER` 新人推荐。
- `threshold`：当前期次累计推荐人数门槛；同一类型内必须是正整数且不能重复，响应按升序排列。
- `prizeId`：当前租户活动奖品库中的奖品 ID；校验奖品存在及规则参数可用。沿用现有已引用停用奖品的回显/更新语义。
- `quantity`：此档每个新期次独立的推荐奖励份数，不读取或修改模板开奖奖品数量。
- 同一奖品可用于多个档位或两种推荐类型；各档数量完全分开。
- 原有 `inviteRegistrationChance` 字段保留，创建/更新/详情/分页继续读写且与 `referralRewards` 互不影响。

模板校验错误包括：推荐类型不支持、人数门槛非正整数/重复/不递增、数量非正整数、奖品不存在或跨租户、奖品规则参数不可用。

### 推荐奖励记录查询与后台兑换

`GET /admin-api/activity/referral-reward/page?periodId={id}` 查询当前租户活动期次推荐奖励记录，返回领取用户、期次、推荐类型、门槛、奖品快照、奖励时间、兑奖码、兑奖状态和兑奖时间。该接口继续沿用 `activity:winner:query` 权限，供既有期次弹窗兼容读取。

`GET /admin-api/activity/referral-reward/progress-page?periodId={id}&userId={id}` 按期次分页查询推荐人进度，返回推荐人 ID、新人推荐数、普通推荐数及该推荐人的全部奖励记录。`userId` 可选；普通推荐数包含新人推荐数。

`POST /admin-api/activity/referral-reward/claim?id={id}` 由后台兑换指定推荐奖励。仅允许当前租户有效的待兑奖奖励，沿用已快照的开奖规则和兑奖状态语义。权限分别为 `activity:referral:query` 与 `activity:referral:claim`。

## App API

要求活动用户登录的接口从认证上下文读取用户 ID 和租户，不接受客户端指定奖励所属用户。

### 活动详情中的阶梯说明

现有 `GET /app-api/activity/period/detail` 与 `/latest` 响应增加 `referralRewardTiers[]`，仅返回公开信息：`type`、`threshold`、`prizeName`、`image`、`claimInstruction`。不返回奖品库 ID、推荐奖励剩余数量、已发数量或内部规则参数。

同时保留 `inviteRegistrationChance`，用于原推荐抽奖/游戏机会提示；两组信息分别返回。

### 我的结果中的进度和奖励

现有 `GET /app-api/activity/period/my-result?periodId={id}` 增加：

```json
{
  "referralProgress": {
    "newcomerCount": 1,
    "ordinaryCount": 3,
    "newcomerTiers": [
      { "threshold": 2, "prizeName": "饮品券", "achieved": false, "stockExhausted": false }
    ],
    "ordinaryTiers": [
      { "threshold": 3, "prizeName": "饮品券", "achieved": true, "stockExhausted": false }
    ]
  },
  "referralRewards": [
    {
      "referralRewardId": 7001,
      "type": "ORDINARY",
      "threshold": 3,
      "prizeName": "饮品券",
      "prizeImage": "https://example.invalid/prize.png",
      "claimInstruction": "在我的券包查看",
      "redemptionCode": "REC7K4M9Q2X8P",
      "claimStatus": 0,
      "claimTime": null,
      "offlineClaim": false
    }
  ]
}
```

- `newcomerCount` 和 `ordinaryCount` 仅针对指定期次；普通人数包含新人。
- 两类 `*Tiers[]` 按门槛升序，包含奖品展示信息、`achieved` 和 `stockExhausted`；不得返回可用库存数。
- `referralRewards[]` 仅包含当前登录用户作为推荐人的奖励记录。`claimStatus` 继续使用 `0` 待兑奖、`1` 已兑奖、`2` 处理中。
- 期次模板未配置新阶梯奖励时，数组为空且进度为 0；旧抽奖/游戏机会字段保持现状。

### 现有自助兑奖接口扩展

保留 `POST /app-api/activity/period/claim?winnerId={id}` 的原有行为，增加 `referralRewardId` 参数：

- 请求必须且只能传 `winnerId` 或 `referralRewardId` 之一；两者都传或都不传返回参数校验错误。
- 传 `winnerId` 时完全沿用中奖记录兑奖逻辑，保持旧客户端兼容。
- 传 `referralRewardId` 时只允许当前登录用户兑奖其本人、当前租户下的有效待兑奖推荐奖励；成功/幂等/处理中/规则失败/线下兑奖语义与现有兑奖规则一致。
- 不存在或不属于当前用户的奖励返回统一的“奖励记录不存在”业务错误，避免泄露其他用户奖励信息。
- 线下兑奖奖励返回现有客服指引错误；用户端结果继续提供 `offlineClaim` 和兑奖码。

## DB Schema

Flyway 增量：`backend/sql/migrations/V2026102601__activity_referral_rewards.sql`（上游同步版本）和 `backend/sql/migrations/V2026102602__activity_referral_menu.sql`。不修改基线 SQL。新增业务表均包含 `tenant_id`、标准审计字段及 `deleted` 字段；查询显式限制租户。

| 表 | 用途与关键字段 | 约束/索引 |
|---|---|---|
| `yshop_activity_template_referral_tier` | 模板阶梯：`template_id`、`type`、`threshold`、`prize_id`、`quantity` | `(tenant_id, template_id, type, threshold, deleted)` 唯一；模板查询索引 |
| `yshop_activity_period_referral_tier` | 期次阶梯/奖品规则快照：来源阶梯/奖品 ID、`type`、`threshold`、奖品名称/图片/说明、规则类型/参数/版本、`reward_quantity`、`issued_quantity` | `(tenant_id, period_id, type, threshold, deleted)` 唯一；期次索引 |
| `yshop_activity_user_template_participation` | 用户首次参加标记：`template_id`、`user_id`、`first_period_id`、`first_registration_id`、`first_referrer_user_id`、`first_register_time` | `(tenant_id, template_id, user_id)` 唯一 |
| `yshop_activity_period_referral_progress` | 每期/推荐人的 `ordinary_count`、`newcomer_count` | `(tenant_id, period_id, referrer_user_id)` 唯一 |
| `yshop_activity_referral_reward` | 推荐人兑奖记录：`period_id`、`user_id`、`period_tier_id`、`type`、`threshold`、奖品展示快照、兑奖码/状态/时间 | `(tenant_id, period_id, user_id, period_tier_id, deleted)` 唯一；用户期次/兑奖状态索引；`(tenant_id, redemption_code, deleted)` 唯一 |

兑奖码使用 `REC` 前缀；现有开奖兑奖码使用 `ACT` 前缀，命名空间不重叠。首次参加表通过保留的成功报名记录按 `(tenant_id, template_id, user_id)` 分组、按报名时间和记录 ID 排序，回填每组最早记录；迁移不修改现有报名/中奖数据。

新增表删除属于破坏性回滚：仅允许在未产生推荐兑奖记录的环境执行。已存在推荐奖励或兑领奖历史后，以停用模板阶梯并前向迁移处理，不删除历史记录。

## 事务、幂等与权限

- 新推荐计数只在报名记录成功插入后执行；推荐人须在同一期有有效报名。已有期次报名唯一索引负责被推荐用户期次内去重。
- 通过唯一首次参加行判定新人。推荐人/期次进度行使用 `SELECT ... FOR UPDATE`（首次创建使用唯一键后再锁定）；同一推荐人并发报名按事务顺序逐次推进。
- 阶梯奖励记录唯一键防止重试重复发放；库存通过带条件的原子更新 `issued_quantity < reward_quantity` 控制。旧 `inviteRegistrationChance` 原逻辑单独执行。
- 推荐记录兑奖先锁定奖励行并校验 `tenant_id`、`user_id`、状态；执行已快照的开奖规则参数。失败维持待兑奖，可按现有用户端语义重试。
- Admin 模板使用现有 `activity:template:*`；期次推荐奖励查询使用 `activity:winner:query`。用户端使用 `@PreAuthenticated`；无新增菜单权限、MQ、外部依赖或跨模块依赖。

## 错误语义

- 模板保存：无效奖品、跨租户奖品、门槛/数量非法及规则参数不可用，返回对应字段的业务校验错误。
- 报名：原有期次关闭、报名条件不通过、用户已报名、推荐人无效等错误保持现有语义；不满足推荐人同期期有效报名时仅不触发两种推荐奖励，不影响报名成功。
- 兑奖：错误参数组合返回参数错误；奖励不存在/非本人记录返回统一记录不存在；处理中记录拒绝并发重复执行；线下兑奖保持客服指引；线上规则执行失败保持待兑奖并可重试。

## 兼容性

- `inviteRegistrationChance` 及其历史默认值、报名后增加机会行为和 H5 原有机会提示继续兼容。
- 已生成期次不增加或改变历史新阶梯配置；新字段为空时视为未配置。
- `winnerId` 兑奖调用及 `ActivityWinner` 公示、中奖通知、开奖统计和海报数据不包含新推荐奖励记录；推荐奖励由独立的活动推荐管理页面展示。
- OpenAPI 机器快照在实现阶段更新。
