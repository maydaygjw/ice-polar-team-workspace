# 契约变更

## API

管理端前缀：`/admin-api`；通用响应沿用 `{code,data,msg}`。

### 同步生成图片

`POST /product/store-product/ai-image/generate`

Request:

```json
{
  "productId": 1024,
  "storeName": "冰美式",
  "storeInfo": "清爽低糖",
  "description": "<p>精选咖啡豆，冰爽现制</p>"
}
```

Response `data`:

```json
{
  "taskId": "uuid",
  "productId": 1024,
  "status": "SUCCEEDED",
  "imageUrl": "https://provider.example/image.png",
  "message": null
}
```
生成接口按同步协议等待百炼返回；`imageUrl` 属于短期预览地址。

### 采用生成图片

`POST /product/store-product/ai-image/use`

Request:

```json
{
  "taskId": "uuid",
  "productId": 1024
}
```

Response `data`：`{"imageUrl":"https://oss.example/product.png"}`。

采用接口幂等：同一任务重复采用返回已保存的 OSS 地址；如果商品编号不匹配、任务不属于当前租户/操作人或候选图已失效，则拒绝。

## 错误语义

- 参数校验：名称为空、商品编号为空、任务编号为空，沿用统一参数错误。
- 未授权：沿用 Spring Security 权限错误。
- 商品不存在/任务不存在/任务归属不符：业务错误，不泄露其他租户数据。
- 百炼未配置或供应商失败：业务错误，消息面向管理员，不返回 API Key 或完整供应商响应。
- 候选图下载、文件存储或商品更新失败：业务错误；商品封面保持原值。

## DB / MQ

- DB：N/A。本期不新增表或字段，使用既有商品 `image` 字段。
- MQ：N/A。本期采用同步调用，不新增消息 topic。

## 权限与数据范围

- 两个接口均要求 `shop:store-product:update`。
- `productId` 通过现有商品查询校验租户隔离；任务 Redis key 包含 tenantId，响应前再次校验商品编号和租户。
- 仅更新指定商品的 `image`，不绕过现有商品数据权限。

## 依赖与配置

- backend product biz 增加 `yshop-module-infra-api` 和 Redis starter 依赖；不新增第三方 SDK，使用现有 Spring HTTP client/Jackson/Hutool。
- 服务端配置：

```yaml
yshop:
  ai-image:
    enabled: ${AI_IMAGE_ENABLED:false}
    api-key: ${DASHSCOPE_API_KEY:}
    endpoint: ${DASHSCOPE_API_ENDPOINT:https://dashscope.aliyuncs.com}
    model: ${DASHSCOPE_IMAGE_MODEL:wan2.6-t2i}
    api-path: ${DASHSCOPE_IMAGE_API_PATH:/api/v1/services/aigc/multimodal-generation/generation}
    size: ${DASHSCOPE_IMAGE_SIZE:1280*1280}
```

密钥只允许通过部署环境注入；不得写入 `application-*.yaml` 的真实值。

## 外部系统：阿里云百炼

- 北京地域同步接口：`POST {endpoint}/api/v1/services/aigc/multimodal-generation/generation`。
- 认证：`Authorization: Bearer <DASHSCOPE_API_KEY>`；不发送异步请求头。
- 请求：使用模型名、`input.messages[].content[].text`、`size` 和 `n=1`；响应读取 `output.choices[0].message.content[0].image`。
- 失败策略：供应商调用异常、非成功 HTTP 响应或无图片 URL均映射为业务失败；不自动重试，避免重复计费。
- 结果 URL：只作一次性服务端下载的临时地址，采用时下载并转存 master file client；不持久化为商品封面。
- 官方依据：[百炼万相文生图 API 参考](https://help.aliyun.com/zh/model-studio/text-to-image-api-reference)、[图像 API 常见问题](https://help.aliyun.com/zh/model-studio/image-faq)。
