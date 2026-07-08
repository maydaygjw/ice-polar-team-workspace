# 问题诊断报告：分账收款人解绑未生效

## 现象

`PUT /admin-api/store/shop/bind-profit-recipient` 请求 `{"shopId":9,"enabled":false}` 后，接口返回成功，但数据库中 `profit_sharing_recipient_id` 未被清空。

## 验证数据

```sql
SELECT id, name, profit_sharing_recipient_id, profit_sharing_enabled, tenant_id
FROM yshop_store_shop
WHERE id = 9 AND tenant_id = 154;
```

修改前：

| id | name | profit_sharing_recipient_id | profit_sharing_enabled | tenant_id |
|---|---|---|---|---|
| 9 | 寝清君南通大学 | 2 | 0 | 154 |

## 根因

`StoreShopServiceImpl.bindProfitRecipient` 在 `enabled=false` 分支设置了 `shop.setProfitSharingRecipientId(null)`，随后调用 `shopMapper.updateById(shop)`。

但当前项目使用 MyBatis Plus 3.5.5，全局未配置 `update-strategy`，默认行为下 `updateById` **忽略 null 字段**，导致 `profit_sharing_recipient_id` 无法被更新为 NULL。

## 代码位置

- `yshop-drink/yshop-module-mall/yshop-module-store-biz/src/main/java/co/yixiang/yshop/module/store/service/storeshop/StoreShopServiceImpl.java:189-218`
- `yshop-drink/yshop-module-mall/yshop-module-store-biz/src/main/java/co/yixiang/yshop/module/store/dal/dataobject/storeshop/StoreShopDO.java:156-163`

## 修复方案

给 `StoreShopDO.profitSharingRecipientId` 字段增加注解，强制 MyBatis Plus 更新 null 值：

```java
@TableField(updateStrategy = FieldStrategy.IGNORED)
private Long profitSharingRecipientId;
```

并确认已引入：

```java
import com.baomidou.mybatisplus.annotation.FieldStrategy;
import com.baomidou.mybatisplus.annotation.TableField;
```

## 部署说明

修复后需要重新执行 `mvn clean package -DskipTests` 并重启 test 环境后端服务。DevOps 可协助部署。

## 临时处理

已执行临时 SQL 将 shopId=9 的 `profit_sharing_recipient_id` 置为 NULL：

```sql
UPDATE yshop_store_shop
SET profit_sharing_recipient_id = NULL
WHERE id = 9 AND tenant_id = 154;
```

临时 SQL 不能替代代码修复；若再次启用/禁用分账，问题会复现。

---
Reported by: devops-agent
Date: 2026-07-08
