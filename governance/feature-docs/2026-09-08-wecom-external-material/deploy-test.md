# 测试环境部署记录：企业微信外部素材

## 发布信息

| 项目 | 值 |
|---|---|
| 环境 | `test` |
| 部署时间 | 2026-09-08 15:15（Asia/Shanghai） |
| Backend 提交 | `211e8790fa36b9656167e0da8001a23bbcbe2d07` |
| Backend JAR SHA-256 | `ee8a021456b2cc7a89a61eecfe2e228746d95b4df85be0215eac41b252db360c` |
| Admin 提交 | `3d85aaab15f1d89981553878a6093baeb490bdca` |
| Admin dist tar SHA-256 | `f67b11c2977062698763466ad2d15e472333650cbe64e7c3fe0b1e4863de0350` |
| 后端运行方式 | Java 21，`dev` profile，裸进程，监听 `8888` |

## 数据库升级

- 已执行 `backend/sql/upgrade-2026-09-08-wecom-external-material.sql`。
- `mp_wecom_external_material_provider` 已创建并写入 `FIXED_PRICE_PRODUCT / TEXT / externalMaxCount=1`。
- `mp_wecom_material.external_provider`、`mp_wecom_material.external_params` 已存在。
- 受影响表备份：`/opt/holun/backups/mp_wecom_material.20260908150545.sql`。

## 部署结果

- 后端健康接口：`https://yshop-api-test.holuntech.cn/actuator/health/` 返回 `{"status":"UP"}`。
- 后端运行 JAR 内提交与本次部署提交一致，端口 `8888` 正常监听。
- 管理端：`https://yshop-admin-test.holuntech.cn/` 返回 HTTP 200。
- Nginx 配置测试通过并已 reload，服务状态为 active。
- 管理端旧静态目录备份：`/opt/holun/yshop-drink-vue/dist.bak.20260908151458`。

## 回滚

- 后端部署前可使用服务器已有旧 JAR 备份：`/opt/holun/yshop-drink/yshop-server/yshop-server.jar.bak.2026090722-stable-832b5f0`。
- 数据库可使用 `mp_wecom_material.20260908150545.sql` 恢复受影响素材表；Provider 表和新增字段需按迁移回滚方案处理。
- 管理端恢复带时间戳的 `dist.bak.20260908151458` 后执行 `nginx -t && systemctl reload nginx`。

## 验证边界

- 本次完成测试环境部署、数据库升级、服务健康和公网入口校验。
- 尚未使用真实企业微信执行外部素材预览、群发和新客户欢迎语端到端烟测。

## 2026-09-08 15:35 租户模型修正

- 根因：Provider 配置表原设计误作系统级表，运行查询被租户插件追加 `tenant_id` 后报列不存在。
- 修正：`WecomExternalMaterialProviderDO` 改为继承 `TenantBaseDO`，Provider 配置按 `tenant_id + provider` 隔离；未使用 `@InterceptorIgnore`。
- 数据库：已备份 `/opt/holun/backups/wecom_external_material_before_tenant_20260908152759.sql`，迁移后 Provider 有 11 条有效租户配置，`tenant_id IS NULL` 为 0。
- 当前 test 运行 JAR SHA-256：`32b89be6d29f03a22e0f599325280375c9ba7c0ecb89304cb93c26bde7a1190f`，内嵌基线提交仍为 `211e8790fa36b9656167e0da8001a23bbcbe2d07`，`git.dirty=true` 表示本次租户修正尚未提交。
- 修正后后端健康接口返回 `{"status":"UP"}`；生产发布前必须提交并合并该修正，禁止直接复用当前 dirty 制品。

## 2026-09-08 17:00 群标签筛选修复部署

- Backend 提交：`cd15ace1614fad84fb09d573b03a8520f09ece08`。
- Backend JAR SHA-256：`b7f0e6c0b487b1239670eb411d97f9d779ab2056b6c904e8363fa20720e11155`。
- 部署前已备份旧 JAR；新进程 PID `2736285`，Java 21，`dev` profile，监听 `8888`。
- 健康接口：`https://yshop-api-test.holuntech.cn/actuator/health/` 返回 `{"status":"UP"}`。
- 本次部署包含按群标签精确筛选客户群的修复；未重复执行已完成的外部素材数据库迁移。
