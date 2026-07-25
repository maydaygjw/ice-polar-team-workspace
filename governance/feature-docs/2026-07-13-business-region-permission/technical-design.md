# 技术设计：business-region、部门与多门店权限模型

## 概述

本设计引入 `business-region` 作为经营区域，同时继续使用部门作为后台数据权限边界。门店归属于 `business-region`，`business-region` 归属于部门，后台用户通过用户-门店关系表管理一个或多个门店。本期不实现小程序端，仅预留后续接入模型。

```text
租户
  -> 部门
      -> business_region
          -> 门店
              -> 订单 / 设备 / 商品 / 收入 / 提现
```

## 数据库变更

### 新增表：`business_region`

```sql
CREATE TABLE `business_region` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT '商圈ID',
  `tenant_id` bigint NOT NULL DEFAULT '0' COMMENT '租户编号',
  `dept_id` bigint NOT NULL COMMENT '归属部门ID',
  `name` varchar(100) NOT NULL COMMENT '商圈名称',
  `is_default` tinyint NOT NULL DEFAULT '0' COMMENT '是否默认商圈（0否 1是）',
  `status` tinyint NOT NULL DEFAULT '0' COMMENT '状态（0正常 1停用）',
  `sort` int NOT NULL DEFAULT '0' COMMENT '排序',
  `province` varchar(64) DEFAULT NULL COMMENT '省',
  `city` varchar(64) DEFAULT NULL COMMENT '市',
  `district` varchar(64) DEFAULT NULL COMMENT '区',
  `address` varchar(255) DEFAULT NULL COMMENT '地址',
  `lng` varchar(30) DEFAULT NULL COMMENT '经度',
  `lat` varchar(30) DEFAULT NULL COMMENT '纬度',
  `creator` varchar(64) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `updater` varchar(64) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `deleted` bit(1) DEFAULT b'0',
  PRIMARY KEY (`id`),
  KEY `idx_business_region_tenant_dept` (`tenant_id`, `dept_id`),
  KEY `idx_business_region_tenant_default` (`tenant_id`, `is_default`),
  KEY `idx_business_region_tenant_status_sort` (`tenant_id`, `status`, `sort`)
) COMMENT='商圈';
```

默认商圈约束由服务层和迁移脚本共同保证：每个租户必须有且只有一个 `is_default = 1` 的有效 `business-region`。MySQL 不使用普通唯一索引约束 `is_default`，避免多个非默认记录因 `is_default = 0` 产生唯一冲突。

### 修改表：`yshop_store_shop`

```sql
ALTER TABLE `yshop_store_shop`
  ADD COLUMN `business_region_id` bigint DEFAULT NULL COMMENT '商圈ID' AFTER `id`,
  ADD COLUMN `dept_id` bigint DEFAULT NULL COMMENT '归属部门ID' AFTER `business_region_id`,
  ADD KEY `idx_store_shop_tenant_region` (`tenant_id`, `business_region_id`),
  ADD KEY `idx_store_shop_tenant_dept` (`tenant_id`, `dept_id`);
```

### 新增表：`yshop_store_shop_admin`

```sql
CREATE TABLE `yshop_store_shop_admin` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'ID',
  `tenant_id` bigint NOT NULL DEFAULT '0' COMMENT '租户编号',
  `shop_id` bigint NOT NULL COMMENT '门店ID',
  `user_id` bigint NOT NULL COMMENT '后台用户ID',
  `creator` varchar(64) DEFAULT NULL,
  `create_time` datetime DEFAULT NULL,
  `updater` varchar(64) DEFAULT NULL,
  `update_time` datetime DEFAULT NULL,
  `deleted` bit(1) DEFAULT b'0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_shop_admin_tenant_shop_user` (`tenant_id`, `shop_id`, `user_id`),
  KEY `idx_shop_admin_tenant_user` (`tenant_id`, `user_id`),
  KEY `idx_shop_admin_tenant_shop` (`tenant_id`, `shop_id`)
) COMMENT='门店管理员关联';
```

### 核心业务表归属字段

后续阶段逐步给核心业务表增加直接归属字段：

```sql
ALTER TABLE `yshop_store_order`
  ADD COLUMN `business_region_id` bigint DEFAULT NULL COMMENT '商圈ID',
  ADD COLUMN `dept_id` bigint DEFAULT NULL COMMENT '归属部门ID',
  ADD KEY `idx_store_order_tenant_region_time` (`tenant_id`, `business_region_id`, `create_time`),
  ADD KEY `idx_store_order_tenant_dept_time` (`tenant_id`, `dept_id`, `create_time`);
```

设备、收入、提现、商品主表在迁移到部门权限时使用同样思路。

## 历史数据回填策略

1. 为每个租户创建或校验一个默认 `business-region`。
2. 默认 `business-region` 绑定到租户根部门或指定运营部门。
3. 回填 `yshop_store_shop.business_region_id` 和 `dept_id`。
4. 从 `yshop_store_shop.admin_id` 逗号字符串回填 `yshop_store_shop_admin`。
5. 迁移期内继续写 `admin_id` 兼容旧逻辑，但读取关系以 `yshop_store_shop_admin` 为准。

## 后端模块影响

### 门店模块

- 新增 `BusinessRegionDO`、Mapper、Service、Admin Controller。
- `StoreShopDO` 增加 `businessRegionId`、`deptId`。
- 创建/编辑门店时：
  - 校验 `business-region` 存在且启用；
  - 设置 `shop.deptId = businessRegion.deptId`；
  - 不允许前端独立提交不一致的 `deptId`。
- 租户初始化或迁移时创建默认 `business-region`。
- 默认 `business-region` 不允许直接删除；设置新默认区域时需要在事务内取消旧默认并设置新默认。
- 新增 `StoreShopAdminDO` 和分配服务。
- 将单门店限制改为门店 ID 集合校验。

### 系统与认证模块

当前 `OAuth2TokenServiceImpl#getShopId` 只返回一个门店。需要改为多门店模型：

- `LoginUser` 增加 `shopIds`。
- 令牌需要支持：
  - 直接序列化 `shopIds`；或
  - 登录认证时从关系表加载并缓存。

建议第一版在 OAuth2 访问令牌/刷新令牌表增加 `shop_ids` 字段，并在 `LoginUser` 中保留 `shopIds`。

### 数据权限接入

门店模块新增数据权限定制器：

```java
@Bean
public DeptDataPermissionRuleCustomizer storeDeptDataPermissionRuleCustomizer() {
    return rule -> {
        rule.addDeptColumn(BusinessRegionDO.class, "dept_id");
        rule.addDeptColumn(StoreShopDO.class, "dept_id");
        // 核心业务表补充 dept_id 后继续注册。
    };
}
```

### 门店范围工具

新增统一的门店范围工具，替代散落的单个 `shopId` 读取逻辑：

```java
ShopScope getCurrentShopScope();
```

规则：

- 租户管理员或全量权限角色：租户内不限制门店。
- 有分配门店的用户：限制为 `shopIds`。
- 没有分配门店的用户：空范围。

Mapper 查询使用：

```java
wrapper.inIfPresent(Entity::getShopId, shopScope.getShopIds());
```

写操作必须校验目标 `shopId` 是否在当前用户可管理范围内，除非其角色拥有全量权限。

## 接口设计

### 管理后台 business-region 接口

基础路径：`/admin-api/business-region`

| 方法 | 路径 | 说明 |
|---|---|---|
| `POST` | `/create` | 创建 `business-region` |
| `PUT` | `/update` | 更新 `business-region` |
| `DELETE` | `/delete?id={id}` | 删除 `business-region` |
| `GET` | `/get?id={id}` | 查询详情 |
| `GET` | `/page` | 分页查询 |
| `GET` | `/simple-list` | 选择器使用的启用列表 |
| `PUT` | `/set-default?id={id}` | 设置租户默认 `business-region` |

创建和更新请求支持 `isDefault`。当 `isDefault = true` 时，后端必须在同一事务内取消该租户下其他默认区域。

### 小程序 business-region 接口

本期暂不实现小程序端，也不新增小程序 `business-region` 接口。后续启动小程序阶段时，再基于本数据模型补充 `/app-api/business-region/*` 合同。

### 门店接口变更

- 管理后台门店创建/编辑请求增加 `businessRegionId`。
- 管理后台门店响应增加 `businessRegionId`、`businessRegionName`、`deptId`、`deptName`。
- 兼容期内，如果旧入口未提交 `businessRegionId`，后端可使用租户默认 `business-region` 派生归属；管理后台表单完成后应强制显式提交。

### 登录/用户信息接口变更

- 管理后台用户权限信息响应增加 `shopIds`，可选增加 `shops`。
- 迁移期保留 `shopId`，表示第一个可管理门店或 `0`。

## 时序

### 管理后台创建门店

```text
管理后台 -> 后端: 提交门店，包含 businessRegionId
后端 -> BusinessRegionMapper: 查询 business-region
后端: 校验租户、状态
后端: shop.deptId = businessRegion.deptId
后端 -> StoreShopMapper: 写入门店
后端 -> StoreShopAdminMapper: 写入门店管理员关系
后端 -> 管理后台: 返回成功
```

### 后续小程序区域下单

```text
小程序 -> 后端: GET /app-api/business-region/list
小程序: 用户选择 business-region
小程序 -> 后端: GET /app-api/business-region/shops?businessRegionId=R
小程序: 用户选择门店和商品
小程序 -> 后端: 创建订单 {businessRegionId: R, shopId: S}
后端 -> StoreShopMapper: 查询门店 S
后端: 校验 shop.businessRegionId == R
后端: order.businessRegionId = shop.businessRegionId
后端: order.deptId = shop.deptId
后端 -> OrderMapper: 写入订单
```

以上为后续小程序阶段的目标时序，不纳入本期实现。

## 界面影响

### 管理后台

- 新增 `business-region` 管理页面。
- 门店表单增加 `business-region` 选择器。
- 门店列表增加 `business-region` 和部门列。
- 门店管理员分配支持多选用户和多门店关系。

### 小程序

本期不改造小程序页面。后续阶段再增加 `business-region` 选择/切换入口、本地缓存和门店上下文刷新。

## 测试策略

- 后端单元测试：`business-region` 服务校验。
- 后端集成测试：`business-region` 和门店的部门数据权限。
- SQL 迁移验证：默认区域、门店归属、管理员关系回填。
- 管理后台端到端验证：创建区域 -> 创建门店 -> 分配用户 -> 校验列表过滤。
- 小程序端到端或手工验证暂缓到后续小程序阶段。

## 风险评估

| 风险 | 影响 | 缓解 |
|---|---|---|
| 现有代码假设只有一个 `shopId` | 高 | 增加 `shopIds`，通过统一工具逐步替换过滤逻辑。 |
| `admin_id` 逗号字符串导致权限不一致 | 高 | 迁移到关系表，迁移期双写兼容。 |
| 历史数据缺少归属字段 | 中 | 先回填门店，再分阶段回填核心业务表。 |
| 部门变化影响可见性 | 中 | 门店部门跟随 `business-region`，文档明确区域转移影响后续可见性。 |
| 默认商圈缺失或重复 | 高 | 迁移脚本和服务层启动前校验；默认切换在事务内完成。 |
| 小程序保存了失效区域 | 低 | 本期不实现小程序端；后续阶段每次下单校验区域状态和门店归属。 |

## 分支规划

| 仓库 | 分支 |
|---|---|
| `backend/` | `feat/business-region-permission` |
| `admin/` | `feat/business-region-permission` |

本期不需要修改 `miniapp/` 和 `icepolar-dms/`。
