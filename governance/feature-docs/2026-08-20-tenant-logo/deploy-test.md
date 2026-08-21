# 测试环境部署记录：租户 Logo

## 发布信息

| 项目 | 值 |
|---|---|
| 环境 | `test` |
| 部署时间 | 2026-08-20 22:59（Asia/Shanghai） |
| 后端基准 commit | `873b2640dd207b913c9ab88ad927057f967c99ab` |
| 后端工作区摘要 | `6e16bc2058a6be08f527e2dc4437fa1f93556b1aee90e467639c4b13d558632d` |
| 后端 JAR SHA-256 | `af0f084f2f6cc9053f5f732b9843945842a14f5e5e9621e7f05470ce416a3de6` |
| 管理端基准 commit | `198d53aa2c430f1c3cdf4bd221276a8fc47c1223` |
| 管理端工作区摘要 | `04d98d6a956eed2ecb837c39f6c826bcab655a9ab903defe91b9715ad5f1e586` |
| 管理端发布包 SHA-256 | `10f7cdf58f193731a0631930793c3e12857faabb6cc9b327b19a84941d788ccb` |

## 执行结果

- 后端本地 Maven 打包成功，运行时使用 Java 21；JAR 内 `git.commit.id.full` 与基准 commit 一致。
- `application-prod.yaml` 默认生产地址检查通过。
- test 数据库已执行 `backend/sql/upgrade-2026-08-20-tenant-logo.sql`。
- `system_tenant.logo` 已存在，类型为 `varchar(500)`，允许为空，注释为“租户 Logo 图片 URL”。
- 后端旧 JAR 已备份至 `/opt/holun/yshop-drink/yshop-server/target/yshop-server.jar.bak.20260820225716`。
- 管理端旧静态资源已备份至 `/opt/holun/yshop-drink-vue/dist.bak.20260820225846`。
- 后端已启动，8888 端口监听，`/actuator/health` 返回 `{"status":"UP"}`。
- 管理端和 API 公网入口均返回 HTTP 200，Nginx 配置检查通过且服务 active。

## 验证说明

- 管理端构建：`pnpm build:dev` 通过；仅有既存 Sass 弃用警告。
- 后端构建：`mvn -pl yshop-server -am package -DskipTests` 通过。
- 本次部署未提交 Git；工作区变更仍保留供后续审核。

