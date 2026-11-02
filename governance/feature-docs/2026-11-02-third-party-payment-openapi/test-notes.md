# 第三方支付 OpenAPI 验证记录

## Backend

- `mvn -pl yshop-module-system/yshop-module-system-biz,yshop-module-pay/yshop-module-pay-biz -am test`：通过；system/pay 及其依赖模块共 438 项测试，0 失败、0 错误、1 跳过。
- 最终验证在 Webhook 存量订单通知修复和事件唯一约束调整后执行。
- 增加 `pay_type` 字段并纳入支付响应后，`mvn -pl yshop-module-pay/yshop-module-pay-biz -am test`：44 项测试通过，0 失败、0 错误、0 跳过。
- 将 OpenAPI mapper 查询改为 `LambdaQueryWrapperX` DSL 后，同一命令再次通过：44 项测试通过，0 失败、0 错误、0 跳过；新 mapper 中无 `@Select`/原生查询注解。
- 框架增加 `controller.openapi` 自动 `/open-api` 前缀后，system/pay 相关 Maven 测试通过；同时确认 OpenAPI token 路径的租户解析使用客户端绑定，不要求请求方传租户头。
- 编译期间有现有 MapStruct 未映射字段警告；不影响构建结果。

## Admin

- `pnpm install --frozen-lockfile`：通过。
- `NODE_OPTIONS=--max_old_space_size=8192 pnpm build:prod`：通过。
- `pnpm ts:check`：未通过。仓库全量类型检查报告多个既有全局声明/接口类型缺失；定向检查本次改动文件时发现并修正了客户端编号可空错误，剩余输出是既有的 `MerchantDetailsPageReqVO` 未声明错误。生产构建通过，但不能替代类型检查。

## E2E

- 未运行真实微信 JSAPI、支付回调、退款及 Webhook 接收端联调。当前环境没有可确认的微信商户测试凭据、MQ/数据库联调配置和第三方接收端。
- 上线前需要按 `test-plan.md` 在隔离测试租户执行端到端验证；不得使用生产支付密钥。

## Dev 部署记录（2026-11-02）

- Backend 分支 `feat/third-party-payment-openapi` 已推送，包含框架提交 `51e201c5` 和支付 OpenAPI 提交 `f9e67c6f7c2b92533d455d4c99d20e0e76c9ef51`。
- Admin 分支 `feat/third-party-payment-openapi` 已推送，提交 `b2047af0e20fe9bfe15f2dbc03a0e308460f06cd`；`pnpm build:dev` 通过。
- Dev 数据库流水线 `yshop-db-dev` 在该 Backend 分支执行迁移前 `info`（运行 ID `104`）、`migrate`（`105`）、迁移后 `info`（`106`）和 `validate`（`107`），四次运行均成功。
- Backend dev 流水线运行 ID `137` 使用该分支和 `YSHOP_ENV=dev2`。Maven 打包阶段成功；“从 OSS 下发 Docker Compose 文件”阶段失败，流水线返回 `deploy.fail`，运行状态为 `FAIL`。API 健康地址 `https://api-yshop-dev.holuntech.cn/actuator/health/` 检查返回 HTTP 502。
- 云效部署详情和任务日志 API 返回 HTTP 403，当前无法取得更具体的失败原因。Backend 未验收成功，因此未触发 Admin dev 部署；Admin 分支已提交并推送，但尚未部署。
- 云效流水线详情响应包含未脱敏的 Maven 全局变量。响应内容未写入仓库或发布记录；相关凭据应按已暴露处理并轮换。
- 根据部署后端日志确认启动失败原因为 `@Resource` 按字段名 `configMapper` 注入了 Infra 模块同名 Mapper 代理。将字段名改为 `openApiClientConfigMapper`，Backend 提交 `2f905a0381aa3b9ab558d21ac798c86cbafd2eeb`；system/pay Maven 测试 438 项通过，0 失败、0 错误、1 跳过。
- Backend 部署流水线 `138` 使用提交 `2f905a0381aa3b9ab558d21ac798c86cbafd2eeb` 并成功，部署单 `2887569` 状态 `FINISH`；API 健康检查返回 `{"status":"UP"}`。
- Admin 部署流水线 `55` 使用提交 `b2047af0e20fe9bfe15f2dbc03a0e308460f06cd` 并成功；管理端首页返回 HTTP 200，页面引用的 JS/CSS 静态资源均返回 HTTP 200。

## 静态检查

- backend/admin `git diff --check`：通过。
