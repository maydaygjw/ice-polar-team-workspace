# 变更报告：订单每日序号

## Outcome

已完成后端订单每日序号能力：按“租户 + 门店 + 后端自然日”从 1 开始递增，订单创建成功后在管理端和 C 端响应中返回 `orderSequence`。

## Affected Repositories

- `backend`：订单 DO、API DTO、管理端/C 端响应模型、订单创建流程、序号计数服务、单元测试和数据库升级脚本。
- `governance`：需求、契约、技术设计、测试记录和评审报告。
- `admin`、`miniapp`：本期未修改；新增响应字段向后兼容。

## Database / Contract

- `yshop_store_order` 新增 nullable `order_sequence`。
- 新增 `yshop_order_sequence`，以租户、门店和日期唯一维护计数。
- 升级脚本：`backend/sql/upgrade-2026-08-15-order-daily-sequence.sql`。
- 历史订单保持 `null`，不做回填。

## Verification

- 编译通过：`mvn -pl yshop-module-mall/yshop-module-order-biz -am -DskipTests compile`。
- 新增单测通过：`OrderSequenceServiceTest`，1/1。
- 完整依赖测试受既有 pay-biz 测试失败阻断，详见 `test-notes.md`。

## Delivery State

- 未提交 commit，未修改根仓库中的 submodule 指针，保留在 backend 独立 worktree `feat/order-daily-sequence` 中供人工审阅。
