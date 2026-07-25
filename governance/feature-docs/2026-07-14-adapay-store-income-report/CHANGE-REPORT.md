# CHANGE-REPORT — Adapay 店铺收入报表

## Summary

- 新增独立「店铺收入报表」，按店铺和 `sharing_time` 自然日展示 Adapay 分账成功后的店铺收入汇总。
- 支持从日汇总穿透到逐笔结算明细，明细同时展示店铺结算金额和关联订单实付金额。
- 仅统计店铺角色金额；已回退到虚拟余额的记录不冒充 Adapay 到账收入。

## Repositories

- `backend`: pay-biz 新增汇总/明细只读接口、店铺权限过滤和 Mapper 查询；新增菜单权限升级脚本。
- `admin`: 新增店铺收入报表 API client、汇总页面和明细弹窗；保留既有无关改动。
- `governance`: 新增需求、技术设计、契约、UI、测试和审查记录。

## Contracts

- `GET /admin-api/pay/profit-sharing-income/summary-page`
- `GET /admin-api/pay/profit-sharing-income/detail-page`
- DB 无新增业务表和字段；菜单/权限脚本：`backend/sql/upgrade-2026-07-13-adapay-store-income-report.sql`
- 权限：`pay:profit-sharing-income:query`

## Verification

- 通过：pay-biz 编译、Mapper XML 校验、新增前端文件 ESLint。
- 未通过：pay-biz 全量测试命中既有 OCR/对账依赖问题；admin `ts:check` 命中既有缺失类型定义问题。
- 未执行：真实数据库聚合验证和 E2E。

## Risks

- 生产数据需验证历史重试记录的成功记录去重和聚合性能。
- 回退收入、退款冲销、导出功能不在本期范围。

## Suggested PR

`feat(pay): add Adapay store income report`
