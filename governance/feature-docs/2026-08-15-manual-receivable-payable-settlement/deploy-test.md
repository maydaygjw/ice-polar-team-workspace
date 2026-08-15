# 测试环境部署记录：手工触发应收应付结算

## 部署结果

| 项目 | 结果 |
|---|---|
| 环境 | `test` |
| 后端提交 | `737d6c3` |
| 管理端提交 | `90db2a5` |
| 数据库升级 | `sql/upgrade-2026-08-14-order-billing-template.sql` 执行成功 |
| 后端构建 | 远端 Maven `BUILD SUCCESS` |
| 管理端构建 | `pnpm build:dev` 通过 |
| 后端启动 | `Started YshopServerApplication`，端口 `8888` 正常监听 |
| 管理端静态资源 | 已发布，Nginx active |
| 外部访问 | 管理端和 API 域名均返回 `HTTP 200` |

## 校验

- 运行中的后端 JAR 内 `git.commit.id.full` 为
  `737d6c355eff758da8c79d166d76a30416cfafbb`。
- 后端进程使用 `--spring.profiles.active=dev` 启动。
- 管理端静态资源已在远端 `dist` 目录完成替换；旧目录保留为带时间戳的备份目录。

## 验证边界

本次完成的是测试环境部署与基础可用性校验；真实 Adapay 沙箱分账、权限登录后的浏览器操作和订单端到端业务链路仍需在测试数据准备后验证。
