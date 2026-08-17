# Test 环境部署记录

- 部署时间：2026-08-17 09:57（Asia/Shanghai）
- 环境：test
- 变更：会员地址持久化商圈，并按“商圈 → 目的地”级联选择

## 产物

- 后端：`backend/yshop-server/target/yshop-server.jar`
  - 基准提交：`aa86b2086af46bb4e3203c28c080f9f76fa69698`
  - 工作区变更摘要：`d837ab86d34063e79a6c0931277bd5997c80516a121cf87686d595bf16f7e65e`
  - SHA-256：`d2a1e37b97e559d8976272ac5789e946ee4c36e0a8a248ebe3aa70da729de55b`
- 管理端：`admin/dist`
  - 基准提交：`d8d96a21cfdcee229ca34e4b9d0ae2b035344ec6`
  - 工作区变更摘要：`9ae2d4a4d9bbf2c5daeb1f10fbe93cd0ba34a36874a6ee245da06b134a90c204`
  - 发布包 SHA-256：`5ccd6fd05dd961d31107f1c81fc69c2c79e1e68dfccae0f89a536772c0a6c0f8`
- SQL：`backend/sql/upgrade-2026-08-17-member-address-business-region.sql`
  - SHA-256：`e02d35f0cc21dd520c98a9ee52b5bf5aa3f870a5c8c1e5ae721c5cb7278fa2aa`

## 执行结果

- 数据库连接成功，迁移执行成功。
- `yshop_user_address.business_region_id`：不存在 → 存在。
- 已有地址回填商圈：1 条。
- 后端 JAR 已备份后替换，进程启动成功，8888 端口监听，根路径返回 HTTP 200。
- 管理端 dist 已备份后替换，Nginx 配置检查和 reload 成功。
- 公网 API 和管理端入口均返回 HTTP 200。

## 验证说明

- Maven 后端打包：通过。
- 管理端 `pnpm build:dev`：通过；仅有现存 Sass 弃用警告。
- 完整后端测试仍有既有支付模块测试失败，未发现会员地址相关失败。
- 当前变更尚未提交 Git；部署产物包含上述基准提交之外的本地工作区变更。
