---
url: "https://pay.weixin.qq.com/doc/v3/merchant/4012596395.md"
title: "wx.navigateToMiniProgram（停止新增）"
doc_id: 4012596395
api_version: "apiv3"
product: "微信支付分"
url_display: "https://pay.weixin.qq.com/doc/v3/merchant/4012596395"
title_display: "APIv3/普通商户/支付分产品/微信支付分/API列表/小程序调起支付分确认订单页/wx.navigateToMiniProgram（停止新增）"
---

>更新时间：2025.03.05

商户通过[创建支付分订单](https://pay.weixin.qq.com/doc/v3/merchant/4012587900.md)接口获取确认订单的必要参数package后可使用微信支付提供的小程序方法调起微信支付分小程序，引导用户确认订单（小程序端）



## 接口说明

支持商户： 【普通商户】

2024年1月31日后接入的商户已无法使用wx.navigateToMiniProgram接口，商户需调用[wx.openBusinessView](https://pay.weixin.qq.com/doc/v3/merchant/4012587949.md)接口来实现从商户小程序跳转到微信支付分小程序。

兼容性表现说明

- 小程序版本库 >= 2.6.0，低版本需提示用户升级微信版本。

- iOS兼容性表现：若微信版本>=7.0.3，开发者可以通过此openSDK接口跳转到微信支付分小程序；若微信版本< 7.0.3，开发者通过此openSDK接口可以跳转到微信，但不能跳转到微信支付分小程序，此时微信会提示用户可能由于应用的请求非法或者微信版本过低。

- Android兼容性表现：若微信版本>=7.0.3，开发者可以通过此openSDK接口跳转到微信支付分小程序；若微信版本< 7.0.3，开发者通过此openSDK接口不能跳转到微信，此时开发者应提示用户更新微信版本。


接口名称: wx.navigateToMiniProgram，详见[小程序API文档](https://developers.weixin.qq.com/miniprogram/dev/api/navigate/wx.navigateToMiniProgram.html)。

特别提醒

每个小程序可跳转的其他小程序数量限制为不超过 10 个。

## 字段说明

#### 请求参数

| 参数名 | 类型 | 必填 | 描述 |
| --- |  --- | --- | --- |
| appId | string(32) | true | 支付分小程序appid，固定值，请传入wxd8f3793ea3b935b8。 |
| path | string(64) | true | 固定配置：pages/use/use |
| extraData | Object | true | 需要传递给支付分的业务数据。 |
| extraData.package | string(128) | true | 【跳转支付分小程序订单数据包】创建支付分订单成功后返回，用于拉起支付分小程序确认订单页面，由数字大小写字母\_-符号组成，不超过300字符。 |

wx.navigateToMiniProgram 请求示例

```
wx.navigateToMiniProgram({
  appId: 'wxd8f3793ea3b935b8',
  path: 'pages/use/use',
  extraData: {
    package: 'AAQTnZoAAAABAAAAAAD8m2b8VRdZ2kVdKmHNZiAAAABcwQVtru-5k9MmEOZJ_Pv_Nq7Cw56dNKKN5Ej3Knt5jTHF-NdsP_McFW-iaU3iuJ0gWlNQeG9UihoKi0k2pv1t71M6mpk15X6L1545yNpmPD5uhi3poFV8e_5EdYwi_cbc6tXYVfa0AJUO4OzHGPhMdT4ZMwmFFhD0HQi9mRHQhFRKPwFai4NkkW7vm9mv1test',
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
})
```

#### 返回参数

触发场景: 用户从商户小程序页面进入到支付分后再返回到商户小程序页面。

返回参数获取说明: 商户小程序可在 App.onLaunch，App.onShow 中获取到这份数据。

| 参数名 | 类型 | 必填 | 描述 |
| --- |  --- | --- | --- |
| query_id | string(64) | true | 单据查询ID，对应[《查询支付分订单》](https://pay.weixin.qq.com/doc/v3/merchant/4012587902.md)接口中入参query\_id。<br> |

返回商家侧小程序请求示例

```
// app.js
onShow(res) {
  if (res.scene === 1038) { // 场景值1038：从被打开的小程序返回
    const { appId, extraData } = res.referrerInfo;
    if (appId === 'wxd8f3793ea3b935b8') { // 建议检查来源 appId，确保从支付分返回商户小程序页面，支付分 appId 为 wxd8f3793ea3b935b8
      let query_id = extraData.query_id;
      let result = this.queryOrderStatus(query_id);
      if (result) {
        // 成功
      } else {
        // 失败
      }
    }
  }
}

/**
 * 查询订单状态函数
 * 由商家后台服务提供
 * @param query_id {string
} 单据id，可以在接口【查询订单】进行单据查询
 */
queryOrderStatus: function(query_id) {
  // 商家小程序向商家后台服务请求查询订单状态，
  // 这里的前后端接口和数据协议由商家侧设计
  // 函数返回查询结果，这里以布尔值true代表成功，布尔值false代表失败
}
```