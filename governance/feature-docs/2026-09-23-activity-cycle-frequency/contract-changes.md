# 活动模板周期频率契约变更

## Admin API

活动模板创建、更新请求和详情响应中的 `cycleType` 支持：

- `1`：按周；`cycleWeekday` 必须为 `1-7`，分别表示周一至周日。
- `2`：按天；`cycleWeekday` 可为 `null` 或省略。

其他活动模板和期次接口语义不变。生成期次接口仍为：

`POST /admin-api/activity/period/generate?templateId={id}&occurrence={1..3}`

## Database

- `yshop_activity_template.cycle_type` 注释和业务取值扩展为 `1=每周，2=每天`。
- `yshop_activity_template.cycle_weekday` 改为可空；按天模板为空，按周模板仍为 `1-7`。
- 迁移脚本：`backend/sql/upgrade-2026-09-23-activity-cycle-frequency.sql`。

## Compatibility

历史记录中的 `cycle_type=1` 和已有期次保持原语义；不重算、不更新历史期次日期。
