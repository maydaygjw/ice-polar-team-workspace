# Backlog Item: 模块化单体 → 可拆分架构演进方案

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-009 |
| Title | 模块化单体 → 可拆分架构演进方案（Modular Monolith → Extractable） |
| Status | `draft` |
| Priority | `P1` |
| Created | 2026-07-28 |
| Author | gejunwen |
| Tags | architecture, spring-modulith, modular-monolith, event-driven, tech-debt |

## Problem / Need

当前 backend 是标准的模块化单体（Modular Monolith）：17 个 Maven 模块全部编译进 `yshop-server` 一个 fat jar，由单一 `@SpringBootApplication` 入口启动。部署形态只有"全有或全无"——要么整个应用一个进程，要么没有。

实际运行中遇到的问题：

1. **模块边界名存实亡**：表面上是 `-api`/`-biz` 分离，实际大量越界。`order-biz` 依赖 10 个其他 `-biz`；`store-biz` 被 9 个模块直接 import DO/Mapper；约 80+ 处跨模块直接 `@Autowired` 对方 Service。模块边界只是"文件夹分层"，不是真正的模块化。

2. **部署形态不可选**：无法做到"只把支付拆成独立服务"或"设备模块独立部署"。任何模块的改动都需要整个应用一起发版、一起扩容。

3. **渐进拆分无路径**：从单体到微服务没有平滑路径。如果未来某个模块（如支付、设备）需要独立部署，只能大重构，无法在不动业务代码的前提下切换部署形态。

4. **跨模块副作用通过直接调用触发**：支付完成 → 直接调订单更新状态；订单创建 → 直接调会员扣余额。这些同步调用在拆分时必须改为异步事件，但当前没有事件机制，全部耦合在代码里。

## Context

### 技术现状

- **框架**：Spring Boot 3.2.2，Java 17，无 Spring Cloud（无注册中心/配置中心/网关/分布式事务）
- **模块结构**：17 个 Maven 模块，`-api`（DTO/接口/常量）+ `-biz`（Controller/Service/Mapper/DO）
- **基础设施**：单库 MySQL 8.0（`yshop_pro`），Redis 6，Redisson 延迟队列，RocketMQ starter 已在 framework 但未启用
- **异步消息**：自研 Redis Stream（`RedisMQTemplate` + `AbstractRedisStreamMessage`）
- **租户隔离**：`TenantContextHolder` ThreadLocal + MyBatis Plus `TenantLineHandler` 拦截器

### 有利条件

- 模块结构已经是 `-api`/`-biz` 分离，有 21 个 `*Api.java` 接口和 268 处合规引用
- 已有跨模块异步消息先例：`PayNoticeMessage`（pay-api → order-biz + bidrank-biz）、`SendCouponMessage`（coupon-biz → member-biz）
- 所有业务表共享同一 MySQL 实例，拆分初期可继续共享（各自访问各自表）

### 不利条件

- `store-biz` 是全局 hub，被 9 个模块直接 import DO/Mapper/Service/VO/Convert
- `order-biz` 依赖面最大（10 个 `-biz`），是拆分的"硬骨头"
- `message-biz` 下的 `redismq` 包是非标准结构，被 `order-biz` 直接 import
- 大量跨模块调用未在 pom.xml 中声明（编译期能通过是因为 `yshop-server` 包进了所有 `-biz`）

## 方案概述

### 核心思路

**不引入 Spring Cloud，用 Spring Modulith 实现"代码层面模块化单体，部署层面按需拆分"**。

关键洞察：模块边界（代码层）和部署拓扑（运维层）是两个正交的维度。Spring Modulith 把这两个维度解耦——模块边界在代码中固定（通过 `-api` 接口和事件通信），部署拓扑在运行时自由组合（通过事件外部化 + 条件 Bean 装配）。

### 演进路径

```
Phase A: 解耦（零部署风险，纯代码重构）
  │
  ▼
Phase B: 引入 Spring Modulith（事件驱动 + 模块验证）
  │
  ▼
Phase C: 按需拆分（渐进式，每次拆一个模块）
  │
  ▼
目标形态：模块化单体，可按需拆出任意模块为独立服务
```

#### Phase A — 解耦（1-2 周）

目标：消除所有跨模块直接 import，收敛到 `-api` 接口。

1. **上移共享 DO/Mapper/VO 到 `-api`**：`store-biz` 的 `StoreShopDO`/`StoreShopMapper`、`member-biz` 的 `MemberUserDO` 等被跨模块使用的类，上移到对应 `-api` 模块。

2. **补齐 `-api` 接口**：为每个被跨模块调用的 Service 定义接口（`StoreShopApi`、`MemberUserApi` 等），实现放在 `-biz`。

3. **处理 `redismq` 非标准包**：`message-biz` 下的 `redismq` 包上移到 `message-api`，`DelayedQueue` 抽象为接口。

4. **加 Maven Enforcer**：禁止 `*-biz → *-biz` 依赖，CI 拦截越界。

#### Phase B — 引入 Spring Modulith（2-3 天）

目标：建立事件驱动的跨模块通信机制，验证模块边界。

1. **加依赖**：`spring-modulith-starter-core` + `spring-modulith-starter-test`

2. **每个 `-biz` 模块加 `package-info.java`**：声明 `@ApplicationModule` 和 `allowedDependencies`

3. **跨模块副作用改为事件**：同步查询保持 `-api` 调用，副作用/状态变更改为 `ApplicationEventPublisher.publishEvent()`

4. **跑模块验证测试**：`@ApplicationModuleTest` 自动验证模块依赖是否合法

#### Phase C — 按需拆分（渐进式）

目标：任意模块可拆为独立服务，其余模块保持合并进程。

1. **每个部署单元 = 一个入口模块**：新增 `yshop-server-pay`、`yshop-server-device` 等，每个只聚合自己的 `-biz` + 共享内核（system/infra/framework）

2. **事件路由**：用 `@Externalized` 标注需要跨进程的事件，自动发到 MQ（RocketMQ/Kafka）；进程内事件保持本地传递，零开销

3. **同步查询跨界**：`-api` 接口提供本地实现和远程实现两种，按配置切换（`@ConditionalOnProperty`）

4. **共享内核**：`system`/`infra`/`framework` 作为库打进每个服务，所有服务构建自同一个 commit

### 拆分候选排序

| 模块 | 拆分价值 | 理由 |
|------|---------|------|
| **pay** | ⭐⭐⭐⭐⭐ | 边界最清晰，回调链路独立，合规要求，第一个拆 |
| **device** | ⭐⭐⭐⭐ | 独立通信协议，对接 icepolar-dms，print/ice 子模块在演进 |
| order/mall | ⭐⭐⭐ | 流量最大但依赖最多（10 个模块），最后拆 |
| message | ⭐⭐ | 天然异步，但体量小，留主进程即可 |
| system/infra | ❌ 不拆 | 共享内核，每个服务都需要 |
| score/express/bidrank 等 | ❌ 不拆 | 体量小，独立部署收益为负 |

### 事件驱动技术选型

| 场景 | 方案 | 说明 |
|------|------|------|
| 单体模式 | Spring `ApplicationEventPublisher` | 零依赖，JVM 内传递 |
| 微服务模式（异步） | Spring Modulith `@Externalized` → RocketMQ | 你已有 RocketMQ starter，配置一行启用 |
| 微服务模式（同步查询） | `-api` 接口 → 远程实现（RestClient/OpenFeign） | 接口签名不变，实现按配置切换 |
| Redis Stream | 自定义 `ExternalizedEventType`（可选） | Spring Modulith 不原生支持，但可插拔 |

### 关键决策

1. **不用 Spring Cloud**：不引入 Nacos/Feign/Gateway/Seata，降低复杂度。Spring Modulith 的事件驱动 + 条件 Bean 已足够覆盖拆分需求。

2. **不用 Seata 分布式事务**：跨进程一致性用事件驱动 + 幂等消费（Outbox 模式）保证，不需要两阶段提交。

3. **共享数据库过渡**：拆分初期继续共享 MySQL，各自访问各自表。终态再考虑分库。

4. **共享内核作为库依赖**：`system`/`infra`/`framework` 不拆为独立服务，作为库打进每个服务。

### 与 BACKLOG-006 的关系

BACKLOG-006 提出了基于 Spring Cloud 的拆分方案（Nacos + Feign + Gateway + Seata），是**重量级方案**。

BACKLOG-009 提出了基于 Spring Modulith 的方案，是**轻量级方案**。

| 维度 | BACKLOG-006（Spring Cloud） | BACKLOG-009（Spring Modulith） |
|------|---------------------------|-------------------------------|
| 引入组件 | Nacos + Feign + Gateway + Seata | spring-modulith-starter-core |
| 分布式事务 | Seata | 事件驱动 + 幂等 |
| 学习成本 | 高 | 低 |
| 单体性能 | 有损（RPC 序列化） | 无损（事件在 JVM 内传递） |
| 拆分灵活性 | 高（但需维护注册中心） | 高（配置切换，代码不变） |
| 适合阶段 | 已确定拆微服务 | 先单体，未来可能拆 |

**建议**：先按 BACKLOG-009 完成 Phase A/B（解耦 + 事件驱动），这是两个方案共同的前置条件。如果后续确实需要完整微服务体系，再叠加 Spring Cloud 组件。

## Acceptance Criteria

Phase A（可独立验收）：
- [ ] `maven-enforcer-plugin` 配置生效，CI 能拦截 `*-biz → *-biz` 依赖
- [ ] 核心 `-api` 缺口补齐：`store-api`、`member-api`、`order-api` 对外方法
- [ ] `order-biz`/`store-biz`/`member-biz`/`merchant-biz` 的全部跨模块引用改为走 `-api` 接口
- [ ] `message-biz` 的 `redismq` 包上移到 `message-api`
- [ ] 交叉依赖校验通过（无 biz→biz Maven 依赖 + 无跨模块 Service import）

Phase B（待 Phase A 完成后细化）：
- [ ] `spring-modulith-starter-core` 引入，所有模块加 `package-info.java`
- [ ] 跨模块副作用调用全部改为事件驱动（支付完成、订单创建、会员扣减等）
- [ ] `@ApplicationModuleTest` 验证通过，无模块依赖违规

Phase C（待 Phase B 完成后细化）：
- [ ] `pay-service` 可独立部署，与主进程通过 MQ 通信
- [ ] 事件外部化配置生效（`@Externalized` 标注的事件自动发到 MQ）
- [ ] 同步查询跨界切换验证通过（本地实现 ↔ 远程实现按配置切换）
