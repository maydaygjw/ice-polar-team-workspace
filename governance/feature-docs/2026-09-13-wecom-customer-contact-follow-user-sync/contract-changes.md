# 企业微信客户联系人按客户员同步契约

## 变更范围

- `POST /admin-api/mp/wecom-customer-contact/sync` 新增可选查询参数 `followUserId`。
- `accountId` 保持必填；未传 `followUserId` 时同步当前企业微信配置权限范围内的全部客户员联系人。
- 传入 `followUserId` 时，仅同步该客户员负责的联系人；后端校验该 UserID 属于当前配置且处于当前权限范围。
- 管理端客户联系人页面提供客户员选择器，默认“全部客户员”。

## 兼容性

- 原有只传 `accountId` 的调用方式保持兼容。
- 不涉及 miniapp，不新增数据库字段。
