# 第三方支付 OpenAPI 端到端测试计划

## 环境

- 隔离测试租户，使用微信支付沙箱或可控的支付渠道测试配置。
- 配置一组 `client_credentials` OAuth2 客户端、租户支付配置中启用 OpenAPI 和 `payment` scope。
- 准备微信 JSAPI OpenID、Adapay 测试配置及可接收 HTTP/HTTPS Webhook 的测试服务，并记录原始 JSON 请求体。
- 分别使用 `payType=weixin` 和 `payType=adapay` 创建支付单，验证渠道数据、回调更新、查单和全额退款终态。
- 配置微信商家转账能力、租户小程序 AppID、已报备转账场景和可接收 Webhook 的测试服务。

## 场景

1. 请求有效 token；分别验证未登记 scope、客户端未启用、错误 secret 和不支持的 grant type 均被拒绝。
2. 使用匹配 AppID 的 OpenID 创建支付；相同订单与幂等键重试返回原支付单，篡改金额或使用不同幂等键产生冲突。
3. 完成支付后验证微信回调只更新 OpenAPI 支付记录，不触发商城履约；重复回调只产生一条 `payment.succeeded` 事件。
4. 查询支付单及第三方订单号；验证其他客户端即使知道 `paymentId` 也无法读取。
5. 申请全额退款并验证异步退款终态、相同幂等键重试及重复退款保护。
6. 验证 Webhook 明文投递、事件 ID 去重、2xx 确认、超时/非 2xx 退避重试和管理端失败事件重放。
7. 停用客户端后验证新支付请求被拒绝；已受理支付仍完成状态处理和已配置通知投递。
8. 对回调 URL 测试 HTTP、私网/环回地址、DNS 私网解析和 3xx 重定向，确认均不会转发内部请求。
9. 验证有 `payment` scope 的客户端可向当前租户内存在 `routineOpenid` 的会员发起转账并取得 `packageInfo`；缺少该 scope 的客户端请求被拒绝。
10. 使用同一 clientOrderNo/幂等键重复提交相同内容，确认复用原微信商户单号；修改 userId、金额或备注时返回冲突且不产生第二笔转账。
11. 模拟微信转账结果未知、重复请求、待用户确认及 `MCHTRANSFER.BILL.FINISHED` 重复通知；确认状态更新幂等、未知结果复用原商户单号、终态 Webhook 仅创建一次。
12. 验证缺少转账配置/场景报备、会员跨租户或没有 `routineOpenid`、OpenAPI 开关关闭时拒绝发起；日志和 OpenAPI 关联记录不含完整 OpenID 或支付密钥。

## 通过标准

- 支付/退款金额、商户配置、scope、客户端和租户归属均与测试数据一致。
- 重复请求、重复支付通知和 Webhook 重试均不形成重复交易或重复状态事件。
- 所有失败场景不泄露商户密钥、客户端密钥、访问令牌或完整 OpenID。
- 转账和其他支付 API 统一由 `payment` scope 授权；用户确认前状态不表示到账成功，终态以微信已验签通知或平台查单为准。
