# 商品不限制库存审查报告

## 审查结论

通过。实现符合需求规格与契约，核心库存路径已正确识别 `-1` 为不限制库存。

## 问题与修复

1. **规格全为 `-1` 时商品库存写入 `0`**
   - 位置：`StoreProductServiceImpl.computedProduct`
   - 风险：管理端创建全部规格不限制的商品后，商品层 `stock` 为 `0`，导致下单失败。
   - 处理：已修复为全部规格 `-1` 时，商品库存也设为 `-1`。

## 验证结果

- 后端编译：`mvn -pl yshop-module-mall/yshop-module-product-biz,yshop-module-mall/yshop-module-order-biz -am clean compile -DskipTests` → SUCCESS
- 管理端构建：`pnpm build:prod` → Build successful
- 管理端 `ts:check`：失败，但为主目录同样存在的既有类型定义缺失问题，非本次引入。

## 影响范围

- 后端：`yshop-module-product-biz`、`yshop-module-order-biz`、`yshop-module-store-import-biz`
- 管理端：`src/views/mall/product/*`
- 无 DB 迁移；无 API 路径变化；无权限变化。

## 残余风险

- 现有订单退款/取消恢复库存时，依赖 SQL `stock != -1` 过滤，已验证不会修改 `-1`。
- 管理端存在未单独校验 `-1` 的输入（商品基础库存为文本输入），依赖后端与数据库整型存储，可正常保存。
- 积分商城、秒杀、拼团等活动库存未纳入本期；`pinkStock`、`seckillStock` 仍按原逻辑处理。
