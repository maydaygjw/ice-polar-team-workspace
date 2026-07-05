# Order Refund Reject — Test Notes

## 新增/变更文件

- `admin/e2e/order-refund-reject.spec.ts`
- `governance/feature-docs/order-refund-reject/e2e-test-plan.md`
- `governance/feature-docs/order-refund-reject/test-notes.md`

## 已覆盖场景

### Admin Playwright E2E（`admin/e2e/order-refund-reject.spec.ts`）

1. 完整 happy path：用户申请 → 管理员拒绝（允许再申请）→ 用户重新申请 → 管理员确认退款。
2. 拒绝后不允许再申请：用户重新申请接口返回错误。
3. 非退款中订单调用拒绝接口失败。
4. 已拒绝订单直接确认退款失败。
5. 拒绝原因空值/超长校验。
6. 已拒绝订单出现在「退款单」筛选中，且操作日志包含拒绝原因。

### 小程序 E2E 测试计划

- 订单列表/详情「退款已拒绝」状态展示。
- 拒绝原因回显与重新申请入口。
- 允许/不允许重新申请的后端校验。
- 已退款、退款中订单禁止重复申请。

## 环境要求

- 后端：`http://localhost:8888`（可通过 `API_URL` 覆盖）。
- 前端：`http://localhost:3000`（可通过 `FRONTEND_URL` 覆盖）。
- 管理员账号密码：`ADMIN_USERNAME` / `ADMIN_PASSWORD`。
- 普通用户账号密码：`USER_PHONE` / `USER_PASSWORD`。
- 数据库已执行 `backend/sql/upgrade-order-refund-reject.sql`。
- 运行命令：`npx playwright test admin/e2e/order-refund-reject.spec.ts`。
- 注意：admin 项目未声明 `@playwright/test` 依赖，运行前需全局安装或在工作区安装。

## 已知限制

- 后端 Java 实现与小程序页面改造尚未完成，当前测试代码基于设计文档与已合并的 admin UI 草稿编写，需待实现后执行。
- 测试数据通过 admin CRUD 接口创建；若字段校验收紧，可能需要调整 `createTestOrder` 入参。
