# Change Report

## Planning Result

本阶段已完成企业微信客户添加外部联系人后自动发送欢迎语的 backend 实现。

## Scope

- 回调识别 `change_external_contact/add_external_contact`。
- 使用 `State` 匹配当前租户商圈。
- 读取启用的系统欢迎语模板。
- 使用 `WelcomeCode` 调用企业微信 `send_welcome_msg`，发送文字后图片。
- 通过 Redis Stream 异步处理，使用发送记录和 WelcomeCode 摘要幂等；遵守 WelcomeCode 20 秒有效期及外部发送最多一次约束。
- 对确定性失败记录 FAILED，对外部请求结果不明确记录 UNKNOWN 并告警，不自动重发。

## Not Included

- 不创建或同步企业微信远端欢迎语模板。
- 不新增管理端页面或发送按钮。
- 不处理客户群入群欢迎语。
- 不承诺企业微信接口成功等于客户已读。
- 不对外部发送接口做自动重试；请求超时等结果不明确时记录 UNKNOWN 并告警。

## Affected Repositories

- `backend`：已修改回调、Redis Stream 消费、欢迎语发送 API 客户端、发送记录和迁移脚本。
- `admin`：N/A，复用现有模板启停管理。
- `governance`：新增本功能需求、契约、技术设计、测试和评审文档。

## Migration

已新增：`backend/sql/upgrade-2026-08-13-wecom-welcome-message-send.sql`。本次未执行数据库迁移。

## Verification

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am test`：通过，36 tests。
- `mvn -pl yshop-server -am package -DskipTests -Dmaven.gitcommitid.skip=true`：完整 reactor 构建成功。
- `git diff --check`：通过；迁移脚本已静态核验。
- 尚未执行数据库迁移、部署和真实企业微信 E2E。

## Suggested Implementation Commit

`feat(mp): send wecom welcome message after external contact event`
