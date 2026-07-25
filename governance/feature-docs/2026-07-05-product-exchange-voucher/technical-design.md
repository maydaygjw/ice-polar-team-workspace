# Technical Design: 商品兑换券

## 1. Feature Overview

用户在外部渠道（如抖音、美团、线下活动）购买商品后，获得一张商品兑换券（券码）。进入冰立得微信小程序后，输入或扫描券码完成核销，在对应制冰机设备上提货/履约。

**与营销优惠券的区别：**

| 维度 | 营销优惠券 (yshop_coupon) | 商品兑换券 (product-exchange-voucher) |
|------|------------------------|-------------------------------------|
| 来源 | 平台/商家发放 | 外部渠道购买后导入 |
| 价值 | 抵扣金额（least/value） | 直接兑换指定商品 |
| 支付 | 仍需用户支付差额 | 无需额外支付（0元订单） |
| 核销 | 下单时自动抵扣 | 主动输入券码核销 |
| 库存 | 发券计数（distribute/receive） | 与商品库存联动 |
| 履约 | 物流配送/门店自提 | 制冰机设备现场提货 |

## 2. Database Changes

### 2.1 New Tables

#### `yshop_product_voucher` — 兑换券模板（Admin 配置）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | bigint | PK | 模板 ID |
| `tenant_id` | bigint | NOT NULL | 租户 ID |
| `product_id` | bigint | NOT NULL, FK | 兑换商品 ID |
| `shop_id` | bigint | NOT NULL | 适用门店 |
| `title` | varchar(128) | NOT NULL | 券名称 |
| `code_prefix` | varchar(16) | | 券码前缀（如 `BD`） |
| `total_count` | int | NOT NULL DEFAULT 0 | 总发行量 |
| `used_count` | int | NOT NULL DEFAULT 0 | 已核销量 |
| `valid_days` | int | NOT NULL DEFAULT 0 | 领取后有效天数（0=不限制） |
| `start_time` | datetime | | 固定有效期开始 |
| `end_time` | datetime | | 固定有效期结束 |
| `status` | tinyint | NOT NULL DEFAULT 0 | 0=未启用 1=启用 2=已结束 |
| `is_deleted` | tinyint | NOT NULL DEFAULT 0 | 逻辑删除 |
| `create_time` | datetime | NOT NULL | |
| `update_time` | datetime | NOT NULL | |

#### `yshop_product_voucher_code` — 券码实例（批量导入）

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | bigint | PK | |
| `tenant_id` | bigint | NOT NULL | 租户 ID |
| `voucher_id` | bigint | NOT NULL, FK | 模板 ID |
| `code` | varchar(64) | NOT NULL, UQ | 券码（如 `BD2026A1B2C3`） |
| `status` | tinyint | NOT NULL DEFAULT 0 | 0=未使用 1=已使用 2=已过期 3=已冻结 |
| `user_id` | bigint | | 绑定用户 ID |
| `bind_time` | datetime | | 绑定时间 |
| `use_time` | datetime | | 核销时间 |
| `order_id` | varchar(32) | | 关联订单号 |
| `device_imei` | varchar(32) | | 核销设备 IMEI |
| `expire_time` | datetime | NOT NULL | 过期时间 |
| `batch_no` | varchar(32) | NOT NULL | 导入批次号 |
| `is_deleted` | tinyint | NOT NULL DEFAULT 0 | |
| `create_time` | datetime | NOT NULL | |
| `update_time` | datetime | NOT NULL | |

**索引：**
- `UNIQUE INDEX uk_code_tenant (code, tenant_id)` — 券码租户唯一
- `INDEX idx_voucher_status (voucher_id, status)` — 按模板查可用券
- `INDEX idx_user_status (user_id, status)` — 用户查券
- `INDEX idx_expire_status (expire_time, status)` — 过期清理

### 2.2 Existing Table Changes

#### `yshop_store_order` — 新增字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `voucher_code_id` | bigint | 关联 `yshop_product_voucher_code.id` |
| `voucher_code` | varchar(64) | 冗余券码（方便查询） |
| `order_source` | tinyint | 0=正常下单 1=兑换券核销 |

> `order_source` 区分正常订单与兑换券订单，影响订单列表筛选、统计口径。

### 2.3 Migration Script

文件名：`sql/upgrade-v20260625-product-exchange-voucher.sql`

```sql
-- 兑换券模板表
CREATE TABLE `yshop_product_voucher` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `product_id` bigint NOT NULL COMMENT '兑换商品ID',
  `shop_id` bigint NOT NULL COMMENT '适用门店',
  `title` varchar(128) NOT NULL COMMENT '券名称',
  `code_prefix` varchar(16) DEFAULT NULL COMMENT '券码前缀',
  `total_count` int NOT NULL DEFAULT 0 COMMENT '总发行量',
  `used_count` int NOT NULL DEFAULT 0 COMMENT '已核销量',
  `valid_days` int NOT NULL DEFAULT 0 COMMENT '领取后有效天数',
  `start_time` datetime DEFAULT NULL COMMENT '固定有效期开始',
  `end_time` datetime DEFAULT NULL COMMENT '固定有效期结束',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '0=未启用 1=启用 2=已结束',
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL,
  `update_time` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_tenant_status` (`tenant_id`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品兑换券模板';

-- 券码实例表
CREATE TABLE `yshop_product_voucher_code` (
  `id` bigint NOT NULL AUTO_INCREMENT,
  `tenant_id` bigint NOT NULL,
  `voucher_id` bigint NOT NULL COMMENT '模板ID',
  `code` varchar(64) NOT NULL COMMENT '券码',
  `status` tinyint NOT NULL DEFAULT 0 COMMENT '0=未使用 1=已使用 2=已过期 3=已冻结',
  `user_id` bigint DEFAULT NULL COMMENT '绑定用户',
  `bind_time` datetime DEFAULT NULL,
  `use_time` datetime DEFAULT NULL,
  `order_id` varchar(32) DEFAULT NULL COMMENT '关联订单号',
  `device_imei` varchar(32) DEFAULT NULL COMMENT '核销设备',
  `expire_time` datetime NOT NULL COMMENT '过期时间',
  `batch_no` varchar(32) NOT NULL COMMENT '导入批次号',
  `is_deleted` tinyint NOT NULL DEFAULT 0,
  `create_time` datetime NOT NULL,
  `update_time` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_code_tenant` (`code`, `tenant_id`),
  KEY `idx_voucher_status` (`voucher_id`, `status`),
  KEY `idx_user_status` (`user_id`, `status`),
  KEY `idx_expire_status` (`expire_time`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品兑换券码实例';

-- 订单表扩展
ALTER TABLE `yshop_store_order`
  ADD COLUMN `voucher_code_id` bigint DEFAULT NULL COMMENT '兑换券码ID' AFTER `coupon_id`,
  ADD COLUMN `voucher_code` varchar(64) DEFAULT NULL COMMENT '兑换券码' AFTER `voucher_code_id`,
  ADD COLUMN `order_source` tinyint NOT NULL DEFAULT 0 COMMENT '0=正常 1=兑换券' AFTER `voucher_code`,
  ADD KEY `idx_voucher_code` (`voucher_code`),
  ADD KEY `idx_order_source` (`order_source`);
```

## 3. Module Impact

### 3.1 New Module: `yshop-module-voucher`

```
yshop-module-voucher/
├── yshop-module-voucher-api/
│   ├── src/main/java/co/yixiang/yshop/module/voucher/
│   │   ├── api/VoucherApi.java              ← 跨模块接口
│   │   ├── api/dto/VoucherCodeDTO.java
│   │   ├── api/dto/VoucherRedeemResultDTO.java
│   │   └── api/enums/VoucherCodeStatusEnum.java
│   └── pom.xml
└── yshop-module-voucher-biz/
    ├── src/main/java/co/yixiang/yshop/module/voucher/
    │   ├── controller/admin/
    │   │   ├── ProductVoucherController.java       ← 模板 CRUD
    │   │   └── ProductVoucherCodeController.java   ← 券码管理/导入
    │   ├── controller/app/
    │   │   └── AppProductVoucherController.java    ← 核销/我的券
    │   ├── service/
    │   │   ├── ProductVoucherService.java
    │   │   ├── ProductVoucherServiceImpl.java
    │   │   ├── ProductVoucherCodeService.java
    │   │   ├── ProductVoucherCodeServiceImpl.java
    │   │   └── AppProductVoucherService.java
    │   ├── dal/
    │   │   ├── dataobject/
    │   │   │   ├── ProductVoucherDO.java
    │   │   │   └── ProductVoucherCodeDO.java
    │   │   └── mysql/
    │   │       ├── ProductVoucherMapper.java
    │   │       └── ProductVoucherCodeMapper.java
    │   └── convert/
    │       └── VoucherConvert.java
    └── pom.xml
```

### 3.2 Modified Modules

| 模块 | 变更 | 说明 |
|------|------|------|
| `yshop-module-order-biz` | 新增 `order_source` 处理 | 兑换券订单 0 元支付，跳过支付回调 |
| `yshop-module-device-biz` | 依赖 `voucher-api` | 创建设备订单时传入 `voucherCodeId` |
| `yshop-module-product-biz` | 无代码变更 | 仅通过 product_id 关联 |
| `yshop-server` | pom 新增 `voucher` 模块 | 聚合入口 |

### 3.3 Cross-Module Dependencies

```
yshop-module-voucher-biz
    ├── yshop-module-product-api  (查商品信息)
    ├── yshop-module-order-api      (创建订单)
    └── yshop-module-device-api     (创建设备订单)

yshop-module-device-biz
    └── yshop-module-voucher-api    (核销后回调)

yshop-module-order-biz
    └── yshop-module-voucher-api    (查询券码状态)
```

## 4. API Design

### 4.1 Admin API (`/admin-api/voucher/*`)

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/voucher/template/create` | 创建兑换券模板 |
| PUT | `/voucher/template/update/{id}` | 修改模板 |
| GET | `/voucher/template/page` | 模板分页列表 |
| GET | `/voucher/template/{id}` | 模板详情 |
| PUT | `/voucher/template/status/{id}` | 启停模板 |
| POST | `/voucher/code/import` | 批量导入券码（Excel/CSV） |
| GET | `/voucher/code/page` | 券码分页列表 |
| GET | `/voucher/code/export` | 导出券码使用状态 |

### 4.2 C-End API (`/app-api/voucher/*`)

| 方法 | 路径 | 说明 | 权限 |
|------|------|------|------|
| POST | `/voucher/redeem` | 核销券码（输入/扫描） | `@PreAuthenticated` |
| GET | `/voucher/my` | 我的兑换券列表 | `@PreAuthenticated` |
| GET | `/voucher/detail/{code}` | 券码详情 | `@PreAuthenticated` |
| POST | `/voucher/order` | 用券创建设备订单 | `@PreAuthenticated` |

### 4.3 Key Request/Response

**POST /app-api/voucher/redeem**

```json
// Request
{
  "code": "BD2026A1B2C3"
}

// Response (success)
{
  "code": 0,
  "data": {
    "voucherCodeId": 10001,
    "code": "BD2026A1B2C3",
    "title": "冰立得矿泉水兑换券",
    "productId": 123,
    "productName": "冰立得天然矿泉水",
    "productImage": "https://...",
    "shopId": 456,
    "shopName": "冰立得一号店",
    "status": 0,
    "expireTime": "2026-12-31T23:59:59"
  }
}

// Response (error)
{
  "code": 100801,  // VOUCHER_CODE_NOT_FOUND
  "msg": "券码不存在或已被使用"
}
```

**POST /app-api/voucher/order**

```json
// Request
{
  "voucherCodeId": 10001,
  "imei": "860123456789012",
  "shopId": 456
}

// Response (success)
{
  "code": 0,
  "data": {
    "orderId": "ORDER20260625123456",
    "deviceOrderId": 20001
  }
}
```

## 5. Voucher Code Lifecycle State Machine

```
                    +-----------+
                    |  IMPORTED |
                    | (已导入)   |
                    +-----+-----+
                          |
                          | 用户输入券码
                          v
                    +-----------+
              +---->|  UNUSED   |<----+
              |     | (未使用)   |     |
              |     +-----+-----+     |
              |           |           |
              |           | redeem    |
              |           v           |
              |     +-----------+     | 过期
              |     |  BOUND    |     |
              |     | (已绑定)   |     |
              |     +-----+-----+     |
              |           |           |
              |           | create order
              |           v           |
              |     +-----------+     |
              +-----|   USED    |-----+
                    | (已使用)   |
                    +-----+-----+
                          |
                          | 设备出冰完成
                          v
                    +-----------+
                    |FULFILLED |
                    | (已履约)   |
                    +-----------+

    +-----------+         +-----------+
    |  EXPIRED  |<------|  FROZEN   |
    | (已过期)   |       | (已冻结)   |
    +-----------+       +-----------+
```

| 状态 | 值 | 说明 |
|------|-----|------|
| `UNUSED` | 0 | 已导入，未被任何用户绑定 |
| `BOUND` | 1 | 用户已绑定（输入券码后），尚未下单 |
| `USED` | 2 | 已创建订单，尚未设备履约 |
| `FULFILLED` | 3 | 设备已出冰/履约完成 |
| `EXPIRED` | 4 | 超过 expire_time 未使用 |
| `FROZEN` | 5 | 管理员冻结（异常/退款场景） |

> **状态流转规则**：
> - `UNUSED` → `BOUND`：用户首次输入券码，绑定 user_id
> - `BOUND` → `USED`：调用创建设备订单，生成 order_id
> - `USED` → `FULFILLED`：DMS 返回设备出冰成功
> - `UNUSED`/`BOUND` → `EXPIRED`：定时任务扫描 expire_time
> - 任意 → `FROZEN`：Admin 手动冻结
> - `FROZEN` → `UNUSED`：Admin 解冻（仅未使用时）

## 6. Redemption Flow Sequence Diagram

```
MiniApp          Backend(app-api)          VoucherService         OrderService         DeviceService         DMS
   |                    |                       |                    |                    |                  |
   |  1.输入/扫描券码     |                       |                    |                    |                  |
   | -----------------> |                       |                    |                    |                  |
   |                    |  2.SELECT code        |                    |                    |                  |
   |                    |  (tenant_id, code)    |                    |                    |                  |
   |                    | --------------------> |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   |                    |  3.校验:               |                    |                    |                  |
   |                    |    - 存在?              |                    |                    |                  |
   |                    |    - status=UNUSED?     |                    |                    |                  |
   |                    |    - expire_time > now? |                    |                    |                  |
   |                    |    - 同一用户已绑定?      |                    |                    |                  |
   |                    | <-------------------- |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   |                    |  4.UPDATE status=BOUND, |                    |                    |                  |
   |                    |    user_id=current,     |                    |                    |                  |
   |                    |    bind_time=now         |                    |                    |                  |
   |                    | --------------------> |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   |  5.返回券详情        |                       |                    |                    |                  |
   | <----------------- |                       |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   |  6.用户确认，选择设备  |                       |                    |                    |                  |
   | -----------------> |                       |                    |                    |                  |
   |                    |  7.SELECT code (FOR UPDATE)                  |                    |                  |
   |                    |  校验 status=BOUND && user_id=current         |                    |                  |
   |                    | --------------------> |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   |                    |  8.创建 0 元订单        |                    |                    |                  |
   |                    | -------------------------------------------> |                    |                  |
   |                    |                       |                    |                    |                  |
   |                    |  9.创建设备订单         |                    |                    |                  |
   |                    | ---------------------------------------------------------------> |                  |
   |                    |                       |                    |                    |                  |
   |                    | 10.UPDATE status=USED,|                    |                    |                  |
   |                    |    order_id=xxx        |                    |                    |                  |
   |                    | --------------------> |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   |                    | 11.下发制冰指令        |                    |                    |                  |
   |                    | -------------------------------------------------------------------------------> |
   |                    |                       |                    |                    |                  |
   |                    | 12.设备出冰完成回调     |                    |                    |                  |
   |                    | <------------------------------------------------------------------------------- |
   |                    |                       |                    |                    |                  |
   |                    | 13.UPDATE status=FULFILLED                |                    |                  |
   |                    | --------------------> |                    |                    |                  |
   |                    |                       |                    |                    |                  |
   | 14.返回成功         |                       |                    |                    |                  |
   | <----------------- |                       |                    |                    |                  |
```

## 7. Idempotency & Anti-Fraud

### 7.1 Idempotency

| 场景 | 机制 | 说明 |
|------|------|------|
| 券码绑定 | 幂等 | 同一用户重复输入已绑定券码 → 返回已绑定详情（不报错） |
| 券码下单 | 幂等键 | `voucher_order:{voucherCodeId}` Redis 分布式锁，5s TTL |
| 设备指令 | 幂等 | 复用 DMS 现有指令幂等机制 |

### 7.2 Anti-Fraud

| 风险 | 措施 |
|------|------|
| 券码爆破 | 券码格式：前缀 + 年份 + 8 位随机字母数字，空间 36^8；输入错误 5 次/分钟限速 |
| 券码转售 | 绑定后不可解绑；一码一用户 |
| 重复核销 | 数据库 `status` 状态机 + `SELECT FOR UPDATE` 乐观锁 |
| 过期券使用 | 所有查询带 `expire_time > NOW()` 条件 |
| 跨租户攻击 | MyBatis Plus `TenantLineInnerInterceptor` 自动注入 `tenant_id` |

## 8. Risk Assessment

| 风险 | 等级 | 影响 | 缓解措施 |
|------|------|------|---------|
| 券码批量导入性能 | 中 | 万级券码导入慢 | 异步导入（Redis 队列 + 定时任务）；分批 INSERT |
| 兑换券订单与支付订单统计混淆 | 中 | 营收数据失真 | `order_source` 字段区分；统计报表过滤 |
| 设备出冰失败但券已核销 | 高 | 用户资产损失 | 状态机保留 `USED` 中间态；Admin 可手动重置为 `BOUND` 重试 |
| 外部渠道券码冲突 | 低 | 券码重复 | 导入时校验 `uk_code_tenant`；冲突报批次错误 |
| 高并发秒杀场景 | 低 | 超卖 | `SELECT FOR UPDATE` + Redis 分布式锁双重保护 |

## 9. Branch Names

| 仓库 | 分支名 | 说明 |
|------|--------|------|
| `backend/` | `feature/product-exchange-voucher` | 基于 `master` |
| `miniapp/` | `feature/product-exchange-voucher` | 基于 `main` |
| `admin/` | `feature/product-exchange-voucher` | 基于 `main`（如有 Admin 页面） |

## 10. ADR

**No new ADR needed.**

本功能复用现有架构模式：
- 模板+实例双层结构 → 复用 `CouponDO` + `CouponUserDO` 模式
- 跨模块调用 → 遵循 `CONTRACTS.md` § Module Dependency Rules
- 设备订单履约 → 复用 `device-api` 现有 DMS 转发模式
- 0 元订单 → 复用 `score` 模块积分兑换订单模式（跳过支付）

无新增架构范式。

## 11. Error Codes

| Code | 含义 | 触发场景 |
|------|------|---------|
| 100800 | 兑换券模板不存在 | 查询/修改不存在的模板 |
| 100801 | 券码不存在或已使用 | 核销时查无此码或状态非 UNUSED |
| 100802 | 券码已过期 | expire_time < NOW() |
| 100803 | 券码已被其他用户绑定 | 非当前用户绑定 |
| 100804 | 券码已冻结 | 状态为 FROZEN |
| 100805 | 商品已下架 | 关联 product.isShow = 0 |
| 100806 | 设备不可用 | IMEI 不在线或故障 |
| 100807 | 核销过于频繁 | 同一用户 1 分钟内核销超过 10 次 |
| 100808 | 券码已绑定但未使用 | 重复绑定自身已绑定券码（应返回成功而非错误） |
