# 契约变更：企业微信客户管理员姓名同步

## 客户管理员接口

现有接口路径、权限和请求参数保持不变：

- `GET /admin-api/mp/wecom-customer-admin/page`
- `GET /admin-api/mp/wecom-customer-admin/simple-list`
- `POST /admin-api/mp/wecom-customer-admin/sync`

分页和选择器响应新增 `enabled` 字段；同步接口返回值不变。

响应字段 `displayName` 的语义明确为企业微信通讯录成员姓名；无法读取姓名时使用成员 `userid`。同步时刷新已存在成员的姓名和权限范围状态。`userid` 仍作为稳定的成员标识。

## 外部系统

同步通过企业微信客户联系凭证获取客户联系成员列表，并尝试读取成员姓名。成员信息不可读或姓名为空时，使用 `userid` 兜底；不影响成员同步。

## 兼容性

客户管理员响应新增 `enabled` 布尔字段，已有记录通过数据库默认值保持启用。新增 `PUT /admin-api/mp/wecom-customer-admin/update-enabled?id={id}&enabled={enabled}`，使用 `mp:wecom-customer-admin:update` 权限。

客户管理员选择器只返回启用状态的成员；管理分页仍展示已停用成员，以便恢复启用。所有客户管理员选择项显示“姓名（UserID）”。后台首次加载时默认选择第一个企业微信配置。

数据库新增 `mp_wecom_customer_admin.enabled`，默认 `1`，Flyway 迁移脚本：`backend/sql/migrations/V2026102101__wecom_customer_admin_enabled.sql`。
