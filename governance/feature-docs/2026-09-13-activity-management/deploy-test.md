# 测试环境部署记录

## 部署结果

- 部署时间：2026-09-13（Asia/Shanghai）
- Backend：远端 `master`，commit `8e7496ee9d25a5bee92c0d0d5b414e675238e700`
- Backend JAR SHA-256：`01da46fdb1fff2551816bdcdae127f484ae8ba34583c0d8bdfa68b3589ab0098`
- Backend：Java 17、`dev` profile、8888 端口、PID `1543685`
- Backend 健康检查：测试 API 域名 HTTP 200，返回 `{"status":"UP"}`
- Admin：远端 `master`，commit `5e009f063f4118ca6dfe091696e60afc7edd244e`
- Admin：测试构建 `build:dev`，Nginx 配置检查/reload 通过，远端静态文件 1216 个
- Admin 健康检查：测试域名 HTTP 200

## 数据库迁移

- 脚本：`backend/sql/upgrade-2026-09-13-activity-management.sql`
- SHA-256：`0a543b8301d393b90e76a033193981560bd2932133f7e512ba86b2f92b317ccd`
- 执行结果：成功
- 迁移前结构备份：`/tmp/yshop_pro-schema-before-activity-management-20260913150037.sql`
- 核验结果：8 张活动表全部存在；`system_menu` 中营销父菜单下 `activity` 菜单存在 1 条

## 菜单修复

- 发现初始迁移按旧假设使用 `parent_id=2030`，实际测试库营销菜单 ID 为 `2000`。
- 已将活动菜单 `1000246` 修正为 `parent_id=2000`，并补齐 `activity:period:draw`、`activity:period:qrcode` 权限。
- 修复后数据库核验通过；管理端需重新登录或刷新权限缓存。

## 备注

- 本次只部署测试环境，未触碰生产环境。
- 测试环境的真实业务页面、企微本地数据报名校验和二维码生成仍需使用测试账号进一步回归。
