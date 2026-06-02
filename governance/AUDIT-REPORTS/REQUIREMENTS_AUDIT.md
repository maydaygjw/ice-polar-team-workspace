# 代码质量排查范围与验收标准

> 生成日期：2026-06-02
> 适用范围：ice-polar-team-workspace 全仓库（backend / admin / miniapp / icepolar-dms）
> 依据规范：governance/CLAUDE.md、ARCHITECTURE.md、CONTRACTS.md

---

## 一、排查范围清单

### 1.1 范围总览

| 仓库 | 技术栈 | 文件总量（估算） | 核心审查模块 |
|------|--------|-----------------|-------------|
| `backend/` | Java 17 / Spring Boot 3.2 / MyBatis Plus / Maven | ~1,881 Java + ~25 Mapper XML + ~5 SQL | 租户隔离、订单状态机、支付回调、佣金计算、设备-DMS 调用链 |
| `admin/` | Vue3 / Vite4 / Element Plus / TypeScript / pnpm | ~831 TS/Vue/JS | API 客户端、订单管理页面、设备管理页面、佣金配置页面 |
| `miniapp/` | 原生微信小程序（WXML/WXSS/JS） | ~47 页面文件 | 登录鉴权、设备控制页面、支付流程、订单列表 |
| `icepolar-dms/` | Python 3.12+ / FastAPI / SQLAlchemy 2.x / pytest | ~56 Python（含 ~20 测试） | 设备命令路由、MQTT 通信、订单状态同步、API 安全 |

### 1.2 backend/ 详细审查范围

#### P0 — 安全与租户隔离（必须审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| 租户拦截器 | `yshop-framework/yshop-spring-boot-starter-biz-tenant/**/*.java` | `TenantLineInnerInterceptor`、`TenantContextHolder`、`TenantDatabaseInterceptor`、`TenantBaseDO` |
| 数据权限拦截器 | `yshop-framework/yshop-spring-boot-starter-biz-data-permission/**/*.java` | `DataPermissionDatabaseInterceptor`、`DataPermissionAnnotationInterceptor` |
| 安全配置 | `yshop-framework/yshop-spring-boot-starter-security/**/*.java` | `YshopWebSecurityConfigurerAdapter`、`SecurityProperties`、`AuthorizeRequestsCustomizer` |
| 配置文件 | `yshop-server/src/main/resources/application*.y{a,}ml` | 数据库密码、JWT secret、API key 等 secrets 检查 |
| SQL 文件 | `backend/sql/*.sql` | 禁止直接修改 `yixiang-drink.sql`，检查 upgrade 脚本规范 |
| 新查询审查 | 所有 `*Mapper.java`、`*Mapper.xml`、`*.java` 中含 `new QueryWrapper` 或 `LambdaQueryWrapper` 的文件 | 确认未绕过 `tenant_id` 隔离 |

#### P1 — 架构合规（必须审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| 订单状态枚举 | `yshop-module-mall/yshop-module-order-api/**/OrderStatusEnum.java` | 与 `OrderInfoEnum` 不一致问题 |
| 订单服务实现 | `yshop-module-mall/yshop-module-order-biz/**/AppStoreOrderServiceImpl.java` | 支付成功回调逻辑、三字段状态机 |
| 订单 Mapper | `yshop-module-mall/yshop-module-order-biz/**/StoreOrderMapper.java` / `.xml` | 状态查询 ground truth |
| 佣金服务 | `yshop-module-mall/yshop-module-order-biz/**/CommissionServiceImpl.java` | Commission > Inheritance 规则实现 |
| 设备管理 | `yshop-module-mall/yshop-module-device-biz/**/*.java` | DMS 调用封装，禁止前端直连 DMS |
| MQ/Redis 延迟队列 | `yshop-module-message/**/redismq/*.java`、`yshop-module-order-biz/**/mq/**/*.java` | 事件驱动异步流程合规 |
| 支付回调 | `yshop-module-pay/**/*.java`、`yshop-module-order-biz/**/PayNoticeConsumer.java` | 支付成功数据流完整性 |
| WebSocket | `yshop-framework/yshop-spring-boot-starter-websocket/**/*.java` | 消息安全、用户身份绑定 |

#### P2 — 代码风格与性能（抽样审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| Controller 层 | `**/controller/**/*.java` | 参数校验、返回值规范、异常处理 |
| Service 层 | `**/service/**/*ServiceImpl.java` | 事务边界、业务逻辑复杂度 |
| DAO/Mapper XML | `**/resources/mapper/**/*.xml` | SQL 注入风险、N+1 查询、索引利用 |
| 实体类 | `**/dal/dataobject/**/*.java` | 字段注解、tenant_id 存在性 |
| 单元测试 | `**/src/test/**/*.java`（共 ~73 个） | 覆盖率、测试质量 |

### 1.3 admin/ 详细审查范围

#### P0 — 安全（必须审查）

| 类别 | 文件路径 | 说明 |
|------|---------|------|
| Axios 配置 | `admin/src/config/axios/**/*.ts` | 请求拦截器、Token 刷新、错误处理 |
| 登录模块 | `admin/src/api/login/**/*.ts` | 登录流程、密码传输 |
| 路由守卫 | `admin/src/permission.ts` | 权限校验、未授权跳转 |

#### P1 — 架构合规（必须审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| API 客户端 | `admin/src/api/**/*.ts` | 与 backend 接口契约一致性 |
| 订单管理页面 | `admin/src/views/**/order/**/*.vue` | 订单状态显示与 backend 枚举一致 |
| 佣金配置页面 | `admin/src/views/**/shop/**/*.vue`、`admin/src/views/**/category/**/*.vue` | commissionRate 输入校验（0-100，precision 2） |
| 设备管理页面 | `admin/src/views/**/device/**/*.vue` | 不直接调用 DMS，仅通过 backend 代理 |

#### P2 — 代码风格（抽样审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| Vue 组件 | `admin/src/views/**/*.vue` | 组件规范、TypeScript 类型安全 |
| Store 模块 | `admin/src/store/modules/**/*.ts` | 状态管理规范 |
| 工具函数 | `admin/src/utils/**/*.ts` | 复用性、错误处理 |

### 1.4 miniapp/ 详细审查范围

#### P0 — 安全（必须审查）

| 类别 | 文件路径 | 说明 |
|------|---------|------|
| 登录鉴权 | `miniapp/utils/auth.js` | wx.login、token 存储、openid 处理 |
| 全局配置 | `miniapp/app.js`、`miniapp/config/config.js` | `dmsUrl` 配置（禁止直连 DMS） |
| 支付页面 | `miniapp/pages/payment/payment.js` | 支付流程安全 |

#### P1 — 架构合规（必须审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| 设备相关页面 | `miniapp/pages/device-*/**/*` | 设备命令通过 backend 转发，不直连 DMS |
| 订单相关页面 | `miniapp/pages/orders/**/*`、`miniapp/pages/processing/**/*` | 订单状态与 backend 枚举一致 |
| API 调用 | 所有 `*.js` 中含 `wx.request` 的文件 | URL 前缀、参数格式、错误处理 |

#### P2 — 代码风格（抽样审查）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| 页面 JS | `miniapp/pages/**/*.js` | 代码规范、生命周期管理 |
| 工具函数 | `miniapp/utils/**/*.js` | 复用性、错误处理 |

### 1.5 icepolar-dms/ 详细审查范围

#### P0 — 安全（必须审查）

| 类别 | 文件路径 | 说明 |
|------|---------|------|
| 配置文件 | `icepolar-dms/app/config.py` | secrets、数据库连接、MQTT 凭证 |
| 依赖注入 | `icepolar-dms/app/dependencies.py` | 认证、权限校验 |
| 路由安全 | `icepolar-dms/app/routes/**/*.py` | 仅接受 backend 调用，验证调用方身份 |

#### P1 — 架构合规（必须审查）

| 类别 | 文件路径 | 说明 |
|------|---------|------|
| 设备命令路由 | `icepolar-dms/app/routes/commands.py` | 命令参数校验、设备状态检查 |
| 设备管理 | `icepolar-dms/app/routes/devices.py` | CRUD 操作、连接/断开逻辑 |
| MQTT 通信 | `icepolar-dms/app/services/mqtt_communicator.py` | 消息可靠性、超时处理、重连机制 |
| 订单管理 | `icepolar-dms/app/services/order_manager.py` | 与 backend 订单状态同步 |
| 请求响应映射 | `icepolar-dms/app/services/request_response_mapper.py` | DMS 与设备协议映射正确性 |

#### P2 — 代码质量（必须审查，SDD 要求）

| 类别 | 文件路径模式 | 说明 |
|------|-------------|------|
| 单元测试 | `icepolar-dms/tests/**/*.py`（共 ~20 个） | 覆盖率 >= 80% |
| 模型定义 | `icepolar-dms/app/models/**/*.py` | SQLAlchemy 模型规范 |
| Schema 定义 | `icepolar-dms/app/models/schemas.py` | Pydantic 校验规则 |
| Lint 合规 | 全部 `*.py` | `ruff check .` 必须通过 |

---

## 二、验收标准

### 2.1 P0 — 安全 / 租户隔离（一票否决项）

| 编号 | 检查项 | 验收标准 | 检查方法 |
|------|--------|---------|---------|
| P0-S01 | Secrets 泄露 | 任何配置文件、代码文件、注释中不得包含明文密码、API key、JWT secret | 正则扫描 `password\s*=\s*[^${]`、`api[_-]?key`、`secret\s*[:=]` |
| P0-S02 | 租户隔离完整性 | 所有业务表查询必须通过 `TenantLineInnerInterceptor` 自动注入 `tenant_id = ?` | 检查 `*Mapper.xml` 中无手写 `tenant_id` 条件绕过；检查 `@TenantIgnore` 使用是否必要且已审批 |
| P0-S03 | 新查询租户检查 | 新增/修改的 `QueryWrapper` / `LambdaQueryWrapper` / 自定义 SQL 不得跳过租户隔离 | Code Review 时逐行检查 |
| P0-S04 | SQL 升级脚本规范 | 数据库变更必须通过 `sql/upgrade-*.sql` 文件，禁止直接修改 `yixiang-drink.sql` | 检查 PR 中 SQL 文件变更 |
| P0-S05 | DMS 访问控制 | `icepolar-dms` 仅接受 `yshop-drink` backend 调用，miniapp / admin 不得直连 | 检查 miniapp `config.js` 中 `dmsUrl` 是否存在；检查 admin API 客户端是否含 DMS 地址 |
| P0-S06 | 认证鉴权 | 所有 Admin API 端点必须有 `@PreAuthorize` 或等效权限控制；App API 端点必须验证用户身份 | 检查 Controller 方法注解 |
| P0-S07 | 支付安全 | 支付回调必须验证签名，金额必须二次校验，防止重复通知 | 检查 `PaySuccess` 回调实现 |

### 2.2 P1 — 架构合规（关键项）

| 编号 | 检查项 | 验收标准 | 检查方法 |
|------|--------|---------|---------|
| P1-A01 | 订单状态一致性 | `OrderStatusEnum`、`OrderInfoEnum`、`AdminOrderStatusEnum` 对同一 `status` 值的定义必须一致；新增/修改状态必须同步更新 DO、VO、Mapper XML、前端常量 | 枚举值交叉比对；检查 PR 中所有引用点 |
| P1-A02 | 三字段状态机 | 订单状态判断必须同时考虑 `paid`、`refund_status`、`status` 三个字段，不得仅依赖单一字段 | 检查 `StoreOrderMapper.xml` 和 `AppStoreOrderServiceImpl` 中的状态判断逻辑 |
| P1-A03 | 佣金规则 | 佣金计算优先级：`category.commission_rate` > `shop.commission_rate`；计算结果写入 `commission_amount` | 检查 `CommissionServiceImpl` 实现；核对 `CONTRACTS.md` |
| P1-A04 | 事件驱动异步 | 支付回调、订单超时、通知发送必须使用 MQ（RocketMQ）或 Redis 延迟队列，不得同步阻塞主流程 | 检查 `PaySuccess` 方法中是否发送 MQ；检查超时处理是否用 `RedisDelayHandle` |
| P1-A05 | 历史数据不可变 | 订单快照（`StoreOrderCartInfo`）在支付成功后冻结，后续不得修改 | 检查快照写入后是否有 update 操作 |
| P1-A06 | API 契约同步 | 跨仓库变更（backend <-> admin <-> miniapp）必须先在 `CONTRACTS.md` 中定义 | 检查 PR 是否包含 CONTRACTS.md 变更 |
| P1-A07 | DMS 调用规范 | backend `device` 模块调用 DMS 必须通过封装好的 HTTP 客户端，不得裸调 | 检查 `DeviceManagementServiceImpl` 中 DMS 调用方式 |
| P1-A08 | 分层架构（DMS） | `routes` 返回 `dict`；`services` 返回 Pydantic Schema；`dao` 返回 SQLAlchemy Entity；禁止跨层返回类型 | 检查 DMS 各层返回类型 |

### 2.3 P2 — 代码风格 / 性能（建议项）

| 编号 | 检查项 | 验收标准 | 检查方法 |
|------|--------|---------|---------|
| P2-C01 | Java 代码规范 | 遵循 Alibaba Java Coding Guidelines；无魔法数字；方法行数 <= 80；类行数 <= 500 | IDE 插件 / Checkstyle |
| P2-C02 | SQL 性能 | Mapper XML 中无 `SELECT *`；复杂查询有索引；无 N+1 查询 | EXPLAIN 分析 / MyBatis 日志 |
| P2-C03 | 异常处理 | Service 层不得吞没异常；Controller 层统一返回 `CommonResult`；不得返回堆栈信息给前端 | 代码审查 |
| P2-C04 | 单元测试覆盖率 | backend 核心模块（order/pay/device）>= 60%；DMS >= 80% | `mvn test` / `pytest --cov` |
| P2-C05 | TypeScript 类型安全 | admin 中无 `any` 滥用；API 响应有明确类型定义 | `tsc --noEmit` |
| P2-C06 | 微信小程序规范 | 页面文件大小 <= 2MB；无冗余 setData；合理使用分包 | 微信开发者工具审核 |
| P2-C07 | Python 代码规范 | DMS 代码通过 `ruff check .`；docstring 和注释使用中文 | `ruff check .` |
| P2-C08 | 依赖安全 | 无已知 CVE 的高危依赖；定期更新依赖版本 | `mvn dependency-check` / `pip-audit` |

---

## 三、优先级矩阵

### 3.1 优先级定义

```
P0 = 安全 / 租户隔离  →  违反即阻塞发布，一票否决
P1 = 架构合规         →  违反需限期修复，影响系统稳定性
P2 = 代码风格 / 性能   →  违反建议修复，不影响功能正确性
```

### 3.2 优先级与模块交叉矩阵

| 模块 | P0 安全/租户隔离 | P1 架构合规 | P2 代码风格/性能 |
|------|----------------|------------|----------------|
| **backend/ 租户框架** | 拦截器配置、TenantBaseDO、@TenantIgnore 审计 | — | 配置可维护性 |
| **backend/ 订单模块** | 新查询租户检查 | 状态机一致性、佣金规则、历史数据不可变 | SQL 性能、测试覆盖 |
| **backend/ 支付模块** | 回调签名验证、金额校验 | 事件驱动异步（MQ/Redis） | 异常处理规范 |
| **backend/ 设备模块** | DMS 调用身份验证 | DMS 调用封装、禁止前端直连 | HTTP 客户端超时配置 |
| **admin/ 管理后台** | 登录鉴权、Axios 拦截器 | API 契约同步、佣金输入校验 | TypeScript 类型安全 |
| **miniapp/ 小程序** | 登录鉴权、Token 存储 | 不直连 DMS、订单状态一致 | 代码包大小、setData 优化 |
| **icepolar-dms/** | 配置 secrets、路由认证 | 分层架构、仅 backend 调用 | 测试覆盖 >= 80%、ruff 合规 |

### 3.3 审查触发条件

| 触发条件 | 必须审查的优先级 |
|---------|----------------|
| 新增/修改 `*Mapper.java` 或 `*Mapper.xml` | P0、P1 |
| 新增/修改枚举类（`*Enum.java`） | P0、P1 |
| 新增/修改支付相关代码 | P0、P1 |
| 新增/修改设备/DMS 相关代码 | P0、P1 |
| 新增/修改 SQL 文件 | P0 |
| 修改 `application*.yml` 配置文件 | P0 |
| 新增 Controller 端点 | P0、P1 |
| 前端新增 API 调用 | P1 |
| 纯 UI/样式变更 | P2 |
| 文档变更 | P2（仅格式检查） |

---

## 四、审查执行流程

### 4.1 自动化检查（CI 阶段）

```
PR 创建
  ├── backend: mvn test + Checkstyle + SpotBugs
  ├── admin: pnpm lint:eslint + pnpm lint:format + tsc --noEmit
  ├── miniapp: 微信开发者工具代码质量扫描
  ├── icepolar-dms: ruff check . + pytest -v --cov
  └── 全仓库: secrets 扫描（git-secrets / truffleHog）
```

### 4.2 人工审查（Code Review 阶段）

```
Reviewer 检查清单:
1. [P0] 是否包含 secrets？
2. [P0] 新查询是否跳过租户隔离？
3. [P1] 枚举变更是否同步所有引用点？
4. [P1] 跨仓库变更是否在 CONTRACTS.md 中定义？
5. [P1] 异步流程是否使用 MQ/Redis 延迟队列？
6. [P2] 是否有足够的单元测试覆盖？
7. [P2] 代码是否符合各技术栈的 lint 规范？
```

### 4.3 验收签字

| 角色 | 负责审查项 | 签字条件 |
|------|-----------|---------|
| Security Reviewer | P0 全部 | 无 secrets、租户隔离完整、认证鉴权正确 |
| Architecture Reviewer | P1 全部 | 状态机一致、佣金规则正确、事件驱动合规、契约同步 |
| Tech Lead | P2 全部 + 整体质量 | Lint 通过、测试覆盖达标、代码可读性可维护性合格 |

---

## 五、附录：已知风险点

以下问题已在治理文档中标记，审查时需特别关注：

| 风险编号 | 描述 | 位置 | 审查重点 |
|---------|------|------|---------|
| RISK-001 | `OrderStatusEnum` 与 `OrderInfoEnum` 对 `status` 定义不一致 | `backend/yshop-framework/yshop-common/.../OrderInfoEnum.java`、`backend/yshop-module-mall/.../OrderStatusEnum.java` | 新增代码引用枚举时必须明确使用哪个；禁止混用 |
| RISK-002 | `icepolar-dms` 不允许 push | `icepolar-dms/` | 变更仅本地 commit，由用户手动 push |
| RISK-003 | `CONTRACTS.md` 内容不完整（缺少 Device/DMS 合约、Order Status 状态机合约） | `governance/CONTRACTS.md` | 跨仓库变更前必须先补全合约 |
| RISK-004 | 子模块 detached HEAD 历史问题 | 全部子模块 | 确保子模块已切回正确分支并跟踪远程 |
