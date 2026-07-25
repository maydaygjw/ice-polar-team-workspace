# Contract Changes — Adapay 店铺收入报表

## API

新增两个管理后台只读接口：

- `GET /admin-api/pay/profit-sharing-income/summary-page`：店铺日收入汇总分页。
- `GET /admin-api/pay/profit-sharing-income/detail-page`：指定店铺、指定结算日的结算明细分页。

响应金额统一使用元金额 `BigDecimal`，日期时间使用现有管理后台序列化格式。接口不返回银行卡、身份证和其他收款人敏感信息。

## DB

- 不新增业务表和业务字段。
- 新增 `backend/sql/upgrade-2026-07-13-adapay-store-income-report.sql`，注册菜单及 `pay:profit-sharing-income:query` 权限。
- 如实现阶段确认需要新增索引，必须在上述脚本中同时提供回滚语句。

## 权限与数据范围

- 所有查询显式按 `tenant_id` 隔离。
- 店铺筛选和结果遵循现有后台店铺数据权限；无店铺权限时不得通过传入其他 `shopId` 越权查看。
- 页面只读，不新增写权限。

## 外部系统与事件

N/A：报表只读本地已固化分账数据，不调用 Adapay，不新增事件或 MQ。
