# 活动正文 AI 自动排版契约

## Admin API

`POST /admin-api/activity/template/ai-format`

权限：`activity:template:update`。请求体：

```json
{
  "title": "活动标题",
  "content": "<p>原始正文</p>"
}
```

成功响应使用现有 `CommonResult<String>`，`data` 为排版后的 HTML。服务端不返回模型密钥或供应商原始响应。

输入正文最大 12000 个字符；空正文返回参数错误。接口不保存内容，不改变活动模板数据。

## 外部系统

服务端通过百炼兼容 OpenAI 的文本接口调用配置的模型，默认模型为 `qwen3.8-flash`。API Key 与现有图片 AI 共用，仅从 `DASHSCOPE_API_KEY` 环境变量注入。
