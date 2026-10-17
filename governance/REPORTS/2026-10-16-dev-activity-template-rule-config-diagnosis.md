# Dev 活动模板奖品规则参数校验失败诊断

- 时间：2026-10-16 15:59:37、15:59:38（Asia/Shanghai）。
- 环境：`dev`，API 域名 `yshop-api-dev.holuntech.cn`，后端日志监听端口 8888。
- 范围：只读检查应用日志、运行代码和数据库；未修改数据、配置或制品。

## 运行版本

从运行进程 PID 410902 的实际 JAR `/opt/yshop/app.jar` 读取：

- commit：`1e7372fe5bd80d22cd0464ffe64f1357eab12922`
- SHA-256：`7bae22d56c72c5cea40f5ca45942cf7711fe7de6bad9617fecd9822842a1910b`

## 证据

`server.log` 在 15:59:37.051 与 15:59:38.205 各记录一次 `ServiceException: 开奖规则参数不合法`。堆栈为 `ActivityTemplateServiceImpl.update` → `validatePrizeLibrary` → `ActivityPrizeServiceImpl.requireAvailable` → `requireForReference` → `validateRule`。

两次错误前最后一次奖品库查询均为 prize ID `2`。当前租户 `158` 的模板 `1` 关联奖品 ID 为 `1, 3, 4, 2, 5`。只读查询显示 prize `2` 的名称为“当日霸王餐”，规则类型为 `FANHUOLUN_REFUND_MAX_TODAY_ORDER`，规则参数 JSON 没有任何字段。

该规则 `FanhuolunRefundMaxTodayOrderDrawRule.validate` 要求 `max_money` 可解析为大于 0 的金额。`ActivityPrizeServiceImpl.validateRule` 会捕获规则校验异常并统一转换为“开奖规则参数不合法”，所以当前堆栈没有呈现具体的缺失字段。

模板更新流程在 `validatePrizeLibrary` 通过后才更新模板和奖品关联；这次失败发生在校验阶段。排查期间只执行了只读 SQL，没有改动数据库。

## 结论与后续

已证实：模板更新请求包含 prize `2`，但该奖品的 `FANHUOLUN_REFUND_MAX_TODAY_ORDER` 参数为空，缺少必填的 `max_money`，导致模板更新在保存前失败。

建议通过活动奖品管理流程为 prize `2` 配置有效的正数 `max_money` 后再更新模板。不要用直接 SQL 修改代替管理流程。本问题独立于同日中奖领取失败的 period prize `87` 缺少 `couponId`。
