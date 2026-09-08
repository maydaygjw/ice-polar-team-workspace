# 企业微信素材组外部素材技术设计

## 模块影响

- `backend`：企业微信素材领域、外部素材提供方适配器、素材组解析与发送编排、数据库迁移、管理端 API 和单元测试。
- `admin`：外部素材表单、Provider 配置的 `externalMaxCount` 展示、素材组预算提示、动态素材预览和发送前校验。
- `miniapp` / `icepolar-dms`：N/A；本功能由管理端和后端完成，不改变小程序到 DMS 的边界。
- 企业微信：复用现有群发、欢迎语和临时图片上传链路；不向前端暴露凭据。

## 关键决策

1. **Provider 配置集中管理**：租户级系统配置表维护每个租户可用 Provider 的 `externalType`、`externalMaxCount`、参数定义和启用状态；管理员不能覆盖这些协议属性。
2. **外部引用与展开结果分离**：素材组只保存 Provider 标识和按参数定义校验后的业务参数；动态结果在预览或发送时解析，不落库为普通素材。
3. **统一返回有序列表**：提供方返回 `ExternalMaterialResult[]`，列表长度为 1 到 Provider 配置的 `externalMaxCount`，所有元素类型必须一致，系统按原顺序展开，不重排、不静默截断。
4. **保存时预留数量预算**：非文字素材组的预算按 `普通非文字素材数量 + Σ(外部引用 externalMaxCount) ≤ 9` 校验。运行时再校验 `0 < actualCount ≤ externalMaxCount`，实际少返回的数量不释放已配置预算。
4. **发送前原子解析**：先完整解析并校验整个素材组，再转换为企业微信消息；任一外部引用失败时不发送部分内容、不生成不完整任务。
5. **提供方服务端注册**：管理端只能选择后端注册的提供方并填写白名单参数，不能提交任意 URL、脚本或凭据。

## 处理流程

```text
管理端保存外部引用
  → 读取并校验 Provider 的类型、externalMaxCount 和素材组预算
  → 保存 EXTERNAL 素材引用

预览/发送
  → 读取最新素材组并校验租户、企业微信配置和预算
  → 按素材组顺序调用提供方
  → 校验同类型、数量范围和每项字段
  → 按提供方返回顺序展开为标准消息
  → 小程序封面按现有流程上传企业微信临时素材
  → 预览或创建发送任务快照
```

## 数据与事务

- 新增租户级 Provider 配置表 `mp_wecom_external_material_provider`，保存 `tenant_id`、`provider`、`external_type`、`external_max_count`、`params_definition`、`enabled` 及审计字段；同一 Provider 可按适用租户分别配置。
- `mp_wecom_material` 的外部引用只保存 `external_provider`、`external_params`；解析时读取当前启用的 Provider 配置，不允许客户端提交类型或数量上限。
- `external_max_count` 为正整数；`external_params` 只保存业务参数，不保存 Secret、access token 或其他运行时凭据。
- 服务层负责类型字段互斥、提供方参数校验、租户/企业微信配置归属和素材组预算校验；数据库负责必要的非空、范围和索引约束。
- 素材组保存、复制和外部引用更新必须在组预算校验通过后提交；解析结果不写入素材表。
- 发送任务继续使用创建时的完整内容快照，后续提供方结果变化不影响已创建任务。

## 风险与回滚

- 外部提供方超时、返回混合类型、空列表、超出 `externalMaxCount` 或字段无效时，整个预览/发送失败。
- 动态结果数量可能使企业微信最终附件达到上限，因此保存时按 `externalMaxCount` 预留预算，不能只按最近一次实际结果判断。
- 数据库迁移失败时回滚新增列和索引；不删除已有普通素材、文件服务图片或企业微信外部素材。
- 没有 `EXTERNAL` 类型的旧组继续沿用原解析路径。

### 外部素材解析器抽象

- `WecomExternalMaterialResolver` 只定义统一的 `resolve(material)` 接口，返回保持提供方顺序的 `WecomExternalMaterialResult` 列表。
- 已知内置 Provider 标识统一维护在 `WecomExternalMaterialProviderEnum`；数据库中的 `provider` 值必须与枚举 code 一致。
- `FHLFixedPriceProductMaterialResolver` 是当前一口价商品 Provider 实现，负责该 Provider 的参数读取、商品查询、结果组装和通用校验。
- 后续 Provider 适配应通过新的实现类接入，不让素材组编排服务依赖具体外部数据源；解析器返回的结果必须继续满足 Provider 的类型和数量配置。
