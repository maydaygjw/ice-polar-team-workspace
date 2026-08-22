# 企业微信跨租户共享欢迎语回调技术设计

## 模块影响

- `backend/yshop-module-mp`：账号字段、回调路径、State 生成与解析、跨租户账号路由、欢迎语消息租户上下文。
- `backend/sql`：新增账号应用元数据字段，存量应用名称回填。
- `admin`：账号类型、表单、列表和精简账号数据增加应用名称与 AgentId。
- `yshop-server`：现有回调公开路径通配配置改为兼容 CorpID 路由，无新增依赖。

## 关键决策

### 1. CorpID 用于回调入口，租户由 State 决定

一个共享应用只有一套回调凭据。GET 阶段尚未解密消息，不能从 State 找租户，因此先用 URL 中的 CorpID 跨租户找到回调配置。POST 解密后解析：

```text
v1:t{tenantId}:r{businessRegionId}
```

再在目标租户上下文中查询账号和欢迎语模板。

### 2. 保留租户内账号记录，避免引入完整共享账号关系模型

本期不把 `mp_wecom_account` 改成全局表，也不新增账号授权关系。允许不同租户各保存同一个 CorpID 的配置记录；回调阶段要求这些记录代表同一个共享应用，凭据一致。目标租户的模板和发送记录继续使用自己的 `accountId`，保持现有租户隔离。

该方案的边界是：同一个 CorpID 只能配置一个欢迎语发送应用。若未来同一个 CorpID 需要多个应用并行接收回调，URL 必须升级为应用级路由键，不能继续只用 CorpID。

### 3. 账号元数据显式化

- `name`：保留为系统“配置名称”。
- `app_name`：企业微信应用名称。
- `agent_id`：企业微信应用 AgentId，可为空以兼容历史数据。

Secret、Token、EncodingAESKey 的加密存储方式不变。

### 4. 消息在目标租户下入队

回调解析 State 后，先在目标租户中找到同 CorpID 的账号记录，消息使用目标账号 `accountId`，并在目标租户上下文中发送 Redis Stream。这样现有消费者无需跨租户读取模板或发送记录。

## Data Changes

`mp_wecom_account` 新增：

```sql
app_name varchar(100) NULL
agent_id int NULL
```

迁移脚本将历史 `name` 回填至 `app_name`；不改变现有 `(tenant_id, corp_id, deleted)` 唯一约束，继续限制一个租户下同 CorpID 只有一条配置。

## Callback Flow

```text
GET/POST /mp/wecom/callback/{corpId}
  → 跨租户查询 CorpID 配置
  → Token 验签、AES 解密、CorpID 校验
  → 解析 State 得到 tenantId + regionId
  → 目标租户查询同 CorpID 账号
  → 目标租户上下文发送欢迎语事件
  → 消费者按 accountId + regionId 查询模板
  → WelcomeCode 幂等发送
```

## Migration and Rollback

- 新增 `backend/sql/upgrade-2026-08-21-wecom-shared-callback-routing.sql`。
- 迁移前备份 `mp_wecom_account`；脚本只新增字段并回填应用名称，不修改 Secret、Token、AESKey。
- 回滚为删除 `app_name`、`agent_id` 两列；回滚前确认管理端和服务端已回退代码。
- 已存在的旧 State 联系我二维码不能自动获得租户路由，需通过更新联系我配置重新生成 State。

## Risks

- 同 CorpID 多条账号记录的凭据不一致时，CorpID 无法唯一决定解密凭据；实现需检测并拒绝不一致配置。
- 回调 URL 从 accountId 改为 CorpID 后，同 CorpID 多应用并行回调不受支持；这是本期“单一欢迎语发送应用”约束。
- `WelcomeCode` 仍然短时有效，回调只入队，消费者必须快速处理。
