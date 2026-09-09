# 技术设计

- 通道 CRUD 独立于客户群服务；通道表只保存 Webhook 配置，不保存密钥以外的外部凭据。
- 定时任务保存通道快照引用 `push_channel_id`，执行时重新读取通道，删除或租户不匹配则失败。
- `DOLPHIN_PRIVATE` 根据素材组顺序逐条发送 Webhook；TEXT 直接发送，MINI_PROGRAM 将素材图片 URL、系统小程序账号信息映射到海豚字段。
- `OFFICIAL` 复用现有企业微信群发逻辑。
