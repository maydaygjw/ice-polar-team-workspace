# 活动管理契约变更

## API

### Admin API

统一前缀 `/admin-api/activity`，响应使用现有 `CommonResult`。

| 方法 | 路径 | 说明 | 权限 |
|---|---|---|---|
| POST | `/template/create` | 创建活动模板及奖品 | `activity:template:create` |
| PUT | `/template/update` | 更新未生成期次的模板配置 | `activity:template:update` |
| GET | `/template/page` | 分页查询活动模板 | `activity:template:query` |
| GET | `/template/get?id={id}` | 查询模板详情 | `activity:template:query` |
| POST | `/template/enable` | 启用/停用模板 | `activity:template:update` |
| DELETE | `/template/delete?id={id}` | 删除无期次、无业务记录的模板 | `activity:template:delete` |
| POST | `/period/generate?templateId={id}&occurrence={n}` | 幂等生成下一期/下 2 期/下 3 期期次 | `activity:template:update` |
| GET | `/period/page` | 查询活动期次及人数统计 | `activity:period:query` |
| GET | `/period/get?id={id}` | 查询期次详情和快照 | `activity:period:query` |
| POST | `/period/draw` | 到开奖时间后手动触发开奖 | `activity:period:draw` |
| POST | `/period/abandon` | 废弃未开奖期次并清理报名/中奖记录 | `activity:period:update` |
| POST | `/period/registration-open` | 手工开启或关闭期次报名 | `activity:period:update` |
| POST | `/period/qrcode` | 为指定期次生成临时小程序码 | `activity:period:qrcode` |
| GET | `/registration/page?periodId={id}` | 查询报名记录 | `activity:registration:query` |
| DELETE | `/registration/delete?id={id}` | 删除未开奖期次中的报名记录 | `activity:registration:delete` |
| POST | `/registration/increase-chances` | 为指定报名用户增加抽奖次数 | `activity:registration:query` |
| GET | `/winner/page?periodId={id}` | 查询中奖记录 | `activity:winner:query` |
| GET | `/registration/export?periodId={id}` | 导出报名记录 | `activity:registration:export` |
| GET | `/winner/export?periodId={id}` | 导出中奖记录 | `activity:winner:export` |

创建/更新请求至少包含：商圈、周期规则、报名起止时间、开奖时间、标题、富文本正文、活动图、背景图、宣传素材引用、活动管理员、社群标签和奖品列表。社群配置只选择一个或多个社群标签，不指定具体活动群；报名校验时匹配所选标签关联的任一微信群。时间使用带时区的 ISO 日期时间；服务按租户时区解释周期规则。登录态报名接口使用当前登录用户身份，并可选接收 `referrerUserId` 和 `channelCode`。

模板详情和分页响应中的 `data.prizes` 返回模板保存的奖品配置数组，字段包括 `prizeName`、`image`、`quantity` 和 `claimInstruction`，顺序与模板配置一致；数据库中的 `prize_config` JSON 由后端负责解析，客户端不得根据缺失字段自行重建奖品配置。

小程序码请求：

```json
{"periodId":123}
```

成功响应：

```json
{"url":"https://oss.example/temporary/miniapp-qrcode/153/activity.png","expiresAt":"2026-09-15T00:00:00Z"}
```

服务内部调用既有小程序码能力，页面路径使用预留活动详情页，scene 使用受微信限制的短格式期次参数，例如 `activityPeriodId=123`。客户端不得传入 path、scene、appId 或其他租户信息。

用户端 API 使用 `/app-api/activity/period/detail`、`/app-api/activity/period/latest`、`/app-api/activity/period/register`、`/app-api/activity/period/increase-chances` 和 `/app-api/activity/period/my-result`；本期不实现小程序页面和调用方，但其业务主键统一为 `periodId`。其中 `/app-api/activity/period/latest?templateId={id}` 必须传入活动模板 ID，服务端只在该活动模板的期次中返回最近的一期。

`GET /app-api/activity/period/eligibility?periodId={id}` 要求当前用户登录，按期次快照执行所有启用报名条件，返回条件数组：

```json
[
  {
    "type": "HAS_TODAY_CONFIRMED_ORDER",
    "name": "当天已下过单",
    "description": "用户当天在外部商城存在已确认订单即可报名",
    "passed": false,
    "failureReason": "当天未下过已确认订单"
  }
]
```

用户端应展示所有条件，并突出显示 `passed=false` 的条件及其 `failureReason`；报名提交前和报名失败后均可重新查询该接口。

### 报名条件扩展：当天已下过单

- 条件类型：`HAS_TODAY_CONFIRMED_ORDER`。
- 展示名称：`当天已下过单`；配置为空对象 `{}`，不接受客户端传入商城域名、租户 ID 或其他外部身份参数。
- 条件通过口径：调用当前租户 `we7_mall_host` 配置对应的外部商城接口，查询当前会员的 `externalUserId`；外部接口返回 `data.has_confirmed_order=true` 时通过。
- 外部接口：`GET {we7_mall_host}/app/index.php`，携带 `i=2`、`c=entry`、`a=wxapp`、`m=hlmall`、`businessModule=order`、`do=HasTodayConfirmedOrder` 和 `user_id={externalUserId}`。
- 外部接口的“当天”由外部商城按其服务器时区和 `order_date` 判断；有效订单状态沿用 `wxapp_order` 文档定义的 `2、3、4、5、8、10`。
- `we7_mall_host` 从当前租户系统参数读取，拼接路径前去除末尾 `/`；服务端固定 10 秒请求超时。
- 当前会员不存在、没有 `externalUserId`、未配置 `we7_mall_host`、接口 HTTP 非 2xx、返回 `status != success` 或响应结构无效时，条件按失败关闭处理，不得误放行报名。
- 该条件与其他启用条件按 AND 关系执行；校验结果写入报名记录的 `condition_result` JSON 快照。

### 抽奖次数与中奖限制

- 活动模板新增 `singleWinner`，生成期次时复制到期次快照；为 `true` 时同一会员在该期最多生成一条中奖记录，为 `false` 时同一报名记录可按其抽奖次数生成多条中奖记录。
- 报名成功时 `drawChances=1`、`drawChancesUsed=0`。抽奖机会按报名记录保存，不改变报名唯一性。
- `POST /admin-api/activity/registration/increase-chances` 请求体为 `{"registrationId":10001,"chances":2}`，仅允许在开奖前为有效报名增加次数，返回增加后的抽奖总次数。
- `POST /app-api/activity/period/increase-chances?periodId={id}&chances={n}` 使用当前登录用户的报名记录，仅允许在开奖前增加 `1-10` 次，返回增加后的抽奖总次数。
- 开奖时每个抽奖次数作为一个抽签位；开奖完成后该期所有有效报名的 `drawChancesUsed` 更新为 `drawChances`。用户端结果同时返回总次数、已使用次数、剩余次数及全部中奖记录。

## 状态与错误语义

期次状态：`NOT_STARTED` 未开始、`IN_PROGRESS` 进行中、`ENDED` 已结束；内部可使用短暂的 `DRAWING` 开奖中状态，但不对前端作为业务展示状态开放。

- `POST /admin-api/activity/period/abandon` 请求体为 `{"periodId":123}`。允许废弃任意状态的期次；服务在租户和数据权限校验后逻辑删除原期次及其报名、中奖、奖品和快照记录。新期次继续通过原期次生成接口创建。

- 模板或期次不存在、跨租户或无数据权限：按现有资源不存在/无权限语义处理。
- 时间区间非法、奖品数量非法、必填素材缺失：参数校验失败。
- 期次已生成后修改快照字段、删除有记录模板、非开奖时间手动开奖：业务状态不允许。
- 重复报名：返回已报名业务错误，不产生新记录。
- 管理员客户关系不存在：返回 `ACTIVITY_ADMIN_NOT_ADDED`。
- 用户不在配置社群的本地群成员数据中：返回 `ACTIVITY_GROUP_MEMBER_REQUIRED`。
- 社群校验规则为：活动配置的任一标签下，任一关联群的本地成员表包含该 `external_user_id` 即通过；标签之间、同标签下的群之间均为 OR 关系。
- 报名身份解析规则为：从当前登录态获取 `yshop_user.id`，再匹配 `mp_wecom_customer_contact.member_id`，取联系人记录中的企微 `external_user_id` 进行后续校验；可选的 `referrerUserId` 和 `channelCode` 原样保存到报名记录。
- 查不到 `yshop_user`、查不到对应企微客户联系人，或联系人未同步成功时：若对应校验开关开启，均按校验失败处理；两项校验均关闭时不要求企微联系人记录。
- 没有有效报名：开奖成功但实际中奖人数为 0，奖品均标记为未分配。
- 小程序账户、微信生成或临时文件上传失败：沿用现有小程序码错误语义，不返回成功空 URL。

## Database

新增表统一使用 `BIGINT` 主键、`tenant_id BIGINT NOT NULL`、`creator VARCHAR(64)`、`create_time DATETIME NOT NULL`、`updater VARCHAR(64)`、`update_time DATETIME NOT NULL`、`deleted BIT NOT NULL DEFAULT 0`；金额不涉及本功能。所有外键逻辑关联不使用数据库级 FK，删除和租户校验由业务层保证。

### `yshop_activity_template` 活动模板

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 模板 ID，主键 |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `dept_id` | `BIGINT NOT NULL` | 归属部门，数据权限 |
| `business_region_id` | `BIGINT NOT NULL` | 活动商圈 |
| `title` | `VARCHAR(128) NOT NULL` | 活动标题 |
| `content` | `TEXT NOT NULL` | 富文本正文 |
| `cover_image` | `VARCHAR(512) NOT NULL` | 活动主图 |
| `background_image` | `VARCHAR(512) NULL` | 小程序活动页背景图 |
| `promote_images` | `JSON NULL` | 渠道宣传素材 URL/排序数组 |
| `condition_config` | `JSON NULL` | 报名条件配置数组，保存条件类型、版本、启用状态和条件配置 |
| `cycle_type` | `TINYINT NOT NULL DEFAULT 1` | 周期类型，`1` 每周 |
| `cycle_weekday` | `TINYINT NOT NULL` | 每周星期，`1` 周一至 `7` 周日 |
| `registration_start_time` | `TIME NOT NULL` | 期次每日报名开始时间 |
| `registration_end_time` | `TIME NOT NULL` | 期次报名截止时间 |
| `draw_time` | `TIME NOT NULL` | 期次开奖时间 |
| `check_wecom_admin` | `BIT NOT NULL DEFAULT 0` | 是否校验已添加活动客户管理员 |
| `check_group_member` | `BIT NOT NULL DEFAULT 0` | 是否校验活动社群成员 |
| `single_winner` | `BIT NOT NULL DEFAULT 0` | 是否限制每人最多中奖一次 |
| `enabled` | `BIT NOT NULL DEFAULT 0` | 是否启用生成新期次 |
| `next_period_date` | `DATE NULL` | 可选缓存字段，仅用于列表展示，不作为事实来源 |

> 周期规则以星期和每日时间表达，期次日期由服务计算；期次表保存计算后的完整日期时间。

索引：`uk_tenant_title (tenant_id, title, deleted)`；`idx_tenant_region (tenant_id, business_region_id, deleted)`；`idx_tenant_enabled (tenant_id, enabled, deleted)`。

### `yshop_activity_template_admin` 活动客户管理员配置

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 主键 |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `template_id` | `BIGINT NOT NULL` | 活动模板 ID |
| `wecom_userid` | `VARCHAR(64) NOT NULL` | 企业微信客户管理员 UserID |
| `admin_name` | `VARCHAR(64) NOT NULL` | 管理员名称快照 |
| `sort` | `INT NOT NULL DEFAULT 0` | 展示顺序 |

唯一约束：`uk_template_admin (tenant_id, template_id, wecom_userid, deleted)`；索引：`idx_template (tenant_id, template_id, deleted)`。

### `yshop_activity_template_group` 活动社群配置

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 主键 |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `template_id` | `BIGINT NOT NULL` | 活动模板 ID |
| `tag_id` | `BIGINT NOT NULL` | 本地社群标签 ID |
| `tag_name` | `VARCHAR(128) NOT NULL` | 标签名称快照 |
| `sort` | `INT NOT NULL DEFAULT 0` | 展示顺序 |

唯一约束：`uk_template_group (tenant_id, template_id, tag_id, deleted)`；索引：`idx_template_tag (tenant_id, template_id, tag_id, deleted)`。

### `yshop_activity_period` 活动期次

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 期次 ID，二维码 scene 的业务主键 |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `template_id` | `BIGINT NOT NULL` | 活动模板 ID |
| `dept_id` | `BIGINT NOT NULL` | 部门快照 |
| `business_region_id` | `BIGINT NOT NULL` | 商圈快照 |
| `period_no` | `VARCHAR(32) NOT NULL` | 期次展示编号 |
| `period_date` | `DATE NOT NULL` | 本期期次日期 |
| `registration_start_time` | `DATETIME NOT NULL` | 报名开始时间 |
| `registration_end_time` | `DATETIME NOT NULL` | 报名截止时间 |
| `draw_time` | `DATETIME NOT NULL` | 计划开奖时间 |
| `status` | `TINYINT NOT NULL DEFAULT 1` | `1` 未开始、`2` 进行中、`3` 已结束；开奖锁定可用内部状态 `4` |
| `registration_open` | `BIT NOT NULL DEFAULT 0` | 是否允许报名，由后台手工控制，默认关闭 |
| `draw_status` | `TINYINT NOT NULL DEFAULT 0` | `0` 未开奖、`1` 开奖中、`2` 已开奖、`3` 开奖失败 |
| `planned_winner_count` | `INT NOT NULL DEFAULT 0` | 奖品数量合计 |
| `actual_winner_count` | `INT NOT NULL DEFAULT 0` | 实际中奖人数 |
| `registration_count` | `INT NOT NULL DEFAULT 0` | 报名人数缓存 |
| `draw_batch_no` | `VARCHAR(64) NULL` | 开奖批次号 |
| `draw_source` | `TINYINT NULL` | `1` 定时任务、`2` 后台手动 |
| `draw_time_actual` | `DATETIME NULL` | 实际开奖完成时间 |

唯一约束：`uk_template_period (tenant_id, template_id, period_date, deleted)`；索引：`idx_draw_scan (tenant_id, status, draw_time, draw_status)`；`idx_region_status (tenant_id, business_region_id, status, draw_time)`。

### `yshop_activity_period_snapshot` 活动期次内容与规则快照

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 主键 |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `period_id` | `BIGINT NOT NULL` | 期次 ID，一期一条 |
| `title` | `VARCHAR(128) NOT NULL` | 标题快照 |
| `content` | `TEXT NOT NULL` | 正文快照 |
| `cover_image` | `VARCHAR(512) NOT NULL` | 活动图快照 |
| `background_image` | `VARCHAR(512) NULL` | 背景图快照 |
| `promote_images` | `JSON NULL` | 宣传素材快照 |
| `check_wecom_admin` | `BIT NOT NULL DEFAULT 0` | 管理员校验开关快照 |
| `check_group_member` | `BIT NOT NULL DEFAULT 0` | 社群校验开关快照 |
| `single_winner` | `BIT NOT NULL DEFAULT 0` | 是否限制每人最多中奖一次 |
| `admin_snapshot` | `JSON NULL` | 管理员 UserID/名称数组 |
| `group_snapshot` | `JSON NULL` | 标签/群 ID/名称数组 |
| `condition_snapshot` | `JSON NULL` | 报名条件快照数组，期次生成后不可回溯修改 |

唯一约束：`uk_period (tenant_id, period_id, deleted)`。

### `yshop_activity_period_prize` 期次奖品

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 奖品 ID |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `period_id` | `BIGINT NOT NULL` | 期次 ID |
| `sort` | `INT NOT NULL DEFAULT 0` | 奖品顺序 |
| `prize_name` | `VARCHAR(128) NOT NULL` | 奖品名称快照 |
| `image` | `VARCHAR(512) NULL` | 奖品图片快照 |
| `quantity` | `INT NOT NULL` | 配置数量，必须大于 0 |
| `winner_quantity` | `INT NOT NULL DEFAULT 0` | 已分配中奖数量 |
| `claim_instruction` | `VARCHAR(1024) NULL` | 领取说明快照 |

索引：`idx_period (tenant_id, period_id, deleted)`；校验 `winner_quantity <= quantity`。

### `yshop_activity_registration` 报名记录

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 报名 ID |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `period_id` | `BIGINT NOT NULL` | 期次 ID |
| `user_id` | `BIGINT NOT NULL` | `yshop_user.id`，企微校验时取其 `external_user_id` |
| `referrer_user_id` | `BIGINT NULL` | 推荐人用户 ID |
| `channel_code` | `VARCHAR(64) NULL` | 报名渠道标识 |
| `register_time` | `DATETIME NOT NULL` | 报名时间 |
| `status` | `TINYINT NOT NULL DEFAULT 1` | `1` 有效、`2` 取消/无效 |
| `draw_chances` | `INT NOT NULL DEFAULT 1` | 累计获得的抽奖次数 |
| `draw_chances_used` | `INT NOT NULL DEFAULT 0` | 开奖时已使用的抽奖次数 |
| `admin_check_passed` | `BIT NOT NULL DEFAULT 0` | 管理员校验结果 |
| `group_check_passed` | `BIT NOT NULL DEFAULT 0` | 社群校验结果 |
| `check_snapshot` | `JSON NULL` | 命中的管理员、标签和群快照 |
| `condition_result` | `JSON NULL` | 各报名条件的通过状态、失败原因和摘要快照 |
| `client_ip` | `VARCHAR(64) NULL` | 风控审计信息 |

唯一约束：`uk_period_user (tenant_id, period_id, user_id, deleted)`；索引：`idx_period_status (tenant_id, period_id, status, register_time)`。

### `yshop_activity_winner` 中奖记录

| 字段 | 类型/空值/默认值 | 说明 |
|---|---|---|
| `id` | `BIGINT NOT NULL` | 中奖记录 ID |
| `tenant_id` | `BIGINT NOT NULL` | 租户 ID |
| `period_id` | `BIGINT NOT NULL` | 期次 ID |
| `registration_id` | `BIGINT NOT NULL` | 报名记录 ID |
| `user_id` | `BIGINT NOT NULL` | `yshop_user.id` |
| `prize_id` | `BIGINT NOT NULL` | 期次奖品 ID |
| `prize_name` | `VARCHAR(128) NOT NULL` | 奖品名称快照 |
| `prize_image` | `VARCHAR(512) NULL` | 奖品图片快照 |
| `claim_instruction` | `VARCHAR(1024) NULL` | 领取说明快照 |
| `draw_batch_no` | `VARCHAR(64) NOT NULL` | 开奖批次 |
| `winner_time` | `DATETIME NOT NULL` | 中奖生成时间 |
| `status` | `TINYINT NOT NULL DEFAULT 1` | `1` 待领取、`2` 已领取；本期不实现核销，可保持待领取 |

索引：`idx_period_registration (tenant_id, period_id, registration_id, deleted)`、`idx_period_prize (tenant_id, period_id, prize_id, deleted)`、`idx_user (tenant_id, user_id, winner_time)`。同一报名记录是否可产生多条中奖记录由期次快照的 `singleWinner` 控制。

活动模板保存默认配置；生成期次时写入期次、快照、奖品记录和关联配置。二维码不新增永久存储表，临时文件目录沿用 `temporary/miniapp-qrcode/{tenantId}`。基础迁移脚本为 `backend/sql/upgrade-2026-09-13-activity-management.sql`，本次增量迁移为 `backend/sql/upgrade-2026-09-14-activity-draw-chances.sql`，均必须包含限定范围的 DDL/数据回滚语句。

## MQ / 定时任务

新增周期开奖任务，按开奖时间扫描 `activity_period`，使用“租户 + 期次”锁和数据库状态条件保证幂等。首期不新增 MQ topic；开奖结果在同一事务内落库，失败不发出成功事件。后续通知或权益发放需新增事件契约。

## 权限与数据范围

- 新增菜单归属为“营销 → 活动管理”，下设活动配置、活动期次、报名记录和中奖记录页面；菜单按租户套餐/菜单授权控制可见性。
- 活动配置、活动期次、报名记录和中奖记录分别复用 `activity:template:*`、`activity:period:*`、`activity:registration:*` 和 `activity:winner:*` 权限码。
- 模板、期次、报名和中奖记录均校验当前租户；需要部门/商圈范围时校验 `dept_id` 与 `business_region_id`。
- 二维码生成只允许拥有对应期次查询权限和 `activity:period:qrcode` 权限的后台用户操作。
- 报名接口未来使用 C 端登录用户身份，不接受请求体传入用户 ID、租户 ID 或活动管理员身份。

## 依赖与外部系统

- 复用 `mp-api` 的本地企微客户、客户标签/群数据查询能力，不在活动模块复制企微表或直接调用企微 HTTP API。
- 群成员使用 `mp_wecom_customer_group_member` 本地同步表，不再读取 `mp_wecom_customer_group.member_list` JSON；活动模块通过 `mp-api` 查询“标签下群成员是否存在”。
- 复用 `mp` 已有小程序码生成能力：微信 SDK 版本沿用平台登记的 `4.6.0`，当前租户小程序主账户提供凭证。
- 复用 `infra-api` `TemporaryFileApi`，生成图片不登记永久业务文件；预期保留 48 小时，实际生命周期由存储配置负责。
- 小程序码生成不额外重试；微信或存储失败由调用方按失败结果重新发起。
