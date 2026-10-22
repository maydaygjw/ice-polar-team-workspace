# 契约变更：企业微信群临时二维码

## 管理端 API

- `POST /admin-api/mp/wecom-customer-group/qrcode?id={groupId}`
- 权限：复用 `mp:wecom-customer-group:query`，不新增权限码。
- 成功响应：`{ qrCodeDataUrl, expiresAt }`。企业微信配置 ID 仅供后端 Redis 延迟清理使用，不返回前端。前端用 `qrCodeDataUrl` 预览和下载，并显示 `expiresAt`。
- 请求校验群记录存在且属于当前租户；使用群记录关联的企业微信账号配置。

## 延迟队列 API

- `DelayedQueueListener<T>` 是 message-api 中的通用消费契约，message-biz 负责注册监听器，mp-biz 提供客户群配置清理消费者。
- 延迟消息类型位于 mp-api，包含 `tenantId`、`accountId`、`groupId`、`configId` 和 `retryCount`；队列键为 `mp:wecom:customer-group:qrcode-cleanup`。
- mp-biz 依赖 message-api，不依赖 message-biz；message-biz 已依赖 mp-api，不形成循环依赖。

## Redis 延迟消息

- 消息：`tenantId`、`accountId`、`groupId`、`configId`、`createdAt`、`retryCount`。
- 延迟：创建成功后 1 小时。
- 到期动作：按租户加载企业微信配置，调用企业微信 `groupchat/del_join_way`；成功或配置已不存在均结束任务。
- 失败：指数退避重新投递，重试间隔上限为 60 分钟；不丢弃清理消息。重试写入 Redis 失败时记录 ERROR 日志。
- 此消息属于跨模块异步契约，需在实现中定义稳定的队列键和消息类型版本。

## 数据库与权限

- 数据库 schema：N/A，无持久化二维码配置字段。
- 权限：复用现有 `mp:wecom-customer-group:query`，不新增权限码。
- 租户隔离：创建接口校验当前租户下群记录；延迟消息显式携带租户 ID，消费者执行期间恢复对应租户上下文。

## 外部系统

- 企业微信客户联系 Secret 调用 `externalcontact/groupchat/add_join_way` 创建单群进群二维码。
- 创建成功后用 `externalcontact/groupchat/get_join_way` 读取 `qr_code`，服务端下载图片后返回 data URL。
- 延迟清理调用 `externalcontact/groupchat/del_join_way` 删除配置。
- 两个接口失败均需保留错误上下文；日志不得包含认证凭据。
