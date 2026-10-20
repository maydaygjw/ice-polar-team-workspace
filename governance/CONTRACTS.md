# 跨模块接口契约索引

## 会员详情微信打款

- `POST /admin-api/pay/member-transfer/create`：请求 `userId`、`amount`、`outBillNo`（客户端生成并在同一次打款重试中复用）。后端按当前租户读取会员，仅使用 `routineOpenid`；缺失时拒绝打款。金额以元传入，必须大于 0，精度最多两位。
- 成功响应包含 `outBillNo`、`transferBillNo`、`state`、`packageInfo`。该接口创建微信支付 API v3 商家转账单；微信可能要求用户确认收款，接口受理不等于款项到账。
- `GET /admin-api/pay/member-transfer/query?outBillNo={outBillNo}`：查询该商户转账单，返回单号、状态、转账金额（分）、备注和失败原因。管理端显示公众号 OpenID 与小程序 OpenID；只有存在 `routineOpenid` 时允许发起打款。
- 接口权限为独立的 `member:user:transfer`。复用当前租户微信小程序支付商户配置及商家转账能力。

## 活动报名推荐人 ID（2026-10-11）

`POST /app-api/activity/registration/create` 新增可选 query 参数 `referrerUserId`（Long，backend 会员 ID）。H5 从小程序入口 `referrerUserId` 读取推荐人，报名时以 API 参数 `referrerUserId` 原样传递，不得映射为外部 ID。后端按当前租户校验该会员存在；不存在则报名失败。移除 `referrerExternalUserId` 参数支持。活动分享短链接统一使用下划线参数 `referrer_user_Id`（当前登录会员 ID）。`channelCode` 保持不变，无数据库变更。

平台规则见 [ARCHITECTURE.md](ARCHITECTURE.md)，机器快照见 `CONTRACT/`；功能契约按功能目录维护。

- [小程序码生成](feature-docs/2026-09-07-miniapp-qrcode/contract-changes.md)：新增 app-api，复用微信 SDK 与 infra 临时文件存储。
- [活动页面小程序短链接](feature-docs/2026-09-21-activity-miniapp-short-link/contract-changes.md)：app-api 根据活动模板和推荐人生成微信小程序短链接文本。
- [管理后台生成活动小程序短链接](feature-docs/2026-10-16-activity-admin-short-link/contract-changes.md)：新增 admin-api，根据活动期次生成不带会员推荐人的微信小程序短链接。
- [企业微信外部素材](feature-docs/2026-09-08-wecom-external-material/contract-changes.md)：素材组支持由系统 Provider 配置驱动的有序多结果外部素材。
- [会员企微客户筛选](feature-docs/2026-09-11-member-wecom-customer-filter/contract-changes.md)：会员分页接口支持按是否存在已匹配企微客户关联记录筛选。
- [会员 ID 查询](feature-docs/2026-09-25-member-id-query/contract-changes.md)：会员分页接口支持按会员 ID 精确查询。
- [会员外部用户 ID](feature-docs/2026-09-13-member-external-user-id/contract-changes.md)：会员增加可选外部系统用户 ID，供后台维护和查询展示。
- [企业微信客户朋友圈](feature-docs/2026-09-11-wecom-customer-moments/contract-changes.md)：朋友圈素材组支持文字、图片或单个链接附件，并按企业微信接口规则校验附件类型。
- [企业微信客户联系人客户标签](feature-docs/2026-09-20-wecom-customer-contact-tags/contract-changes.md)：客户联系人支持单个和批量添加、移除企业微信客户标签，不使用内部标签。
- [企业微信客户联系人按客户员同步](feature-docs/2026-09-13-wecom-customer-contact-follow-user-sync/contract-changes.md)：客户联系人同步接口支持可选客户员 UserID，未传时保持全部客户员同步。
- [活动抽奖次数与中奖限制](feature-docs/2026-09-13-activity-management/contract-changes.md)：报名默认 1 次抽奖机会，支持后台和用户端增加次数，并支持按活动限制每人最多中奖一次；用户端报名身份从登录态解析，不再由客户端传入当前用户 `externalUserId`。
- [活动报名订单条件](feature-docs/2026-09-13-activity-management/contract-changes.md)：报名条件支持按配置天数判断会员在 N 天内是否有已确认订单；当前外部订单接口仅支持 1 天；同一条件类型可配置多个条件实例。
- [活动推荐报名查询](feature-docs/2026-09-13-activity-management/contract-changes.md)：用户端支持按活动期次查询当前登录用户推荐的有效报名记录。
- [活动报名条件分类与说明编辑](feature-docs/2026-09-17-activity-management-refactor/contract-changes.md)：报名条件分为内置和扩展两类，支持按租户编辑条件说明。
- [活动报名条件实例管理](feature-docs/2026-09-18-activity-condition-instance-management/contract-changes.md)：条件类型由后端注册，租户可管理带参数的条件实例，并按模板引用阻止删除。
- [活动模板奖品回显](feature-docs/2026-09-13-activity-management/contract-changes.md)：管理端活动模板详情和分页响应返回 `prizes`，用于编辑表单回显模板奖品配置。
- [活动群活码配置](feature-docs/2026-09-13-activity-management/contract-changes.md)：活动模板支持从图片素材库选择群活码图片，并在生成期次时写入快照供用户端详情返回。
- [活动中奖记录兑奖](feature-docs/2026-09-19-activity-winner-claim/contract-changes.md)：开奖只生成中奖记录；后台支持单条中奖记录兑奖、中奖管理批量兑奖和期次批量兑奖，兑奖状态随中奖记录返回。
- [活动中奖企业微信通知](feature-docs/2026-09-21-activity-winner-notification/contract-changes.md)：中奖管理支持由活动管理员向中奖客户发送企业微信中奖通知。
- [活动中奖通知状态](feature-docs/2026-09-21-activity-winner-notification/contract-changes.md)：中奖记录持久化企业微信通知状态，后台支持展示和筛选。
- [活动中奖批量通知](feature-docs/2026-09-25-activity-winner-batch-notification/contract-changes.md)：中奖管理支持按勾选记录批量创建企业微信中奖通知任务。
- [活动线下兑奖码](feature-docs/2026-09-21-activity-offline-claim-code/contract-changes.md)：开奖规则支持线下兑奖，并为每条中奖记录生成唯一兑奖码。
- [活动模板报名人数限制](feature-docs/2026-09-21-activity-registration-limit/contract-changes.md)：后台按活动模板配置每期报名人数上限，报名时由后端原子校验。
- [活动中奖公示长图](feature-docs/2026-09-21-activity-winner-public-poster/contract-changes.md)：管理端和用户端按活动期次查询最多展示 100 条有效中奖记录，管理端生成公示长图，用户端展示脱敏中奖名单。
- [活动邀请报名增加抽奖机会](feature-docs/2026-09-21-activity-invite-chance/contract-changes.md)：后台开启后，被推荐人成功报名且推荐人已报名时，推荐人自动增加一次抽奖/游戏机会；用户端详情返回开关状态，抽奖或游戏后分享提示好友报名奖励。
- [活动推荐阶梯奖励](feature-docs/2026-10-16-activity-referral-rewards/contract-changes.md)：保留推荐增加抽奖/游戏机会配置，另按期次统计新人和普通推荐阶梯并使用独立奖品数量；推荐人通过用户端自助兑奖。
- [活动即时抽奖模式](feature-docs/2026-09-22-activity-lottery-mode/contract-changes.md)：活动模板支持开奖/抽奖两种模式，抽奖模式由 app-api 按概率即时抽奖并以 requestId 幂等。
- [活动游戏模式](feature-docs/2026-10-15-activity-game-mode/contract-changes.md)：管理员手动新增游戏展示名称，活动模板选择游戏并配置三关奖品；新配置使用现有 H5 跳跃玩法，用户端会话由后端推进和结算。
- [活动期次更换群活码](feature-docs/2026-10-18-activity-period-group-qrcode/contract-changes.md)：管理后台可为未结束活动期次更新群活码图片快照，不影响活动模板和历史业务记录。
- 活动游戏关卡提交不再使用数字挑战：`POST /app-api/activity/period/game/submit` 改为接收客户端报告的 `passed` 布尔值；后端保留会话、关卡顺序、幂等和奖品结算校验，响应移除 `challenge`。
- [活动用户端兑奖](feature-docs/2026-09-19-activity-winner-claim/contract-changes.md)：用户端可兑奖自己的中奖记录，报名和中奖结果返回兑奖状态；执行失败保持待兑奖并可重试。
- [活动期次状态与结束操作](feature-docs/2026-09-13-activity-management/contract-changes.md)：期次生命周期状态与报名开关解耦，后台支持显式结束期次，状态扫描任务每 5 分钟推进期次状态和报名开关。
- [活动用户端奖品展示](feature-docs/2026-09-23-activity-app-prize-display/contract-changes.md)：用户端活动详情奖品响应移除库存、已中奖数量和中奖概率字段，保留内部抽奖数据。
- [活动 H5 Ticket 认证](feature-docs/2026-09-15-activity-h5-auth/contract-changes.md)：已登录客户端通过一次性 ticket 安全进入 H5，兑换 backend Bearer Token。
- [外卖用户画像](feature-docs/2026-10-19-member-user-profile/contract-changes.md)：新增租户隔离的画像数据、按订单频率字段计算并持久化的用户阶段、会员 ID 和主商圈代码展示与筛选、只读管理端分页查询和全量阶段分布统计。

活动 H5 认证在测试环境额外支持 Mock Ticket：当 `yshop.security.mock-enable` 和
`yshop.security.mock-webview-ticket-enable` 同时开启时，`test` 前缀加数字用户 ID（例如
`test590471`）可直接兑换该测试用户的 backend Token；测试租户由
`yshop.security.mock-webview-ticket-tenant-id` 配置。该能力不使用 Redis Ticket，生产环境必须关闭。

## 小程序无手机号登录

- `POST /app-api/member/auth/auth-session` 继续接收 `wx.login()` 返回的一次性 `code`。
- 后端通过微信 `jscode2session` 获取并校验 `openid`，按当前 `tenant-id` 查询小程序会员；不存在时创建一个手机号为空的会员并绑定 `routine_openid`。
- 查询或创建成功后统一签发并返回 `accessToken`、`refreshToken`、`expiresTime`、`openId` 和 `userInfo`。
- 客户端不得直接提交 `openid` 作为身份凭证；重试必须重新调用 `wx.login()` 获取新 `code`。
- `auth-session` 的登录副作用是明确的：首次调用可能创建会员并写入登录记录。旧客户端只读取 `openId` 的行为保持兼容。

## 饭火轮新店外部素材

- 新店素材复用当前租户的 `we7_mall_host`（微擎商城域名），不再读取 `fhl_new_store_request_url`。
- 客户端参照热门商品接口，以商城域名拼接 `/app/index.php`，通过 GET 查询新店，携带 `i=2`、`c=entry`、`a=wxapp`、`do=getTopFixedPriceProducts`、`m=hlmall`、`businessModule=store` 和商圈参数 `region_code`。
- 响应沿用 `status=success`、`data` 数组，每个门店包含 `id`、`name`、`logo`；素材继续随机选取最多 3 家有效门店。

## 饭火轮每日活动红包外部素材

- Provider：`FHL_DAILY_ACTIVITY_COUPON_MINI_PROGRAM`，输出类型为 `MINI_PROGRAM`，每次最多返回 1 条。
- Provider 参数为 `businessRegionCode`（商圈编码）和 `coverImageUrl`（优惠券封面图片）；封面由管理端图片组件选择，不写入外部接口凭据。
- 后端复用当前租户的 `we7_mall_host`，以商城域名拼接 `/app/index.php`，通过 GET 调用 `GetDailyShareCoupon`，携带 `i=2`、`t=0`、`v=4.9.9`、`from=wxapp`、`c=entry`、`a=wxapp`、`m=hlmall`、`businessModule=coupon`、签名和 `region_code`。
- 响应要求 `status=success`；从 `data` 中只取第一条有效优惠券，使用 `id` 生成小程序页面 `hlmall/pages/coupon/receive?scene={id}`，标题取优惠券 `name`，图片取 Provider 的 `coverImageUrl`。

## 企业微信客户朋友圈周期发送

- `POST /admin-api/mp/wecom-moment/schedule/create`：创建周期发送计划。请求包含 `accountId`、`materialGroupId`、`senderUserids`、`dailyTimes`（`HH:mm` 数组，单计划每天可配置多个时间），以及可选 `startDate`、`endDate`。
- `GET /admin-api/mp/wecom-moment/schedule/page`：查询周期发送计划及执行状态。
- `POST /admin-api/mp/wecom-moment/schedule/cancel`：取消尚未结束的周期发送计划。
- 每个到期时间点独立创建一条 `mp_wecom_moment_task` 朋友圈任务；原有 `POST /admin-api/mp/wecom-moment/create` 即时发送接口保持兼容。
- backend Quartz handler `wecomMomentScheduledPushJob` 每 10 分钟扫描执行。图片和链接封面在实际执行时调用朋友圈专用素材上传接口，不复用普通素材上传逻辑。
