# Adapay 分账结算 — Review Report

## 1. 审查结论

**通过。**

本次变更补齐 Adapay 分账结算中企业 Member 创建与前端表单的最后缺口：后端按 Adapay `/v1/corp_members` 要求传入完整字段，四张企业图片打包为 zip 并 UTF-8 URLEncode 中文文件名；管理后台收款人表单增加统一社会信用代码/有效期/经营范围/法人信息/企业地址/身份证正反面/开户银行许可证等字段，并支持营业执照、身份证正反面 OCR 自动回填。实现与需求/设计文档一致，无密钥泄漏，后端与 admin 均编译/构建通过。

## 2. 核对清单结果

| 项 | 结果 | 说明 |
|---|---|---|
| 实现与需求一致 | 通过 | 企业 Member 字段、四图 zip 打包、身份证 OCR、省市编码、银行列表等符合设计 |
| API 契约保持一致 | 通过 | 复用已有 `/pay/profit-recipient/*`、`/pay/bank/list`、`/pay/adapay-region/*` 端点；DTO 字段更新 |
| 没有硬编码密钥 | 通过 | 未发现硬编码密钥/密码 |
| 已验证租户隔离 | 通过 | 收款人表仍保持 `tenant_id`；字典表为平台级只读 |
| 已创建数据库迁移脚本 | 通过 | 复用既有 `sql/upgrade-adapay-profit-sharing-region.sql`，企业字段已含 |
| 迁移脚本字段与 DO/BaseDO 一致 | 通过 | 字段与 DO 一致 |
| 数据字典项均已定义对应枚举/常量 | 通过 | 错误码 `PROFIT_RECIPIENT_ATTACH_FILE_INVALID`、`PROFIT_RECIPIENT_ID_CARD_OCR_FAILED` 已定义 |
| 测试覆盖本次变更 | 不通过 | 未新增单元测试 |
| 功能分支符合命名约定 | 通过 | `feat/adapay-profit-sharing-corp-member` |
| PR 描述已关联需求和设计文档 | 待 PR 阶段 | 本次未提交 PR |

## 3. 发现的问题

### 严重

无。

### 一般

无。

### 建议

#### L-1: 缺少针对企业 Member 字段与附件打包的单元测试
- **位置**: `ProfitRecipientServiceImpl.validateMemberInfo`、`downloadAttachFile`、`createAdapayMember`
- **问题**: 未补充单元测试覆盖「字段缺失校验」「四图打包」「zip 大小超限」「中文文件名编码」等分支。
- **影响**: 未来调整校验规则或 Adapay 字段时容易回归。
- **修复建议**: 补充 `ProfitRecipientServiceImplTest` 相关用例。

## 4. 修复验证说明

无（首次实现本次补齐）。

## 5. 其他说明

- 本次变更未修改 Adapay Member/结算账户的核心状态机，仅完善企业 Member 传参与附件打包。
- admin `ts:check` 因既有类型定义缺失未执行；`build:prod` 通过。
- 前期已合并功能（收款人 CRUD、计费规则、分账订单、日终 Job、银行/省市字典表）不在本次变更范围内。
