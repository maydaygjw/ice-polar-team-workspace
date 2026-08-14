# 验证记录

## Current Status

- 已完成 backend 回调、Redis Stream 消费、发送记录和企业微信发送接口实现。
- 已新增数据库迁移；尚未执行数据库迁移、部署或真实企业微信发送。

## Planned Verification

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am test`
- `mvn -pl yshop-server -am package -DskipTests -Dmaven.gitcommitid.skip=true`
- 使用 mock 企业微信回调和发送接口覆盖验签、State 匹配、模板状态、幂等、消费者异常 ACK 和外部结果未知处理。
- 已执行：`mvn -pl yshop-module-mp/yshop-module-mp-biz -am test`，模块及依赖测试通过（36 tests）。
- 已执行：`mvn -pl yshop-server -am package -DskipTests -Dmaven.gitcommitid.skip=true`，完整 reactor 构建成功，`yshop-server` 可打包。
- 已执行：`git diff --check`，无空白错误；迁移脚本已静态核验，未连接数据库执行。
- 首次完整构建未带跳过参数时，项目 `git-commit-id-maven-plugin` 因临时 worktree 的 dotGitDirectory 无法读取 HEAD 失败；使用插件文档支持的 `-Dmaven.gitcommitid.skip=true` 后构建成功。
- test 环境只在用户明确授权后执行数据库迁移和真实企业微信 E2E。

## Known Constraints

- 现有 `WecomCallbackService` 只做验签、解密和日志记录；需要先扩展为结构化事件解析和异步投递。
- 企业微信外部发送与本地数据库没有共同事务；必须通过发送记录、唯一索引和 UNKNOWN 告警控制一致性风险。
- 真实 E2E 会向测试企业微信客户发送消息，必须使用明确的测试账号和测试客户。
