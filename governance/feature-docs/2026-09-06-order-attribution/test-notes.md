# 测试记录：订单渠道与推荐人记录

## 当前状态

实现已在 backend 独立 worktree `feat/order-attribution` 完成；本记录包含当前已执行验证。

## 待执行验证

- 后端订单模块单元测试：字段透传、推荐人租户校验、自推荐拒绝、空值兼容。
- 家政和设备模块测试：`AppStoreOrderDTO` 字段可透传至统一订单 API。
- 数据库迁移检查：新增可空字段、索引和回滚语句。
- 集成测试：确认真实租户和用户数据下的推荐人校验。
- OpenAPI 快照检查：确认下单请求新增字段、订单响应不新增字段（当前仓库未提供可直接生成的 OpenAPI 快照流程）。

## 已执行验证

- `mvn -pl yshop-module-mall/yshop-module-order-biz,yshop-module-mall/yshop-module-desk-biz,yshop-module-device/yshop-module-device-biz,yshop-module-site/yshop-module-site-biz -am -DskipTests compile`：通过。
- `mvn -pl yshop-module-mall/yshop-module-order-biz -am -Dtest=OrderApiImplTest -Dsurefire.failIfNoSpecifiedTests=false test`：通过，7 tests。
- `git diff --check`：通过。
- 后端订单推广查询接口编译验证：通过。

## 未执行项

- 集成测试：未执行，需要真实数据库和租户/商圈数据环境；当前单元测试覆盖统一订单 API 的字段透传。
- 前端 `vue-tsc`：未完成，admin worktree 没有本地依赖；复用主 admin worktree 依赖运行时缺少 `qrcode`、`vite/client` 类型定义。
- E2E：本次没有用户界面变更，暂不安排独立 E2E。
