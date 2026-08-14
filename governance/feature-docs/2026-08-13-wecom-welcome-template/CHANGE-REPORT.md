# Change Report

## Changed repositories

- `backend`：扩展企业微信欢迎语模板附件模型、默认小程序账户接口、小程序封面发送时上传分支、错误码、单元测试和数据库增量脚本。
- `admin`：扩展欢迎语模板 API、列表页和表单；支持文字+图片或文字+小程序、默认小程序账户、path、封面预览、启停和删除。
- `governance`：新增需求、技术设计、契约、UI、测试和审查文档。

## Not included

- 不调用入群欢迎语素材管理接口；小程序附件仅用于客户添加外部联系人欢迎语。
- 本次未执行测试环境数据库升级，待合并后执行 `backend/sql/upgrade-2026-08-14-wecom-welcome-template-mini-program.sql`。

## Verification

- Backend compile：passed。
- Backend targeted unit tests：passed, 9 tests。
- Admin production build：passed。
- Admin full type check：blocked by pre-existing repository-wide generated auto-import/type declaration errors；本次欢迎语文件过滤检查通过。

## Test deployment

- 本次实现尚未部署 test，也未执行增量 SQL；部署与真实企业微信验证在合并后进行。
