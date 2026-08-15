# 企业微信客户联系回调审查报告

## 结论

通过。修正后无剩余阻断或高风险问题。

Admin 复审通过：请求字段、创建/编辑留空语义、成对格式校验、敏感值不回显以及 `callbackConfigured` 状态展示均与后端契约一致。

## 已关闭问题

1. 缺少 query 参数、非法 `accountId`、空 Body 原先可能被全局异常处理成 HTTP 200。现由回调 Controller 映射为 HTTP 400，并以 MockMvc 覆盖真实 MVC 行为。
2. WxJava 4.6.0 不校验 AES 明文帧尾部 `receiveid/CorpID`。现补充帧结构解析和常量时间 CorpID 比较，GET/POST 共用该路径，并覆盖跨 CorpID 复用凭据的拒绝测试。

## 非阻断验证缺口

- 数据库迁移和凭据加密 TypeHandler round-trip 尚未在真实 MySQL 验证。
- 未使用真实企业微信、公网 HTTPS 地址进行回调联调。
- 未启动完整环境重新生成 OpenAPI 快照。
- 解密 XML 按当前联调需求写 INFO 日志，可能含企业微信用户、客户和群标识；生产启用前需确认日志权限、留存期限及后续脱敏策略。

## 复审验证

- 目标测试：18 tests，0 failures，0 errors。
- `git diff --check`：通过。
- Admin 目标文件 ESLint、Prettier 与生产构建：通过。
