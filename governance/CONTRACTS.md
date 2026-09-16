# 跨模块接口契约索引

平台规则见 [ARCHITECTURE.md](ARCHITECTURE.md)，机器快照见 `CONTRACT/`；功能契约按功能目录维护。

- [小程序码生成](feature-docs/2026-09-07-miniapp-qrcode/contract-changes.md)：新增 app-api，复用微信 SDK 与 infra 临时文件存储。
- [企业微信外部素材](feature-docs/2026-09-08-wecom-external-material/contract-changes.md)：素材组支持由系统 Provider 配置驱动的有序多结果外部素材。
- [会员企微客户筛选](feature-docs/2026-09-11-member-wecom-customer-filter/contract-changes.md)：会员分页接口支持按是否存在已匹配企微客户关联记录筛选。
- [会员外部用户 ID](feature-docs/2026-09-13-member-external-user-id/contract-changes.md)：会员增加可选外部系统用户 ID，供后台维护和查询展示。
- [企业微信客户朋友圈](feature-docs/2026-09-11-wecom-customer-moments/contract-changes.md)：朋友圈素材组支持文字、图片或单个链接附件，并按企业微信接口规则校验附件类型。
- [企业微信客户联系人按客户员同步](feature-docs/2026-09-13-wecom-customer-contact-follow-user-sync/contract-changes.md)：客户联系人同步接口支持可选客户员 UserID，未传时保持全部客户员同步。
- [活动抽奖次数与中奖限制](feature-docs/2026-09-13-activity-management/contract-changes.md)：报名默认 1 次抽奖机会，支持后台和用户端增加次数，并支持按活动限制每人最多中奖一次。
- [活动 H5 Ticket 认证](feature-docs/2026-09-15-activity-h5-auth/contract-changes.md)：已登录客户端通过一次性 ticket 安全进入 H5，兑换 backend Bearer Token。

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
