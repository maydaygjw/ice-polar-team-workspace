# E2E 测试计划：Adapay 分账结算

## 环境前置条件

| 条件 | 说明 |
|------|------|
| 管理后台 | `https://yshop-admin.holuntech.com/`（默认 baseURL，可通过 `E2E_BASE_URL` 覆盖） |
| 测试账号 | `E2E_TENANT` / `E2E_USERNAME` / `E2E_PASSWORD` 环境变量（默认 `HolunEase`） |
| Adapay 沙箱 | 需支持 Member 创建、结算账户绑定、更换结算账户 |
| 测试店铺 | 需存在至少一个店铺，用于店铺级收款人和绑定测试 |
| 权限 | 测试账号需具备 `pay:profit-recipient:*`、`pay:profit-sharing:query`、`store:shop:update` 权限 |
| 浏览器 | Chromium，zh-CN locale，Asia/Shanghai timezone |

## 用例清单

### 收款人管理

| 编号 | 用例名称 | 文件 | 状态 |
|------|----------|------|------|
| PS-R-01 | 新增平台级个人分账收款人 | `profit-sharing-receiver.spec.ts` | ✅ 已实现 |
| PS-R-02 | 新增店铺级个人分账收款人 | `profit-sharing-receiver.spec.ts` | ✅ 已实现 |
| PS-R-03 | 编辑收款人基本信息和状态 | `profit-sharing-receiver.spec.ts` | ✅ 已实现 |
| PS-R-04 | 编辑收款人并更换结算账户 | `profit-sharing-receiver.spec.ts` | ✅ 已实现 |
| PS-R-05 | 删除未绑定的收款人 | `profit-sharing-receiver.spec.ts` | ✅ 已实现 |
| PS-R-06 | 删除收款人时同步删除 Adapay 结算账户 | 后端 `ProfitRecipientServiceImpl` | ✅ 已实现 |

### 店铺分账绑定

| 编号 | 用例名称 | 文件 | 状态 |
|------|----------|------|------|
| PS-S-01 | 店铺绑定分账收款人并启用分账 | `shop-profit-sharing-binding.spec.ts` | ✅ 已实现 |
| PS-S-02 | 店铺解绑分账收款人 | `shop-profit-sharing-binding.spec.ts` | ✅ 已实现 |

### 分账记录

| 编号 | 用例名称 | 文件 | 状态 |
|------|----------|------|------|
| PS-Q-01 | 查看分账结算记录列表 | `profit-sharing-record.spec.ts` | ✅ 已实现 |

### 不列入的用例

| 场景 | 原因 |
|------|------|
| 企业收款人创建 | 需企业营业执照等 KYC 资料，Adapay 沙箱可能不支持 |
| 支付链路分账触发 (UC-3) | 涉及微信小程序支付，Playwright 无法自动化 |
| 日终自动结算 (UC-4) | 后端定时任务，非 UI 驱动 |
| 重试失败分账 (UC-5 retry) | 需要存在真实失败分账记录，数据不可控 |
| 绑定后删除收款人 | 后端拒绝（`PROFIT_RECIPIENT_BOUND`），属于后端校验逻辑 |
| 直接断言 Adapay 结算账户已删除 | E2E 仅通过管理后台 UI 验证，Adapay 侧清理由后端同步完成；可补充后端单元测试覆盖 Adapay 异常分支 |
