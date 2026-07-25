# 技术设计

## 模块影响

- `backend/yshop-module-mall/yshop-module-product-biz`：新增管理端 AI 图片生成和采用图片接口；调用百炼并复用 infra 文件 API 更新商品封面。
- `backend/yshop-module-mall/yshop-module-product-api`：新增业务错误码。
- `backend/yshop-module-infra/yshop-module-infra-api`：复用已有 `FileApi`，不新增跨模块实现依赖。
- `admin`：商品编辑封面区增加生成、预览、采用交互和 API client。
- Redis：保存短期任务元数据，用租户、商品和操作人校验任务归属；不新增业务表。

## 关键决策

1. **HTTP 同步生成**：按用户提供的万相新版协议一次请求直接获取图片 URL，不增加前端轮询和任务查询接口。
2. **采用时才上传**：生成接口只返回百炼短期预览 URL；用户点击采用后，后端下载该 URL，通过 `FileApi` 写入 master file client，再更新商品 `image`。
3. **短期 Redis 凭证**：生成接口仍保存任务凭证和 URL，用于校验租户、商品和操作人，并支持采用接口幂等；不保存业务图片。
4. **配置化模型**：百炼 endpoint、model、API Key、图像尺寸和启用开关均服务端配置化。
5. **复用商品更新权限**：生成和采用均要求 `shop:store-product:update`。

## 流程

```text
admin 商品编辑
  └─ POST generate(productId, 当前表单文本)
       └─ backend 校验商品/权限 → 百炼同步生成 → Redis 保存短期凭证 → 返回 imageUrl
  └─ POST use(taskId, productId)
       └─ 校验租户/商品/任务 → 下载候选图 → FileApi(master OSS) → 更新 image
```

## 风险与回滚

- 百炼接口或模型变更：通过 endpoint/model 配置切换；禁用开关可立即关闭入口，既有商品图片不受影响。
- Redis 不可用时不能生成/采用，接口失败而不修改商品。
- OSS 上传后商品更新失败可能产生孤儿文件；本期不删除未知来源文件，需通过文件管理清理，后续可增加补偿任务。
- 无数据库迁移；回滚代码和关闭 `AI_IMAGE_ENABLED` 即可回退。

## 契约引用

- 详细 API、权限、外部系统和错误语义见 `contract-changes.md`。
- UI 状态和交互见 `ui-ux-design.md`。
