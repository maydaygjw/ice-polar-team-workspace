# 测试记录

- `cd backend && mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile`：通过。
- `cd backend && mvn -pl yshop-module-mp/yshop-module-mp-biz -am test`：通过，MP 模块及依赖测试 41 项通过。
- `cd admin && pnpm build:dev`：通过。
- `cd admin && pnpm ts:check`：仓库全量检查仍有既有类型错误；本次客户群相关文件定向筛选无新增错误。
- 未执行真实企业微信 API 和浏览器 E2E：需要配置真实 CorpID/Secret、数据库迁移和企业微信成员确认环境。
