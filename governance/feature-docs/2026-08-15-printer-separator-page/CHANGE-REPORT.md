# 变更报告

## 业务结果

- 文件打印订单正文完成后自动提交一页分隔页，分隔页包含订单编号、门店名称、文件名、正文页数和打印份数。
- 分隔页成功后才进入配送；分隔页失败支持后台只重试分隔页，不重新打印正文。
- 分隔页 HTML 通过临时 OSS 文件提交，默认保留 48 小时，终态主动清理。
- 租户可通过“租户参数管理”的 `printer.separator.enabled` 开关控制后续打印任务是否启用分隔页，默认关闭。

## 影响仓库

- `backend`：临时文件 API、分隔页模板/提交服务、订单快照、状态机、重试接口和测试。
- `admin`：分隔页阶段展示、失败操作提示和仅重试分隔页 API/按钮。
- `governance`：需求、设计、契约、UI、验证和审查记录。

## 契约与迁移

- 新增 `POST /admin-api/device/print-job/retry-separator?orderNo={设备订单号}`。
- 复用 `device:print-job:retry` 权限。
- 无数据库表结构变更；`extra_params.separator` 为兼容性 JSON 增量。
- 复用既有 `infra_tenant_config`，不新增租户参数 API。

## 验证结果

- 后端编译通过。
- 后端 reactor 全量测试通过：43 个测试。
- 管理端类型检查待安装前端依赖后执行。

## 残余风险

- 需要配置 OSS 生命周期规则并完成真实链科 HTML 打印联调。
- 需要在测试环境验证租户参数开关的创建、修改和按订单固化行为。

## 建议 PR 标题

`feat(printer): add order separator page after document printing`
