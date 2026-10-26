---
url: "https://pay.weixin.qq.com/doc/v3/partner/4012365874.md"
title: "报错：HTTP header缺少微信支付平台证书序列号(Wechatpay-Serial)"
doc_id: 4012365874
api_version: "apiv3"
url_display: "https://pay.weixin.qq.com/doc/v3/partner/4012365874"
title_display: "APIv3/合作伙伴/通用规则/开发须知/常见问题/报错：HTTP header缺少微信支付平台证书序列号(Wechatpay-Serial)"
---

>更新时间：2024.11.19

在敏感字段加解密的场景，商户需要在发起请求的HTTP头部中通过Wechatpay-Serial添上平台证书（wechatpay.pem）的序列号请注意这里是平台证书序列号（平台证书总是以wechatpay.pem命名），而不是商户API证书序列号（商户API证书总是以apiclient\_cert.pem命名），以声明加密所用的平台证书。如何获取平台证书请参考[平台证书简介及使用说明](https://pay.weixin.qq.com/doc/v3/merchant/4012068814.md)，如何获取证书序列号参考第二部分

例如

```
curl -X POST \
  https://api.mch.weixin.qq.com/v3/pay/transactions/out-trade-no/1217752501201407033233368018/close \
  -H "Authorization: WECHATPAY2-SHA256-RSA2048 mchid=\"1900000001\",..." \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Wechatpay-Serial: 4DF076AC5A7D968D4A8B0B9C599A74CB4CF8EE8A" \
  -d '{
    "mchid" : "1230000109"
  }'
```

如何获取证书序列号，参考以下步骤

可以用openssl命令行工具查看平台证书序列号

```
$ openssl x509 -in wechatpay.pem -noout -serial
```

你会得到平台证书序列号

```
Wechatpay-Serial: 4DF076AC5A7D968D4A8B0B9C599A74CB4CF8EE8A
```