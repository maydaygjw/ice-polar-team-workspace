# 企业微信客户联系回调测试记录

## 自动化验证

命令：

```bash
(cd .worktrees/backend-wecom-callback-events && \
  mvn -q -pl yshop-module-mp/yshop-module-mp-biz -am \
  -Dtest=WecomCallbackServiceTest,AppWecomCallbackControllerTest,WecomConvertTest \
  -Dsurefire.failIfNoSpecifiedTests=false test)
```

结果：通过，18 个测试，0 failure，0 error。

覆盖：

- GET URL 验签与 echostr 解密。
- AES 解密帧尾 CorpID 校验，以及跨账户复用 Token/AESKey 时拒绝 GET。
- POST 签名校验、XML 解密、CorpID 校验和未知事件兼容。
- 错误签名、账户不存在、回调凭据缺失。
- DOCTYPE/XXE XML 拒绝。
- MockMvc 验证 GET/POST 裸文本响应与 UTF-8 Content-Type。
- MockMvc 验证缺参、非法 accountId 和空 Body 均返回 HTTP 400。
- 企业微信账户回调字段转换及 `callbackConfigured` 响应。

## 静态检查

- `git diff --check`：通过。
- 目标 Maven reactor 编译：随上述测试命令通过。
- `mvn -q -pl yshop-module-mp/yshop-module-mp-biz -am test`：通过。
- admin 目标文件 Prettier 检查：通过。
- admin `pnpm build:prod`：通过；仅有项目既存 Sass deprecation warning。
- admin `pnpm ts:check`：未通过，仓库基线存在大量既有全局类型错误；过滤目标文件后无本次文件错误。

## 未执行

- 未连接真实企业微信做回调联调；需要公网 HTTPS 地址、测试企业微信账户及对应 Token/EncodingAESKey。
- 未执行数据库迁移；脚本使用 `information_schema` 检查，可重复执行，需在测试数据库验证。
- 未执行凭据加密 TypeHandler 的数据库 round-trip；已沿用现有 `EncryptTypeHandler`。
- 未重新生成 `governance/CONTRACT/backend-api.json`；生成流程需要启动完整后端及其 MySQL、Redis 环境。本功能 API 语义已记录在 `contract-changes.md`。

## 联调步骤

1. 执行升级脚本，并通过既有企业微信账户管理 API 同时保存回调 Token 与 EncodingAESKey。
2. 企业微信后台配置 URL：`https://{host}/app-api/mp/wecom/callback/{accountId}`，Token 和 EncodingAESKey 与账户配置一致。
3. 保存配置，确认 GET URL 验证通过。
4. 勾选“外部联系人变更回调”，手工添加、编辑、删除客户或变更客户群。
5. 确认后端日志出现验签解密后的事件 XML，且接口返回 200；确认没有数据库写入、MQ 或外部 API 调用。
