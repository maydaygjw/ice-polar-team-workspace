# 活动游戏模式契约变更

## 活动游戏管理 API

不新增游戏专属接口域。游戏配置通过现有 `/admin-api/activity/template` 接口管理；活动模板创建、更新、详情和分页接口扩展游戏字段。响应使用 `CommonResult`，沿用管理端登录、租户隔离和现有活动模板权限。游戏配置独立存放在 `yshop_activity_game_config` 表。

- 游戏配置入口只查询和维护 `yshop_activity_game_config` 中当前租户的记录。
- 游戏配置沿用模板接口域，路由为 `GET /game-config/page`、`POST /game-config/create`、`PUT /game-config/update`。新增请求提交 `gameCode`、`name` 和 `enabled`；`gameCode` 由管理员填写并与 H5 实际实现保持一致，后端只做格式和租户内唯一性校验，不维护游戏白名单，也不按名称映射代码。更新只允许修改展示名称和启用状态，稳定代码不可修改。管理员不能上传或执行自定义游戏程序；停用不删除被模板或期次引用的历史配置。
- 游戏配置列表展示代码、名称和启用状态。已有游戏配置、模板和期次继续兼容。

使用现有 `activity:template:query`、`activity:template:create`、`activity:template:update` 权限，不新增权限点。

## 活动模板/期次 API

现有模板创建、更新、详情和分页 API 增加：

```json
{
  "drawMode": 3,
  "gameId": 501,
  "prizes": [
    { "levelNo": 1, "prizeId": 1001, "quantity": 1, "sort": 1 },
    { "levelNo": 2, "prizeId": 1002, "quantity": 1, "sort": 2 },
    { "levelNo": 3, "prizeId": 1003, "quantity": 1, "sort": 3 }
  ]
}
```

- `drawMode`: 1 开奖、2 抽奖、3 游戏；省略仍默认 1。
- `gameId` 仅 `drawMode=3` 时必填；非游戏模式不得依赖该字段。
- 游戏模式必须恰有 `levelNo=1,2,3` 的三个奖品配置，且无重复关卡号；使用既有奖品库及奖品数量/规则快照。
- 游戏模式不使用开奖时间；不进入定时开奖或手动开奖流程。
- 游戏模式复用报名记录的 `drawChances`/`drawChancesUsed` 作为游戏次数：报名默认 1 局；推荐报名成功增加 1 局；每局失败或第三关通过时消耗 1 局；终局且仍有剩余次数时可重新开始一局，进行中的游戏只能恢复原局。
- 期次详情、管理端期次响应和 app-api 活动详情增加 `drawMode=3`、`gameCode`、`gameName` 及关卡奖品 `levelNo`。用户端仍不返回库存、中奖概率或后台规则参数。

非游戏模板和历史期次继续按现有 1/2 模式读取；缺省 `drawMode` 按 1 处理。

## 用户端期次 API

不新增游戏专属接口域；在现有 `/app-api/activity/period` 接口下扩展操作，要求当前会员登录，用户 ID 和租户 ID 从认证上下文读取。

### 开始或恢复会话

`POST /game/start` 请求 `{ "periodId": 123 }`。当前登录用户必须在该期次有有效报名，期次须为游戏模式且处于报名开放状态。每个报名只创建一个会话，重复请求返回当前会话。

响应包括 `sessionId`、`gameCode`、`gameName`、`status`、`currentLevel`、`highestPassedLevel` 和已结算中奖摘要（如有）；不返回额外数字挑战。

### 提交当前关卡

`POST /game/submit` 请求：

```json
{
  "sessionId": 7001,
  "levelNo": 1,
  "requestId": "a1d3...",
  "passed": true
}
```

H5 按跳跃结果提交 `passed`。服务端校验用户、报名、会话状态、关卡顺序及 `requestId` 幂等性，并按已通过关数结算奖品；不再生成、返回或校验数字挑战。`passed` 是客户端报告的结果，服务端无法独立验证 Canvas 跳跃过程。响应返回 `levelResult`（PASS/FAIL）、更新后的会话状态和终局 `winner` 摘要（含中奖 ID、奖品展示信息和兑奖状态）。当前关通过且尚有下一关时只更新进度，不发奖；当前关失败或第 3 关通过导致游戏终局时，在本次提交事务内按最高已通过关卡结算，并在同一响应返回中奖结果。客户端不能传奖品、用户、通关层数或兑奖状态作为结算依据。相同 `requestId` 重试返回首次结果；关卡越序或终局会话继续提交返回业务错误。

历史 `game_progress` JSON 中可能仍含旧数字挑战字段；新服务端忽略该字段，不要求数据迁移。

第 1 关失败时 `highestPassedLevel=0`，无中奖记录；第 2 或第 3 关失败时，分别结算上一已通关关的奖品；第 3 关通过时结算第 3 关奖品。若期次库存已耗尽或单人限中不允许中奖，游戏仍终局，但 `winner` 为 `null` 并返回原因枚举。生成中奖记录后，客户端使用现有 `POST /app-api/activity/period/claim?winnerId={winnerId}` 兑奖；线下兑奖继续返回客服指引错误并保留待兑奖状态。

## 数据库增量

升级脚本：`backend/sql/upgrade-2026-10-15-activity-game-mode.sql`。游戏配置使用独立业务表；所有涉及数据的查询显式限制当前租户，不加数据库外键。

1. `yshop_activity_template` 增加 `record_type`（历史数据默认活动模板）、可空 `game_code` 和可空 `game_id`。游戏配置迁移到独立表，保存租户、稳定代码、展示名和启用状态；代码由后台维护并按租户唯一。活动模板的 `game_id` 引用游戏配置表。
2. `yshop_activity_template_prize` 增加可空 `level_no`；游戏模式取值 1–3 且唯一，非游戏模式为空。
3. `yshop_activity_period_snapshot` 增加游戏 ID、类型代码和名称快照。
4. `yshop_activity_period_prize` 增加可空 `level_no`，将逐关映射冻结到期次。
5. `yshop_activity_registration` 增加游戏状态、当前关、最高通过关和关卡幂等结果 JSON 字段。一个报名记录对应一局；终态不可重开。该表在游戏启动和提交时行锁更新进度。

新增字段及唯一键应有索引以支持按租户、期次、用户和报名定位。回滚仅删除本功能新增字段和索引；不删除或修改历史业务数据。

Flyway 迁移：`backend/sql/migrations/V2026101601__seed_enterprise_jump_game.sql`、`V2026101701__rename_enterprise_jump_game.sql`、`V2026101702__extract_activity_game_config.sql` 和 `V2026101703__remove_number_sorting_game.sql`。迁移会初始化并抽取游戏配置、将展示名称更新为“企鹅蓄力跳跃”，并删除“数字排序”配置。当前 H5 蓄力跳跃实现使用稳定代码 `ENTERPRISE_JUMP`。

## 事务、权限与幂等

- `start` 校验租户、期次模式、开放状态和有效报名；锁定报名记录并初始化或恢复进度。
- `game/submit` 按报名行锁执行关卡状态更新；仅在失败或第 3 关通过的终局提交中执行库存预占及中奖记录插入。同一请求不得重复推进或生成中奖记录。
- 游戏和关卡奖品均从期次快照读取；客户端不得传入 `gameCode`、`prizeId`、`registrationId`、`userId` 或 `tenantId`。
- 管理端沿用 `activity:template:*` 权限管理模板及游戏配置记录，不新增权限。C 端使用 `@PreAuthenticated`。
- 不新增 MQ、外部系统或运行时依赖。机器 OpenAPI 快照在实现阶段更新。

## 错误语义

覆盖：游戏不存在/已停用、游戏模式不匹配、期次未开放、未报名或报名无效、会话终局、关卡顺序错误、关卡结果缺失、重复请求号参数不合法、无库存、单人限中。无库存与单人限中是终局业务结果，不回滚玩家游戏结束状态；请求重试按会话记录返回首次终局结果。
