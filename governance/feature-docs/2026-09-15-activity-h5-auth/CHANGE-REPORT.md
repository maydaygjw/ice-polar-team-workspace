# 变更报告

## 已完成

- backend 新增 `webview-ticket` 和 `webview-exchange` 两个 app-api。
- 新增 Redis 一次性 ticket DAO、请求/响应 VO 和认证错误码。
- 兑换接口加入租户忽略路径，由 ticket 恢复租户上下文后签发 backend Token。
- 未修改数据库和微信登录流程。

## 部署说明

- backend 运行环境必须配置并正常连接 Redis。
- H5 先通过已登录客户端获得 ticket，再调用兑换接口；兑换后使用返回的 `accessToken` 请求业务 API。
- 当前复用 OAuth2 `default` client，无需新增客户端初始化数据。

## 验证

- reactor 编译通过。
- 定向单元测试 5/5 通过。
