# Backlog Item: 微服务拆分评估与解耦

## Metadata

| Field | Value |
|-------|-------|
| ID | BACKLOG-006 |
| Title | 微服务拆分评估与解耦 |
| Status | `draft` |
| Priority | `P2` |
| Created | 2026-07-24 |
| Author | gejunwen |
| Tags | architecture, microservice, decoupling, modular-monolith, tech-debt |

## Problem / Need

当前 backend 是典型的"模块化单体"（modular monolith）：17 个 Maven 模块全部聚合到 `yshop-server` 一个 fat jar 部署。治理规则（`ARCHITECTURE.md`）要求跨模块调用只走 `-api`，但实际 ~80+ 处直接 `@Autowired` 对方 biz 的 Service，核心模块 `order-biz`/`store-biz`/`member-biz` 存在严重硬耦合。

随着业务增长（支付、订单、会员、营销、竞价等多域并行演进），单体部署的隔离性、独立扩缩容、团队分工边界逐渐成为瓶颈。

## Context

### 现状摸底（2026-07-24）

**基础设施**：
- Spring Boot 3.2.2，Java 17，无 Spring Cloud（无 Nacos/Feign/Gateway/Seata）
- 单库（MySQL `yshop_pro`，dynamic-datasource 做主备读写分离），所有业务表共享同一实例
- 租户隔离通过 `TenantContextHolder` ThreadLocal + MyBatis Plus `TenantLineHandler` 拦截器注入 `tenant_id`
- 异步消息统一走 Redis Stream（`RedisMQTemplate` + `AbstractRedisStreamMessage`），framework 内也含 RocketMQ starter 可用
- 延迟队列自研，基于 Redisson `RBlockingDeque + getDelayedQueue`

**模块依赖现状**：
- **已松耦合（只依赖 `-api`，可直接拆）**：`infra`、`pay`、`express`、`mp`、`bidrank`、`canvas`
- **硬耦合（拆前需解耦）**：
  - `order-biz` 依赖 6 个其它 biz：`desk/express/message/mp/pay/product/score`
  - `store-biz` 是全局 hub，被 8 个模块依赖，自己又依赖 `pay-biz`
  - `member-biz` 依赖 `system-biz`/`shop-biz`/`coupon-biz`/`card-biz`/`mp-biz`
  - `merchant-biz` 依赖 `order-biz`
  - `message-biz`/`score-biz` 依赖 `member-biz`
- **`-api` 接口形态**：Spring Bean 风格的本地 facade（`XxxApi` interface + `XxxApiImpl`），共 21 个 `*Api.java`，268 处合规引用

**跨模块异步消息**（已跨进程友好）：
- `PayNoticeMessage`（pay-api → order-biz + bidrank-biz）
- `SendCouponMessage`（coupon-biz → member-biz）
- 生产者/消息体已在 pay-api 包内

### 建议拆分思路（四步走，分三阶段）

**Phase A — 解耦（零部署风险）**：
1. 加 `maven-enforcer-plugin` 禁止 `*-biz → *-biz` 依赖，生成精确解耦工单
2. 补齐缺失的 `-api` 接口，把所有 80+ 违规引用改为走接口
3. 目标：干净的模块化单体，所有跨模块调用走接口

**Phase B — 试点（验证基建）**：
1. 引入 Spring Cloud 全家桶（Nacos 注册中心/配置中心 + OpenFeign RPC + Gateway 网关）
2. 引入 Seata 处理分布式事务
3. 抽 `pay-service` 独立部署（最干净、最独立），跑通全套流程
4. 解决：租户 ThreadLocal → RPC header 透传、分库/分 schema

**Phase C — 推广（逐域拆）**：
- 建议收敛为 4~6 个服务（非 17 个模块 1:1 平迁）：

| 服务 | 收敛模块 | 拆分顺序 |
|------|---------|---------|
| platform-service | system + infra | 2nd |
| pay-service | pay | 1st（试点） |
| order-service | mall(order+desk+device) + merchant | 最后 |
| product-store-service | mall(shop+store+product+canvas) | 3rd |
| member-marketing-service | member + marketing(coupon+card) + score | 4th |
| edge-service | message + mp + express + site + bidrank | 最早（外围） |

- 拆分顺序：先外围、后核心。`order`/`store` 留到最后，等前面所有服务都跑稳。

### 架构治理对齐

拆分前需走 Architecture Agent 流程：
- 新增 ADR `adr-00X-microservice-split.md`
- 更新 `ARCHITECTURE.md` 模块依赖规则 → 服务边界 + RPC 契约
- 产出 `technical-design.md` + `contract-changes.md`

## Acceptance Criteria

以下均为 Phase A 的可验收成果，Phase B/C 待 Phase A 完成后细化。

- [ ] `maven-enforcer-plugin` 配置生效，CI 能拦截 `*-biz → *-biz` 依赖
- [ ] 补齐核心 `-api` 缺口：`store-api` 对外方法（StoreShopService/StoreWithdrawalService/UserBankService 等）、`member-api`、`order-api` 补齐
- [ ] `order-biz`/`store-biz`/`member-biz`/`merchant-biz` 的全部跨模块引用改为走接口
- [ ] 交叉依赖校验通过（无 biz→biz Maven 依赖 + 无跨模块 Service import）
