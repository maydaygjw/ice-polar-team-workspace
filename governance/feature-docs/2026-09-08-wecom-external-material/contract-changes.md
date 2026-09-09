# 企业微信素材组外部素材契约变更

## Admin API

复用现有素材接口：

- `POST /admin-api/mp/wecom-material/create`
- `PUT /admin-api/mp/wecom-material/update`
- `GET /admin-api/mp/wecom-material/get?id={id}`

外部素材创建/更新请求增加：

```json
{
  "groupId": 10,
  "type": "EXTERNAL",
  "externalProvider": "FIXED_PRICE_PRODUCT",
  "externalParams": "{\"businessRegionCode\":\"region-001\"}"
}
```

饭火轮新店素材请求示例：

```json
{
  "groupId": 10,
  "type": "EXTERNAL",
  "externalProvider": "FHL_NEW_STORE_MINI_PROGRAM",
  "externalParams": "{\"businessRegionCode\":\"SHLJZ001\"}"
}
```

小程序页面固定为 `hlmall/pages/takeout/takeoutindex?storeId={门店ID}`，Provider 自动把接口返回的门店 `id` 拼接到 `storeId`。租户配置 `fhl_new_store_request_url` 使用业务方提供的完整 `GetNewStoreList` 请求地址（包含其签名参数），不要把签名写入代码或提交到仓库。

- `externalProvider`、`externalParams` 在 `EXTERNAL` 类型下必填；`externalType` 和 `externalMaxCount` 不接受客户端输入，由 Provider 配置表决定。
- Provider 配置表维护 `provider`、`externalType`、`externalMaxCount`、`paramsDefinition`、`enabled`；只有启用 Provider 才能被选择。
- 提供方只能返回配置的 `externalType`；非空实际数量必须满足 `actualCount ≤ externalMaxCount`。允许返回空列表，表示跳过该素材项。
- `externalParams` 只能包含该 Provider 参数定义中的业务参数；首期一口价 Provider 只允许一个商圈编码。
- 饭火轮新店 Provider 标识为 `FHL_NEW_STORE_MINI_PROGRAM`，类型为 `MINI_PROGRAM`，最大数量为 3，参数仅为 `businessRegionCode`。小程序页面固定为 `hlmall/pages/takeout/takeoutindex?storeId={门店ID}`；请求地址由租户配置 `fhl_new_store_request_url` 提供，避免在代码中固化签名。
- 响应展示外部引用配置及展开后的预览结果，但不得返回 Secret、access token 或提供方内部凭据。

新增接口：

- `GET /admin-api/mp/wecom-external-material-provider/list`：返回启用的 Provider、输出类型、系统配置的最大数量和参数定义。
- `POST /admin-api/mp/wecom-material/preview`：按已保存素材引用解析并返回有序的标准化预览结果。

## 素材组数量规则

- 现有组上限继续生效：最多一个 `TEXT`，最多九个非文字素材。
- 外部非文字引用的预算为：`普通非文字素材数量 + Σ(Provider.externalMaxCount) ≤ 9`。
- 外部 `TEXT` Provider 的 `externalMaxCount` 必须为 1，且只能位于素材组首位。
- 超出预算时，创建、更新、复制、排序、预览和发送均拒绝；不得只在前端校验。

## 标准提供方结果

```text
ExternalMaterialResult[]
  item.type: TEXT | MINI_PROGRAM
  item.payload: type-specific fields
```

- 列表可为空；非空时必须有序且元素类型一致。
- `TEXT` 每项必须有非空 `content`；`MINI_PROGRAM` 每项必须有 `imageUrl`、`title` 和 `page`。
- 后端逐项转换为既有 `text`/`attachments` 标准消息；提供方对象不得直接透传到企业微信。

## Database

新增 `mp_wecom_external_material_provider`：

- `tenant_id`：配置所属租户，所有查询自动按当前租户隔离。
- `provider`：租户内唯一 Provider 标识。
- `external_type`：该 Provider 的输出类型。
- `external_max_count`：该 Provider 的动态展开数量上限。
- `params_definition`：参数名称、类型、必填性、校验规则和展示元数据。
- `enabled` 及标准审计字段；唯一约束为 `tenant_id + provider + deleted`。

`mp_wecom_material` 增加：

- `external_provider`：提供方标识。
- `external_params`：经过白名单校验的业务参数。

字段仅对 `EXTERNAL` 类型生效；所有查询和写入继续执行 `tenant_id`、素材组和企业微信配置归属校验。迁移脚本使用 `sql/upgrade-2026-09-08-wecom-external-material.sql`，不修改基线 schema 文件。

## 错误语义

- 提供方不存在/禁用、参数不完整、数量配置非法：配置错误。
- 素材组预算超限：素材数量超限。
- 提供方超时、混合类型、非空数量超过 `externalMaxCount` 或结果字段无效：外部素材解析失败；空列表跳过该素材项。
- 任一外部素材解析失败：本次预览或发送整体失败，不发送部分内容。
