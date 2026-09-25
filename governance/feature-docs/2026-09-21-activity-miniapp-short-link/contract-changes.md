# 活动页面小程序短链接

## 接口

- `GET /app-api/activity/share/short-link`，需要登录
- 请求参数：
  - `templateId`：活动模板 ID。
- 返回：微信小程序短链接文本，例如 `#小程序://氧气学长/efrFZnrUkrq6Ydp`。

## 生成规则

- 页面路径固定为 `hlmall/pages/index/index`。
- 服务端从 access token 获取当前会员，并读取其 `external_user_id` 作为 `referrer_user_Id`；客户端不得传入或覆盖推荐人。
- 查询参数固定包含 `open_activity=1`、`templateId`、`referrer_user_Id` 和活动模板所属启用商圈的 `region_code`。
- `region_code` 从服务端活动模板和商圈配置解析，客户端不能传入或覆盖。
- 使用当前租户的小程序主账号调用微信 Short Link 接口，不保存短链接记录。
