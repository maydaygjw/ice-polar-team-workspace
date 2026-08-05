# 私域热门商品推送技术设计

## 调用链

```text
Quartz privatePromoteJob
  -> @TenantJob 设置当前租户
  -> TenantConfigApi 读取私域商圈配置和中继地址
  -> 外部商城接口查询商品
  -> MpAccountService 获取主小程序 WxMaService
  -> WxMaLinkService 调用微信 URL Link API
  -> 海豚私域 Webhook
```

## 模块边界

- `infra-api` 暴露按当前租户读取参数值的轻量 API。
- `infra-biz` 实现参数读取并在当前租户上下文中查询 `infra_tenant_config`。
- `mp-biz` 实现外部商品查询、微信链接生成、Webhook 推送和 Quartz Handler。
- 不直接依赖其他模块的 `-biz` 实现；小程序账号能力复用 mp 模块内部现有服务。

## 失败处理

- 单个商圈查询或推送失败只记录该商圈错误，继续处理当前租户的其他商圈。
- 外部响应不是成功状态、商品数组为空、链接生成失败或中继地址为空时跳过推送。
- 不记录完整的 Webhook 地址和微信凭据；日志只记录租户、商圈和错误原因。
- 任务不保存发送记录，本期不做历史幂等；同一日手动重复触发会再次推送。
