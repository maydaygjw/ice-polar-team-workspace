# 测试记录

## Planned

- backend：回调 URL CorpID 路由、跨租户 State 解析、目标账号选择、凭据不一致拒绝、欢迎语模板命中和重复 WelcomeCode 幂等。
- admin：账号表单提交/回显 `appName`、`agentId`，列表展示字段。

## Results

- backend：`mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomCallbackServiceTest,AppWecomCallbackControllerTest,WecomWelcomeMessageProcessorTest -Dsurefire.failIfNoSpecifiedTests=false test`，通过，24 个测试全部通过。
- admin：`pnpm exec eslint src/api/mp/wecom/account.ts src/views/mp/wecom/account/AccountForm.vue src/views/mp/wecom/account/index.vue src/views/mp/wecom/contactWay/ContactWayForm.vue`，通过。
- admin：`pnpm build:prod`，通过；仅有既有 Vite/Sass/UnoCSS 弃用或实验性提示。
- admin：`pnpm ts:check` 未通过，输出包含仓库其他模块的大量类型错误；本次变更涉及的 `mp/wecom` 文件未出现在错误输出中。
- 未执行真实企业微信回调和端到端发送：需要企业微信测试应用、有效 WelcomeCode 和运行中的 Redis，当前单元测试不具备这些外部条件。
