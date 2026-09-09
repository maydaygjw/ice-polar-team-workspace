# 变更报告

## 业务结果

- 新增企业微信推送通道维护，按租户和商圈管理多个海豚私域 Webhook。
- 即时群发和每日定时推送均可选择官方企业微信或海豚私域。
- 海豚私域支持文本和小程序素材，其他素材类型会失败并记录错误。

## 影响仓库

- `backend`: 通道 CRUD、推送分流、Webhook payload、数据库迁移和权限菜单。
- `admin`: 通道维护页、即时群发/定时推送通道选择。

## 验证

- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile`: pass
- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomCustomerGroupServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test`: pass（5 tests）
- `pnpm build:dev`: pass
- `pnpm ts:check`: baseline failures，未发现本功能文件新增错误

## 交付

未执行 commit、push、PR 或部署。
