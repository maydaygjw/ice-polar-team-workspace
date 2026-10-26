---
url: "https://pay.weixin.qq.com/doc/v3/partner/4012365872.md"
title: "报错：Http头Authorization值格式错误，请参考《微信支付商户REST API签名规则》或者“Authorization不合法”"
doc_id: 4012365872
api_version: "apiv3"
url_display: "https://pay.weixin.qq.com/doc/v3/partner/4012365872"
title_display: "APIv3/合作伙伴/通用规则/开发须知/常见问题/报错：Http头Authorization值格式错误，请参考《微信支付商户REST API签名规则》或者“Authorization不合法”"
---

>更新时间：2026.01.23

请参考操作指引-如何生成请求签名的设置http头章节，一步步按照示例操作一遍，

以下是一个Http头Authorization值的示例（因为长度原因，展示起来可能看起来像换行，实际上Authorization值是在一行）

```
Authorization: WECHATPAY2-SHA256-RSA2048 mchid="123456789",nonce_str="593BEC0C930BF1AFEB40B4A08C8FB242",signature="gZGkLF3mVIHY72hE1cFSrbEOKr5O7N2jYZAt5VSBpZpHn84HWylnljJHGGlMAtFt4AUP/gso9MyQ95GNb9h9DYI3RmwQe2kvcysVKoYvzgst217AzZYYwHaUnanaEFEuKD33L84JPe/HX1CLs4VjcE16aZfORqHanlgPivirKg/SysHWtlHVU5zYiWsfXU3ylgWXqjj4hHRgKiJ1KbPzMqS0izDfnEBfTWp7GQddnxVOcbCGfk6jQECNu5GX9hFoxL2oCv5iHUg5Vka0/rKs9wjlRLmDPyObMpJUYQ2/a7HcNnzFxxC+JJa+PAjLWT/nkEMdTMotHFwQN05TWB0M9A==%",timestamp="1554208460",serial_no="1DDE55AD98ED71D6EDD4A4A16996DE7B47773A8C"
```

（1）请确认Authorization值是在一行，红框的位置是一个空格而非换行符

![](https://gtimg.wechatpay.cn/resource/xres/mmpaydoc/static/img/e4e18c81a9983cb291bd5f37459a5456.png)

（2）请确认认证类型为WECHATPAY2-SHA256-RSA2048

（3）确认包含了mchid（商户号）、nonce\_str（随机字符串）、serial\_no（商户API证书序列号）、timestamp（时间戳）、signature（签名值）参数，且这些参数和计算签名的参数值保持一致

（4）Authorization里的参数是双引号，不是单引号。 nonce\_str="593BEC0C930BF1AFEB40B4A08C8FB242"而不是nonce\_str='593BEC0C930BF1AFEB40B4A08C8FB242'

（5）Http头Authorization值都是英文下的符号，而不能是中文符号，参数之间也不要有空格