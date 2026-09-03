# 企业微信素材组复制契约变更

## Admin API

新增接口：

```text
POST /admin-api/mp/wecom-material-group/copy
```

请求：

```json
{
  "id": 10
}
```

- `id` 为源素材组编号，必填。
- 服务端从源组读取企业微信配置，不接受客户端指定目标配置或目标名称。
- 返回新素材组编号：`Long`。
- 使用 `mp:wecom-material-group:create` 权限；仍须校验当前租户、源组和企业微信配置归属。
- 接口不调用企业微信外部 API，不复制文件，不返回 Secret、access token 或外部凭据。

## Naming

- 首选名称：`{sourceName}-副本`。
- 若已存在，依次尝试 `{sourceName}-副本(2)`、`{sourceName}-副本(3)`，直到唯一。
- 每次候选名称均须满足现有 100 字符限制；超长时截断源名称后再拼接后缀，最终名称不得超过 100 个字符。
- 并发复制发生名称竞争时，数据库唯一约束/重试策略必须保证不覆盖已有组；若无法安全重试，返回明确错误且事务回滚。

## Database

不新增表或字段。复制在同一事务中插入：

- `mp_wecom_material_group`：新 `id`、源 `account_id`、生成后的 `name`。
- `mp_wecom_material`：新 `id`、新 `group_id`，复制素材业务字段及按源顺序重新写入的 `sort`。

不复制 `creator`、`create_time`、`updater`、`update_time`、`deleted`、`tenant_id` 等审计/租户字段，由框架和实体插入逻辑生成。

## Errors

- 源素材组不存在、已删除或不属于当前租户：沿用 `WECOM_MATERIAL_GROUP_NOT_EXISTS`。
- 企业微信配置不存在或凭据无效：沿用 `WECOM_ACCOUNT_NOT_EXISTS`。
- 无法生成唯一名称或并发唯一性冲突：沿用素材组名称冲突错误或新增明确错误，禁止静默覆盖。
