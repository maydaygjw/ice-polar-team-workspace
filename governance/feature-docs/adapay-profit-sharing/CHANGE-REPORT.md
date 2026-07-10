# CHANGE-REPORT: Adapay 分账结算

## 1. 业务目标

补齐 Adapay 分账结算中企业 Member 创建与后台表单的最后缺口：
- 企业 Member 创建时按 Adapay `/v1/corp_members` 要求提供完整字段与 zip 附件；
- 法人身份证正反面支持 OCR 识别并自动回填姓名、身份证号、有效期；
- 管理后台分账收款人表单补充企业 Member 全部字段与身份证 OCR 上传组件。

## 2. 影响仓库和主要文件

| 仓库 | 主要文件 |
|---|---|
| `backend/` | `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/enums/ErrorCodeConstants.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitrecipient/ProfitRecipientServiceImpl.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/convert/profitrecipient/ProfitRecipientConvert.java` |
| | `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitrecipient/vo/ProfitRecipientMemberInfoVO.java` |
| `admin/` | `src/api/mall/store/profitSharingReceiver/index.ts` |
| | `src/views/mall/store/profitSharingReceiver/ProfitSharingReceiverForm.vue` |
| `governance/` | `feature-docs/adapay-profit-sharing/meta.yaml` |
| | `feature-docs/adapay-profit-sharing/test-notes.md` |
| | `feature-docs/adapay-profit-sharing/review-report.md` |

## 3. 契约变化摘要

### API

无新增端点。复用已有：

| 端点 | 方法 | 说明 | 权限 |
|---|---|---|---|
| `/pay/profit-recipient/create` | POST | 创建收款人 | `pay:profit-recipient:create` |
| `/pay/profit-recipient/update` | PUT | 更新收款人 | `pay:profit-recipient:update` |
| `/pay/profit-recipient/recognize-license` | POST | 营业执照 OCR | `pay:profit-recipient:create` |
| `/pay/profit-recipient/recognize-id-card` | POST | 身份证 OCR | `pay:profit-recipient:create` |

### DTO 变更

- `ProfitRecipientMemberInfoVO` 统一企业字段命名：`socialCreditCode`、`socialCreditCodeExpires`、`businessScope`、`legalPerson`、`legalCertId`、`legalCertIdExpires`、`legalMp`、`address`、`licensePhotoUrl`、`idCardFrontUrl`、`idCardBackUrl`、`bankLicensePhotoUrl`。
- `ProfitSharingReceiverMemberInfoVO` / `ProfitSharingReceiverSettleAccountSummaryVO`（admin TypeScript 接口）同步扩展。

### DB

复用既有 `yshop_adapay_profit_recipient` 企业 Member 字段，无新增迁移脚本。

### 错误码

- `PROFIT_RECIPIENT_ATTACH_FILE_INVALID`（1008009029）：企业 Member 附件不符合要求（如超过 9MB）。
- `PROFIT_RECIPIENT_ID_CARD_OCR_FAILED`（1008009037）：身份证 OCR 识别失败。

## 4. DB 迁移脚本名

无新增。复用既有迁移脚本。

## 5. 测试结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端全量编译 | `mvn clean compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 pay-biz 编译 | `mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile -DskipTests` | ✅ BUILD SUCCESS |
| admin 生产构建 | `pnpm run build:prod` | ✅ Build successful |
| admin 类型检查 | `pnpm run ts:check` | ⚠️ 未执行（既有环境问题） |
| 单元测试 | — | ⚠️ 未新增 |

## 6. 风险与注意事项

1. **测试覆盖不足**：企业 Member 字段校验与附件打包逻辑未补充单元测试，建议后续补充。
2. **Adapay 企业 Member 字段敏感**：`social_credit_code`、`legal_cert_id` 等字段通过服务端直传 Adapay，不在本地长期存储完整明文（仅保存快照用于展示/更换结算账户）。
3. **身份证 OCR 为辅助功能**：识别失败时允许手动填写，不影响正常提交。
4. **前期功能已合并**：省市编码、银行列表、计费规则、分账订单、日终 Job 等已在前序 PR 合并，不在本次变更范围内。

## 7. 建议 PR 标题和描述

**标题**: `feat(pay/admin): Adapay 分账企业 Member 字段对齐与身份证 OCR`

**描述**:

```
- 后端企业 Member 创建按 Adapay /v1/corp_members 要求传入完整字段
- 企业 Member 附件改为打包四张图片（三证合一/身份证正反面/开户银行许可证）
- zip 包内中文文件名按 UTF-8 URLEncode 编码，单包大小限制 9MB
- 新增身份证 OCR 接口 /pay/profit-recipient/recognize-id-card
- 管理后台收款人表单补充企业 Member 全部字段与身份证 OCR 自动回填
- 统一 ProfitRecipientMemberInfoVO 企业字段命名

关联文档：
- governance/feature-docs/adapay-profit-sharing/requirements-spec.md
- governance/feature-docs/adapay-profit-sharing/contract-changes.md
- governance/feature-docs/adapay-profit-sharing/technical-design.md
- governance/feature-docs/adapay-profit-sharing/ui-ux-design.md
- governance/feature-docs/adapay-profit-sharing/test-notes.md
- governance/feature-docs/adapay-profit-sharing/review-report.md
```

## 8. PR 链接

| 仓库 | PR |
|---|---|
| `backend` | [#45](https://gitee.com/icepolar/yshop-drink/pulls/45) |
| `admin` | [#23](https://gitee.com/icepolar/yshop-drink-vue/pulls/23) |
