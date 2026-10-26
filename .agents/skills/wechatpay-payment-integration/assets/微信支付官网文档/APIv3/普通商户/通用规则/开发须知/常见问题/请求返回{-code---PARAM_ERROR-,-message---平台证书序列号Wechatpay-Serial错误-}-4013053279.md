---
url: "https://pay.weixin.qq.com/doc/v3/merchant/4013053279.md"
title: "请求返回{\"code\":\"PARAM_ERROR\",\"message\":\"平台证书序列号Wechatpay-Serial错误\"}"
doc_id: 4013053279
api_version: "apiv3"
url_display: "https://pay.weixin.qq.com/doc/v3/merchant/4013053279"
title_display: "APIv3/普通商户/通用规则/开发须知/常见问题/请求返回{-code---PARAM_ERROR-,-message---平台证书序列号Wechatpay-Serial错误-}"
---

>更新时间：2024.11.19

这个错误出现在上送参数需要敏感信息加密的接口中。请参考申明加密使用的平台证书

当证书序列号错误或者不是请求商户号对应的平台证书时，微信支付会返回问题中的错误提示。请检查：

- 加密使用的证书是否是微信支付平台证书。有时会误用商户证书导致该错误。

- 是否是请求商户对应的微信支付平台证书，如用了其他商户号的平台证书。

- 证书是否过期。请按照指引检查证书是否过期，并更新并部署新证书。