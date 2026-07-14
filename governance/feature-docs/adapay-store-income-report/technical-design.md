# 技术设计 — Adapay 店铺收入报表

## 模块影响

| 模块 | 变更 | 说明 |
|------|------|------|
| `yshop-module-pay-biz` | 修改 | 新增店铺收入汇总/明细查询接口、Service 和 Mapper 查询 |
| `admin/` | 修改 | 新增店铺收入报表页面和 API client |
| `backend/sql` | 新增 | 注册菜单及只读查询权限 |

不新增收入表、分账表字段或 MQ；复用现有 `yshop_adapay_profit_sharing_order`、`yshop_adapay_profit_sharing_order_item` 和 `yshop_store_order`。

## 关键决策

1. **查询归属 pay 模块**：报表事实来源是 Adapay 分账及其角色明细，查询入口放在 `pay-biz`，避免订单维护模块承担支付财务报表职责。
2. **两层查询**：汇总接口按店铺和 `DATE(sharing_time)` 聚合；明细接口按店铺和结算日分页，店铺收入取 `role=2` 明细金额。
3. **只读与快照优先**：不调用 Adapay、不修改订单或分账状态；订单金额展示订单实付值，店铺结算金额展示分账明细固化值。
4. **成功口径**：仅统计 `sharing_status=2`。`sharing_status=4` 属于虚拟余额回退，暂不冒充 Adapay 到账。
5. **重复控制**：查询以成功分账记录为事实，并按订单的有效成功记录去重，避免历史重试记录重复累计。

## API 契约

### 汇总分页

`GET /admin-api/pay/profit-sharing-income/summary-page`

参数：`pageNo`、`pageSize`、`shopId`、`settlementDateStart`、`settlementDateEnd`。

返回分页记录：`settlementDate`、`shopId`、`shopName`、`settlementOrderCount`、`orderAmount`、`incomeAmount`。

### 明细分页

`GET /admin-api/pay/profit-sharing-income/detail-page`

参数：`pageNo`、`pageSize`、`shopId`、`settlementDate`。

返回分页记录：`orderId`、`shopId`、`shopName`、`orderAmount`、`settlementAmount`、`sharingTime`、`sharingStatus`、`profitSharingOrderId`。

两个接口都只返回当前租户及当前用户可见店铺的数据；参数错误使用现有统一参数校验语义。

## 数据查询与索引

- 汇总关联分账主表、店铺角色明细和订单表，过滤删除标记、租户、成功状态、店铺角色和结算日期。
- 明细沿用同一事实口径，并按 `sharing_time DESC, order_id DESC` 排序。
- 优先复用现有索引；若执行计划确认需要，再在同一特性升级脚本中补充 `(tenant_id, sharing_status, sharing_time, shop_id)`、`(sharing_order_id, role)` 等索引，避免无依据扩张表结构。

## 菜单与权限

- 菜单：门店中心下新增「店铺收入报表」。
- 权限：`pay:profit-sharing-income:query`。
- 不新增创建、更新、删除权限。

## 风险与回滚

- 主要风险是多表聚合和历史重复分账记录导致金额重复；通过成功记录去重、角色过滤和金额单元测试控制。
- 菜单可通过升级脚本中的反向删除语句回滚；代码回滚不影响既有分账数据。
