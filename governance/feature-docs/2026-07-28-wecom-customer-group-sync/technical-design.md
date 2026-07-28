# 技术设计

## 模块影响

- `backend/yshop-module-mp`：新增企业微信配置、客户群快照、企业微信 HTTP 调用和管理端接口。
- `backend/sql`：新增企业微信配置表、客户群表和菜单/权限增量脚本；不修改 `yixiang-drink.sql`。
- `admin`：在微信管理下新增企业微信配置和客户群页面、API client、权限按钮。
- 不影响 `miniapp`、`icepolar-dms` 和既有公众号/小程序账号接口。

## 关键决策

1. **独立实体而非复用 `mp_account`**：公众号/小程序字段和缓存行为与企业微信不同，独立表可避免 `is_miapp` 分支继续膨胀。
2. **Secret 加密存储、响应脱敏**：使用现有 `EncryptTypeHandler` 加密数据库字段；列表/详情不返回明文，更新留空表示保留旧值。
3. **同步采用手动同步 + 分页拉取**：先调用 access token，再使用 `externalcontact/groupchat/list` 的 cursor 分页获取群 ID，逐个调用 `externalcontact/groupchat/get` 获取详情，完成一条写入一条；详情失败不清空旧数据，最终返回成功/失败汇总。
4. **同步结果本地幂等**：以租户、企业微信配置和 `chat_id` 为业务唯一键 upsert，避免重复同步产生重复群。
5. **并发控制**：以企业微信配置 ID 使用 Redisson 锁，阻止同一配置的重复同步；锁竞争直接返回业务错误。
6. **本期同步为同步 HTTP 请求**：实现简单、结果即时可见；接口设置外部请求超时并记录失败数量。后续规模增大导致超时时再演进为 MQ/任务模式。

## 必要流程

```text
后台保存配置
  -> 后端校验租户内 CorpID 唯一
  -> Secret 加密保存

后台点击同步
  -> 校验配置属于当前租户
  -> 获取 access_token
  -> groupchat/list(cursor 分页)
  -> groupchat/get(逐群详情)
  -> 按 tenant_id + account_id + chat_id upsert
  -> 返回 total/success/failed
```

## 迁移与回滚

- 使用 `backend/sql/upgrade-2026-07-28-wecom-customer-group-sync.sql`，包含两张带 `tenant_id`、逻辑删除字段和业务索引的表，以及幂等菜单/权限初始化。
- 回滚仅删除本功能菜单、权限关联和两张新表；执行前须确认没有依赖本功能数据。脚本不删除既有公众号/小程序数据。

## 风险

- 企业微信接口权限由企业后台配置决定，本地无法仅凭 CorpID/Secret 保证可调用。
- 客户群数量较多时，逐群详情调用会受接口频率和后台请求超时影响；本期通过 cursor 分页、单次超时和结果汇总控制影响。
- Secret 加密依赖运行环境 `mybatis-plus.encryptor.password`，各环境必须配置同一密钥策略，否则历史配置无法解密。
