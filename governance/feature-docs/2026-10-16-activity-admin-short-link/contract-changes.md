# 管理后台生成活动小程序短链接

## API

- `POST /admin-api/activity/period/short-link`，需要 `activity:period:qrcode` 权限。
- JSON 请求：`{"periodId":123}`。
- 返回：微信小程序短链接文本。
- 服务端根据期次读取活动模板和启用商圈，生成 `hlmall/pages/index/index` 页面链接，参数为 `open_activity=1`、`templateId`、`region_code`。
- 管理后台生成的链接不附加会员推荐人参数；此接口不创建短链接记录。
- 小程序短链接文本由当前租户的小程序主账号生成。
