# 测试记录 — Adapay 分账结算

## 验证结果

| 验证项 | 命令 | 结果 |
|---|---|---|
| 后端全量编译 | `mvn clean compile -DskipTests` | ✅ BUILD SUCCESS |
| 后端 pay-biz 编译 | `mvn -pl yshop-module-pay/yshop-module-pay-biz -am compile -DskipTests` | ✅ BUILD SUCCESS |
| admin 生产构建 | `pnpm run build:prod` | ✅ Build successful |
| admin 类型检查 | `pnpm run ts:check` | ⚠️ 未执行（既有环境类型定义缺失，与本次变更无关） |

## 变更文件

### backend
- `yshop-module-pay/yshop-module-pay-api/src/main/java/co/yixiang/yshop/module/pay/enums/ErrorCodeConstants.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/service/profitrecipient/ProfitRecipientServiceImpl.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/convert/profitrecipient/ProfitRecipientConvert.java`
- `yshop-module-pay/yshop-module-pay-biz/src/main/java/co/yixiang/yshop/module/pay/controller/admin/profitrecipient/vo/ProfitRecipientMemberInfoVO.java`

### admin
- `src/api/mall/store/profitSharingReceiver/index.ts`
- `src/views/mall/store/profitSharingReceiver/ProfitSharingReceiverForm.vue`

## 注意事项

- 未新增单元测试；本次为企业 Member 字段对齐与前端表单扩展，建议后续补充 `ProfitRecipientServiceImpl` 企业字段校验与四图打包的单元测试。
- admin `ts:check` 为既有环境问题，未执行；生产构建通过。
- 企业 Member 创建时按 Adapay `/v1/corp_members` 要求传入完整字段，并将四张图片打包为 zip，中文文件名 UTF-8 URLEncode。
- 法人身份证正反面支持 OCR 自动识别并回填法人姓名、身份证号、身份证有效期。
- 原有省市编码、银行列表、计费规则、分账订单、日终 Job 等功能已在前期实现并合并到 master，本次未改动。
