# 契约变更 — 商品单点不送

## API 契约

商品管理接口的商品对象新增字段 `isSingleNoDelivery`：

| 字段 | 类型 | 含义 |
|------|------|------|
| `isSingleNoDelivery` | `Integer` | 单点不送：`0` 否，`1` 是，默认 `0` |

管理端创建、更新、查询商品接口均支持该字段；客户端商品查询响应同步返回该字段，供后续配送规则使用。

## 数据库变更

在 `yshop_store_product` 表新增：

```sql
is_single_no_delivery TINYINT(1) NOT NULL DEFAULT 0 COMMENT '单点不送 0=否 1=是'
```

## 行为边界

本次仅增加商品配置及其 API 数据传递，不改变下单和配送校验逻辑。
