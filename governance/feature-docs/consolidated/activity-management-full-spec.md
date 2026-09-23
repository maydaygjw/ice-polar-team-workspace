# 活动管理全量需求与设计

## 1. 文档定位

本文是活动管理当前版本的统一需求规格、产品设计、技术设计和交付基线。范围以 `2026-09-13-activity-management` 为主，并吸收后续活动相关增量：

| 日期 | 增量 | 当前纳入内容 |
|---|---|---|
| 09-13 | 活动管理一期 | 模板、期次、报名、奖品、抽奖、中奖、二维码 |
| 09-15 | 活动 H5 Ticket 认证 | 一次性 ticket、H5 Token 兑换 |
| 09-17 | 活动管理重构 | 条件类型、条件组合、活动管理菜单拆分 |
| 09-18 | 条件实例管理 | 条件实例 CRUD、模板引用、删除阻断 |
| 09-19 | 中奖记录兑奖 | 单条/批量/按期次兑奖 |
| 09-21 | 中奖通知 | 活动管理员通过企业微信通知中奖客户 |
| 09-21 | 线下兑奖码 | 线下兑奖规则和不可变兑奖码 |
| 09-21 | 报名人数限制 | 期次报名上限和原子计数 |
| 09-21 | 中奖公示 | 管理端公示数据和用户端脱敏中奖名单 |
| 09-21 | 邀请加抽奖次数 | 推荐人成功邀请后的额外抽奖机会 |
| 09-21 | 小程序短链接 | 活动模板分享短链接 |

### 1.1 当前结论

- 一期主链路已覆盖 backend、admin；小程序页面本身不属于 09-13 一期交付。
- 活动的事实边界是“模板定义规则，期次冻结快照，报名和中奖只依赖期次快照”。
- 所有接口、数据和任务必须执行租户隔离，并在需要时执行部门/商圈数据权限。
- 跨仓契约以各 feature 目录的 `contract-changes.md` 为历史依据；本文是汇总视图，不替代机器契约。

## 2. 目标与非目标

### 2.1 目标

运营人员能够创建周期性活动模板，生成独立期次，控制报名和开奖，配置报名条件和奖品，查询报名/中奖结果，并完成投放、兑奖、通知和中奖公示。

C 端/H5 能够在安全认证后查看期次、检查报名资格、报名、增加抽奖次数、查看结果、查看公示名单，并通过活动短链接或小程序码进入活动承载页面。

### 2.2 当前不包含

- 09-13 一期不交付原生小程序活动页面和完整小程序交互。
- 不实时调用企业微信接口完成报名关系判断；当前依赖后端已同步的本地数据。
- 不自动发货、物流核销、优惠券/积分发放，除已定义的兑奖规则扩展外不新增权益系统。
- 不支持付费报名、权重抽奖、人工指定中奖人、多轮开奖、OR/嵌套报名条件组。
- 不允许租户或客户端上传脚本、表达式、外部 URL、凭据或任意处理器类名。

## 3. 角色与核心场景

| 角色 | 目标 | 关键操作 |
|---|---|---|
| 活动运营人员 | 配置活动 | 创建/编辑模板、配置周期、素材、条件、奖品、启停 |
| 活动运营人员 | 管理期次 | 生成期次、开关报名、手动开奖、废弃期次、生成小程序码 |
| 活动运营人员 | 处理结果 | 查询/导出报名和中奖记录、兑奖、通知中奖客户、生成公示数据 |
| C 端会员 | 参与活动 | 查看详情、检查资格、报名、增加抽奖次数、查看中奖结果 |
| 推荐人 | 邀请报名 | 分享活动，符合条件时获得额外抽奖机会 |
| 定时任务 | 自动运营 | 到达开奖时间后幂等开奖 |
| H5 | 安全承载 | 用一次性 ticket 换取 backend Token 后调用活动 API |

## 4. 业务概念与生命周期

### 4.1 模板与期次

- **活动模板**：保存周期规则、默认内容、报名条件实例引用、奖品配置和运营开关。
- **活动期次**：模板按周期生成的可运营业务单元，拥有唯一 `periodId`。
- **期次快照**：生成时复制标题、正文、素材、管理员、社群、条件、奖品、单人中奖限制、报名上限、邀请奖励开关等，历史数据只读。
- 模板可继续编辑，但已生成期次涉及的历史内容不回写。
- 模板停用后不再生成新期次；已生成期次按其快照继续执行。

### 4.2 期次状态

对外状态：

- `NOT_STARTED`：尚未到报名开始时间。
- `IN_PROGRESS`：处于活动时间窗口或等待开奖。
- `ENDED`：开奖完成或期次已结束。

内部可使用 `DRAWING`/`draw_status=1` 表示开奖锁定中，但不作为前端业务状态开放。

辅助状态：

- `registration_open`：后台是否允许报名；默认为关闭，可手动开启/关闭。
- `draw_status`：未开奖、开奖中、已开奖、开奖失败。
- 期次废弃使用逻辑删除及关联记录清理，不复用正常结束状态。

### 4.3 报名条件

条件分为后端注册的**条件类型**和租户可配置的**条件实例**：

- 条件类型是代码注册的稳定标识，提供名称、说明、版本、类别和 `configSchema`。
- 条件实例保存租户自己的名称、说明、参数、排序和启用状态。
- 模板引用条件实例 ID；期次生成时保存完整条件快照。
- 组合规则固定为 AND；同一类型允许引用多个不同实例；同一实例不得重复引用。
- 条件执行上下文由后端构造，不能从请求体信任用户 ID、租户 ID、外部地址或条件结果。

当前条件类型：

| 类型 | 说明 | 配置 |
|---|---|---|
| `WECOM_ADMIN_FOLLOWED` | 当前会员已添加任一指定活动客户管理员 | 管理员企业微信 UserID 列表 |
| `WECOM_GROUP_MEMBER` | 当前会员属于任一标签关联微信群的本地成员 | 社群标签 ID 列表 |
| `HAS_CONFIRMED_ORDER_WITHIN_DAYS` | 外部商城存在已确认订单 | `days`；当前外部接口只支持 `days=1` |

旧的 `checkWecomAdmin`、`checkGroupMember` 在兼容期可读写，但后端统一转换为条件配置；新模板优先使用条件实例。

## 5. 完整需求

### 5.1 模板管理

模板至少支持：

- 商圈、归属部门和标题。
- 每周周期规则：星期一至星期日之一，报名开始时间、报名结束时间、开奖时间。
- 活动正文、活动主图、活动背景图、渠道宣传素材。
- 活动群链接；活动社群只选择标签，不直接选择具体微信群。
- 活动客户管理员列表及排序。
- 条件实例列表及排序。
- 奖品列表：名称、图片、数量、领取说明、开奖/兑奖规则。
- 是否启用、是否限制每人最多中奖一次。
- 每期报名人数上限：`0` 表示不限，大于 `0` 表示上限。
- 是否开启“邀请成功报名增加推荐人一次抽奖机会”。

约束：

- 报名结束时间不得晚于开奖时间；跨自然日必须按完整日期时间校验。
- 奖品数量必须为正整数，计划中奖人数为奖品数量总和。
- 期次生成后，不允许修改会影响已生成快照的模板配置。
- 有期次、报名或中奖业务记录时禁止破坏性删除模板；使用逻辑删除和权限校验。
- 活动群链接必填；条件说明由条件实例维护，客户端不得自行重建缺失字段。

### 5.2 期次管理

- 根据租户、模板和期次日期幂等生成下一期/下 2 期/下 3 期。
- 期次保存完整日期时间和所有内容/规则快照。
- 支持查询人数统计、期次详情、报名开关、手动开奖、废弃和生成临时小程序码。
- 允许对任意状态的期次执行废弃，但必须经过租户和数据权限校验，并清理该期报名、中奖、奖品及快照逻辑记录。
- 小程序码从期次定位活动模板，页面参数与活动分享短链接一致，携带 `open_activity=1`、`templateId`、`region_code` 和可选 `channelCode`，不携带推荐人；每次可重新生成，返回预计 48 小时有效的临时地址；不保存永久二维码业务记录。

### 5.3 用户报名

报名成功条件：

1. 当前登录用户存在且期次可报名。
2. 当前时间在报名窗口内，且 `registration_open=true`。
3. 当前用户同一期没有有效报名记录。
4. 所有启用条件通过。
5. 如配置报名上限，后端原子校验后仍有可用名额。

身份和企微校验：

- 从登录态取 `yshop_user.id`，匹配 `mp_wecom_customer_contact.member_id`，得到 `external_user_id`。
- 管理员校验：管理员列表中任一管理员是该联系人的有效跟进成员即可通过。
- 社群校验：任一选中标签下任一关联群的本地成员记录包含该 `external_user_id` 即通过。
- 开启校验但查不到会员、联系人或同步数据时按失败处理；两个企微条件均关闭时不强制查询联系人。
- 企微失败只返回安全业务语义，不向用户暴露内部 UserID、标签 ID 或堆栈。

报名成功后：

- 创建一条报名记录，`drawChances=1`、`drawChancesUsed=0`。
- 保存推荐人和渠道标识（如请求携带），但推荐人不得由客户端用于覆盖当前报名人身份。
- 保存条件结果和命中的管理员/标签/群快照。
- 若邀请奖励开启、新用户成功报名、推荐人不是本人且推荐人已有效报名，则推荐人的抽奖次数增加 1；推荐人未报名、无效或已开奖时不奖励。

报名失败后客户端可调用资格接口重新查询，展示所有条件并突出未通过项。

### 5.4 报名人数与抽奖次数

- `registrationLimit=0` 表示不限；正数表示每期有效报名人数上限。
- 报名落库前执行带上限条件的原子计数更新；满额返回业务错误并回滚报名。
- 删除未开奖期次中的报名记录释放一个名额。
- 管理端可在开奖前为指定有效报名增加任意受控次数。
- 用户端只能为自己的有效报名增加 `1-10` 次，且必须在开奖前。
- 抽奖次数属于报名记录，不改变“每人每期一次报名”的唯一性。

### 5.5 开奖

- 定时任务和后台手动开奖复用同一服务和锁。
- 只处理有效报名；每个抽奖机会展开为一个抽签位。
- `singleWinner=true` 时同一会员最多保留一条中奖记录；否则可按抽签位中奖多次。
- 中奖数量不超过有效报名人数和各奖品配置数量。
- 没有有效报名时开奖成功，但实际中奖数为 0，奖品保持未分配。
- 开奖完成后将所有有效报名的 `drawChancesUsed` 更新为 `drawChances`，期次进入结束态。
- 重复或并发开奖必须幂等，不得重复生成中奖记录或超发奖品。
- 开奖只生成中奖记录，不执行奖品外部发放副作用；发放在兑奖阶段执行。

### 5.6 兑奖、线下兑奖和通知

中奖记录：

- `status` 表示记录有效性。
- `claimStatus`：`0` 待兑奖、`1` 已兑奖、`2` 处理中。
- `claimTime` 只在成功兑奖时写入。
- 每条有效中奖记录可有租户内唯一、不可变的 `redemptionCode`。
- `OFFLINE_CLAIM` 规则不在开奖或后台兑奖时执行外部发放，线下人员核验兑奖码后完成发放。

管理端支持单条兑奖、批量兑奖和按期次批量兑奖。批量操作逐条处理：已兑奖幂等跳过，单条失败不回滚其他已成功的外部动作。

中奖通知由服务端从期次快照中按顺序选择同时跟进中奖客户的活动管理员，生成包含活动标题、奖品名称和兑奖说明的企业微信客户文本消息任务。客户端不得传入发送人、用户 ID 或外部联系人 ID；重复发送需前端二次确认。

### 5.7 中奖公示

管理端和用户端最多展示 100 条有效中奖记录，排序为奖品顺序、中奖时间、中奖记录 ID。

- 管理端返回活动标题、期次号、开奖时间、背景图、奖品分组、脱敏展示名和截断标记。
- 用户端无需登录，返回脱敏展示名和奖品信息。
- 不得返回兑奖码、用户 ID、openid、完整手机号、企业微信 UserID 或内部中奖记录 ID。
- 没有有效中奖记录时返回成功空结果，前端展示暂无公示数据。

### 5.8 H5 认证和小程序短链接

H5 Ticket：

- 已登录会员调用生成接口；服务端生成不可预测 ticket，Redis 保存 60 秒。
- ticket 只保存用户、用户类型和租户引用，不保存 openid、微信凭证或 backend Token。
- 匿名兑换接口使用 Redis Lua 原子 GET+DEL，只允许成功兑换一次。
- 兑换使用 ticket 内租户上下文签发现有 backend Token，不信任请求头中的租户或用户信息。
- 无效、过期、伪造或重复 ticket 统一返回认证错误。

活动短链接：

- `GET /app-api/activity/share/short-link` 需要登录，只接收 `templateId`。
- 推荐人和商圈编码由服务端从登录态、模板和商圈配置解析，客户端不得传入或覆盖。
- 使用当前租户小程序主账号生成短链接，不保存短链接记录。

## 6. API 设计

通用规则：管理端前缀 `/admin-api/activity`，用户端前缀 `/app-api/activity`，响应使用 `CommonResult`；所有资源查询显式限制当前租户和数据权限。

### 6.1 管理端接口

| 方法 | 路径 | 用途 | 权限 |
|---|---|---|---|
| POST/PUT | `/template/create`、`/template/update` | 模板创建/更新 | `activity:template:create/update` |
| GET | `/template/page`、`/template/get` | 模板列表/详情 | `activity:template:query` |
| POST/DELETE | `/template/enable`、`/template/delete` | 启停/删除 | `activity:template:update/delete` |
| POST | `/period/generate` | 幂等生成期次 | `activity:template:update` |
| GET | `/period/page`、`/period/get` | 期次列表/详情 | `activity:period:query` |
| POST | `/period/draw` | 到时手动开奖 | `activity:period:draw` |
| POST | `/period/abandon` | 废弃期次 | `activity:period:update` |
| POST | `/period/registration-open` | 开关报名 | `activity:period:update` |
| POST | `/period/qrcode` | 生成临时小程序码 | `activity:period:qrcode` |
| GET/DELETE | `/registration/page`、`/registration/delete` | 查询/删除报名 | `activity:registration:query/delete` |
| POST | `/registration/increase-chances` | 管理端增加次数 | `activity:registration:query` |
| GET | `/registration/export` | 导出报名 | `activity:registration:export` |
| GET | `/winner/page`、`/winner/export` | 查询/导出中奖 | `activity:winner:query/export` |
| POST | `/winner/claim` | 单条兑奖 | `activity:winner:claim` |
| POST | `/winner/claim-batch` | 批量兑奖 | `activity:winner:claim` |
| POST | `/period/claim-winners` | 期次批量兑奖 | `activity:winner:claim` |
| POST | `/winner/send-notification` | 发送中奖通知 | 现有中奖处理权限 |
| GET | `/winner/public-poster-data` | 获取公示长图数据 | `activity:winner:query` |
| GET | `/condition/types` | 查询注册条件类型 | `activity:condition:query` |
| GET | `/condition/instance/page` | 条件实例分页 | `activity:condition:instance:query` |
| POST/PUT/DELETE | `/condition/instance/create/update/delete` | 条件实例 CRUD | 对应 instance 权限 |
| PUT | `/condition/instance/update-status` | 条件实例启停 | `activity:condition:instance:update` |

### 6.2 用户端接口

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/period/detail` | 期次详情、条件和报名进度 |
| GET | `/period/latest?templateId={id}` | 指定模板最近一期 |
| GET | `/period/eligibility?periodId={id}` | 当前登录用户资格检查 |
| POST | `/period/register` | 当前登录用户报名 |
| POST | `/period/increase-chances` | 当前用户增加 1–10 次 |
| GET | `/period/my-result` | 当前用户抽奖次数和中奖记录 |
| GET | `/period/my-referrals` | 当前用户作为推荐人的有效报名 |
| GET | `/period/winners?periodId={id}` | 脱敏中奖公示，无需登录 |
| GET | `/share/short-link?templateId={id}` | 生成活动短链接，需要登录 |

外部小程序码请求接收 `periodId` 和可选 `channelCode`；服务端根据期次解析模板与商圈，固定页面路径并组装页面参数，不接受 path、scene、appId、templateId、region_code、推荐人、租户信息或其他外部身份参数。

### 6.3 关键错误语义

| 场景 | 语义 |
|---|---|
| 重复报名 | 已报名业务错误 |
| 报名条件不通过 | 统一条件失败，详情通过资格接口返回 |
| 报名满额 | `1009000031` |
| 未添加活动管理员 | `ACTIVITY_ADMIN_NOT_ADDED` |
| 不在活动社群 | `ACTIVITY_GROUP_MEMBER_REQUIRED` |
| 条件实例不存在 | `CONDITION_INSTANCE_NOT_EXISTS` |
| 条件实例被引用 | `CONDITION_INSTANCE_IN_USE` |
| 条件实例不可用/配置错误 | `CONDITION_INSTANCE_TYPE_INVALID` / `CONDITION_INSTANCE_CONFIG_INVALID` |
| 模板重复引用实例 | `TEMPLATE_CONDITION_DUPLICATE` |
| 模板引用停用实例 | `TEMPLATE_CONDITION_DISABLED` |
| H5 ticket 无效 | 统一会员认证错误 `1004003007` |

## 7. 数据设计

所有活动表使用 `BIGINT` 主键、`tenant_id`、审计字段和逻辑删除；不使用数据库级外键，关联、租户和删除由业务层保证。

| 表 | 作用 | 关键字段 |
|---|---|---|
| `yshop_activity_template` | 模板 | 商圈、周期、素材、`condition_config`、`single_winner`、`registration_limit`、`invite_registration_chance`、enabled |
| `yshop_activity_template_admin` | 模板管理员 | tenant、template、wecom_userid、排序 |
| `yshop_activity_template_group` | 模板社群标签 | tenant、template、tag_id、标签快照 |
| `yshop_activity_period` | 期次 | template、period_date、完整时间、状态、报名/开奖统计、draw batch |
| `yshop_activity_period_snapshot` | 期次快照 | 内容素材、管理员/群、条件、单人限制、报名限制等 |
| `yshop_activity_period_prize` | 期次奖品 | 奖品快照、quantity、winner_quantity、规则 |
| `yshop_activity_registration` | 报名 | user、推荐人、渠道、状态、抽奖次数、企微结果、条件结果 |
| `yshop_activity_winner` | 中奖 | 报名、用户、奖品快照、中奖时间、兑奖状态、兑奖码 |
| `yshop_activity_condition` | 条件类型租户配置 | tenant、condition_type、description、启用状态 |
| `yshop_activity_condition_instance` | 条件实例 | tenant、type、name、description、config、sort、enabled |

关键约束：

- 模板：`uk_tenant_title`、租户+商圈和启用索引。
- 期次：租户+模板+期次日期唯一；开奖扫描按状态、开奖时间、开奖状态索引。
- 报名：租户+期次+用户唯一；查询按期次、状态、报名时间索引。
- 条件实例：同租户名称逻辑唯一，按类型/启用状态索引。
- 中奖码在租户内唯一且不可变。

数据迁移必须使用 dated upgrade SQL，禁止修改基线 SQL；破坏性变更必须有回滚说明。历史期次快照、报名结果和中奖结果不重算、不回写。

## 8. 技术设计

### 8.1 模块边界

- backend 新增/维护活动业务模块，admin 消费管理端 API。
- 活动模块跨模块调用只能依赖 `-api`，通过 `mp-api` 读取本地企微同步数据，通过 `infra-api` 使用临时文件能力。
- 外部商城订单调用封装在活动模块独立 Client 中；商城域名来自当前租户系统参数 `we7_mall_host`，客户端不可传入。
- H5 ticket 复用 member 认证和 OAuth2 Token 能力；Redis 只保存短期身份引用。
- 不新增 MQ；开奖采用定时扫描 + 期次锁，未来如需异步发放再引入事件。

### 8.2 期次生成

1. 校验模板存在、启用、租户和数据权限有效。
2. 按租户时区计算下一个满足周期的完整日期时间。
3. 以租户、模板、期次日期获取锁或依赖唯一键，保证幂等。
4. 复制模板内容、条件实例完整执行信息、管理员/社群快照、奖品和新增开关。
5. 创建期次、快照和期次奖品；重复请求返回已有期次。

### 8.3 条件执行

条件处理器接口包含类型、版本、参数校验和执行方法。服务端创建统一上下文：当前用户、租户、期次、请求时间和租户时区。

`HAS_CONFIRMED_ORDER_WITHIN_DAYS` 流程：

1. 读取当前会员 `externalUserId`。
2. 读取当前租户 `we7_mall_host`，去掉末尾 `/`。
3. 仅允许当前外部接口支持的 `days=1`。
4. GET `{host}/app/index.php`，传入 `i=2,c=entry,a=wxapp,m=hlmall,businessModule=order,do=HasTodayConfirmedOrder,user_id=...`。
5. 固定 10 秒超时；非 2xx、`status != success`、响应结构异常、身份缺失或外部异常均失败关闭。
6. 报名条件结果保存安全摘要；日志只允许 DEBUG 脱敏输出。

### 8.4 报名事务

报名服务在事务中完成期次状态/时间校验、条件执行、用户唯一性校验、原子名额占用和报名写入。名额占用失败必须回滚本次报名；唯一键和业务校验双重防止并发重复报名。

### 8.5 开奖事务

1. 定时任务扫描到期开奖期次，或接受后台手动触发。
2. 获取期次锁，确认尚未开奖并切换为开奖中。
3. 读取有效报名和期次奖品快照，展开抽签位并随机打乱。
4. 按 `singleWinner` 规则分配奖品，写入中奖记录和奖品已分配数。
5. 更新抽奖次数已使用、实际中奖人数、开奖批次、实际完成时间和结束状态。
6. 任一步骤失败则回滚，保留可重试的失败态，不产生半套结果。

### 8.6 兑奖与通知

开奖和兑奖分离：开奖只产生记录，兑奖服务读取中奖记录关联的期次奖品规则并执行外部动作。批量兑奖按记录逐条处理，保留成功/失败明细。

中奖通知服务从期次管理员快照按顺序匹配有效客户联系人跟进关系；客户端不参与身份绑定或消息内容组装。

### 8.7 H5 ticket

Redis key：`yshop_webview_ticket:{ticket}`；value 保存 `userId/userType/tenantId`；TTL 60 秒。兑换使用 Lua 原子读取删除，再以 ticket 租户上下文创建 Token。请求头 `tenant-id` 不参与认证判断。

## 9. 管理后台与用户体验

### 9.1 菜单

营销 → 活动管理，下设：模板管理、期次管理、报名管理、中奖管理、条件管理。旧路由保持兼容，权限按子模块迁移。

### 9.2 模板页

- 列表筛选标题、商圈、启用状态；展示周期、下次开奖、状态和操作。
- 编辑表单分为基础信息、时间规则、内容素材、条件/企微社群、奖品配置。
- 条件实例由类型元数据驱动渲染；停用或不可用实例显示状态并阻止保存/生成。
- 奖品支持动态增删，实时显示计划中奖人数。
- 已生成期次后展示快照保护提示。

### 9.3 期次与结果页

- 期次表展示报名区间、开奖时间、报名数、计划/实际中奖数、状态。
- 期次详情提供报名、中奖、小程序码、开奖、废弃和公示操作。
- 二维码弹窗展示预览、下载、复制地址和临时有效期；失败可重试。
- 报名/中奖支持分页、用户/状态/奖品筛选和导出。
- 中奖页展示兑奖状态、线下兑奖码，并对批量兑奖/通知发送做二次确认。

### 9.4 用户端

- 资格页展示所有条件；`passed=false` 高亮，描述来自服务端。
- 报名失败后重新拉取资格，避免只展示通用错误。
- 结果页展示总抽奖次数、已用、剩余次数和全部中奖记录。
- 中奖公示只展示服务端脱敏后的名称和奖品信息。

## 10. 权限、安全与合规

- 所有业务表必须带 `tenant_id`；所有读取、修改、删除、导出和任务扫描显式执行租户过滤。
- 需要部门/商圈数据权限的模板、期次、报名、中奖操作沿用现有数据权限。
- 客户端不得提交 userId、tenantId、openid、外部联系人 ID、发送人、外部 URL、凭据、条件结果或二维码 scene。
- 企微 UserID、标签 ID、群 ID、手机号和 openid 不进入用户端响应；公示必须脱敏。
- 日志不得输出外部凭据、Token 或完整身份标识；外部订单请求只允许脱敏 DEBUG 日志。
- 不把临时二维码误认为永久业务资产；短链接和 ticket 不落永久业务表。

## 11. 定时任务与可观测性

- 开奖任务按租户时区扫描到期且未开奖期次。
- 记录开奖来源（定时/手动）、批次号、开始/完成时间、失败原因和实际中奖数。
- 条件外部调用记录耗时、HTTP 状态和安全错误摘要，不记录凭据和完整身份参数。
- 关键业务指标：期次生成数、报名成功/失败数、满额次数、开奖成功/失败数、兑奖成功/失败数、通知发送成功/失败数。
- 需要告警：开奖失败、迁移失败、企微本地数据缺失比例异常、外部商城超时比例异常。

## 12. 测试与验收

### 12.1 功能验收

- 可创建每周活动并配置报名截止和开奖同一时刻。
- 可幂等生成期次，且期次拥有完整不可变快照。
- 报名时间、启停开关、重复报名、条件 AND、报名上限均正确生效。
- 订单条件只在 externalUserId、商城地址和外部响应均有效时通过；异常不得误放行。
- 抽奖次数、单人中奖限制、邀请奖励和奖品上限正确生效。
- 定时/人工并发开奖不重复、不超发；开奖后抽奖次数全部标记已用。
- 可查询、导出、兑奖、通知和生成公示数据；用户端数据脱敏。
- 二维码由 `periodId` 定位生成上下文，落地页面按 `templateId` 和 `region_code` 进入活动，H5 ticket 只能一次兑换且不可跨租户。

### 12.2 已有验证

- backend 活动模块编译通过；外部订单 Client 定向测试通过。
- admin 活动页面定向 ESLint 通过；条件实例相关 `build:dev` 通过。
- H5 ticket Redis DAO 和认证服务定向测试通过，5 个测试通过。
- H5 生产构建通过，包含报名条件展示和报名失败后重新检测流程。

### 12.3 仍需执行

- 测试环境真实 MySQL 迁移和回滚验证。
- 真实租户、会员、企微联系人、群成员和外部商城数据下的报名/开奖/兑奖/通知测试。
- 条件实例 CRUD、租户隔离、模板引用删除阻断和停用实例阻断测试。
- admin Playwright E2E：登录、权限、菜单、表单、二维码、兑奖、公示。
- 小程序真实扫码和微信开发者工具验证。
- 全量前端类型检查和 backend Checkstyle 清理；当前基线仍有与活动无关或历史规范告警。

## 13. 交付风险与决策待办

| 风险/待办 | 影响 | 处理建议 |
|---|---|---|
| 本地企微群成员快照字段稳定性 | 社群条件可能无法精确通过 | 先保持失败关闭，完成字段核对后补真实 API 测试 |
| 测试库营销父菜单 ID 差异 | 菜单迁移可能挂错父菜单 | 执行迁移前确认目标库父菜单 ID并核对权限 |
| 条件处理器下线 | 新期次可能无法生成 | 保留版本/可用性检查，历史期次按快照策略处理 |
| 外部订单接口只支持当天 | `days>1` 无法真实判断 | 当前明确只支持 `days=1`，待外部接口升级再放开 |
| 小程序页面尚未交付 | 二维码暂不能完成端到端闭环 | 页面路径冻结前仅作为预投放素材 |
| 全量类型/规范门禁 | 影响最终构建门禁 | 清理 activity 和基线告警，补充自动化测试 |
| 条件配置仍有 JSON 扫描 | 大量模板时删除检查成本上升 | 数据量达到阈值后增加规范化引用表 |

## 14. 历史来源

- [`2026-09-13-activity-management`](../2026-09-13-activity-management/)
- [`2026-09-15-activity-h5-auth`](../2026-09-15-activity-h5-auth/)
- [`2026-09-17-activity-management-refactor`](../2026-09-17-activity-management-refactor/)
- [`2026-09-18-activity-condition-instance-management`](../2026-09-18-activity-condition-instance-management/)
- [`2026-09-19-activity-winner-claim`](../2026-09-19-activity-winner-claim/)
- [`2026-09-21-activity-winner-notification`](../2026-09-21-activity-winner-notification/)
- [`2026-09-21-activity-offline-claim-code`](../2026-09-21-activity-offline-claim-code/)
- [`2026-09-21-activity-registration-limit`](../2026-09-21-activity-registration-limit/)
- [`2026-09-21-activity-winner-public-poster`](../2026-09-21-activity-winner-public-poster/)
- [`2026-09-21-activity-invite-chance`](../2026-09-21-activity-invite-chance/)
- [`2026-09-21-activity-miniapp-short-link`](../2026-09-21-activity-miniapp-short-link/)
