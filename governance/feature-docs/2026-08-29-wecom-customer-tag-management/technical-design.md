# 企业微信客户标签库管理技术设计

## 模块影响

- `backend`：在现有 `WecomApiClient` 增加企业微信客户标签库 API 封装；新增管理端 Controller、Service、VO 和菜单权限迁移。不新增数据库表。
- `admin`：新增企业微信客户标签页面、API client 和标签组/标签表单。
- `miniapp`、`icepolar-dms`：N/A，本功能不经过小程序或设备系统。

## 关键决策

1. **实时源**：列表直接调用企业微信 `get_corp_tag_list`，不做本地缓存或快照，降低外部修改后的数据不一致风险；代价是页面依赖企业微信可用性。
2. **写操作映射**：新增统一映射到 `add_corp_tag`，新组携带 `group_name` 和首批标签，已有组携带 `group_id` 和标签；编辑映射到 `edit_corp_tag`；删除按对象类型映射到 `del_corp_tag`。
3. **凭证边界**：Service 只从当前租户的企业微信配置读取 CorpID/Secret，API client 内部获取 token；DTO、异常摘要和日志均不包含凭证。
4. **对象身份**：企业微信 `group_id`、`tag_id` 使用字符串；不转换为本地 Long，也不建立本地关系表。

## 必要流程

`accountId → 租户范围内配置 → CorpID/Secret → access_token → 企业微信标签接口 → 脱敏后的管理端 DTO`

任何企业微信非零 `errcode`、超时或响应缺字段均转为业务失败；写操作失败不触发页面成功提示。列表只返回企业微信当前有效对象。

## 风险与权衡

- 企业微信接口配额、权限和网络可用性直接影响页面；页面必须提供重试入口。
- 删除是外部不可逆操作，前端二次确认，后端按独立删除权限保护。
- 企业微信后台发生并发修改时，以调用时的企业微信校验结果为准，不能保证本地页面操作前后的乐观锁语义。

## 契约引用

详见同目录 `contract-changes.md` 和官方接口：[管理企业标签](https://developer.work.weixin.qq.com/document/path/92117)。
