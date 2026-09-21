# 活动模板报名人数限制

## 规则

- 管理后台活动模板新增 `registrationLimit`，按活动期次限制报名人数。
- `registrationLimit = 0` 表示不限；大于 `0` 时表示本期最多允许的有效报名人数。
- 生成活动期次时复制模板配置，已生成的期次使用自己的限制值；活动模板在已有期次后仍按现有规则不可修改。
- 后端在报名落库前使用带上限条件的原子计数更新，达到上限后返回“当前活动报名人数已满”，并回滚本次报名。
- 删除报名记录会同步释放一个报名名额。

## 接口字段

- `POST /admin-api/activity/template/create` 和 `PUT /admin-api/activity/template/update` 请求体增加 `registrationLimit`，非负整数，默认 `0`。
- `GET /admin-api/activity/template/get` 和 `/page` 返回 `registrationLimit`。
- 用户端活动期次详情返回 `registrationLimit` 和当前 `registrationCount`，用于展示报名进度。
- 用户端报名接口在名额已满时返回业务错误码 `1009000031`。

## 权限与兼容性

- 复用现有活动模板创建、编辑和查询权限，不新增权限点。
- 数据库升级对已有模板和期次默认填 `0`，保持原有不限人数行为。
