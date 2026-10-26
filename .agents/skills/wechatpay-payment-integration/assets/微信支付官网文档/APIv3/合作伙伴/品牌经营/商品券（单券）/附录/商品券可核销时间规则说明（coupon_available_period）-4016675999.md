---
url: "https://pay.weixin.qq.com/doc/v3/partner/4016675999.md"
title: "商品券可核销时间规则说明（coupon_available_period）"
doc_id: 4016675999
api_version: "apiv3"
product: "商品券（单券）"
url_display: "https://pay.weixin.qq.com/doc/v3/partner/4016675999"
title_display: "APIv3/合作伙伴/品牌经营/商品券（单券）/附录/商品券可核销时间规则说明（coupon_available_period）"
---

>更新时间：2025.11.25

注意

创建投放计划时，投放计划的开始、结束时间会对商品券可核销时间（coupon\_available\_period）的相关字段进行校验，详细规则请查阅[投放时间字段说明](https://pay.weixin.qq.com/doc/v3/partner/4016111064.md#%E5%AD%97%E6%AE%B5%E4%BB%8B%E7%BB%8D)



## 一、概述

商品券信息中，coupon\_available\_period下的各个子参数共同构建了商品券的可核销时间规则，具体可核销时间为各个子参数设置的交集时间，商户在创券、发券时，需计算好商品券可核销的时间范围。

| 字段 | 功能 | 注意事项 |
| --- | --- | --- |
| available\_begin\_time | 设置商品券批次的开始时间 | 批次开始和结束时间的间隔不能超过一年 |
| available\_end\_time | 设置商品券批次的结束时间 | 批次开始和结束时间的间隔不能超过一年 |
| wait\_days\_after\_receive | 设置商品券领券后需等待生效的天数 | 1、批次开始时间前领券，计时从批次生效的第一天开始计算。批次有效期内领券，计时从用户领券当天开始计算<br>2、wait\_days\_after\_receive需要与available\_days一起使用<br>3、不可与irregular\_available\_period\_list一起使用 |
| available\_days | 设置商品券生效后可使用的天数 | 1、生效后可使用的天数范围若超过批次结束时间，则券的有效期截止到批次结束时间。<br>2、available\_days可单独使用，也可以与wait\_days\_after\_receive一起使用<br>3、不可与irregular\_available\_period\_list一起使用 |
| weekly\_available\_period | 设置商品券每周可生效的时间段 | 1、weekly\_available\_period.day\_list可单独使用，而weekly\_available\_period.day\_period\_list需要与weekly\_available\_period.day\_list一起使用<br>2、时间段的开始时间、结束时间必须同时设置，填写多个时间段时，不同区间请勿重叠<br>3、不可与irregular\_available\_period\_list一起使用 |
| irregular\_available\_period\_list | 自定义设置商品券可生效的时间段 | 1、时间段的开始时间、结束时间必须同时设置，填写多个时间段时，不同区间请勿重叠<br>2、不可与wait\_days\_after\_receive、available\_days、weekly\_available\_period一起使用 |

## 二、常见场景组合说明

| 场景 | 所需字段 | 参数设置举例 | 说明 |
| --- | --- | --- | --- |
| 在批次有效期内，用户可以在任意时间点使用券。 | available\_begin\_time<br>available\_end\_time | "coupon\_available\_period" : {<br>    "available\_begin\_time" : "2025-08-04T08:00:00+08:00",<br>    "available\_end\_time" : "2025-08-13T08:00:00+08:00"<br>} | 用户领券之后在批次有效期（2025年8月4日8点到2025年8月13日8点）的任意时间点都可以使用。 |
| 在批次有效期内，用户领券后立即可用，且券有效期是N天。 | available\_begin\_time<br>available\_end\_time<br>available\_days | "coupon\_available\_period" : {<br>    "available\_begin\_time" : "2025-08-04T08:00:00+08:00",<br>    "available\_end\_time" : "2025-08-13T08:00:00+08:00"，<br>    "available\_days" : "3"<br>} | 用户领券之后3天内在批次有效期（2025年8月4日8点到2025年8月13日8点）的任意时间点都可以使用。 |
| 在批次有效期内，用户领券后需要等待N天才可以用券，且券有效期是N天。 | available\_begin\_time<br>available\_end\_time<br>available\_days<br>wait\_days\_after\_receive | "coupon\_available\_period" : {<br>    "available\_begin\_time" : "2025-08-04T08:00:00+08:00",<br>    "available\_end\_time" : "2025-08-13T08:00:00+08:00"，<br>    "available\_days" : "3"，<br>    "wait\_days\_after\_receive":"2"<br>} | 用户领券之后需要等待2天才可以使用券，当券可以使用时，用户可在3天内在批次有效期（2025年8月4日8点到2025年8月13日8点）的任意时间点可以使用。 |
| 在批次有效期内，每周设定的星期可以用券。 | available\_begin\_time<br>available\_end\_time<br>weekly\_available\_period | "coupon\_available\_period" : {<br>    "available\_begin\_time" : "2025-08-04T08:00:00+08:00",<br>    "available\_end\_time" : "2025-08-13T08:00:00+08:00"，<br>    "weekly\_available\_period" : {<br>        "day\_list" : \["MONDAY", "FRIDAY"\],<br>    }<br>} | 用户领券之后在批次有效期内（2025年8月4日8点到2025年8月13日8点），每个周一、周五全天的任意时间点可以使用。 |
| 在批次有效期内，每周设定的星期以及对应时间段可以用券。 | available\_begin\_time<br>available\_end\_time<br>weekly\_available\_period | "coupon\_available\_period" : {<br>    "available\_begin\_time" : "2025-08-04T08:00:00+08:00",<br>    "available\_end\_time" : "2025-08-13T08:00:00+08:00"，<br>    "weekly\_available\_period" : {<br>        "day\_list" : \["MONDAY", "FRIDAY"\],<br>        "day\_period\_list" : \[{<br>            "begin\_time" : "08:00:00",<br>            "end\_time" : "10:00:00"<br>        }\]<br>    }<br>} | 用户领券之后在批次有效期内（2025年8月4日8点到2025年8月13日8点），每个周一、周五的8点到10点之间的任意时间点可以使用。 |
| 在批次有效期内，指定可以用券的时间段。 | available\_begin\_time<br>available\_end\_time<br>irregular\_available\_period\_list | "coupon\_available\_period" : {<br>    "available\_begin\_time" : "2025-08-04T08:00:00+08:00",<br>    "available\_end\_time" : "2025-08-13T08:00:00+08:00"，<br>    "irregular\_available\_period\_list" : \[<br>        {<br>            "begin\_time" : "2025-08-04T08:00:00+08:00",<br>            "end\_time" : "2025-08-06T08:00:00+08:00"<br>        },<br>        {<br>            "begin\_time" : "2025-08-10T08:00:00+08:00",<br>            "end\_time" : "2025-08-13T08:00:00+08:00"<br>        }<br>    \]<br>} | 用户领券之后在批次有效期内（2025年8月4日8点到2025年8月13日8点），指定的2025年8月4日8点到2025年8月6日8点、2025年8月10日8点到2025年8月13日8点之间的任意时间点可以使用。 |
| 以上场景仅作为示例参考，商户可结合自身实际需求进行字段的组合。 | 以上场景仅作为示例参考，商户可结合自身实际需求进行字段的组合。 | 以上场景仅作为示例参考，商户可结合自身实际需求进行字段的组合。 | 以上场景仅作为示例参考，商户可结合自身实际需求进行字段的组合。 |