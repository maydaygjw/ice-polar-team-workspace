# 霸王餐活动接口

> 活动接口统一归入 Swagger 的“营销”文档分组。接口前缀为 `/admin-api`（管理端）和 `/app-api`（用户端），业务响应统一为 `CommonResult`：`{ code, msg, data }`，`code = 0` 表示成功。
>
> 管理端请求头：`Authorization: Bearer <admin-token>`、`tenant-id: <tenant-id>`。用户端需要登录的接口请求头：`Authorization: Bearer <member-token>`、`tenant-id: <tenant-id>`。
>
> 后端源码：`backend/yshop-module-activity/yshop-module-activity-biz/src/main/java/co/yixiang/yshop/module/activity/`

## Swagger 分组

活动模块的管理端和用户端接口均匹配 Swagger 分组“营销”，包括 `/activity/template/**`、`/activity/period/**`、`/activity/registration/**` 和 `/activity/winner/**`。

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
| POST | `/admin-api/activity/period/draw` | `activity:period:draw` | 手动开奖 |
| POST | `/admin-api/activity/period/qrcode` | `activity:period:qrcode` | 生成期次小程序码 |
| GET | `/admin-api/activity/registration/page` | `activity:registration:query` | 分页查询报名记录 |
| POST | `/admin-api/activity/registration/increase-chances` | `activity:registration:query` | 增加报名用户抽奖次数 |
| GET | `/admin-api/activity/registration/export` | `activity:registration:export` | 导出报名记录 |
| GET | `/admin-api/activity/winner/page` | `activity:winner:query` | 分页查询中奖记录 |
| GET | `/admin-api/activity/winner/export` | `activity:winner:export` | 导出中奖记录 |

### 用户端

| 方法 | 路径 | 登录 | 说明 |
|------|------|:---:|------|
| GET | `/app-api/activity/period/detail?periodId={id}` | 否 | 查询活动期次详情 |
| GET | `/app-api/activity/period/latest?templateId={id}` | 否 | 查询指定活动最近期次详情 |
| POST | `/app-api/activity/period/register?periodId={id}` | 是 | 当前登录用户报名活动 |
| GET | `/app-api/activity/period/my-result?periodId={id}` | 是 | 查询当前用户报名和中奖结果 |
| POST | `/app-api/activity/period/increase-chances?periodId={id}&chances={n}` | 是 | 增加当前用户抽奖次数 |
| POST | `/app-api/activity/registration/create?periodId={id}&userId={externalUserId}` | 兼容接口 | 按外部用户标识报名，旧调用方使用 |

## 1. 活动模板

### 创建 `POST /admin-api/activity/template/create`

请求体：`ActivityTemplateCreateReqVO`。

| 字段 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| title | string | 是 | 活动标题 |
| businessRegionId | long | 是 | 活动商圈 ID |
| content | string | 是 | 活动富文本正文 |
| coverImage | string | 是 | 活动主图 URL |
| backgroundImage | string | 否 | 页面背景图 URL |
| promoteImages | string[] | 否 | 宣传素材图片 URL 列表 |
| cycleType | int | 是 | 当前仅支持 `1`，表示每周 |
| cycleWeekday | int | 是 | 每周星期，`1-7` 表示周一至周日 |
| registrationStartTime | time | 是 | 每日开始报名时间，如 `00:00:00` |
| registrationEndTime | time | 是 | 每日结束报名时间，如 `22:00:00` |
| drawTime | time | 是 | 每日开奖时间，如 `22:00:00` |
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
| claimInstruction | string | 否 | 领奖说明 |

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
  "checkWecomAdmin": true,
  "checkGroupMember": true,
  "singleWinner": false,
  "enabled": true,
  "prizes": [
    {
      "prizeName": "奶茶兑换券",
      "image": "https://cdn.example.com/prize.png",
      "quantity": 10,
      "claimInstruction": "凭中奖记录到店核销"
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

成功时 `data` 为新建模板 ID。

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

返回期次时间、报名人数、中奖人数、内容快照、企微/社群配置快照、`singleWinner` 规则和奖品列表。

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
{"periodId": 123}
```

仅允许在计划开奖时间后执行。成功时 `data` 为 `true`，重复触发不会重复开奖。

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

二维码绑定具体活动期次，不接受客户端传入 `path`、`scene`、`appId` 或租户信息。

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

需要权限 `activity:registration:query`，仅允许在开奖前为有效报名增加次数。

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

### 导出 `GET /admin-api/activity/winner/export`

Query 参数同中奖记录分页查询。接口返回 Excel 文件；服务端会导出符合条件的全部记录。

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
    "status": 2,
    "registrationCount": 100,
    "plannedWinnerCount": 10,
    "actualWinnerCount": 0,
    "singleWinner": false,
    "content": "<h2>周五霸王餐</h2><p>本周五到店参与霸王餐活动</p>",
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
        "claimInstruction": "凭中奖记录到店核销"
      }
    ]
  }
}
```

`periodDate` 使用 `[year, month, day]` 数组；`registrationStartTime`、`registrationEndTime` 和 `drawTime` 使用 Unix 毫秒时间戳。客户端展示时应按业务时区格式化，不要直接展示原始数值。

`content` 为富文本 HTML 字符串，客户端应按富文本容器渲染，并限制图片宽度以适配移动端。

`status`：`1` 未开始，`2` 进行中，`3` 已结束。

`singleWinner` 为 `true` 时同一用户在本期最多中奖一次；为 `false` 时，用户可按抽奖次数获得多条中奖记录。

### 查询指定活动最近期次 `GET /app-api/activity/period/latest`

无需登录，需要传入活动模板 ID。服务端优先返回该活动模板下当前时间最近的未结束期次（按计划开奖时间升序）；如果没有未结束期次，则返回该活动模板下最近一个已结束期次。不存在该活动模板或其期次时返回对应的资源不存在错误。

```http
GET /app-api/activity/period/latest?templateId=123
```

返回结构与 `/app-api/activity/period/detail` 相同。

### 报名活动 `POST /app-api/activity/period/register`

需要登录，请求体为空，使用 Query 参数：

| 参数 | 类型 | 必填 | 说明 |
|------|------|:---:|------|
| periodId | long | 是 | 活动期次 ID |

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

已报名但尚未中奖或尚未开奖时，`registered` 为 `true`、`winner` 为 `false`。中奖后会返回 `winnerId`、`prizeId`、`prizeName`、`prizeImage`、`claimInstruction`、`winnerTime` 和 `winnerStatus`。

### 增加我的抽奖次数 `POST /app-api/activity/period/increase-chances`

需要登录，使用当前登录用户在指定期次的报名记录，仅允许开奖前调用。

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
