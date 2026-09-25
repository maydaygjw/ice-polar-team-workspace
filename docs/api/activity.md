# 霸王餐活动接口

> 活动接口统一归入 Swagger 的“营销”文档分组。接口前缀为 `/admin-api`（管理端）和 `/app-api`（用户端），业务响应统一为 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功。
>
> 管理端请求头：`Authorization: Bearer <admin-token>`、`tenant-id: <tenant-id>`。用户端需要登录的接口请求头：`Authorization: Bearer <member-token>`、`tenant-id: <tenant-id>`。
>
> 后端源码：`backend/yshop-module-activity/yshop-module-activity-biz/src/main/java/co/yixiang/yshop/module/activity/`

## Swagger 分组

活动模块的管理端和用户端接口均匹配 Swagger 分组“营销”，包括 `/activity/template/**`、`/activity/period/**`、`/activity/registration/**`、`/activity/winner/**`、`/activity/prize/**`、`/activity/draw-rule/**` 和 `/activity/share/**`。

## 接口总览

### 管理端

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| POST | `/admin-api/activity/template/create` | `activity:template:create` | 创建活动模板 |
| PUT | `/admin-api/activity/template/update` | `activity:template:update` | 更新活动模板 |
| DELETE | `/admin-api/activity/template/delete?id={id}` | `activity:template:delete` | 删除活动模板 |
| PUT | `/admin-api/activity/template/enable?id={id}&enabled={enabled}` | `activity:template:update` | 启用/停用活动模板 |
| GET | `/admin-api/activity/template/get?id={id}` | `activity:template:query` | 查询活动模板详情 |
| GET | `/admin-api/activity/template/page` | `activity:template:query` | 分页查询活动模板 |
| GET | `/admin-api/activity/period/page` | `activity:period:query` | 分页查询活动期次 |
| GET | `/admin-api/activity/period/get?id={id}` | `activity:period:query` | 查询期次详情和快照 |
| POST | `/admin-api/activity/period/generate` | `activity:template:update` | 生成活动期次 |
| POST | `/admin-api/activity/period/draw` | `activity:period:draw` | 手动开奖，仅开奖模式 |
| POST | `/admin-api/activity/period/claim-winners` | `activity:winner:claim` | 批量处理本期中奖记录兑奖 |
| POST | `/admin-api/activity/period/qrcode` | `activity:period:qrcode` | 生成期次小程序码 |
| GET | `/admin-api/activity/draw-rule/list` | `activity:draw-rule:query` | 查询可用开奖规则 |
| GET | `/admin-api/activity/registration/page` | `activity:registration:query` | 分页查询报名记录 |
| POST | `/admin-api/activity/registration/increase-chances` | `activity:registration:query` | 增加报名用户抽奖次数 |
| GET | `/admin-api/activity/registration/export` | `activity:registration:export` | 导出报名记录 |
| GET | `/admin-api/activity/winner/page` | `activity:winner:query` | 分页查询中奖记录 |
| POST | `/admin-api/activity/winner/claim` | `activity:winner:claim` | 单条中奖记录兑奖 |
| POST | `/admin-api/activity/winner/claim-batch` | `activity:winner:claim` | 批量兑奖中奖记录 |
| POST | `/admin-api/activity/winner/send-notification` | `activity:winner:claim` | 发送中奖企业微信通知 |
| GET | `/admin-api/activity/winner/export` | `activity:winner:export` | 导出中奖记录 |
| GET | `/admin-api/activity/condition/types` | `activity:condition:query` | 查询报名条件类型 |
| PUT | `/admin-api/activity/condition/description` | `activity:condition:update` | 编辑报名条件说明 |

### 用户端

| 方法 | 路径 | 登录 | 说明 |
|------|------|:---:|------|
| GET | `/app-api/activity/period/detail?periodId={id}` | 否 | 查询活动期次详情 |
| GET | `/app-api/activity/period/latest?templateId={id}` | 否 | 查询指定活动最近期次详情 |
| POST | `/app-api/activity/period/register?periodId={id}` | 是 | 当前登录用户报名活动 |
| POST | `/app-api/activity/period/draw` | 是 | 抽奖模式即时抽奖，报名后直接返回结果 |
| GET | `/app-api/activity/period/my-result?periodId={id}` | 是 | 查询当前用户报名和中奖结果 |
| GET | `/app-api/activity/period/my-referrals?periodId={id}` | 是 | 查询当前用户推荐的有效报名记录 |
| POST | `/app-api/activity/period/increase-chances?periodId={id}&chances={n}` | 是 | 增加当前用户抽奖次数 |
| GET | `/app-api/activity/share/short-link?templateId={id}` | 是 | 生成活动页面小程序短链接 |
| POST | `/app-api/activity/registration/create?periodId={id}&userId={externalUserId}` | 兼容接口 | 按外部用户标识报名，旧调用方使用 |

## 1. 活动模板

### 创建 `POST /admin-api/activity/template/create`

请求体：`ActivityTemplateCreateReqVO`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| title | string | 是 | 活动标题 |
| businessRegionId | long | 是 | 活动商圈 ID |
| content | string | 是 | 活动富文本正文 |
| groupLink | string | 否 | 活动群链接，保留用于兼容旧客户端 |
| groupQrcodeImage | string | 否 | 活动群活码图片 URL；用户端未满足 `WECOM_GROUP_MEMBER` 条件时展示此二维码 |
| coverImage | string | 是 | 活动主图 URL |
| backgroundImage | string | 否 | 页面背景图 URL |
| promoteImages | string[] | 否 | 宣传素材图片 URL 列表 |
| cycleType | int | 是 | 当前仅支持 `1`，表示每周 |
| cycleWeekday | int | 是 | 每周星期，`1-7` 表示周一至周日 |
| registrationStartTime | time | 是 | 每日开始报名时间，如 `00:00:00` |
| registrationEndTime | time | 是 | 每日结束报名时间，如 `22:00:00` |
| drawTime | time | 条件 | 每日开奖时间；开奖模式必填，抽奖模式必须为空 |
| drawMode | int | 否 | 活动模式：`1` 开奖，`2` 抽奖，默认 `1` |
| registrationLimit | int | 是 | 每期报名人数限制，`0` 表示不限 |
| inviteRegistrationChance | boolean | 否 | 是否开启邀请报名增加推荐人 1 次抽奖机会，默认 `false` |
| checkWecomAdmin | boolean | 否 | 是否校验已添加活动客户管理员 |
| checkGroupMember | boolean | 否 | 是否校验活动社群成员 |
| singleWinner | boolean | 否 | 是否限制每个人最多中奖一次，默认 `false` |
| enabled | boolean | 否 | 是否启用模板 |
| prizes | object[] | 是 | 奖品列表，至少一项 |
| admins | object[] | 否 | 企业微信客户管理员配置列表 |
| groups | object[] | 否 | 活动社群配置列表 |

奖品字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| prizeName | string | 是 | 奖品名称 |
| image | string | 否 | 奖品图片 URL |
| quantity | int | 是 | 奖品数量，必须大于等于 1 |
| probability | decimal | 条件 | 抽奖模式中奖概率，范围 `0.00-100.00`，最多两位小数；开奖模式可为空 |
| claimInstruction | string | 否 | 领奖说明 |
| drawRuleType | string | 是 | 开奖规则类型；线下兑奖使用 `OFFLINE_CLAIM` |
| drawRuleParams | object | 是 | 开奖规则参数；`OFFLINE_CLAIM` 当前为空对象 `{}` |

开奖规则通过 `GET /admin-api/activity/draw-rule/list` 查询。`OFFLINE_CLAIM` 表示由线下工作人员核验后发放，开奖时不执行外部发放动作，后台确认兑奖时仍沿用中奖记录兑奖流程。

请求：

```http
GET /admin-api/activity/draw-rule/list
Authorization: Bearer <admin-token>
tenant-id: <tenant-id>
```

响应：

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "type": "OFFLINE_CLAIM",
      "name": "线下兑奖",
      "description": "线下核验兑奖",
      "version": 1,
      "paramsSchema": {},
      "enabled": true
    }
  ]
}
```

管理员字段：`wecomUserid`（企业微信管理员 UserID）、`adminName`（名称快照）、`sort`（排序）。

社群字段：`tagId`、`tagName`、`groupId`、`groupName`、`sort`。

**请求示例**

```json
{
  "title": "周五霸王餐",
  "businessRegionId": 1001,
  "content": "本周五到店参与霸王餐活动",
  "coverImage": "https://cdn.example.com/activity-cover.png",
  "backgroundImage": "https://cdn.example.com/activity-background.png",
  "cycleType": 1,
  "cycleWeekday": 5,
  "registrationStartTime": "00:00:00",
  "registrationEndTime": "22:00:00",
  "drawTime": "22:00:00",
  "drawMode": 1,
  "registrationLimit": 100,
  "inviteRegistrationChance": true,
  "checkWecomAdmin": true,
  "checkGroupMember": true,
  "singleWinner": false,
  "enabled": true,
  "prizes": [
    {
      "prizeName": "奶茶兑换券",
      "image": "https://cdn.example.com/prize.png",
      "quantity": 10,
      "probability": null,
      "claimInstruction": "凭中奖记录到店核销",
      "drawRuleType": "OFFLINE_CLAIM",
      "drawRuleParams": {}
    }
  ],
  "admins": [
    {
      "wecomUserid": "zhangsan",
      "adminName": "张三",
      "sort": 0
    }
  ],
  "groups": [
    {
      "tagId": 10001,
      "tagName": "霸王餐用户",
      "groupId": "wr_test_group",
      "groupName": "杭州霸王餐群",
      "sort": 0
    }
  ]
}
```

活动模式规则：

- `drawMode=1`（开奖模式）为默认模式。报名结束后按 `drawTime` 统一开奖，`drawTime` 必须填写，奖品 `probability` 不参与开奖。
- `drawMode=2`（抽奖模式）在报名时间范围内即可报名并调用用户端即时抽奖接口，`drawTime` 必须为 `null`；每个奖品必须配置 `probability`。
- 抽奖模式的奖品概率累计可以小于 `100.00%`，剩余概率返回未中奖；奖品耗尽或 `singleWinner=true` 且用户已经中奖时，也返回未中奖。
- 抽奖模式下每次抽奖都会消耗一次抽奖次数；同一个用户只能在有效报名后抽奖。
- 新建模板未传 `drawMode` 时按开奖模式处理。

抽奖模式示例：

```json
{
  "registrationStartTime": "09:00:00",
  "registrationEndTime": "18:00:00",
  "drawTime": null,
  "drawMode": 2,
  "singleWinner": true,
  "prizes": [
    {
      "prizeName": "奶茶兑换券",
      "quantity": 10,
      "probability": 5.00,
      "drawRuleType": "OFFLINE_CLAIM",
      "drawRuleParams": {}
    }
  ]
}
```

成功时 `data` 为新建模板 ID。

`inviteRegistrationChance` 开启后，用户报名成功且存在推荐人时，如果推荐人已报名同一期活动，推荐人的 `drawChances` 自动增加 1；推荐人未报名或推荐人是当前用户本人时不增加。

### 更新 `PUT /admin-api/activity/template/update`

请求体与创建相同，额外必须包含 `id`。已经生成活动期次的模板不能修改影响期次快照的配置。

成功时 `data` 为 `true`。

### 删除 `DELETE /admin-api/activity/template/delete?id={id}`

只有不存在活动期次、报名记录和中奖记录的模板允许删除。成功时 `data` 为 `true`。

### 启用/停用 `PUT /admin-api/activity/template/enable`

Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| id | long | 是 | 活动模板 ID |
| enabled | boolean | 是 | `true` 启用，`false` 停用 |

成功时 `data` 为 `true`。

### 查询详情 `GET /admin-api/activity/template/get?id={id}`

返回 `ActivityTemplateRespVO`，包含模板配置、启用状态、是否已生成期次和创建时间。编辑回显时，`admins` 和 `groups` 返回模板已保存的配置快照：

```json
{
  "admins": [
    { "wecomUserid": "zhangsan", "adminName": "张三", "sort": 0 }
  ],
  "groups": [
    {
      "tagId": 1001,
      "tagName": "霸王餐用户",
      "groupId": "wr_test_group",
      "groupName": "杭州霸王餐群",
      "sort": 0
    }
  ]
}
```

保存模板时客户端提交完整的 `admins`、`groups` 数组；未配置时传空数组或省略字段均按无配置处理。`groups` 中的 `groupId` 使用本地企业微信群 ID，`tagId` 使用本地社群标签 ID。

### 分页查询 `GET /admin-api/activity/template/page`

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| pageNo | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 10 | 每页条数 |
| title | string | 否 | - | 标题模糊匹配 |
| businessRegionId | long | 否 | - | 商圈筛选 |
| enabled | boolean | 否 | - | 启用状态筛选 |

返回 `PageResult<ActivityTemplateRespVO>`。

## 2. 活动期次

### 分页查询 `GET /admin-api/activity/period/page`

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| pageNo | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 10 | 每页条数 |
| templateId | long | 否 | - | 模板筛选 |
| status | int | 否 | - | `1` 未开始，`2` 进行中，`3` 已结束 |
| businessRegionId | long | 否 | - | 商圈筛选 |

### 查询详情 `GET /admin-api/activity/period/get?id={id}`

返回期次时间、报名人数、报名人数限制、中奖人数、内容快照、企微/社群配置快照、`drawMode`、`singleWinner` 规则和奖品列表。`drawMode=2` 时 `drawTime` 返回 `null`，奖品列表包含抽奖概率。

其中 `registrationLimit` 为 `0` 时表示不限；当当前 `registrationCount` 达到大于 `0` 的限制值后，用户端报名接口返回业务错误码 `1009000031`。

### 生成期次 `POST /admin-api/activity/period/generate`

Query 参数：

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| templateId | long | 是 | - | 活动模板 ID |
| occurrence | int | 否 | 1 | 生成第几期，支持 `1-3` |

成功时 `data` 为活动期次 ID；按模板和日期幂等生成。

### 手动开奖 `POST /admin-api/activity/period/draw`

请求体：

```json
{"periodId": 123, "channelCode": "poster"}
```

`channelCode` 可选，最大长度为 64 个字符。服务端根据期次所属模板和商圈生成与活动分享页面一致的二维码页面参数：固定页面路径为 `hlmall/pages/index/index`，携带 `open_activity=1`、`templateId`、`region_code`，传入渠道码时追加 `channelCode`。二维码不携带推荐人参数；客户端不得传入 `path`、`scene`、`appId`、`templateId`、`region_code`、推荐人或租户信息。

仅允许在计划开奖时间后执行，且只适用于 `drawMode=1`（开奖模式）。抽奖模式不会进入统一开奖任务，也不能通过此接口开奖。成功时 `data` 为 `true`，重复触发不会重复开奖。

### 批量兑奖本期中奖记录 `POST /admin-api/activity/period/claim-winners`

需要权限 `activity:winner:claim`。

```json
{"periodId": 123}
```

按当前租户该期次的有效中奖记录批量兑奖，返回 `{total, successCount, skippedCount, failedCount, failedWinnerIds}`。

响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "total": 2,
    "successCount": 1,
    "skippedCount": 1,
    "failedCount": 0,
    "failedWinnerIds": []
  }
}
```

### 生成小程序码 `POST /admin-api/activity/period/qrcode`

请求体：

```json
{"periodId": 123}
```

成功响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "url": "https://cdn.example.com/activity-qrcode.png",
    "expiresAt": "2026-09-15T00:00:00Z"
  }
}
```

`periodId` 仅用于后台定位期次，二维码每次生成独立的临时文件，预计保留 48 小时，不保存永久二维码业务记录。

## 3. 活动报名记录

### 分页查询 `GET /admin-api/activity/registration/page`

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| pageNo | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 10 | 每页条数 |
| periodId | long | 否 | - | 活动期次 ID |
| userId | long | 否 | - | 会员用户 ID |
| status | int | 否 | - | 报名状态，`1` 有效 |

### 导出 `GET /admin-api/activity/registration/export`

Query 参数同报名记录分页查询。接口返回 Excel 文件；服务端会导出符合条件的全部记录，不受分页大小限制。

### 增加抽奖次数 `POST /admin-api/activity/registration/increase-chances`

需要权限 `activity:registration:query`，仅允许在报名开始时间（含）至报名截止时间（不含）之间为有效报名增加次数；即使当前抽奖次数已全部使用，只要仍在报名时间内也允许追加。

请求体：

```json
{"registrationId": 10001, "chances": 2}
```

`chances` 范围为 `1-1000`。成功时 `data` 为增加后的抽奖总次数。

## 4. 活动中奖记录

### 分页查询 `GET /admin-api/activity/winner/page`

| 参数 | 类型 | 必填 | 默认值 | 说明 |
|------|------|:---:|:---:|------|
| pageNo | int | 否 | 1 | 页码 |
| pageSize | int | 否 | 10 | 每页条数 |
| periodId | long | 否 | - | 活动期次 ID |
| userId | long | 否 | - | 会员用户 ID |
| prizeName | string | 否 | - | 奖品名称模糊匹配 |
| status | int | 否 | - | 中奖记录状态，`1` 有效 |
| claimStatus | int | 否 | - | 兑奖状态，`0` 待兑奖，`1` 已兑奖，`2` 处理中 |

### 导出 `GET /admin-api/activity/winner/export`

Query 参数同中奖记录分页查询。接口返回 Excel 文件；服务端会导出符合条件的全部记录。

中奖记录返回字段还包括 `redemptionCode`（租户内唯一、不可变的线下兑奖码）、`claimTime`（成功兑奖时间）。兑奖码由服务端生成，客户端不得自行生成或修改。

中奖记录分页响应示例：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "list": [
      {
        "id": 20001,
        "periodId": 123,
        "userId": 592901,
        "prizeName": "当日霸王餐",
        "redemptionCode": "ACT7K4M9Q2X8P",
        "winnerTime": "2026-09-21T13:19:02",
        "status": 1,
        "claimStatus": 0,
        "claimTime": null
      }
    ],
    "total": 1
  }
}
```

### 单条兑奖 `POST /admin-api/activity/winner/claim`

需要权限 `activity:winner:claim`。

```json
{"winnerId": 20001}
```

成功时 `data` 为 `true`。仅处理当前租户、有效且待兑奖的中奖记录。

响应：

```json
{"code": 0, "msg": "", "data": true}
```

### 批量兑奖 `POST /admin-api/activity/winner/claim-batch`

需要权限 `activity:winner:claim`。

```json
{"winnerIds": [20001, 20002]}
```

返回 `{total, successCount, skippedCount, failedCount, failedWinnerIds}`；已兑奖记录幂等跳过，单条规则执行失败不会回滚其他已成功记录。

响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "total": 2,
    "successCount": 2,
    "skippedCount": 0,
    "failedCount": 0,
    "failedWinnerIds": []
  }
}
```

### 发送中奖企业微信通知 `POST /admin-api/activity/winner/send-notification`

需要权限 `activity:winner:claim`。请求体只传中奖记录 ID，发送人和客户由服务端根据活动管理员及企业微信联系人关系选择。

```json
{"winnerId": 20001}
```

成功响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "msgId": "msg_123",
    "senderUserId": "zhangsan"
  }
}
```

消息由服务端生成，包含活动标题、奖品名称和兑奖说明；重复操作会创建新的企业微信消息任务。

## 5. 用户端接口

### 查询活动详情 `GET /app-api/activity/period/detail`

无需登录。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| periodId | long | 是 | 活动期次 ID |

返回 `AppActivityPeriodDetailRespVO`：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "id": 123,
    "periodNo": "2026-09-18",
    "title": "周五霸王餐",
    "periodDate": [2026, 9, 18],
    "registrationStartTime": 1789660800000,
    "registrationEndTime": 1789740000000,
    "drawTime": 1789740000000,
    "drawMode": 1,
    "status": 2,
    "registrationCount": 100,
    "plannedWinnerCount": 10,
    "actualWinnerCount": 0,
    "singleWinner": false,
    "content": "<h2>周五霸王餐</h2><p>本周五到店参与霸王餐活动</p>",
    "groupLink": "https://work.weixin.qq.com/gm/5fdd2cb348c86f9b99d7577b5d383541",
    "groupQrcodeImage": "https://cdn.example.com/activity-group-qrcode.png",
    "coverImage": "https://cdn.example.com/activity-cover.png",
    "backgroundImage": "https://cdn.example.com/activity-background.png",
    "promoteImages": [],
    "prizes": [
      {
        "id": 10001,
        "sort": 0,
        "prizeName": "奶茶兑换券",
        "image": "https://cdn.example.com/prize.png",
        "quantity": 10,
        "winnerQuantity": 0,
        "probability": null,
        "claimInstruction": "凭中奖记录到店核销"
      }
    ]
  }
}
```

`periodDate` 使用 `[year, month, day]` 数组；`registrationStartTime`、`registrationEndTime` 和 `drawTime` 使用 Unix 毫秒时间戳。抽奖模式的 `drawTime` 为 `null`。客户端展示时应按业务时区格式化，不要直接展示原始数值。

`content` 为富文本 HTML 字符串，客户端应按富文本容器渲染，并限制图片宽度以适配移动端。

`status`：`1` 未开始，`2` 进行中，`3` 已结束。

`singleWinner` 为 `true` 时同一用户在本期最多中奖一次；为 `false` 时，用户可按抽奖次数获得多条中奖记录。

`drawMode`：`1` 表示报名后等待统一开奖，`2` 表示报名后在报名时间范围内即时抽奖。抽奖模式下，奖品的 `probability` 为中奖概率百分比，服务端负责随机计算，客户端不得自行计算中奖结果。

### 查询指定活动最近期次 `GET /app-api/activity/period/latest`

无需登录，需要传入活动模板 ID。服务端优先返回该活动模板下当前时间最近的未结束期次（按计划开奖时间升序）；如果没有未结束期次，则返回该活动模板下最近一个已结束期次。不存在该活动模板或其期次时返回对应的资源不存在错误。

```http
GET /app-api/activity/period/latest?templateId=123
```

返回结构与 `/app-api/activity/period/detail` 相同。

当返回的报名条件中存在 `type=WECOM_GROUP_MEMBER` 且 `passed=false` 时，客户端应使用本响应的 `groupQrcodeImage` 展示活动群二维码供用户扫码入群，不应跳转 `groupLink`。`groupQrcodeImage` 与活动期次一起取最近期次的快照；为空时不展示“去加群”入口。

### 报名活动 `POST /app-api/activity/period/register`

需要登录，请求体为空，使用 Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| periodId | long | 是 | 活动期次 ID |
| referrerUserId | long | 否 | 推荐人用户 ID |
| channelCode | string | 否 | 报名渠道标识，最长 64 个字符 |

```http
POST /app-api/activity/period/register?periodId=123
Authorization: Bearer <member-token>
tenant-id: <tenant-id>
Content-Type: application/json
```

请求体为空，不要在请求体中传入用户 ID、租户 ID 或管理员身份。

成功响应：

```json
{
  "code": 0,
  "msg": "",
  "data": 10001
}
```

其中 `data` 为报名记录 ID。服务端从登录态获取会员 ID，并按该会员关联的企微外部联系人执行活动管理员和社群成员校验。重复点击时客户端应保持按钮 loading，避免重复请求；服务端也会通过期次和用户唯一约束拒绝重复报名。

### 查询我推荐的报名记录 `GET /app-api/activity/period/my-referrals`

需要登录。服务端从登录态获取推荐人用户 ID，不接受客户端传入推荐人用户 ID。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| periodId | long | 是 | 活动期次 ID |

```http
GET /app-api/activity/period/my-referrals?periodId=123
Authorization: Bearer <member-token>
tenant-id: <tenant-id>
```

仅返回当前租户、指定活动期次内状态有效且推荐人为当前用户的报名记录，按报名时间倒序排列。响应中的 `userId` 为被推荐报名用户 ID：

```json
{
  "code": 0,
  "msg": "",
  "data": [
    {
      "id": 10002,
      "periodId": 123,
      "userId": 603698,
      "nickname": "活动用户",
      "channelCode": "poster",
      "registerTime": "2026-09-18T12:11:10",
      "status": 1
    }
  ]
}
```

### 查询我的结果 `GET /app-api/activity/period/my-result`

需要登录。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| periodId | long | 是 | 活动期次 ID |

未报名时返回：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "periodId": 123,
    "registered": false,
    "winner": false
  }
}
```

已报名但尚未中奖或尚未开奖时，`registered` 为 `true`、`winner` 为 `false`。中奖后会返回 `winnerId`、`prizeId`、`prizeName`、`prizeImage`、`claimInstruction`、`redemptionCode`、`winnerTime` 和 `winnerStatus`。其中 `redemptionCode` 为服务端生成的线下兑奖码。

### 生成活动页面小程序短链接 `GET /app-api/activity/share/short-link`

需要登录。客户端只传活动模板 ID；服务端从 access token 获取当前会员，读取其 `external_user_id` 作为推荐人参数，并从模板关联的启用商圈解析 `region_code`。

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| templateId | long | 是 | 活动模板 ID，必须为正数 |
```http
GET /app-api/activity/share/short-link?templateId=1
Authorization: Bearer <member-token>
tenant-id: <tenant-id>
```

响应：

```json
{
  "code": 0,
  "msg": "",
  "data": "#小程序://氧气学长/efrFZnrUkrq6Ydp"
}
```

服务端调用当前租户小程序主账号生成短链接，固定页面路径及参数为：

```text
hlmall/pages/index/index?open_activity=1&templateId=1&referrer_user_Id=592901&region_code=SHLJZ001
```

成功时 `data` 为微信小程序短链接文本，例如 `#小程序://氧气学长/efrFZnrUkrq6Ydp`；短链接不持久化。

### 即时抽奖 `POST /app-api/activity/period/draw`

需要登录，仅适用于 `drawMode=2`（抽奖模式）。用户必须已报名，且当前时间处于报名时间范围内。`requestId` 为客户端生成的幂等请求号，网络重试必须复用同一个值；同一用户、同一期、同一 `requestId` 会返回第一次完整结果，不会重复消耗次数或生成中奖记录。

请求体：

```json
{
  "periodId": 123,
  "requestId": "6d7f0f0b-2ddf-4f6c-a1d4-4a2f4c8bc7b9"
}
```

请求头：

```http
POST /app-api/activity/period/draw
Authorization: Bearer <member-token>
tenant-id: <tenant-id>
Content-Type: application/json
```

中奖响应：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "drawResult": "WIN",
    "winner": {
      "winnerId": 20001,
      "prizeId": 10001,
      "prizeName": "奶茶兑换券",
      "prizeImage": "https://cdn.example.com/prize.png",
      "claimInstruction": "凭中奖记录到店核销",
      "redemptionCode": "ACT7K4M9Q2X8P",
      "winnerTime": "2026-09-18T10:01:02",
      "winnerStatus": 1
    },
    "drawChances": 3,
    "drawChancesUsed": 1,
    "remainingDrawChances": 2
  }
}
```

未中奖也是成功响应，`winner` 为 `null`，但会消耗一次抽奖次数：

```json
{
  "code": 0,
  "msg": "",
  "data": {
    "drawResult": "NO_WIN",
    "winner": null,
    "drawChances": 3,
    "drawChancesUsed": 2,
    "remainingDrawChances": 1
  }
}
```

奖品耗尽、用户已中奖且 `singleWinner=true`、或随机结果落在未中奖概率区间时，均返回 `NO_WIN`，不应作为接口异常处理。

### 增加我的抽奖次数 `POST /app-api/activity/period/increase-chances`

需要登录，使用当前登录用户在指定期次的报名记录。仅允许在报名开始时间（含）至报名截止时间（不含）之间调用；开奖模式和抽奖模式规则一致。即使当前抽奖次数已全部使用，只要仍在报名时间内也允许追加。

```http
POST /app-api/activity/period/increase-chances?periodId=123&chances=2
Authorization: Bearer <member-token>
```

`chances` 范围为 `1-10`。成功时 `data` 为增加后的抽奖总次数。用户端结果中的 `drawChances`、`drawChancesUsed` 和 `remainingDrawChances` 分别表示总次数、已使用次数和剩余次数；`winners` 返回全部中奖记录。

### 旧版报名接口 `POST /app-api/activity/registration/create`

兼容旧调用方使用，参数通过 Query 传递：

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| periodId | long | 是 | 活动期次 ID |
| userId | string | 是 | `yshop_user.external_user_id`，不是数据库用户 ID，也不是企微内部 UserID |

新客户端应使用 `/app-api/activity/period/register`，由服务端从登录态解析用户身份。

## 常见业务错误

| 错误 | 含义 |
|------|------|
| 活动期次不存在 | `periodId` 不存在或不属于当前租户 |
| 当前不在报名时间内 | 尚未开始报名或已超过报名截止时间 |
| 您已报名本期活动 | 同一用户重复报名 |
| 未满足活动报名校验条件 | 未满足活动管理员或社群成员校验 |
| 活动时间不合法 | 模板时间配置不符合规则 |
| 活动模式不支持 | 当前接口与期次模式不匹配，例如对抽奖模式调用统一开奖接口 |
| 抽奖次数不足 | 当前用户没有剩余抽奖次数 |
| 未有效报名 | 当前用户未报名或报名记录已失效 |

即时抽奖的“未中奖”不是异常，不使用错误码；客户端应根据响应中的 `drawResult` 展示结果。
