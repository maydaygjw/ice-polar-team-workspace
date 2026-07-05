# Backlog Item: 支付商户配置字段映射修正

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-002 |
| Title | 支付商户配置字段映射修正 |
| Status | `draft` |
| Priority | `P1` |
| Created | 2026-07-05 |
| Author | gejunwen |
| Tags | pay, admin, merchant-details, wx-v3 |

## Problem / Need

`admin/src/views/pay/merchantDetails/MerchantDetailsForm.vue` 中多个字段的 label 与后端实际语义不符，导致运营配置时频繁困惑：

- `key_private` 在微信 V3 下应填 APIv3 密钥，页面却标注为"私钥或私钥证书"
- `key_cert` 在微信 V3 下应填 p12 证书文件路径，页面仅标注为"key证书"
- `private_key` 是项目自定义的转账私钥路径，页面标注为"微信商户API私钥"，易与签名私钥混淆
- `wechat_pay_public_key_id` / `wechat_pay_public_key` 与 `key_public_id` / `key_public` 功能重复
- `subMchId` 表单项的 `prop` 实际绑定的是 `privateKey`
- `subAppId`、`inputCharset` 在前端表单中完全缺失

## Context

### 1.  egzosn pay 微信 V3 的字段转换

 egzosn pay 在 `WxV3PaymentPlatform.getPayService()` 中创建新的 `WxPayConfigStorage` 时，对 `CommonPaymentPlatformMerchantDetails` 的字段做了重新映射：

```java
configStorage.setV3ApiKey(payConfigStorage.getKeyPrivate());  // key_private → APIv3 密钥
configStorage.setApiClientKeyP12(merchantDetails.getKeyCertInputStream());  // key_cert → p12 证书
```

因此微信 V3 的真实逻辑是：

| 数据库字段 | 真实用途 |
|-----------|---------|
| `key_private` | **APIv3 密钥**，用于解密回调通知 |
| `key_public` | **微信支付平台公钥**，用于回调验签 |
| `key_public_id` | 微信支付平台公钥 ID |
| `key_cert` | **商户 API 证书（p12 文件路径）**，用于加载请求签名私钥 |
| `key_cert_pwd` | 微信 V3 未使用，p12 密码实际为 `mch_id` |
| `cert_store_type` | 被强制覆盖为 `INPUT_STREAM`，前端选择不影响行为 |
| `private_key` | 项目自定义字段，仅 `TransferToUserService` 转账到零钱时使用 |
| `certificate_serial_no` | 商户 API 证书序列号 |
| `wechat_pay_public_key` / `wechat_pay_public_key_id` | 与 `key_public` / `key_public_id` 重复 |

### 2. 为什么当前配置能跑通

test 环境 `wx_miniapp154` 的 `key_private` 填的是 32 位 APIv3 密钥字符串，支付仍然成功，原因是：

1. 支付请求签名私钥来自 `key_cert` 指向的 `.p12` 文件，不是 `key_private`
2. `key_private` 作为 `v3ApiKey` 用于解密微信回调通知
3. 回调通知能正常解密，订单状态才能更新为已支付

如果 `key_private` 填错或为空，支付下单可能成功，但回调解密失败会导致订单状态无法更新。

### 3. 当前实际配置示例

```sql
SELECT details_id, key_private, key_public, key_cert, private_key, certificate_serial_no
FROM merchant_details WHERE details_id = 'wx_miniapp154';
```

结果：

- `key_private`：`ml83Idhmuk57dsMAdnPqdomw1bgTNTlr`（APIv3 密钥）
- `key_public`：`MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA...`（平台公钥内容）
- `key_cert`：`/opt/holun/holun-cert/xdl-1657396792/apiclient_cert.p12`（p12 证书路径）
- `private_key`：`/opt/holun/holun-cert/xdl-1657396792/apiclient_key.pem`（转账私钥路径）
- `certificate_serial_no`：`2641DA84559A354A2F1A21ADC4AD76325381258E`

### 4. 渠道差异

- **微信 V3**：`key_private` = APIv3 密钥，`key_cert` = p12 证书路径
- **支付宝**：`key_private` = 应用私钥，`key_public` = 支付宝公钥，`cert_store_type` 决定是路径还是内容

当前表单没有区分渠道，统一用一套 label，加剧了混淆。

## Acceptance Criteria

- [ ] 微信 V3 下 `keyPrivate` label 改为"APIv3密钥"，placeholder 说明用于解密回调
- [ ] 微信 V3 下 `keyCert` label 改为"商户API证书(p12路径)"，placeholder 说明填服务器绝对路径
- [ ] 微信 V3 下 `keyPublic` label 改为"微信支付平台公钥"
- [ ] 删除或隐藏 `wechatPayPublicKeyId`、`wechatPayPublicKey` 重复字段
- [ ] 微信 V3 下隐藏 `keyCertPwd`、`certStoreType`、`returnUrl`、`signType`、`seller`
- [ ] 修复 `subMchId` 表单项 `prop` 绑定 `privateKey` 的错位问题
- [ ] 补齐 `subAppId`、`inputCharset` 输入框，或从后端 VO/DO/数据库中移除
- [ ] `isTest` 前端类型改为 `number`，与后端 `Integer` 保持一致
- [ ] （可选）根据 `payType` 动态切换表单字段和 label，同时兼容微信 V3 与支付宝
