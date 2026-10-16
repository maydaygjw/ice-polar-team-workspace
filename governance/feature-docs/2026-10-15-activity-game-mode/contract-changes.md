# 活动游戏模式契约变更

## 活动游戏管理 API

不新增游戏专属接口域。游戏配置通过现有 `/admin-api/activity/template` 接口管理，以 `recordType` 区分游戏配置记录和活动模板记录；活动模板创建、更新、详情和分页接口扩展游戏字段。响应使用 `CommonResult`，沿用管理端登录、租户隔离和现有活动模板权限。游戏配置与活动模板存放在同一张表。

- 现有模板分页接口通过 `recordType` 筛选；游戏配置入口只查询和维护 `recordType=GAME_CONFIG` 的记录。
- 游戏配置沿用模板接口域，路由为 `GET /game-config/page`、`POST /game-config/create`、`PUT /game-config/update`。新增请求只提交 `name` 和 `enabled`；`gameCode` 是前后端关联字段，由后端按游戏名称映射并随活动详情/游戏会话返回。当前映射为 `企业蓄力跳跃` → `ENTERPRISE_JUMP`，名称不在已实现映射中时拒绝新增或修改。管理员手动录入名称，不选择内置类型，也不能上传或执行自定义游戏程序；停用不删除被模板或期次引用的历史配置。
- 游戏配置列表仅展示名称和启用状态，不向管理端暴露内部 `gameCode`。已有使用旧内置代码的游戏配置、模板和期次继续兼容。

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
- 期次详情、管理端期次响应和 app-api 活动详情增加 `drawMode=3`、`gameCode`、`gameName` 及关卡奖品 `levelNo`。用户端仍不返回库存、中奖概率或后台规则参数。

非游戏模板和历史期次继续按现有 1/2 模式读取；缺省 `drawMode` 按 1 处理。

## 用户端期次 API

不新增游戏专属接口域；在现有 `/app-api/activity/period` 接口下扩展操作，要求当前会员登录，用户 ID 和租户 ID 从认证上下文读取。

### 开始或恢复会话

`POST /game/start` 请求 `{ "periodId": 123 }`。当前登录用户必须在该期次有有效报名，期次须为游戏模式且处于报名开放状态。每个报名只创建一个会话，重复请求返回当前会话。

响应包括 `sessionId`、`gameCode`、`gameName`、`status`、`currentLevel`、`highestPassedLevel`、当前关卡挑战参数和已结算中奖摘要（如有）。

### 提交当前关卡

`POST /game/submit` 请求：

```json
{
  "sessionId": 7001,
  "levelNo": 1,
  "requestId": "a1d3...",
  "answer": "12345"
}
```

当前游戏配置使用服务端生成的数字挑战，客户端提交答案，由服务端校验。`ENTERPRISE_JUMP` 映射到 H5 企业蓄力跳跃玩法，并使用五位数字记忆挑战验证每关进度；旧 `SUM`、`ORDER`、`MEMORY` 游戏会话继续按各自既有规则处理。服务端不把客户端 Canvas 结果作为结算依据。响应返回 `levelResult`（PASS/FAIL）、更新后的会话状态，以及下一关挑战数据或终局 `winner` 摘要（含中奖 ID、奖品展示信息和兑奖状态）。当前关通过且尚有下一关时只更新进度，不发奖；当前关失败或第 3 关通过导致游戏终局时，在本次提交事务内按最高已通过关卡结算，并在同一响应返回中奖结果。客户端不能传奖品、用户、通关层数或兑奖状态作为结算依据。相同 `requestId` 重试返回首次结果；关卡越序或终局会话继续提交返回业务错误。

第 1 关失败时 `highestPassedLevel=0`，无中奖记录；第 2 或第 3 关失败时，分别结算上一已通关关的奖品；第 3 关通过时结算第 3 关奖品。若期次库存已耗尽或单人限中不允许中奖，游戏仍终局，但 `winner` 为 `null` 并返回原因枚举。生成中奖记录后，客户端使用现有 `POST /app-api/activity/period/claim?winnerId={winnerId}` 兑奖；线下兑奖继续返回客服指引错误并保留待兑奖状态。

## 数据库增量

升级脚本：`backend/sql/upgrade-2026-10-15-activity-game-mode.sql`。不新增业务表；所有涉及数据的查询显式限制当前租户，不加数据库外键。

1. `yshop_activity_template` 增加 `record_type`（活动模板/游戏配置，历史数据默认活动模板）、可空 `game_code` 和可空 `game_id`。游戏配置记录保存租户、按游戏名称映射的稳定代码、展示名、启用状态；当前 `企业蓄力跳跃` 映射为 `ENTERPRISE_JUMP`。活动模板的 `game_id` 引用同表游戏配置记录。按租户+记录类型+游戏代码唯一约束保证代码唯一。该表现有若干活动字段为非空，游戏配置记录创建时需写入中性占位值（例如通用标题、空正文/图片、默认周期和有效的占位时间），模板列表、期次生成、活动详情和报名查询必须按 `record_type` 过滤，避免占位数据进入活动流程。
2. `yshop_activity_template_prize` 增加可空 `level_no`；游戏模式取值 1–3 且唯一，非游戏模式为空。
3. `yshop_activity_period_snapshot` 增加游戏 ID、类型代码和名称快照。
4. `yshop_activity_period_prize` 增加可空 `level_no`，将逐关映射冻结到期次。
5. `yshop_activity_registration` 增加游戏状态、当前关、最高通过关和关卡幂等结果 JSON 字段。一个报名记录对应一局；终态不可重开。该表在游戏启动和提交时行锁更新进度。

新增字段及唯一键应有索引以支持按租户、记录类型、期次、用户和报名定位。不新增任何业务表。回滚仅删除本功能新增字段和索引；不删除或修改历史业务数据。

Flyway 迁移：`backend/sql/migrations/V2026101601__seed_enterprise_jump_game.sql`。Flyway 会在 `V2026101501__activity_game_mode.sql` 后执行；该迁移为当前未停用租户初始化启用的“企业蓄力跳跃”配置，并将已有同名配置的代码规范为 `ENTERPRISE_JUMP`。

## 事务、权限与幂等

- `start` 校验租户、期次模式、开放状态和有效报名；锁定报名记录并初始化或恢复进度。
- `game/submit` 按报名行锁执行凭据验证和状态更新；仅在失败或第 3 关通过的终局提交中执行库存预占及中奖记录插入。同一请求不得重复推进或生成中奖记录。
- 游戏和关卡奖品均从期次快照读取；客户端不得传入 `gameCode`、`prizeId`、`registrationId`、`userId` 或 `tenantId`。
- 管理端沿用 `activity:template:*` 权限管理模板及游戏配置记录，不新增权限。C 端使用 `@PreAuthenticated`。
- 不新增 MQ、外部系统或运行时依赖。机器 OpenAPI 快照在实现阶段更新。

## 错误语义

覆盖：游戏不存在/已停用、游戏模式不匹配、期次未开放、未报名或报名无效、会话终局、关卡顺序错误、提交凭据不合法、重复请求号参数不合法、无库存、单人限中。无库存与单人限中是终局业务结果，不回滚玩家游戏结束状态；请求重试按会话记录返回首次终局结果。
