# 测试环境部署记录：门店配送商户号

## 部署结果

- 环境：test
- 后端版本：`c06502b1`（`feat(store): add delivery merchant number`）
- 管理端版本：`41e5972`（`feat(store): add delivery merchant number`）
- 后端构建：`mvn -pl yshop-server -am package -DskipTests` 成功
- 管理端构建：`pnpm build:dev` 成功
- 后端服务：8888 端口监听，`/actuator/health` 返回 `{"status":"UP"}`
- 管理端静态文件：已发布至 `/opt/holun/yshop-drink-vue/dist`

## 数据库校验

- `yshop_store_shop.delivery_merchant_no` 已执行并存在，类型为 `varchar(64)`，允许为空。
- `upgrade-2026-08-14-order-billing-template-permissions.sql` 在 test 数据库中已完整生效：4 个计费模板菜单权限均存在，拥有查询权限的角色与已补齐子权限的角色均为 7 个（7/7）。
- 数据库未发现迁移历史表，因此无法确认该权限脚本的具体执行时间；以上结论依据当前数据库最终状态。

