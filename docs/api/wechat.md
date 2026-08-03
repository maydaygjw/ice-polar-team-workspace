# 微信业务接口（管理端与 App 端）

> 本文统一记录微信业务相关接口：管理后台使用 `/admin-api`，小程序/公众号业务端使用 `/app-api`。
>
> 本文不包含用户登录、令牌刷新等系统认证接口；认证接口归系统登录模块维护。

## 菜单与接口模块

| 菜单 | 接口模块 | 主要用途 |
|------|----------|----------|
| 微信消息 | `/admin-api/message/wechat-template` | 微信模板维护 |
| 通知管理员 | `/admin-api/mp/user` | 公众号粉丝查询、添加/移除通知管理员 |
| 小程序账户 | `/admin-api/ma/account` | 微信小程序账号配置 |
| 公众号管理 | `/admin-api/mp` | 公众号账号、粉丝、消息、菜单、素材、自动回复、草稿、标签、统计 |
| 企业微信配置 | `/admin-api/mp/wecom-account` | 企业微信 CorpID 与客户联系 Secret |
| 客户群 | `/admin-api/mp/wecom-customer-group` | 同步和查询企业微信客户群快照 |
| 客户联系人 | `/admin-api/mp/wecom-customer-contact` | 同步和查询企业微信客户联系人、跟进成员及会员匹配 |
| 引流海报 | `/admin-api/mp/wecom-lead-poster` | 按商圈和联系我二维码管理引流海报 |
| 联系我管理 | `/admin-api/mp/wecom-contact-way` | 同步、创建和维护企业微信“联系我”二维码 |

## 通用约定

### 请求头

```http
Authorization: Bearer <admin-access-token>
tenant-id: 153
Content-Type: application/json
```

`tenant-id` 示例值 `153` 仅适用于当前冰极项目租户，其他环境以租户配置为准。所有账号、客户群、联系人和海报查询都按当前租户隔离。

### 分页

分页请求统一使用：

| 参数 | 类型 | 默认 | 说明 |
|------|------|------|------|
| pageNo | int | 1 | 页码 |
| pageSize | int | 10 | 每页条数 |

分页响应为：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "list": [],
    "total": 0
  }
}
```

权限不足时由后台权限框架返回错误。具体按钮权限以各接口表中的 Permission 为准。

## 1. 微信消息

这里维护微信模板元数据，供公众号模板消息或小程序订阅消息业务使用；它不是微信平台消息回调接口。

### 接口列表

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| GET | `/admin-api/message/wechat-template/page` | `message:wechat-template:query` | 模板分页 |
| GET | `/admin-api/message/wechat-template/get?id={id}` | `message:wechat-template:query` | 模板详情 |
| GET | `/admin-api/message/wechat-template/list?ids={id1},{id2}` | `message:wechat-template:query` | 按编号批量查询 |
| POST | `/admin-api/message/wechat-template/create` | `message:wechat-template:create` | 创建模板 |
| PUT | `/admin-api/message/wechat-template/update` | `message:wechat-template:update` | 更新模板 |
| DELETE | `/admin-api/message/wechat-template/delete?id={id}` | `message:wechat-template:delete` | 删除模板 |

### 创建/更新请求体

```json
{
  "tempkey": "ORDER_PAY_SUCCESS",
  "name": "订单支付成功",
  "content": "订单{{orderId.DATA}}已支付成功",
  "tempid": "微信平台模板ID",
  "status": 1,
  "type": "template"
}
```

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| id | int | 更新时必填 | 模板编号 |
| tempkey | string | 是 | 系统模板编号 |
| name | string | 是 | 模板名称 |
| content | string | 否 | 模板内容说明 |
| tempid | string | 否 | 微信平台模板 ID |
| status | byte | 是 | 模板状态 |
| type | string | 否 | `template` 公众号模板消息；`subscribe` 小程序订阅消息 |

## 2. 公众号管理

### 2.1 公众号账号

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/mp/account/create` | `mp:account:create` | 创建公众号账号 |
| PUT | `/admin-api/mp/account/update` | `mp:account:update` | 更新公众号账号 |
| DELETE | `/admin-api/mp/account/delete?id={id}` | `mp:account:delete` | 删除公众号账号 |
| GET | `/admin-api/mp/account/get?id={id}` | `mp:account:query` | 查询账号详情 |
| GET | `/admin-api/mp/account/page` | `mp:account:query` | 账号分页 |
| GET | `/admin-api/mp/account/list-all-simple` | `mp:account:query` | 账号下拉选项 |
| PUT | `/admin-api/mp/account/generate-qr-code?id={id}` | `mp:account:qr-code` | 生成公众号二维码 |
| PUT | `/admin-api/mp/account/clear-quota?id={id}` | `mp:account:clear-quota` | 清空微信 API 配额 |
| PUT | `/admin-api/mp/account/set-main?id={id}` | `mp:account:set-main` | 设置主公众号账号 |

**创建/更新请求体**

```json
{
  "name": "冰极公众号",
  "account": "icepolar",
  "appId": "wx_xxxxxxxxxxxxxxxx",
  "appSecret": "服务端配置，不要提交真实值到文档",
  "token": "回调校验 Token",
  "aesKey": "消息加密密钥",
  "remark": "生产公众号"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| name | string | 公众号名称 |
| account | string | 公众号微信号 |
| appId | string | 公众号 AppID |
| appSecret | string | 公众号密钥，仅服务端保存和使用 |
| token | string | 微信服务器回调校验 Token |
| aesKey | string | 消息加密密钥，可选 |
| remark | string | 备注 |

不要在前端日志、接口文档或错误提示中记录 `appSecret`、`token`、`aesKey` 的真实值。

### 2.2 公众号粉丝与“通知管理员”

公众号粉丝查询接口：

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| GET | `/admin-api/mp/user/page` | `mp:user:query` | 粉丝分页 |
| GET | `/admin-api/mp/user/get?id={id}` | `mp:user:query` | 粉丝详情 |
| PUT | `/admin-api/mp/user/update` | `mp:user:update` | 更新粉丝信息 |
| POST | `/admin-api/mp/user/sync?accountId={id}` | `mp:user:sync` | 从公众号同步粉丝 |

分页常用筛选字段：`accountId`、`pageNo`、`pageSize`、`isAdminNotice`、`nickname`。

“通知管理员”使用同一份公众号粉丝数据：

```http
GET /admin-api/mp/user/addAdmin?ids=1024,2048
Authorization: Bearer <admin-access-token>
tenant-id: 153
```

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin-api/mp/user/addAdmin?ids={id1},{id2}` | 添加一个或多个公众号粉丝为通知管理员 |
| DELETE | `/admin-api/mp/user/delAdmin?id={id}` | 移除通知管理员 |

通知管理员目前只支持已配置且已关注的微信公众号粉丝。添加前应先配置公众号并同步粉丝。

### 2.3 公众号消息与自动回复

| 功能 | 方法 | 路径 | Permission |
|------|------|------|------------|
| 消息记录分页 | GET | `/admin-api/mp/message/page` | `mp:message:query` |
| 给粉丝发送消息 | POST | `/admin-api/mp/message/send` | `mp:message:send` |
| 自动回复分页 | GET | `/admin-api/mp/auto-reply/page` | `mp:auto-reply:query` |
| 自动回复详情 | GET | `/admin-api/mp/auto-reply/get?id={id}` | `mp:auto-reply:query` |
| 创建自动回复 | POST | `/admin-api/mp/auto-reply/create` | `mp:auto-reply:create` |
| 更新自动回复 | PUT | `/admin-api/mp/auto-reply/update` | `mp:auto-reply:update` |
| 删除自动回复 | DELETE | `/admin-api/mp/auto-reply/delete?id={id}` | `mp:auto-reply:delete` |

消息发送和自动回复的 `data` 结构由 `WxReply` 组件按消息类型提交，支持文本、图片、语音、视频和图文等微信消息类型。联调时以当前页面提交的 JSON 结构为准，不要把不同消息类型混用。

### 2.4 素材、菜单、草稿与发布

**素材**

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| GET | `/admin-api/mp/material/page` | `mp:material:query` | 素材分页 |
| POST | `/admin-api/mp/material/upload-temporary` | `mp:material:upload` | 上传临时素材 |
| POST | `/admin-api/mp/material/upload-permanent` | `mp:material:upload` | 上传永久素材 |
| POST | `/admin-api/mp/material/upload-news-image` | `mp:material:upload` | 上传图文正文图片 |
| DELETE | `/admin-api/mp/material/delete-permanent?id={id}` | `mp:material:delete` | 删除永久素材 |

**自定义菜单**

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| GET | `/admin-api/mp/menu/list?accountId={id}` | `mp:menu:query` | 查询账号菜单 |
| POST | `/admin-api/mp/menu/save` | `mp:menu:save` | 保存并同步菜单 |
| DELETE | `/admin-api/mp/menu/delete?accountId={id}` | `mp:menu:delete` | 删除账号菜单 |

保存菜单请求体：

```json
{
  "accountId": 1,
  "menus": []
}
```

**草稿与发布**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin-api/mp/draft/page` | 草稿分页 |
| POST | `/admin-api/mp/draft/create?accountId={id}` | 创建草稿，body 为 `{ "articles": [...] }` |
| PUT | `/admin-api/mp/draft/update?accountId={id}&mediaId={mediaId}` | 更新草稿 |
| DELETE | `/admin-api/mp/draft/delete?accountId={id}&mediaId={mediaId}` | 删除草稿 |
| GET | `/admin-api/mp/free-publish/page` | 已发布图文分页 |
| POST | `/admin-api/mp/free-publish/submit?accountId={id}&mediaId={mediaId}` | 发布草稿 |
| DELETE | `/admin-api/mp/free-publish/delete?accountId={id}&articleId={articleId}` | 删除已发布图文 |

### 2.5 标签与统计

**标签**

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/mp/tag/create` | `mp:tag:create` | 创建标签 |
| PUT | `/admin-api/mp/tag/update` | `mp:tag:update` | 更新标签 |
| DELETE | `/admin-api/mp/tag/delete?id={id}` | `mp:tag:delete` | 删除标签 |
| GET | `/admin-api/mp/tag/get?id={id}` | `mp:tag:query` | 标签详情 |
| GET | `/admin-api/mp/tag/page` | `mp:tag:query` | 标签分页 |
| GET | `/admin-api/mp/tag/list-all-simple` | `mp:tag:query` | 标签下拉列表 |
| POST | `/admin-api/mp/tag/sync?accountId={id}` | `mp:tag:sync` | 同步公众号标签 |

**统计**

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/admin-api/mp/statistics/user-summary` | 粉丝增减统计 |
| GET | `/admin-api/mp/statistics/user-cumulate` | 粉丝累计统计 |
| GET | `/admin-api/mp/statistics/upstream-message` | 消息发送概况 |
| GET | `/admin-api/mp/statistics/interface-summary` | 接口分析统计 |

统计接口使用 `accountId` 和时间范围等查询参数，具体日期字段以页面 `MpStatisticsGetReqVO` 为准。

### 2.6 公众号平台回调

```text
GET  /admin-api/mp/open/{appId}
POST /admin-api/mp/open/{appId}
```

这两个接口由微信公众平台调用，用于校验服务器地址和接收 XML 消息。前端页面不要主动请求，也不要把它们当作后台查询接口。

## 3. 小程序账户

小程序账户与公众号账户使用独立的 `/ma/account` 路径。

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/ma/account/create` | `ma:account:create` | 创建小程序账号 |
| PUT | `/admin-api/ma/account/update` | `ma:account:update` | 更新小程序账号 |
| DELETE | `/admin-api/ma/account/delete?id={id}` | `ma:account:delete` | 删除小程序账号 |
| GET | `/admin-api/ma/account/get?id={id}` | `ma:account:query` | 查询账号详情 |
| GET | `/admin-api/ma/account/page` | `ma:account:query` | 账号分页 |
| PUT | `/admin-api/ma/account/set-main?id={id}` | `ma:account:set-main` | 设置主小程序账号 |

创建/更新字段与公众号账号基本一致：`name`、`account`、`appId`、`appSecret`、`token`、`aesKey`、`remark`。小程序登录和支付会读取主小程序账号配置。

## 4. 企业微信

企业微信接口均位于 `/admin-api/mp`，使用服务端 CorpID 和客户联系 Secret 调用企业微信 API。Secret 只在服务端保存，管理端列表和详情不得展示明文。

### 4.1 企业微信配置

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/mp/wecom-account/create` | `mp:wecom-account:create` | 创建配置 |
| PUT | `/admin-api/mp/wecom-account/update` | `mp:wecom-account:update` | 更新配置 |
| DELETE | `/admin-api/mp/wecom-account/delete?id={id}` | `mp:wecom-account:delete` | 删除配置 |
| GET | `/admin-api/mp/wecom-account/get?id={id}` | `mp:wecom-account:query` | 配置详情，Secret 脱敏 |
| GET | `/admin-api/mp/wecom-account/page` | `mp:wecom-account:query` | 配置分页 |
| GET | `/admin-api/mp/wecom-account/list-all-simple` | `mp:wecom-account:query` | 配置下拉列表 |

**请求体**

```json
{
  "name": "客户联系企业微信",
  "corpId": "wwxxxxxxxxxxxxxxxx",
  "secret": "客户联系Secret",
  "remark": "用于联系人和客户群同步"
}
```

创建时 `name`、`corpId`、`secret` 必填；更新时 `secret` 为空表示保留原值。保存前应确认该 Secret 具备企业微信“客户联系”接口权限。

### 4.2 客户群

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/mp/wecom-customer-group/sync?accountId={id}` | `mp:wecom-customer-group:sync` | 同步指定配置可见的全部客户群 |
| GET | `/admin-api/mp/wecom-customer-group/page` | `mp:wecom-customer-group:query` | 客户群分页 |
| GET | `/admin-api/mp/wecom-customer-group/get?id={id}` | `mp:wecom-customer-group:query` | 客户群详情和成员快照 |

分页查询参数：`accountId`、`chatId`、`name`、`pageNo`、`pageSize`。

同步成功返回：

```json
{
  "accountId": 1,
  "total": 20,
  "success": 19,
  "failed": 1,
  "failedMessages": ["部分群详情获取失败"]
}
```

重复同步按 `accountId + chatId` 更新本地快照，不产生重复客户群；局部失败不会清空已有数据。

### 4.3 客户联系人

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/mp/wecom-customer-contact/sync?accountId={id}` | `mp:wecom-customer-contact:sync` | 同步客户联系人和跟进关系 |
| GET | `/admin-api/mp/wecom-customer-contact/page` | `mp:wecom-customer-contact:query` | 联系人分页 |
| GET | `/admin-api/mp/wecom-customer-contact/get?id={id}` | `mp:wecom-customer-contact:query` | 联系人详情 |
| POST | `/admin-api/mp/wecom-customer-contact/send-message` | `mp:wecom-customer-contact:send` | 创建文本群发任务 |

分页查询参数：`accountId`、`name`、`externalUserId`、`unionId`、`matchStatus`、`pageNo`、`pageSize`。

同步响应字段：`accountId`、`total`、`created`、`updated`、`matched`、`unmatched`、`failed`、`failedMessages`。

联系人详情中的 `followUsers` 是当前同步到的跟进成员列表。会员匹配状态：

| 值 | 含义 |
|------|------|
| `MATCHED` | UnionID 唯一匹配到会员 |
| `UNMATCHED` | UnionID 为空或没有匹配会员 |
| `AMBIGUOUS` | 当前租户存在多个相同 UnionID 会员 |

**发送文本消息**

```json
{
  "contactId": 1001,
  "followUserId": "zhangsan",
  "content": "您好，请问有什么可以帮助您？"
}
```

`content` 最长 2000 个字符，`followUserId` 必须是该联系人当前的跟进成员。返回的 `msgId` 表示企业微信已创建群发任务，不代表客户已经收到；跟进成员仍需在企业微信客户端确认发送。

### 4.4 联系我管理

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| POST | `/admin-api/mp/wecom-contact-way/sync?accountId={id}` | `mp:wecom-contact-way:sync` | 同步企业微信已有联系我配置 |
| GET | `/admin-api/mp/wecom-contact-way/page` | `mp:wecom-contact-way:query` | 联系我配置分页 |
| GET | `/admin-api/mp/wecom-contact-way/simple-list?accountId={id}` | `mp:wecom-contact-way:query` | 海报选择用二维码列表 |
| GET | `/admin-api/mp/wecom-contact-way/get?id={id}` | `mp:wecom-contact-way:query` | 联系我详情 |
| POST | `/admin-api/mp/wecom-contact-way/create` | `mp:wecom-contact-way:create` | 创建二维码联系我配置 |
| PUT | `/admin-api/mp/wecom-contact-way/update` | `mp:wecom-contact-way:update` | 更新联系我配置 |
| DELETE | `/admin-api/mp/wecom-contact-way/delete?id={id}` | `mp:wecom-contact-way:delete` | 删除联系我配置 |

**创建请求体**

```json
{
  "accountId": 1,
  "type": 1,
  "scene": 2,
  "style": 0,
  "remark": "杭州门店客服",
  "skipVerify": false,
  "userIds": ["zhangsan"],
  "partyIds": []
}
```

- `scene` 当前固定使用 `2`（二维码联系）；
- `type` 支持 `1`（单人）和 `2`（多人）；
- `userIds` 和 `partyIds` 至少填写一项；
- 新增、更新和删除会同步调用企业微信并刷新本地快照。

### 4.5 引流海报

海报图片由管理端 Canvas 合成并上传，后端只保存图片 URL、二维码快照和位置参数，不负责图片合成。

| 方法 | 路径 | Permission | 说明 |
|------|------|------------|------|
| GET | `/admin-api/mp/wecom-lead-poster/page` | `mp:wecom-lead-poster:query` | 海报分页 |
| GET | `/admin-api/mp/wecom-lead-poster/get?id={id}` | `mp:wecom-lead-poster:query` | 海报详情 |
| POST | `/admin-api/mp/wecom-lead-poster/create` | `mp:wecom-lead-poster:create` | 创建海报 |
| PUT | `/admin-api/mp/wecom-lead-poster/update` | `mp:wecom-lead-poster:update` | 更新海报 |
| DELETE | `/admin-api/mp/wecom-lead-poster/delete?id={id}` | `mp:wecom-lead-poster:delete` | 删除海报 |
| PUT | `/admin-api/mp/wecom-lead-poster/update-status?id={id}&status={status}` | `mp:wecom-lead-poster:update` | 启用/停用海报 |

**创建/更新请求体**

```json
{
  "businessRegionId": 10,
  "contactWayId": 20,
  "backgroundUrl": "https://cdn.example.com/poster-bg.png",
  "imageUrl": "https://cdn.example.com/poster.png",
  "qrX": 780,
  "qrY": 1120,
  "qrSize": 220
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| businessRegionId | long | 商圈编号，必须存在且处于可用状态 |
| contactWayId | long | 企业微信联系我配置编号 |
| backgroundUrl | string | 背景图 URL |
| imageUrl | string | 前端合成后上传的最终海报 URL |
| qrX / qrY | int | 二维码左上角坐标 |
| qrSize | int | 二维码尺寸，`80–1125` |

二维码位置和尺寸必须在 `1125 × 1500` 画布范围内。启用海报后，小程序可通过公开接口按商圈获取最终图片地址，接口详情见第 5 节：

```text
GET /app-api/wecom/lead-poster/get-by-business-region?region_code={code}
```

该接口返回图片 URL 字符串，不需要后台登录态。

## 5. App 端微信业务接口

本文只记录微信业务接口，不包含用户登录、令牌刷新等系统认证接口；认证接口归系统登录模块维护。

### 5.1 小程序模板消息列表

| 方法 | 路径 | 登录态 | 说明 |
|------|------|:---:|------|
| GET | `/app-api/template/list` | ✅ | 查询当前租户的小程序订阅消息模板 ID 列表 |

请求头：

```http
Authorization: Bearer <access-token>
tenant-id: 153
```

成功响应示例：

```json
{
  "code": 0,
  "msg": "",
  "data": [
    "template-id-1",
    "template-id-2"
  ]
}
```

### 5.2 按商圈查询引流海报

| 方法 | 路径 | 登录态 | 说明 |
|------|------|:---:|------|
| GET | `/app-api/wecom/lead-poster/get-by-business-region?region_code={code}` | ❌ | 按商圈代码查询当前启用的引流海报图片 URL |

该接口返回 `CommonResult<String>`，不需要管理后台登录态，但请求仍应携带当前租户的 `tenant-id`。

## 对接流程与安全要求

```text
配置公众号/小程序或企业微信账号
    → 同步微信侧数据
    → 后台查询/编辑本地快照
    → 发送消息、生成二维码或保存引流海报
```

- 账号配置保存后再执行同步；不能使用未保存或其他租户的 `accountId`。
- 企业微信同步是后台主动调用外部 API，成功与部分失败结果都应展示返回汇总。
- `CorpID`、公众号 `AppSecret`、企业微信 `Secret`、微信 Token 和 AES Key 不得提交到 Git、日志或前端埋点。
- 客户联系人 UnionID、手机号和企业微信外部联系人信息按租户隔离，展示时使用脱敏字段。
- 删除或更新账号前确认其下游客户群、联系人、联系我配置和海报仍有无业务依赖。
