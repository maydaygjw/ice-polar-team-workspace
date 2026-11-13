# 第三方 OpenAPI 用户转账

## API

- `POST /open-api/v1/payments/transfers`，需要 OpenAPI `payment` scope。
- 请求 JSON：`openid`（微信用户 OpenID）、`openidType`（`MINIAPP` 小程序或 `MP` 公众号，缺省为 `MINIAPP`）、`amount`（人民币分的正整数）、`outBillNo`（`[A-Za-z0-9_-]{1,32}`，当前租户内唯一）及可选 `remark`。
- 后端要求该类型的 OpenID 匹配当前租户会员，再关联会员 ID 写入转账记录；不要求调用方传会员 ID。
- 后端根据 `openidType` 使用当前租户微信小程序或公众号商户配置调用 APIv3 商家转账，并写入统一用户转账记录，类型为 `MEMBER_MANUAL`。响应包含商户单号、微信转账单号、状态及 `packageInfo`。
- 网络异常导致结果未知时，调用方必须复用相同 `outBillNo` 重试；不得生成新单号。接口受理不等于款项到账，后续状态通过现有查单、回调流程更新。
- 转账记录按当前租户隔离；不接受客户端传入商户号、支付配置 ID、租户 ID 或渠道密钥。
- 转账记录保存 OpenID 类型；后台和小程序的转账记录响应包含 `openidType`，后续查单、撤销及收款确认所需 AppID 使用同一微信应用配置。
