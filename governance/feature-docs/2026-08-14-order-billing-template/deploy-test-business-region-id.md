# 测试环境部署记录：计费模板统一使用商圈 ID

## 部署结果

| 项目 | 结果 |
|---|---|
| 环境 | `test` |
| 后端提交 | `cbf191aa` |
| 管理端提交 | `2bc3cde`（包含 `6df13a6` 的商圈 ID 改造及失败记录重新计算按钮） |
| 数据库升级 | `upgrade-2026-08-16-billing-template-business-region-id.sql` 执行成功 |
| 后端构建 | 远端 Maven `BUILD SUCCESS` |
| 后端启动 | 端口 `8888` 正常监听，`/actuator/health` 返回 `{"status":"UP"}` |
| 管理端静态资源 | 已发布 |

## 数据校验

- `yshop_pay_billing_template.business_region_id` 已生效，旧的 `business_region` 字段已移除。
- test 中历史模板已从商圈名称迁移为 ID：租户 156 使用商圈 ID `14`，租户 158 使用商圈 ID `15`。
- 订单 `2088657498587267072` 的门店商圈 ID 为 `14`，现在可以命中模板 ID `2`。
- 原失败记录保持 `FAILED`，需在管理端点击“重新计算”后生成成功结果；本次未直接篡改业务结果数据。
