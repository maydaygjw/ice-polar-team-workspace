# 验证记录

## 已完成

- 后端客户联系人、跟进成员关系、分页/详情/同步接口已实现。
- 后端新增按 unionid 批量查询会员的 `member-api` 能力，验证 member-biz 与 mp-biz 可正常编译。
- 管理端客户联系人列表、筛选、手动同步、详情抽屉已实现。
- 管理端新增页面使用动态菜单配置，数据库升级脚本包含菜单和权限。
- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests package`：通过。
- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am test`：通过（2 个 mp 模块测试通过，依赖模块测试也通过）。
- `mvn -pl yshop-module-member/yshop-module-member-biz -am -DskipTests package`：通过。
- `mvn -pl yshop-server -am -DskipTests package`：Maven reactor 与 yshop-server 打包通过。
- `pnpm build:test`：通过。
- 新增前端文件 Prettier 检查：通过。

## 环境阻断

- `pnpm ts:check` 未能启动类型检查，当前环境缺少既有类型包：
  `@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`。

## 待业务验证

1. 为租户配置已开通客户联系权限的企业微信账号，并确认开放平台关联后，点击“同步联系人”。
2. 核对联系人数量、unionid 脱敏展示、会员匹配状态、跟进成员及重复同步更新结果。
3. 用无客户联系权限的账号验证失败提示和失败明细。

## Test 环境部署（2026-08-01）

- 数据库升级脚本已执行；联系人、跟进关系表和查询/同步权限已验证存在。
- 后端使用本地完整构建 JAR 发布，测试环境 8888 端口恢复监听。
- 管理端使用 `pnpm build:dev` 构建并整体替换静态资源，测试域名返回 HTTP 200。
- Nginx 状态为 active；远端联系人页面资源与本地构建产物 SHA-256 一致。
- 已保留发布前后端备份，可用于回滚。
- 只读 API 烟测已通过认证和权限校验；自动化测试租户未配置企业微信账号，因此未执行真实联系人同步。

## 客户联系人发送消息增量（2026-08-01）

- 新增 `POST /admin-api/mp/wecom-customer-contact/send-message`，权限为 `mp:wecom-customer-contact:send`。
- 后端通过 `external_userid` 和已同步的跟进成员 `userid` 调用企业微信客户群发文本接口；不使用 UnionID 作为发送目标。
- 管理端联系人详情增加发送消息入口，支持选择跟进成员和 2000 字符以内文本，并明确提示员工需在企业微信确认发送。
- `mvn -pl yshop-module-mp/yshop-module-mp-biz -am -DskipTests package`：通过。
- `mvn -pl yshop-server -am package -DskipTests`：通过，生成 `backend/yshop-server/target/yshop-server.jar`。
- `pnpm exec prettier --check`（新增 API/详情抽屉）：通过。
- 新增文件 ESLint：通过。
- `pnpm build:test`：通过。
- `pnpm ts:check`：受仓库原有缺失类型声明阻断（`@intlify/unplugin-vue-i18n/types`、`@types/qrcode`、`element-plus/global`、`vite-plugin-svg-icons/client`）。
- 尚未部署测试环境，也未执行真实企业微信发送，避免产生真实客户消息。
