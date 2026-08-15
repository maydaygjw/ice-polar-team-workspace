# 门店配送商户号契约变更

## 管理端 API

既有门店接口保持不变：

- `POST /admin-api/store/shop/create`
- `PUT /admin-api/store/shop/update`
- `GET /admin-api/store/shop/get?id={id}`
- `GET /admin-api/store/shop/list`
- `GET /admin-api/store/shop/page`

门店创建、更新请求及门店响应增加可选字符串字段 `deliveryMerchantNo`，语义为配送系统使用的门店商户号；本期不做格式、唯一性或必填校验。

## 内部门店 API

`StoreShopCreateDTO`、`StoreShopInfoDTO` 增加可选字符串字段 `deliveryMerchantNo`，用于跨模块创建和查询门店信息。该字段仅保存和透传，不触发配送系统调用。

## 数据库

在 `yshop_store_shop` 增加：

```sql
delivery_merchant_no varchar(64) NULL COMMENT '配送商户号'
```

迁移文件：`backend/sql/upgrade-2026-08-15-store-delivery-merchant-no.sql`。

回滚：删除 `delivery_merchant_no` 列。该字段不建立唯一索引，允许多个门店暂时为空或由配送系统自行管理唯一性。
