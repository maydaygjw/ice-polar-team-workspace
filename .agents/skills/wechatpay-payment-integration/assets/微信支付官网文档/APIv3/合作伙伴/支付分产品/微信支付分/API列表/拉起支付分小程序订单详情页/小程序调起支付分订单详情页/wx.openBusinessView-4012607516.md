---
url: "https://pay.weixin.qq.com/doc/v3/partner/4012607516.md"
title: "wx.openBusinessView"
doc_id: 4012607516
api_version: "apiv3"
product: "微信支付分"
url_display: "https://pay.weixin.qq.com/doc/v3/partner/4012607516"
title_display: "APIv3/合作伙伴/支付分产品/微信支付分/API列表/拉起支付分小程序订单详情页/小程序调起支付分订单详情页/wx.openBusinessView"
---

>更新时间：2024.12.05

商户使用微信支付提供的小程序方法调起微信支付分小程序，引导用户查看订单（小程序端）



## 接口说明

支持商户： 【普通服务商】

商户小程序跳转微信侧小程序建议使用方式：调用wx.openBusinessView，不占用小程序跳转其他小程序的数量名额

兼容性表现说明

- 小程序版本库 >= 2.6.0，低版本需提示用户升级微信版本。

- iOS兼容性表现：若微信版本>=7.0.3，开发者可以通过此openSDK接口跳转到微信支付分小程序；若微信版本< 7.0.3，开发者通过此openSDK接口可以跳转到微信，但不能跳转到微信支付分小程序，此时微信会提示用户可能由于应用的请求非法或者微信版本过低。

- Android兼容性表现：若微信版本>=7.0.3，开发者可以通过此openSDK接口跳转到微信支付分小程序；若微信版本< 7.0.3，开发者通过此openSDK接口不能跳转到微信，此时开发者应提示用户更新微信版本。


接口名称: wx.openBusinessView

### 字段说明

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
| --- |  --- | --- | --- |
| businessType | string(32) | true | 固定配置：wxpayScoreDetail。 |
| extraData | Object | true | 需要传递给支付分的业务数据。 |
| extraData.mch_id | string(32) | true | 【服务商商户号】调用支付分创单接口提交的商户号，商户号需开通支付分产品权限，且与appid有绑定关系，详见 [服务商商户号与AppID账号关联管理](https://kf.qq.com/faq/200520fueQrI200520aQf6Rr.html)。 |
| extraData.service_id | string(32) | true | 【服务ID】商户支付分服务的唯一标识，由32位数字组成。支付分产品权限审核通过后，微信支付运营会向商户提供该ID。 |
| extraData.out_order_no | string(32) | true | 【商户服务订单号】 商户系统内部服务订单号，要求32个字符内，只能是数字、大小写字母\_-&#124;\* 且在同一个商户号下唯一。需要开发者特别注意，该参数不可用于申请退款接口中的 out\_trade\_no 参数。 |
| extraData.timestamp | string(32) | true | 【时间戳】标准北京时间，时区为东八区，自1970年1月1日 0点0分0秒以来的秒数。注意：部分系统取到的值为毫秒级，需要转换成秒(10位数字)。 |
| extraData.nonce_str | string(32) | true | 【随机串】生成签名随机串。由数字、大小写字母组成，长度不超过32位。 |
| extraData.sign_type | string(32) | true | 【签名类型】仅支持HMAC-SHA256。 |
| extraData.sign | string(64) | true | 【签名值】使用字段mch\_id、service\_id、out\_order\_no、timestamp、nonce\_str、sign\_type按照 [签名生成算法](https://pay.weixin.qq.com/doc/v2/partner/4011985884.md) 计算得出的签名值。<br>注意：该接口签名需使用APIv2密钥 |

wx.openBusinessView 请求示例

```
if (wx.openBusinessView) {
  wx.openBusinessView({
    businessType: 'wxpayScoreDetail',
    extraData: {
      mch_id: '1230000109',
      service_id: '88888888000011',
      out_order_no: '1234323JKHDFE1243252',
      timestamp: '1530097563',
      nonce_str: 'zyx53Nkey8o4bHpxTQvd8m7e92nG5mG2',
      sign_type: 'HMAC-SHA256',
      sign: '029B52F67573D7E3BE74904BF9AEA'
    },
    success() {
      //dosomething
    },
    fail() {
      //dosomething
    },
    complete() {
      //dosomething
    }
  });
} else {
  //引导用户升级微信版本
}
```

#### 返回参数

无