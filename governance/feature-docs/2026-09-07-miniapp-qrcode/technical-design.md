# 技术设计

在 mp-biz 内新增 app Controller、请求/响应 VO 和生成 Service；复用同模块 MpAccountService 获取租户主账户，跨模块仅调用已有 infra-api TemporaryFileApi。无需新增 Maven 依赖。
生成图片字节后检测 PNG/JPEG 签名，使用匹配的后缀与 MIME 上传，避免将异常响应作为图片保存。失败使用明确业务错误，不暴露微信凭证和响应详情。
契约见 contract-changes.md。无 DB、MQ、平台边界变化，无迁移；回滚删除新增接口及实现即可。OSS 生命周期是现有运维配置前提，expiresAt 不代表自动删除。
