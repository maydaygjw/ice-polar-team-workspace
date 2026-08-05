# 私域热门商品推送契约

## 范围

后端每天通过 Quartz 为已配置私域推广商圈的租户查询外部热门一口价商品，并将商品信息通过租户配置的海豚私域 Webhook 推送到私域群。

本期只修改后端，不新增业务表，不新增管理端页面和对外业务接口。

SQL 脚本为 `backend/sql/upgrade-2026-08-05-private-promote-product.sql`；租户实际 Webhook 地址不写入脚本。

## 租户配置

配置存储在 `infra_tenant_config`，配置键在租户内唯一：

| 配置键 | 示例值 | 说明 |
|---|---|---|
| `we7_mall_host` | `http://mall-dev.holuntech.com` | 微擎商城域名，商品接口从该域名拼接 `/app/index.php` |
| `private_promote_regions` | `NT005` 或 `NT005,NT006` | 启用私域推送的商圈编码，逗号分隔 |
| `private_promote_regions_relay_{regionCode}` | `https://webhook.cpshelp.cn/webhook/...` | 对应商圈的海豚私域中继地址，编码按实际值拼接 |

配置键匹配时商圈编码按原值去除首尾空白；中继地址为空时跳过该商圈并记录告警。

## 外部商品接口

`GET {we7_mall_host}/app/index.php`

固定查询参数：`i=2`、`c=entry`、`a=wxapp`、`do=getTopFixedPriceProducts`、`m=hlmall`、`businessModule=order`；动态参数为 `region_code` 和执行日期 `date`（`yyyy-MM-dd`）。

预期响应：`status=success`，商品数组字段包括 `goods_id`、`store_id`、`goods_name`、`goods_price`、`total_sales`。

## 小程序链接

后端从现有微信小程序主账号配置读取 AppID/Secret，通过微信 Short Link API 生成链接：

- 页面路径从租户参数 `private_promote_mini_app_page` 读取；未配置时默认为 `main/pages/takeout/fixed-price-product`
- 页面路径不带开头的 `/`
- query：`storeid={store_id}&productid={goods_id}`

不在代码、SQL 或日志中保存 AppID/Secret。

## Webhook 请求

```json
{
  "message": {
    "msgType": "text",
    "text": {
      "content": "私域热门商品\n商品名称：...\n价格：...\n销量：...\n链接：..."
    }
  }
}
```

Webhook 地址从 `private_promote_regions_relay_{regionCode}` 读取，使用 `Content-Type: application/json` POST。

## Quartz

- Handler Bean：`privatePromoteJob`
- 默认 Cron：`0 0 10 * * ?`（每天 10:00，Asia/Shanghai）
- Job 方法使用 `@TenantJob`，由现有租户任务框架逐租户执行。
- 未配置 `private_promote_regions` 的租户不执行任何外部调用。
