# 测试环境部署记录

## 部署时间

2026-08-27（Asia/Shanghai）

## 部署范围

- Backend：Gitee `icepolar/yshop-drink` 合并后的 `master`，commit `47ea2128beb9a7f424a7c13be1ef773d501aa96b`
- Admin：Gitee `icepolar/yshop-drink-vue` 合并后的 `master`，commit `c5580fbc8005b789b3c799a0de96151cb84083ed`
- Miniapp：未部署

## Backend 制品

- 构建环境：测试服务器 Java 21.0.12
- 启动 profile：`dev`
- 运行 PID：1933910
- 监听端口：8888
- JAR SHA-256：`588a7929102edf92dc4c12ff3ed23e4333605c673595980890988799e6cb8db6`
- JAR 内 `git.commit.id.full` 与源码 commit 一致
- 旧 JAR 已备份，可用于回滚

## Admin 制品

- 构建模式：`dev`
- 产物文件数：1190
- 产物 SHA-256：`6b92b8fc43b4190d74180afc78a332777a6d1a2fc4fda068d5be42a4f26643d0`
- 测试 API 域名检查通过，未命中生产 API 域名
- Nginx 配置检查、reload 通过

## 验证结果

- Backend 本机 `/actuator/health`：HTTP 200，`{"status":"UP"}`
- 测试 API 域名健康检查：HTTP 200
- 测试 Admin 域名检查：HTTP 200
- Nginx：active
- 后端启动日志：应用启动成功，无启动异常

## 未执行事项

- 数据库迁移脚本未执行。数据库迁移需要单独授权，当前部署仅完成应用和管理端制品发布。
- AdaPay 真实支付、拼单完整业务链路和小程序端未进行本次部署验证。

## 数据库迁移

- 执行时间：2026-08-27 14:41（Asia/Shanghai）
- 脚本：`backend/sql/upgrade-2026-08-27-order-group-payment.sql`
- 脚本 SHA-256：`70b0367ce5b98d698bdea465e1ed63cf8d72461ede4e76f2b9230ac463ce9eb4`
- 执行结果：成功
- 迁移前结构备份：`/opt/holun/yshop-drink/db-backups/yshop_pro-schema-before-order-group-payment-20260827144150.sql`
- 迁移后核验：订单、支付尝试、门店配置新增字段及 `idx_pno_group_member_attempt` 索引均已存在。
- 数据库仅执行结构变更，未回填或修改历史业务数据。
