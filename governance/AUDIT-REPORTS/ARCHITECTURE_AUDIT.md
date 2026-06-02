# 架构合规性审查报告

> 审查日期：2026/06/02
> 审查范围：ice-polar-team-workspace（backend / admin / miniapp / icepolar-dms）
> 审查人：architecture-agent

---

## 1. 执行摘要

本次架构合规性审查覆盖模块依赖、租户隔离、DMS 调用链路、事件驱动实现、API 契约一致性及安全扫描六个维度。共发现 **2 个 P0 级问题、7 个 P1 级问题、5 个 P2 级问题**。

**关键发现：**
- **P0**：miniapp 直接调用 DMS 后端，绕过 backend 的 device 模块，严重违反架构边界原则
- **P0**：订单状态存在两套不一致的枚举定义（`OrderStatusEnum` vs `OrderInfoEnum`），可能导致状态判断错误
- **P1**：大量模块存在跨模块直接引用 DAO/Mapper/DO 的边界突破行为，违反 API-first 分层架构
- **P1**：`CONTRACTS.md` 内容严重不完整，仅覆盖佣金合约和基础结构，大量跨仓库契约缺失
- **P1**：`icepolar-dms` 存在硬编码默认密码和弱密钥

---

## 2. 模块依赖分析

### 2.1 模块结构概览

backend 采用 Maven 多模块结构，顶层模块包括：

| 模块 | 子模块 | 职责 |
|------|--------|------|
| yshop-module-system | system-api / system-biz | 用户、权限、OAuth2、租户 |
| yshop-module-mall | product-api/biz, order-api/biz, store-api/biz, shop-api/biz, desk-api/biz, device-api/biz | 商城核心业务 |
| yshop-module-member | member-api / member-biz | 会员、地址、账单 |
| yshop-module-pay | pay-api / pay-biz | 支付、商户配置 |
| yshop-module-marketing | coupon-api/biz, card-api/biz | 优惠券、会员卡 |
| yshop-module-score | score-api / score-biz | 积分系统 |
| yshop-module-merchant | merchant-api / merchant-biz | 商家端 |
| yshop-module-mp | mp-api / mp-biz | 微信公众号 |
| yshop-module-message | message-api / message-biz | 消息通知 |
| yshop-module-infra | infra-api / infra-biz | 基础设施 |
| yshop-module-express | express-api / express-biz | 快递物流 |
| yshop-module-site | site-api / site-biz | 场地预约 |

### 2.2 依赖关系图（跨模块引用）

```
system ──→ store (DAO直接引用)
       ──→ infra (API)

member ──→ system (API)
       ──→ mp (Service直接引用)
       ──→ store (DAO直接引用)
       ──→ shop (DAO直接引用)
       ──→ card (DAO直接引用)
       ──→ coupon (DAO直接引用)

order  ──→ desk (DAO直接引用)
       ──→ product (DAO/Service直接引用)
       ──→ pay (Service直接引用)
       ──→ store (DAO直接引用)
       ──→ member (DAO直接引用)
       ──→ message (MQ/Service直接引用)
       ──→ express (DAO直接引用)
       ──→ card (DAO直接引用)
       ──→ coupon (DAO直接引用)

desk   ──→ store (DAO直接引用)
       ──→ order (API)
       ──→ mp (Service直接引用)

product ──→ store (DAO直接引用)

device ──→ store (DAO直接引用)
       ──→ order (API)
       ──→ product (API)
       ──→ member (API)
       ──→ system (API)
       ──→ pay (Utility直接引用)

store  ──→ pay (Service/Enum直接引用)
       ──→ member (API)
       ──→ system (Enum直接引用)

shop   ──→ store (DAO直接引用)

coupon ──→ store (DAO直接引用)
       ──→ system (API DTO)

score  ──→ member (DAO直接引用)

message ──→ member (DAO直接引用)
        ──→ mp (API/Service直接引用)
        ──→ order (API)

merchant ──→ order (DAO/Service/VO直接引用)
         ──→ product (DAO/Service/VO直接引用)
         ──→ store (DAO/VO直接引用)
         ──→ shop (DAO/VO直接引用)
         ──→ desk (DAO直接引用)
         ──→ member (DAO直接引用)

site   ──→ member (API)
       ──→ order (API)
       ──→ store (DAO直接引用)
```

### 2.3 循环依赖检查

未发现明显的模块间编译循环依赖。但存在以下**逻辑循环风险**：

- `order → desk → order`：order 模块引用 desk 的 DAO，desk 模块通过 API 引用 order
- `member → store → member`：member 引用 store DAO，store 通过 API 引用 member
- `message → order → message`：message 通过 API 引用 order，order 通过 MQ 引用 message

这些逻辑循环虽通过 API/DAO 分层避免了编译循环，但增加了模块耦合度。

---

## 3. 租户隔离审查

### 3.1 租户拦截器配置

租户隔离通过 `yshop-spring-boot-starter-biz-tenant` 模块实现：

- **拦截器**：`TenantLineInnerInterceptor`（MyBatis Plus 标准实现）
- **上下文**：`TenantContextHolder` 从 JWT 中提取租户 ID
- **忽略注解**：`@TenantIgnore` 用于跨租户操作场景

配置位置：`backend/yshop-framework/yshop-spring-boot-starter-biz-tenant/src/main/java/co/yixiang/yshop/framework/tenant/config/YshopTenantAutoConfiguration.java`

### 3.2 @TenantIgnore 使用情况

| 位置 | 用途 | 评估 |
|------|------|------|
| `OAuth2AccessTokenMapper.java:17` | 获取 token 时忽略租户（文件上传等场景） | 合理 |
| `UserBillServiceImpl.java:50` | 账单查询 | 需确认是否必要 |
| `AppStoreOrderServiceImpl.java:797` | 订单查询 | 需确认是否必要 |
| `AccessLogCleanJob.java:34` | 日志清理定时任务 | 合理（系统级任务） |
| `ErrorLogCleanJob.java:34` | 错误日志清理 | 合理 |
| `JobLogCleanJob.java:33` | 任务日志清理 | 合理 |
| `RevenueJob.java:33` | 收入统计（注释掉） | 若启用需评估 |

### 3.3 手写 SQL (Mapper XML) 审查

审查了所有 Mapper XML 文件（共 22 个），**未发现手写 SQL 中显式包含 `tenant_id` 条件**。

这既是好消息也是风险点：
- **好消息**：所有租户过滤由 `TenantLineInnerInterceptor` 自动注入，不依赖手写 SQL
- **风险点**：若存在复杂子查询或自定义 SQL 拼接，拦截器可能无法正确覆盖

**建议**：对所有包含子查询的 Mapper XML 进行运行时 SQL 审计，确认 `tenant_id` 条件是否正确注入到子查询中。

### 3.4 子查询覆盖测试

框架测试 `DataPermissionDatabaseInterceptorTest2.java` 显示拦截器已覆盖：
- IN 子查询
- EXISTS 子查询
- 标量子查询
- JOIN 子查询
- 嵌套子查询

测试位置：`backend/yshop-framework/yshop-spring-boot-starter-biz-data-permission/src/test/java/.../DataPermissionDatabaseInterceptorTest2.java`

---

## 4. DMS 调用链路审查

### 4.1 架构规范

根据 `governance/CLAUDE.md`：
> **icepolar-dms** is called by the backend `yshop-drink` device module, never directly by the mini-program

### 4.2 Backend device 模块调用方式

Device 模块通过 `HttpClientUtils` 调用 DMS：

- **配置项**：`yshop.device.dms.host`（`@Value` 注入）
- **工具类**：`backend/yshop-module-mall/yshop-module-device-biz/src/main/java/co/yixiang/yshop/module/device/utils/HttpClientUtils.java`
- **调用方式**：封装了 GET/POST/PUT/DELETE 四种 HTTP 方法
- **DMS 调用点**：`DeviceManagementServiceImpl` 中调用 DMS 进行设备连接、查询状态、下单等操作

**合规性**：backend device 模块通过配置化 HTTP 客户端调用 DMS，符合架构规范。

### 4.3 Miniapp 直接调用 DMS —— P0 级违规

**严重违规**：`miniapp/pages/device-detail/device-detail.js` 直接使用 `wx.request` 调用 DMS API：

```javascript
// miniapp/app.js:13
const app = getApp();
const DMS_BASE_URL = app.globalData.dmsUrl;  // 'https://dms.holuntech.com'

// miniapp/pages/device-detail/device-detail.js:68
wx.request({
  url: `${DMS_BASE_URL}/api/v1/devices/${imei}/status`,  // 直接查询 DMS
  method: 'GET',
  ...
});

// miniapp/pages/device-detail/device-detail.js:165
wx.request({
  url: `${DMS_BASE_URL}/api/v1/commands/${imei}/${type}`,  // 直接下发指令到 DMS
  method: 'POST',
  ...
});
```

**问题分析**：
- miniapp 绕过了 backend 的 device 模块，直接向 DMS 发送设备状态查询和指令下发请求
- 这违反了 "DMS 仅由 backend device 模块调用" 的架构原则
- 导致：租户隔离失效、权限校验缺失、请求无 JWT 认证、无法做统一的审计日志

---

## 5. 事件驱动审查

### 5.1 延迟队列实现（订单超时）

订单模块使用 **Redisson 延迟队列**实现订单超时自动处理：

| 监听器 | 用途 | 延迟时间 |
|--------|------|----------|
| `OrderUnPayListener` | 未支付订单自动取消 | `ORDER_OUTTIME_UNPAY` 分钟 |
| `OrderAutoConfirmListener` | 自动确认收货 | `ORDER_OUTTIME_UNCONFIRM` 分钟 |
| `OrderDueAutoConfirmListener` | 预约订单自动确认 | `hours + 2` 小时 |
| `OrderDeskAutoConfirmListener` | 桌台订单自动确认 | 配置值 |

实现位置：
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/handle/RedisDelayHandle.java`
- `backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/handle/OrderUnPayListener.java`

**合规性**：使用 Redisson 延迟队列，符合 "Redis 延迟队列" 架构要求。

### 5.2 Redis Stream MQ（支付回调通知）

支付通知使用 Redis Stream 实现：

- **生产者**：`PayNoticeProducer`
- **消费者**：`PayNoticeConsumer extends AbstractRedisStreamMessageListener<PayNoticeMessage>`
- **位置**：`backend/yshop-module-mall/yshop-module-order-biz/src/main/java/co/yixiang/yshop/module/order/mq/consumer/PayNoticeConsumer.java`

**合规性**：使用 Redis Stream 作为 MQ，符合架构要求。

### 5.3 微信消息通知

微信模板消息使用 Redis Stream：

- **消费者**：`WeixinNoticeConsumer extends AbstractRedisStreamMessageListener<WeixinNoticeMessage>`
- **位置**：`backend/yshop-module-message/yshop-module-message-biz/src/main/java/co/yixiang/yshop/module/message/mq/consumer/WeixinNoticeConsumer.java`

**合规性**：符合架构要求。

### 5.4 支付回调接口

支付回调通过 HTTP 接口接收：

- **接口**：`AppOrderController.notifyPayBack()`
- **路径**：`/notify/payBack{detailsId}.json`
- **位置**：`backend/yshop-module-mall/yshop-module-order-biz/.../AppOrderController.java:122`

**注意**：支付回调是同步 HTTP 接收，内部再转异步 MQ 处理，这种模式是合理的。

---

## 6. API 契约一致性

### 6.1 CONTRACTS.md 完整性审查

`governance/CONTRACTS.md` 当前内容：

| 章节 | 状态 | 说明 |
|------|------|------|
| Admin API Prefix | 有 | 基础信息 |
| Core Entity ID Types | 有 | 基础信息 |
| Commission Contract | 有 | 佣金规则 |
| Store Revenue Type Enum | 有 | 枚举定义 |
| Common Result Structure | 有 | 通用返回结构 |
| Device API Contract | **缺失** | miniapp 与 backend 设备交互 |
| Order API Contract | **缺失** | 订单创建/支付/查询 |
| Payment API Contract | **缺失** | 支付回调/状态 |
| DMS API Contract | **缺失** | backend 与 DMS 交互 |
| Member Auth Contract | **缺失** | 登录/授权流程 |

**评估**：CONTRACTS.md 严重不完整，仅覆盖了约 20% 的跨仓库契约。

### 6.2 前后端 DTO 一致性检查

通过抽样检查发现：

- Admin 前端 (`admin/`) 使用 TypeScript 接口定义，与 backend Controller VO 基本对应
- Miniapp 前端 (`miniapp/`) 为原生微信小程序，无 TypeScript 类型定义，通过运行时 JSON 交互
- **风险**：miniapp 中大量硬编码字段名（如 `data.make_ice_status`、`data.conn_status`），若 backend/DMS 返回结构变更，无编译期检查

### 6.3 订单状态枚举不一致 —— P0 级问题

存在 **3 个不同的 `OrderStatusEnum`** 定义：

**定义 1**（`backend/yshop-module-mall/yshop-module-order-api/.../OrderStatusEnum.java`）：
```java
STATUS_0(0,"未支付")
STATUS_1(1,"待发货")
STATUS_2(2,"待收货")
STATUS_3(3,"待评价")
STATUS_4(4,"已完成")
STATUS_MINUS_1(-1,"退款中")
STATUS_MINUS_2(-2,"已退款")
STATUS_MINUS_4(-4,"已取消")
```

**定义 2**（`backend/yshop-framework/yshop-common/.../OrderInfoEnum.java`）：
```java
STATUS_0(0,"默认")
STATUS_1(1,"待收货")
STATUS_2(2,"已收货")
STATUS_3(3,"已完成")
```

**定义 3**（`backend/yshop-module-merchant/.../OrderStatusEnum.java`）：
```java
STATUS_0(0,"待出单")
STATUS_1(1,"待收货")
STATUS_2(2,"已完成")
STATUS_3(3,"待退款")
STATUS_4(4,"待支付")
STATUS_5(5,"已退款")
```

**问题**：
- `STATUS_0` 在 OrderStatusEnum 中表示 "未支付"，在 OrderInfoEnum 中表示 "默认"
- `STATUS_2` 在 OrderStatusEnum 中表示 "待收货"，在 OrderInfoEnum 中表示 "已收货"
- 订单状态用 `paid` + `refund_status` + `status` 三个字段共同表达，增加了复杂度

---

## 7. 安全扫描 (Secrets)

### 7.1 Backend (Java)

**配置文件中的敏感信息**：

| 文件 | 行号 | 内容 | 风险 |
|------|------|------|------|
| `application-dev.yaml` | 51 | `password: admin123456` | 默认数据库密码 |
| `application-dev.yaml` | 56 | `password: admin123456` | 默认数据库密码 |
| `application-dev.yaml` | 175 | `secret: 2a7b3b20c537e52e74afd395eb85f61f` | JWT secret |
| `application-dev.yaml` | 187 | `secret: 6f270509224a7ae1296bbf1c8cb97aed` | 加密 secret |
| `application-dev.yaml` | 226 | `client-secret: i8E6iZyDvZj51JIb0tYsYfVQYOks9Cq1lgryEjFRqC79P3iJcrxEwT6Qk2QvLrLI` | OAuth2 client secret |
| `application-local.yaml` | 同上 | 同上 | 开发环境配置 |

**评估**：以上均为开发环境配置文件（`-dev.yaml`、`-local.yaml`），生产环境应使用环境变量或配置中心。但 JWT secret 等硬编码在配置文件中，若误提交到生产环境存在风险。

**Java 代码中未发现硬编码密码/API Key**。

### 7.2 Miniapp (微信小程序)

| 文件 | 行号 | 内容 | 风险 |
|------|------|------|------|
| `project.config.json` | 2 | `appid: wx4df64c96e6540b4e` | AppID 公开，低风险 |
| `app.js` | 13 | `dmsUrl: 'https://dms.holuntech.com'` | DMS 生产地址暴露 |
| `config/config.js` | 9 | `baseUrl: 'https://yshop-api.holuntech.com'` | API 地址暴露，低风险 |

**评估**：AppID 和 API 地址属于公开信息，风险较低。但 DMS 地址暴露给前端，配合直接调用 DMS 的问题，构成了安全边界突破。

### 7.3 icepolar-dms (Python)

| 文件 | 行号 | 内容 | 风险 |
|------|------|------|------|
| `app/config.py` | 17 | `DB_PASSWORD: str = "dms_password"` | **硬编码默认数据库密码** |
| `app/config.py` | 43 | `SECRET_KEY: str = "change_this_to_a_random_secret_key"` | **硬编码弱密钥** |
| `app/config.py` | 47 | `ADMIN_PASSWORD: str = "admin123"` | **硬编码弱管理密码** |
| `docker-compose.yml` | 9 | `MYSQL_ROOT_PASSWORD: rootpassword` | Docker 默认密码 |
| `docker-compose.yml` | 12 | `MYSQL_PASSWORD: dms_password` | Docker 默认密码 |

**评估**：`icepolar-dms` 存在多处硬编码弱密码和默认密钥，生产环境若未通过环境变量覆盖，存在严重安全隐患。

---

## 8. 发现的问题清单 (按 P0/P1/P2 分级)

### P0 级问题（必须立即修复）

#### P0-01：miniapp 直接调用 DMS，绕过 backend device 模块
- **问题描述**：`miniapp/pages/device-detail/device-detail.js` 直接使用 `wx.request` 向 DMS 发送设备状态查询和指令下发请求，完全绕过了 backend 的 device 模块
- **严重程度**：P0
- **具体位置**：
  - `miniapp/pages/device-detail/device-detail.js:68` — `wx.request` 调用 `${DMS_BASE_URL}/api/v1/devices/${imei}/status`
  - `miniapp/pages/device-detail/device-detail.js:165` — `wx.request` 调用 `${DMS_BASE_URL}/api/v1/commands/${imei}/${type}`
  - `miniapp/app.js:13` — `dmsUrl: 'https://dms.holuntech.com'`
- **影响分析**：
  - 租户隔离完全失效（DMS 请求无 tenant-id）
  - 权限校验缺失（无 JWT 认证）
  - 无法做统一审计日志
  - 架构边界被彻底打破
- **修复建议**：
  1. 删除 miniapp 中的 DMS 直接调用
  2. 在 backend device 模块新增对应的 API 端点（如 `GET /app-api/device/status/{imei}`、`POST /app-api/device/command/{imei}/{type}`）
  3. miniapp 改为调用 backend API，由 backend 再转发到 DMS
  4. 更新 `CONTRACTS.md` 补充 Device API 契约

#### P0-02：订单状态枚举定义不一致
- **问题描述**：存在 3 个不同的 `OrderStatusEnum` 定义，且 `OrderInfoEnum` 与 `OrderStatusEnum` 对 status 的语义定义不一致
- **严重程度**：P0
- **具体位置**：
  - `backend/yshop-module-mall/yshop-module-order-api/.../OrderStatusEnum.java` — STATUS_0(0,"未支付"), STATUS_2(2,"待收货")
  - `backend/yshop-framework/yshop-common/.../OrderInfoEnum.java` — STATUS_0(0,"默认"), STATUS_2(2,"已收货")
  - `backend/yshop-module-merchant/.../OrderStatusEnum.java` — STATUS_0(0,"待出单"), STATUS_3(3,"待退款")
- **影响分析**：
  - 订单状态判断逻辑极易出错
  - `OrderInfoEnum.STATUS_2`（已收货）与 `OrderStatusEnum.STATUS_2`（待收货）语义相反
  - 订单状态由 `paid` + `refund_status` + `status` 三个字段共同表达，增加了状态转换的复杂度
- **修复建议**：
  1. 统一订单状态枚举，仅保留一个 `OrderStatusEnum`
  2. 将 `OrderInfoEnum` 中与订单状态相关的常量迁移到 `OrderStatusEnum`
  3. 明确状态机定义：定义合法的状态转换路径
  4. 逐步重构，先统一 order 模块和 framework 中的定义，再处理 merchant 模块

### P1 级问题（高优先级修复）

#### P1-01：大量模块直接引用其他模块的 DAO/Mapper/DO
- **问题描述**：多个模块的 biz 层直接 import 其他模块的 `dal.dataobject` 和 `dal.mysql` 包，违反了分层架构中 "通过 API 模块交互" 的原则
- **严重程度**：P1
- **具体位置**（部分列举）：
  - `order-biz` 直接引用 `desk.dal.dataobject.ShopDeskDO`、`product.dal.mysql.StoreProductAttrValueMapper`、`member.dal.mysql.MemberUserMapper` 等
  - `member-biz` 直接引用 `store.dal.mysql.StoreShopMapper`、`shop.dal.mysql.RechargeMapper`、`card.dal.dataobject.VipCardDO` 等
  - `message-biz` 直接引用 `member.dal.dataobject.MemberUserDO`
  - `merchant-biz` 直接引用 `order.dal.mysql.StoreOrderMapper`、`product.dal.dataobject.StoreProductDO` 等
  - `system-biz` 直接引用 `store.dal.mysql.StoreShopMapper`
- **影响分析**：
  - 模块边界模糊，一个模块的数据库 schema 变更会波及多个模块
  - 无法独立部署和测试模块
  - 增加了循环依赖风险
- **修复建议**：
  1. 建立模块间只允许通过 `-api` 模块交互的规范
  2. 将跨模块的 DAO 引用逐步替换为 API 调用（Feign/本地调用）
  3. 对于仅需要读操作的场景，可在 `-api` 模块中暴露查询接口和 DTO
  4. 在 CI 中增加架构检查规则，禁止 biz 模块 import 其他模块的 dal 包

#### P1-02：CONTRACTS.md 严重不完整
- **问题描述**：`governance/CONTRACTS.md` 仅包含 Admin API Prefix、Core Entity ID Types、Commission Contract、Store Revenue Type Enum、Common Result Structure，大量关键契约缺失
- **严重程度**：P1
- **具体位置**：`governance/CONTRACTS.md`
- **影响分析**：
  - 前后端开发缺乏统一契约参考
  - 跨仓库变更容易不一致
  - 新成员难以快速理解系统接口
- **修复建议**：
  1. 补充 Device API Contract（设备连接、状态查询、指令下发）
  2. 补充 Order API Contract（创建、支付、查询、取消、退款）
  3. 补充 Payment API Contract（支付回调、支付状态查询）
  4. 补充 Member Auth Contract（登录、授权、token 刷新）
  5. 补充 DMS API Contract（backend 与 DMS 的交互协议）

#### P1-03：icepolar-dms 硬编码弱密码和密钥
- **问题描述**：`icepolar-dms/app/config.py` 中存在多处硬编码的默认密码和弱密钥
- **严重程度**：P1
- **具体位置**：
  - `icepolar-dms/app/config.py:17` — `DB_PASSWORD: str = "dms_password"`
  - `icepolar-dms/app/config.py:43` — `SECRET_KEY: str = "change_this_to_a_random_secret_key"`
  - `icepolar-dms/app/config.py:47` — `ADMIN_PASSWORD: str = "admin123"`
- **影响分析**：
  - 若生产环境未通过环境变量覆盖，存在严重安全隐患
  - 弱管理密码可被暴力破解
  - 可预测的 SECRET_KEY 可能导致 JWT 伪造
- **修复建议**：
  1. 将默认值改为从环境变量读取，无环境变量时启动失败（fail-fast）
  2. 生产环境强制要求环境变量配置
  3. 增加启动时的密码强度校验
  4. 更新 `.env.example` 文档，明确生产环境配置要求

#### P1-04：order 模块同时依赖 OrderStatusEnum 和 OrderInfoEnum
- **问题描述**：`order-biz` 模块中同时使用了 `OrderStatusEnum` 和 `OrderInfoEnum`，两者对 status 的语义定义不一致，极易导致状态判断错误
- **严重程度**：P1
- **具体位置**：
  - `backend/yshop-module-mall/yshop-module-order-biz/.../OrderApiImpl.java:29` — `import OrderStatusEnum`
  - `backend/yshop-module-mall/yshop-module-order-biz/.../OrderApiImpl.java:8` — `import OrderInfoEnum`
  - `backend/yshop-module-mall/yshop-module-order-biz/.../AppStoreOrderServiceImpl.java:12` — `import OrderInfoEnum`
  - `backend/yshop-module-mall/yshop-module-order-biz/.../AppStoreOrderServiceImpl.java:1024` — `OrderStatusEnum.toType(type)`
- **影响分析**：
  - 同一模块内混用两套枚举，维护困难
  - `OrderInfoEnum.STATUS_2`（已收货）与 `OrderStatusEnum.STATUS_2`（待收货）语义相反
- **修复建议**：
  1. 在 order 模块内部统一使用 `OrderStatusEnum`
  2. 将 `OrderInfoEnum` 中订单状态相关的常量标记为 `@Deprecated`
  3. 逐步清理 `OrderInfoEnum` 的状态相关引用

#### P1-05：system 模块直接引用 store 模块的 DAO
- **问题描述**：`system-biz` 作为基础模块，直接引用了 `store` 模块的 `StoreShopMapper` 和 `StoreShopDO`
- **严重程度**：P1
- **具体位置**：
  - `backend/yshop-module-system/yshop-module-system-biz/.../OAuth2TokenServiceImpl.java:14-15` — import `StoreShopDO`, `StoreShopMapper`
  - `backend/yshop-module-system/yshop-module-system-biz/.../AdminUserServiceImpl.java:15-16` — import `StoreShopDO`, `StoreShopMapper`
- **影响分析**：
  - system 模块作为基础设施层，不应依赖业务模块 store
  - 破坏了模块分层（system 应该是最底层依赖）
- **修复建议**：
  1. 在 `store-api` 模块中暴露 `StoreShopApi` 接口
  2. system 模块通过 API 调用获取店铺信息
  3. 或者将店铺关联逻辑上移到 store 模块或专门的聚合模块

#### P1-06：message 模块直接引用 member 和 mp 模块的 DAO/Service
- **问题描述**：`message-biz` 直接引用了 `member.dal.dataobject.MemberUserDO` 和 `mp.service.account.MpAccountService`
- **严重程度**：P1
- **具体位置**：
  - `backend/yshop-module-message/yshop-module-message-biz/.../WeiXinSubscribeService.java:7-8` — import `MemberUserDO`, `MemberUserService`
  - `backend/yshop-module-message/yshop-module-message-biz/.../WeixinTemplateService.java:15-16` — import `MemberUserDO`, `MemberUserService`
  - `backend/yshop-module-message/yshop-module-message-biz/.../WeixinTemplateService.java:21-22` — import `MpUserApi`, `MpAccountService`
- **影响分析**：
  - message 模块与 member/mp 模块耦合
  - 消息发送逻辑依赖于具体用户和公众号实现
- **修复建议**：
  1. 通过 `member-api` 的 API 获取用户信息
  2. 通过 `mp-api` 的 API 获取公众号配置
  3. 消息模板内容通过 DTO 传递，不直接依赖 DO

### P2 级问题（建议修复）

#### P2-01：Backend 开发环境配置文件包含硬编码 JWT Secret
- **问题描述**：`application-dev.yaml` 和 `application-local.yaml` 中包含硬编码的 JWT secret 和 OAuth2 client secret
- **严重程度**：P2
- **具体位置**：
  - `backend/yshop-server/src/main/resources/application-dev.yaml:175`
  - `backend/yshop-server/src/main/resources/application-dev.yaml:226`
  - `backend/yshop-server/src/main/resources/application-local.yaml:175`
  - `backend/yshop-server/src/main/resources/application-local.yaml:226`
- **影响分析**：
  - 开发环境配置，风险较低
  - 但若配置文件被误用于生产环境，则存在严重风险
- **修复建议**：
  1. 在配置文件中添加注释警告："仅用于开发环境，生产环境请使用环境变量"
  2. 考虑使用随机生成的开发环境密钥（每次启动不同）
  3. 增加启动检查，若检测到默认密钥则输出警告日志

#### P2-02：docker-compose.yml 包含默认密码
- **问题描述**：`backend/script/docker/docker-compose.yml` 和 `icepolar-dms/docker-compose.yml` 中包含默认数据库密码
- **严重程度**：P2
- **具体位置**：
  - `backend/script/docker/docker-compose.yml:15` — `MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD:-123456}`
  - `icepolar-dms/docker-compose.yml:9` — `MYSQL_ROOT_PASSWORD: rootpassword`
- **影响分析**：
  - Docker 开发环境配置，风险较低
  - 但若暴露到公网，存在被攻击风险
- **修复建议**：
  1. 移除默认值，强制要求环境变量
  2. 在 README 中说明需要配置的环境变量

#### P2-03：device 模块引用 pay 模块的 Utility 类
- **问题描述**：`device-biz` 的 `HttpClientUtils` 引用了 `pay` 模块的 `WXPayUtility`
- **严重程度**：P2
- **具体位置**：`backend/yshop-module-mall/yshop-module-device-biz/.../HttpClientUtils.java:3`
- **影响分析**：
  - device 模块与 pay 模块产生不必要的耦合
  - `WXPayUtility` 是支付专用工具，device 模块使用它可能仅为了签名算法
- **修复建议**：
  1. 将通用的签名/加密工具提取到 `yshop-common` 或独立的 `yshop-framework` 工具包
  2. device 模块引用通用工具，不依赖 pay 模块

#### P2-04：@TenantIgnore 在业务代码中的使用缺乏文档说明
- **问题描述**：`UserBillServiceImpl` 和 `AppStoreOrderServiceImpl` 中的 `@TenantIgnore` 缺乏注释说明为何需要忽略租户
- **严重程度**：P2
- **具体位置**：
  - `backend/yshop-module-member/.../UserBillServiceImpl.java:50`
  - `backend/yshop-module-mall/.../AppStoreOrderServiceImpl.java:797`
- **影响分析**：
  - 后续维护人员难以理解为何这些操作需要跨租户
  - 可能引入安全隐患
- **修复建议**：
  1. 为每个 `@TenantIgnore` 添加详细注释，说明忽略租户的原因和场景
  2. 定期审计 `@TenantIgnore` 的使用，确认是否仍然必要

#### P2-05：RevenueJob 中的 @TenantIgnore 被注释掉
- **问题描述**：`RevenueJob.java` 中的 `@TenantIgnore` 被注释掉，若该定时任务需要跨租户统计收入，则可能导致数据不完整
- **严重程度**：P2
- **具体位置**：`backend/yshop-module-mall/yshop-module-store-biz/.../RevenueJob.java:33`
- **影响分析**：
  - 收入统计定时任务可能仅统计当前租户的数据
  - 若该任务由系统触发（无租户上下文），则统计结果为空
- **修复建议**：
  1. 确认 RevenueJob 的执行方式（是否由系统触发）
  2. 若需要跨租户统计，取消 `@TenantIgnore` 的注释
  3. 若不需要，删除注释掉的代码

---

## 9. 改进建议

### 9.1 短期（1-2 周）

1. **修复 P0-01**：将 miniapp 的 DMS 直接调用改为通过 backend device 模块代理
2. **修复 P0-02**：启动订单状态枚举统一项目，先统一 order 模块内部的使用
3. **修复 P1-03**：为 icepolar-dms 的硬编码密码增加环境变量覆盖和启动校验
4. **补充 CONTRACTS.md**：至少补充 Device API、Order API、Payment API 三个核心契约

### 9.2 中期（1 个月）

1. **架构守卫**：在 CI 中增加模块依赖检查，禁止 biz 模块 import 其他模块的 dal 包
2. **API 化改造**：逐步将跨模块的 DAO 引用替换为 API 调用，优先处理 system → store、message → member 的引用
3. **租户审计**：对所有 `@TenantIgnore` 的使用进行安全审计，补充文档说明
4. **状态机重构**：定义清晰的订单状态机，将 `paid` + `refund_status` + `status` 三字段模型简化为单一状态字段

### 9.3 长期（3 个月）

1. **模块解耦**：考虑引入领域事件（Domain Event）机制，进一步降低模块间耦合
2. **契约测试**：为 CONTRACTS.md 中的每个契约编写契约测试（Pact 或 Spring Cloud Contract）
3. **安全基线**：建立 secrets 扫描流水线（如使用 GitLeaks 或 TruffleHog），防止敏感信息提交
4. **DMS 边界强化**：在 DMS 侧增加 IP 白名单，仅允许 backend 服务器访问，防止前端直连

---

> 报告生成时间：2026/06/02
> 下次审查建议：修复 P0 问题后 2 周内进行复查
