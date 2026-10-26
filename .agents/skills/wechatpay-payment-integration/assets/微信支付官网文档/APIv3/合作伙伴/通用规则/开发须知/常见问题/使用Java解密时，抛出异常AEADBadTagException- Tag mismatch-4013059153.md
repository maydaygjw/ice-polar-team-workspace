---
url: "https://pay.weixin.qq.com/doc/v3/partner/4013059153.md"
title: "使用Java解密时，抛出异常AEADBadTagException: Tag mismatch"
doc_id: 4013059153
api_version: "apiv3"
url_display: "https://pay.weixin.qq.com/doc/v3/partner/4013059153"
title_display: "APIv3/合作伙伴/通用规则/开发须知/常见问题/使用Java解密时，抛出异常AEADBadTagException- Tag mismatch"
---

>更新时间：2024.11.20

加密使用的AES-GCM包含了Galois Message Authentication Code (GMAC)的消息认证机制。解密时会对数据的完整性进行校验。出现tag mismatch异常，表示解密时的消息认证失败。通常有三种可能：

- 使用了错误的API v3密钥，如使用了其他商户号的密钥，或者使用了APIv2的APIKey。

- 密文不正确。请检查提交解密的密文和收到的密文。注意报文中的密文经过了Base64编码。

- 解密时接口遗漏传入附加数据（associated\_data）。


开发者可以参考我们的示例代码 。