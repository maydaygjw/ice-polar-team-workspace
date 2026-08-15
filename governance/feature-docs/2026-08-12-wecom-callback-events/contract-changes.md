# 企业微信客户联系回调契约增量

## API

### GET `/app-api/mp/wecom/callback/{accountId}`

用途：企业微信验证 URL。

Query：`msg_signature`、`timestamp`、`nonce`、`echostr`，均必填。

成功：HTTP 200，`text/plain;charset=UTF-8`，响应体为解密后的 `echostr`，无通用响应包装。

失败：账户不存在、凭据缺失、签名或解密失败时返回非 2xx，不暴露具体凭据或内部配置。

### POST `/app-api/mp/wecom/callback/{accountId}`

用途：接收企业微信客户联系事件。

Query：`msg_signature`、`timestamp`、`nonce`，均必填。Body 为企业微信加密 XML。

成功：HTTP 200，`text/plain;charset=UTF-8`，响应体固定为 `success`。不写业务数据、不调用外部 API、不发 MQ。

失败：账户不存在、凭据缺失、签名或解密失败、CorpID 不匹配时返回非 2xx。

兼容性：全新公开接口，不改变既有 API。

## 管理 API

既有企业微信账户创建/更新请求增加可选字段：

- `callbackToken`：英文或数字，最长 32 位。
- `callbackEncodingAesKey`：英文或数字，固定 43 位。
- 两项必须同时为空或同时填写；更新时同时为空表示保留原值。

账户响应不返回明文或掩码片段，仅增加 `callbackConfigured` 布尔值。

## DB

`mp_wecom_account` 新增：

- `callback_token varchar(512) NULL`：回调签名 Token，加密存储。
- `callback_encoding_aes_key varchar(512) NULL`：回调 EncodingAESKey，加密存储。

迁移：`backend/sql/upgrade-2026-08-12-wecom-callback-events.sql`。回滚为删除新增字段。

## 权限与租户

- 回调路径公开访问，不要求登录。
- 回调路径忽略请求租户头；账户按 URL 中 `accountId` 跨租户定位，并以账户真实 `tenant_id` 作为上下文。
- 既有企业微信账户管理权限不变。

## 依赖

- 显式登记 `com.github.binarywang:weixin-java-common:4.6.0`，真实使用点为企业微信回调验签与解密。
- 不引入完整企业微信 starter。

## 外部系统

- 企业微信客户联系回调，协议依据官方文档 92129、92130 及通用回调配置。
- GET 需在 1 秒内返回；POST 需在 5 秒内返回，超时或失败企业微信最多重试三次。
- Token 和 EncodingAESKey 仅服务端保存，日志与响应均不得输出。
