# 测试笔记 — Adapay 分账结算

## 变更范围

本次变更为 Phase 3 实现后的文档对齐修复，涉及 5 个规则调整：

| # | 变更 | 影响端 |
|---|------|--------|
| 1 | MemberId 编码规则 `m_{租户Id}_{memberType}_{IdCard}_{storeId\|0}` | backend |
| 2 | 结算账户可通过“更换结算账户”修改（含远程 Adapay 银行卡信息） | backend + admin |
| 3 | 店铺级收款人无需角色 | backend + admin |
| 4 | 店铺只能选绑定本店铺的收款人 | backend + admin |
| 5 | 银行选项从 Adapay 银行列表加载，带出编码 | admin |

## 构建验证

| 验证 | 结果 |
|------|------|
| `mvn compile` (pay-biz, pay-api) | ✅ 通过 |
| `pnpm build:dev` (admin) | ✅ 通过 |
| `mvn test` (pay module) | ✅ 编译通过 |

> 注意：`yshop-spring-boot-starter-web` 模块的 `DesensitizeTest` 存在预存失败（期望中文脱敏但得到英文），与本次变更无关。

## 后端变更点测试建议

### 1. MemberId 编码与 Member 复用

- **创建平台级个人收款人**：验证 `member_id` = `m_{tenantId}_1_{idCard}_0`
- **创建店铺级企业收款人**：验证 `member_id` = `m_{tenantId}_2_{businessLicenseNo}_{shopId}`
- **同店铺同身份证号重复创建**：应返回 `PROFIT_RECIPIENT_MEMBER_ID_DUPLICATE`
- **Adapay 侧已存在 Member（本地无记录）**：创建时应复用该 Member，查询并删除其下所有结算账户，再绑定新账户；本地记录成功写入
- **Adapay 侧已存在 Member 且无结算账户**：直接复用 Member 并绑定新账户
- **Adapay 侧已存在 Member 但结算账户删除失败**：整体创建失败，本地不写入
- **Adapay Member 查询失败**：应返回 `PROFIT_RECIPIENT_MEMBER_QUERY_FAILED`

### 2. 结算账户更换

- **编辑收款人-不更换银行卡**：不传 `settleAccount`，基础信息可保存，原结算账户保持不变
- **编辑收款人-更换银行卡**：显式传入完整新 `settleAccount`，Adapay 同步更新绑定
- **编辑收款人-更换银行卡失败**：Adapay 返回失败时，原结算账户保持有效，基础信息不产生部分保存
- **编辑收款人-空卡号**：若选择更换结算账户，应按必填校验拦截；未选择更换时不应传 `settleAccount`

### 3. 店铺级无角色

- **创建平台级收款人不传 role**：应返回 `PROFIT_RECIPIENT_ROLE_REQUIRED`
- **创建店铺级收款人传 role**：`role` 应被忽略/不校验
- **平台级收款人 role 不可变更**：编辑时修改 role 应报错
- **店铺级收款人编辑时传 role**：应忽略（店铺级不校验 role 变更）

### 4. 店铺收款人列表

- **`list-by-shop?shopId=1`**：仅返回 `recipientType=2` 且 `shopId=1` 的已启用记录
- **平台级收款人不再出现在店铺可选列表中**

## 前端变更点测试建议

### 1. 角色字段条件显示

- **选择平台级**：角色下拉显示
- **选择店铺级**：角色下拉隐藏
- **提交店铺级**：请求体中不包含 `role`

### 2. 银行下拉

- **打开创建表单**：银行下拉加载 `/bank-list.json`
- **搜索银行**：输入银行名称可模糊搜索
- **选择银行**：`settleAccount.bankCode` 为选中银行的编码
- **列表加载失败**：银行下拉为空，不影响其他表单功能

### 3. 结算账户在编辑模式下可更换

- **编辑收款人**：结算账户绑定状态可见，可展示脱敏摘要，不展示完整旧卡号
- **不更换账户提交**：无需填写银行卡号/开户名/银行，也可保存基础信息
- **点击更换结算账户**：展开银行卡表单，银行卡号/开户名/银行/账户类型必填
- **提交更换**：修改银行卡号/银行后，后端同步更新；失败时提示错误并保留原绑定

## 回归风险

| 风险项 | 级别 | 说明 |
|--------|------|------|
| 已有收款人数据 member_id 格式不一致 | 低 | 本次为首次实现，无历史数据 |
| Adapay 银行列表过大影响前端性能 | 低 | 使用 `el-select` + `filterable` 懒加载，首屏不阻塞 |
| list-by-shop 返回结果变更影响店铺配置 | 低 | 原查询返回平台级+店铺级，现仅返回店铺级；ShopForm 已适配 |

## 未覆盖项

- 无自动化单元测试（本次变更未新增测试类）
- 无 E2E 测试（需 Admin Dashboard + 后端服务环境）
- Adapay API 集成测试（需沙箱环境）
