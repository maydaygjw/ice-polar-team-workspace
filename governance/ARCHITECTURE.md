# 系统架构

## 外部系统

| 系统 | 职责 | 访问方式 |
|------|------|----------|
| 微信支付 | C 端支付 | 后端 SDK + 回调 |
| 支付宝 | C 端支付 | 后端 SDK + 回调 |
| AdaPay | C 端支付 + 分账结算 | 后端 SDK + 回调 |
| 企业微信 | 客户联系与客户群同步 | 后端 HTTPS API；CorpID 与客户联系 Secret 仅服务端配置 |
| 阿里云百炼 | 管理端商品 AI 图片生成 | 后端 HTTP API；API Key 仅服务端配置 |

## 业务层级

```
租户 → 部门 → 商圈 → 门店 → 订单 / 设备 / 商品 / 收支 / 提现
```

- 每个租户有且只有一个默认商圈。
- 一个部门可管理多个商圈；一个商圈只能归属一个部门。
- 一个门店只能归属一个商圈，并保存继承的部门标识。
- 门店管理员通过独立关联表管理；旧的单一管理员字段已废弃。
- 门店范围查询使用多个门店标识，不再使用单一门店标识。

## 多租户与数据权限

- 所有业务记录按租户隔离。
- 需要部门级数据权限的业务记录，必须携带部门标识。
- 商圈标识在写入业务记录时从门店派生。
- 历史业务记录一旦生成不可变更；回填字段不得改变业务状态或财务数值。

## 契约

影响多模块、多仓库、多系统或外部依赖的变更，必须由 Architecture Agent 审批并记录。

### 契约层级

| 层级 | 文件 | 范围 |
|------|------|------|
| Platform | `ARCHITECTURE.md`（本章节） | 通用规则、模块边界、依赖、外部系统 |
| Feature | `governance/feature-docs/{YYYY-MM-DD}-{feature}/contract-changes.md` | 单个功能的 API 语义、DTO、权限规则 |
| Machine | `governance/CONTRACT/*.json` | OpenAPI / AsyncAPI，自动收集 |

### 什么算契约

API、事件/MQ、数据库 schema、模块依赖、Maven/前端依赖、第三方库、外部系统、安全边界。

### 模块依赖规则

**跨模块调用必须通过 `-api`，禁止直接依赖 `-biz`。**

```
module-a-biz ──→ module-b-api（接口 + DTO）
                      ↑
              module-b-biz（实现）
```

### API 前缀

| 客户端 | 前缀 |
|--------|------|
| 管理后台 | `/admin-api/...` |
| C 端 / 小程序 | `/app-api/...` |
| 开放 / 回调 | 复用 `/app-api/...` |

### 通用响应

```json
{ "code": 0, "data": {}, "msg": "success" }
```

### 核心实体 ID 类型

| 实体 | ID 类型 |
|------|---------|
| 后台用户 / C 端用户 / 租户 / 部门 / 商圈 / 门店 / 商品 / 分类 | Long |
| 订单 | String(32) |

### 依赖登记册

| 端 | 类别 | 代表依赖 | 版本 |
|----|------|----------|------|
| 后端 | 基础框架 | Spring Boot | `3.2.2` |
| 后端 | ORM / 多租户 | MyBatis Plus / dynamic-datasource | `3.5.5` / `4.3.0` |
| 后端 | 缓存 / 锁 | Redisson / lock4j | `3.26.0` / `2.2.7` |
| 后端 | MQ | RocketMQ Spring Boot Starter | `2.3.0` |
| 后端 | 微信生态 | weixin-java-pay / wx-java-mp / wx-java-miniapp | `4.6.0` |
| 后端 | 支付聚合 | egzosn pay / holuntech pay-java-adapay | `2.14.9` / `2.14.14-SNAPSHOT` |
| 前端 | 框架 / 构建 | Vue / Vue Router / Pinia / Vite / TypeScript | `3.4.21` / `4.3.0` / `2.1.7` / `5.1.4` / `5.3.3` |
| 前端 | UI / 工具 | Element Plus / Axios / ECharts / Dayjs | `2.6.1` / `1.6.8` / `5.5.0` / `1.11.10` |
| 小程序 | — | 原生微信小程序，AppID `wx4df64c96e6540b4e` | — |

### 数据库 Schema 契约

- 升级脚本必须使用 `sql/upgrade-YYYY-MM-DD-{feature}.sql` 命名；日期使用该模块/特性首次形成升级脚本的日期，`{feature}` 使用小写 kebab-case。
- 同一模块或特性的后续增量应合并到该特性脚本，并沿用首次升级日期；完成合并后删除已被替代的旧脚本并同步文档引用。
- 禁止直接修改 `sql/yixiang-drink.sql`；新增升级脚本必须保留在 `sql/` 下并使用上述命名格式。
- 破坏性变更必须含回滚语句。
- 业务表必须含租户标识；需部门过滤的表含部门标识。
- 订单等业务 ID 使用 String(32)。
- 历史字段不可变。

## 设备架构契约

### 调用边界

**小程序禁止直接调用 DMS。**

```
小程序 ──→ yshop-drink 后端 ──→ icepolar-dms
```

### 接口结构

完整 API 定义以 OpenAPI JSON 快照为准：`governance/CONTRACT/backend-api.json`、`governance/CONTRACT/icepolar-dms-api.json`。
