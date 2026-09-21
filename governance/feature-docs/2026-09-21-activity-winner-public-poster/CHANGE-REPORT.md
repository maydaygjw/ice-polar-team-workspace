# 活动中奖公示长图变更报告

## 业务结果

- 中奖管理可按活动期次导出单张中奖公示 PNG 长图。
- 公示只展示有效中奖记录，最多前 100 条；超过 100 条时在海报中明确提示仅展示前 100 条。
- 中奖用户名称由后端脱敏，海报不包含兑奖码和内部用户标识。

## 影响仓库

- `backend`：新增中奖公示数据接口和活动服务逻辑。
- `admin`：新增“导出公示海报”按钮、预览弹窗、Canvas 长图生成和 PNG 下载。
- `h5`：中奖名单页面改为调用 app-api，展示后端脱敏昵称、奖品和中奖时间。

## 契约/迁移

- 新增 `GET /admin-api/activity/winner/public-poster-data?periodId={periodId}`，权限 `activity:winner:query`。
- 新增 `GET /app-api/activity/period/winners?periodId={periodId}`，不要求登录，仅返回公示字段。
- app-api 与管理端统一最多返回 100 条；超过 100 条返回 `truncated=true`，H5 提示仅展示前 100 人。
- 无数据库迁移、MQ、外部系统或新依赖。

## 验证结果

- 后端 `mvn -pl yshop-module-activity/yshop-module-activity-biz -am test`：通过。
- 管理端 `pnpm build:prod`：通过。
- 变更文件 Prettier/ESLint：通过。
- 全量 `vue-tsc`：受仓库基线错误影响未通过，详见 `test-notes.md`。

## 残余风险

- 尚未在真实测试环境验证海报视觉效果和会员资料兜底脱敏。

## 建议 PR 标题

`feat(activity): add winner public poster export`
