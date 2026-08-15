# 企业微信客户联系回调变更报告

## 业务结果

- 支持企业微信客户联系回调 URL 的 GET 验证。
- 支持接收、验签、解密并打印客户联系事件，合法请求返回裸文本 `success`。
- 当前不更新业务数据、不调用外部 API、不发送 MQ。
- 管理后台支持录入回调 Token、EncodingAESKey，并显示事件回调配置状态。

## 影响仓库

- `backend`：公开回调接口、回调凭据、加解密校验、安全日志、配置与测试。
- `admin`：企业微信配置表单、接口类型和回调配置状态。
- `governance`：需求、技术设计、契约、测试与审查记录。

## 契约与迁移

- 新增 GET/POST `/app-api/mp/wecom/callback/{accountId}`。
- 企业微信账户管理请求增加 `callbackToken`、`callbackEncodingAesKey`，响应增加 `callbackConfigured`。
- `mp_wecom_account` 增加两个加密存储的可空字段；升级脚本为 `sql/upgrade-2026-08-12-wecom-callback-events.sql`。

## 验证结果

- Maven 目标模块 reactor 测试通过：18 tests，0 failures/errors。
- 覆盖有效 GET/POST、HTTP 裸文本协议、非法请求 400、签名/配置/CorpID 异常、XXE 和未知事件。
- `git diff --check` 通过。
- admin 生产构建和目标文件格式检查通过；全量类型检查受仓库既有错误影响，目标文件无新增类型错误。

## 残余风险

- 尚需在测试环境执行数据库迁移，并使用真实企业微信完成公网 HTTPS 回调联调。
- 当前按需求记录解密 XML；生产启用前需落实日志权限、留存和脱敏策略。
- OpenAPI 快照尚未在完整依赖环境重新生成。

## 建议 PR

标题：`feat(mp): 接入企业微信客户联系回调`

正文摘要：新增企业微信客户联系回调 GET 验证和 POST 事件接收，回调凭据加密保存；验签、解密及双重 CorpID 校验成功后仅打印事件并返回 `success`，不产生业务副作用。包含数据库升级脚本和 18 个自动化测试。
