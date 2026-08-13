# 企业微信商圈欢迎语模板测试记录

## 计划

- 后端单元测试：模板校验、商圈校验、企业微信请求组装、外部失败保留原记录。
- 后端接口测试：租户隔离、权限、重复模板、图片上传和 CRUD。
- 管理端验证：列表筛选、表单校验、图片预览、保存失败保留状态、启用/停用和删除确认。
- E2E：在测试环境使用固定测试租户和企业微信配置验证完整管理链路；不触发客户欢迎语发送。

## 执行结果

- Backend：`mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests compile` 通过。
- Backend：`mvn -pl yshop-module-mp/yshop-module-mp-biz -am -Dtest=WecomWelcomeTemplateServiceImplTest -Dsurefire.failIfNoSpecifiedTests=false test` 通过，3 个用例通过。
- Admin：`pnpm run build:local` 通过。
- Admin：`pnpm run ts:check` 未能作为全量门禁通过。当前基线已有大量自动导入声明和类型生成错误；本次新增页面仅出现同类全局自动导入错误，未出现本功能 API/组件的业务类型错误。

## 待补验证

- 已完成测试环境数据库升级；仍需使用真实企业微信账号验证 `media/uploadimg` 图片上传，以及本地欢迎语模板新增/编辑/删除。
- 管理端通过真实权限账号验证菜单、上传、预览、启停和删除。
- 后续发送功能开发时，再验证 `welcome_code` 回调与单次发送时效；本期明确不覆盖。

## Test 部署记录（2026-08-13）

- Backend commit：`6028d195`；远端 Maven 打包成功，服务已启动。
- Admin commit：`b16da07a`；`pnpm build:dev` 成功，静态文件已发布。
- SQL：已执行 `backend/sql/upgrade-2026-08-13-wecom-welcome-template.sql`。
- 服务检查：`/actuator/health` 返回 `UP`，8888 端口监听正常。
- 数据检查：`mp_wecom_welcome_template` 已创建；原欢迎语菜单包含 5 条权限，修正迁移将清理旧“同步欢迎语”权限，保留 4 条业务权限。
- 回滚保护：旧 admin 静态目录保留在 test 服务器 `dist.backup.202608131334`；backend 旧 JAR 已按部署脚本备份。
