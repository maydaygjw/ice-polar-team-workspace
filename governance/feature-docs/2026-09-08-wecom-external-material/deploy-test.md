# 测试环境部署记录：企业微信外部素材

## 发布信息

| 项目 | 值 |
|---|---|
| 环境 | `test` |
| 部署时间 | 2026-09-08 15:15（Asia/Shanghai） |
| Backend 提交 | `211e8790fa36b9656167e0da8001a23bbcbe2d07` |
| Backend JAR SHA-256 | `ee8a021456b2cc7a89a61eecfe2e228746d95b4df85be0215eac41b252db360c` |
| Admin 提交 | `3d85aaab15f1d89981553878a6093baeb490bdca` |
| Admin dist tar SHA-256 | `f67b11c2977062698763466ad2d15e472333650cbe64e7c3fe0b1e4863de0350` |
| 后端运行方式 | Java 21，`dev` profile，裸进程，监听 `8888` |

## 数据库升级

- 已执行 `backend/sql/upgrade-2026-09-08-wecom-external-material.sql`。
- `mp_wecom_external_material_provider` 已创建并写入 `FIXED_PRICE_PRODUCT / TEXT / externalMaxCount=1`。
- `mp_wecom_material.external_provider`、`mp_wecom_material.external_params` 已存在。
- 受影响表备份：`/opt/holun/backups/mp_wecom_material.20260908150545.sql`。
- 饭火轮新店 Provider 还需在目标租户配置 `fhl_new_store_request_url` 为业务方提供的完整 `GetNewStoreList` 请求地址（签名仅放配置，不提交到仓库），素材参数填写 `businessRegionCode=SHLJZ001` 即可；页面固定为 `hlmall/pages/takeout/takeoutindex?storeId={门店ID}`。

## 部署结果

- 后端健康接口：`https://yshop-api-test.holuntech.cn/actuator/health/` 返回 `{"status":"UP"}`。
- 后端运行 JAR 内提交与本次部署提交一致，端口 `8888` 正常监听。
- 管理端：`https://yshop-admin-test.holuntech.cn/` 返回 HTTP 200。
- Nginx 配置测试通过并已 reload，服务状态为 active。
- 管理端旧静态目录备份：`/opt/holun/yshop-drink-vue/dist.bak.20260908151458`。

## 回滚

- 后端部署前可使用服务器已有旧 JAR 备份：`/opt/holun/yshop-drink/yshop-server/yshop-server.jar.bak.2026090722-stable-832b5f0`。
- 数据库可使用 `mp_wecom_material.20260908150545.sql` 恢复受影响素材表；Provider 表和新增字段需按迁移回滚方案处理。
- 管理端恢复带时间戳的 `dist.bak.20260908151458` 后执行 `nginx -t && systemctl reload nginx`。

## 验证边界

- 本次完成测试环境部署、数据库升级、服务健康和公网入口校验。
- 尚未使用真实企业微信执行外部素材预览、群发和新客户欢迎语端到端烟测。

## 2026-09-08 15:35 租户模型修正

- 根因：Provider 配置表原设计误作系统级表，运行查询被租户插件追加 `tenant_id` 后报列不存在。
- 修正：`WecomExternalMaterialProviderDO` 改为继承 `TenantBaseDO`，Provider 配置按 `tenant_id + provider` 隔离；未使用 `@InterceptorIgnore`。
- 数据库：已备份 `/opt/holun/backups/wecom_external_material_before_tenant_20260908152759.sql`，迁移后 Provider 有 11 条有效租户配置，`tenant_id IS NULL` 为 0。
- 当前 test 运行 JAR SHA-256：`32b89be6d29f03a22e0f599325280375c9ba7c0ecb89304cb93c26bde7a1190f`，内嵌基线提交仍为 `211e8790fa36b9656167e0da8001a23bbcbe2d07`，`git.dirty=true` 表示本次租户修正尚未提交。
- 修正后后端健康接口返回 `{"status":"UP"}`；生产发布前必须提交并合并该修正，禁止直接复用当前 dirty 制品。

## 2026-09-08 17:00 群标签筛选修复部署

- Backend 提交：`cd15ace1614fad84fb09d573b03a8520f09ece08`。
- Backend JAR SHA-256：`b7f0e6c0b487b1239670eb411d97f9d779ab2056b6c904e8363fa20720e11155`。
- 部署前已备份旧 JAR；新进程 PID `2736285`，Java 21，`dev` profile，监听 `8888`。
- 健康接口：`https://yshop-api-test.holuntech.cn/actuator/health/` 返回 `{"status":"UP"}`。
- 本次部署包含按群标签精确筛选客户群的修复；未重复执行已完成的外部素材数据库迁移。

## 2026-09-08 22:29 饭火轮新店 Provider 部署

- 目标租户：`155`（莘动力）。
- 已执行 `backend/sql/upgrade-2026-09-08-wecom-external-material.sql`；Provider 配置为 `FHL_NEW_STORE_MINI_PROGRAM / MINI_PROGRAM / externalMaxCount=3`。
- 已写入租户参数 `fhl_new_store_request_url`，值为业务方提供的 `GetNewStoreList` 完整请求地址；签名未写入代码或本记录。
- 素材参数使用 `businessRegionCode=SHLJZ001`；小程序页面固定为 `hlmall/pages/takeout/takeoutindex?storeId={门店ID}`。
- 本地构建 JDK：Java 17；测试机运行 JDK：Java 21。
- Backend 构建 commit：`b8e271498f0598c2eda093b7be06cfb3b763ed25`，制品标记 `git.dirty=true`。
- Backend JAR SHA-256：`a82c55b2f152df23c2c05cf820b739c33c7d8cd1381efdf1ce1681c86e264504`。
- 测试机运行进程：PID `2850788`，`dev` profile，监听 `8888`；健康接口返回 `{"status":"UP"}`。
- Provider 数据库复核通过；Provider 列表管理 API 使用当前测试 Mock 用户返回 403，未宣称 API 权限验证通过。
- 本次仅配置租户 Provider 和接口地址，未将素材挂入“欢迎语”或“莘动力每日推送”素材组；待明确发送场景后再添加素材项。
