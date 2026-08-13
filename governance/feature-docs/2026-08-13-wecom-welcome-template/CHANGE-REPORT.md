# Change Report

## Changed repositories

- `backend`：新增企业微信欢迎语模板 DO、Mapper、Service、Controller、企业微信图片/模板 API 调用、错误码、单元测试和数据库/菜单升级脚本。
- `admin`：新增欢迎语模板 API、列表页和表单；支持按企业微信配置/商圈管理文字与图片、预览、启停和删除。
- `governance`：新增需求、技术设计、契约、UI、测试和审查文档。

## Not included

- 不处理企业微信客户添加回调中的 `WelcomeCode`。
- 不调用 `/cgi-bin/externalcontact/send_welcome_msg`，不向客户自动发送欢迎语。
- 实现阶段未执行测试环境数据库升级；本次已按用户授权部署到 test 并执行数据库升级脚本。

## Verification

- Backend compile：passed。
- Backend targeted unit tests：passed, 3 tests。
- Admin build：passed。
- Admin full type check：blocked by pre-existing repository-wide generated auto-import/type declaration errors；本次文件未产生额外业务类型错误。

## Test deployment

- Backend：test 已快进到 `6028d195`，重新构建并启动 `yshop-server.jar`。
- Admin：test 已替换为 `admin` merged master 的 `pnpm build:dev` 构建产物。
- Database：已执行 `backend/sql/upgrade-2026-08-13-wecom-welcome-template.sql`。
- Runtime：`/actuator/health` 返回 `{"status":"UP"}`，8888 端口监听正常。
- Database verification：欢迎语模板表存在；欢迎语管理菜单 1 条、权限 4 条；旧“同步欢迎语”菜单待修正迁移清理。
