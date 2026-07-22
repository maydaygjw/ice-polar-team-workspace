# 技术设计 — 通用设备平台与制冰机迁移

## 模块影响

| 模块 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-device-core-api/biz` | 新增/重构 | 定义设备号、设备类型、租户归属、状态、通用设备订单和适配器边界 |
| `yshop-module-device-ice-api/biz` | 新增/迁移 | 承接制冰机状态、指令、DMS/MQTT 适配和制冰机订单扩展 |
| `yshop-module-device-api/biz` | 兼容层 | 迁移期间保留旧包名、旧接口和旧调用入口 |
| `yshop-module-order-api` | 复用/少量调整 | 仅提供商城订单关联所需的 API/DTO，不把商城订单实现带入 device-core |
| `yshop-module-order-biz` | 兼容调整 | 继续消费制冰机业务所需的设备订单能力，不改变商城订单状态语义 |
| `backend/sql` | 新增 | 扩展现有设备及设备订单表，保留旧字段和历史数据 |
| `icepolar-dms` | 复用 | 本期不修改 DMS API、MQTT 主题和硬件协议 |
| `admin` / `miniapp` | N/A | 本期不修改页面；小程序继续调用兼容接口 |

## Architecture Decisions

### 1. 模块分层

```text
device-core-api
       ↑
device-core-biz
  ├─ Device：设备基础规范
  ├─ DeviceOrder：通用设备操作订单
  ├─ DeviceState：连接与可用状态
  └─ Transport SPI：通信适配器接口

device-ice-api
       ↑
device-ice-biz
  ├─ 制冰机能力
  ├─ 制冰机命令映射
  └─ DMS/MQTT 适配器
```

`device-api/biz` 作为迁移期兼容外观，新能力不得继续放入旧的制冰机聚合服务。

跨模块调用遵循 `-api → -api`，实现位于对应 `-biz`；`device-core` 不依赖 `device-ice-biz`，避免通用核心反向依赖具体能力。

### 2. device-core 规范

设备核心的最小模型包含：

- `deviceCode`：通用设备号；旧 `imei` 作为兼容输入。
- `deviceType`：设备类型标识。
- `tenantId`：设备所属租户。
- `connectionStatus`：连接状态。
- `availabilityStatus`：空闲、占用、维护或停用状态。
- `metadata`：供应商或设备扩展信息，不能承载能力业务字段。

连接状态和可用状态分别持久化，支持“在线且占用”的组合。任务执行状态不写入设备连接状态。

### 3. 通用设备操作订单

本期将通用设备订单放在 `device-core`，用于统一表达：

```text
CREATED → QUEUED → RUNNING → SUCCEEDED
                         └──→ FAILED / CANCELLED
```

订单包含设备号、设备类型、操作类型、发起人、可选 `bizOrderId`、开始/结束时间和失败原因。`bizOrderId` 只建立与商城订单的关联，device-core 不负责商城订单的支付、库存、佣金或退款。

制冰机能力在通用设备订单上扩展冰量规格、设备命令和 DMS 任务信息。未来若设备订单需要独立商业计价，再评估拆分为 `order` 的商业订单和 device-core 的履约子订单。

### 4. 通信适配器

`device-core` 只定义通信适配器接口，不直接依赖 DMS SDK、MQTT 客户端或具体网关实现。`device-ice` 提供 DMS/MQTT 适配器，负责：

- 设备连接/断开。
- 状态查询和状态映射。
- 制冰机命令映射。
- DMS 异常和响应转换。

现有 `HttpClientUtils`、固定 DMS 路径、`ProductSpecEnum` 和制冰机命令枚举应迁移到 `device-ice`。

### 5. 制冰机迁移

当前实现中的 `DeviceManagementServiceImpl` 同时承担设备管理、制冰机业务、商城下单和 DMS 转发。迁移拆分为：

1. `device-core` 接管设备基础模型、状态规范和通用设备订单。
2. `device-ice` 接管 `ice_maker_v1`、冰量规格、制冰机命令和 DMS 路径。
3. 旧 Controller 和 `device-api` 继续接收旧请求，并转换为新 core/ice API。
4. 新旧设备订单查询在兼容期统一映射，避免重复生成或重复展示。
5. 回归通过后，再逐步删除旧聚合服务中的制冰机专属实现。

### 6. 不新增绑定模型

本期不引入独立设备绑定表、`bind` 或 `unbind` 接口。设备与业务主体的现有归属关系继续沿用当前数据和服务。通用设备核心只定义设备所属租户及现有必要的归属字段，未来确实出现多归属、位置角色或历史关系需求时再单独立项。

## Migration and Rollback

拟新增脚本：`backend/sql/upgrade-2026-07-22-device-platform.sql`。

迁移顺序：

1. 为现有设备和设备订单增加通用字段，保留 `imei`、旧订单号和历史字段。
2. 回填 `deviceType`、连接状态和设备订单类型。
3. 新增 core/ice 双读兼容，旧接口继续工作。
4. 将新写入切换到 core/ice，实现数据一致后再下线旧实现。

回滚时停止新 core/ice 写入，切回旧 device 服务；新增字段保留，不物理删除历史数据。

## Risks

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 通用核心继续混入制冰机字段 | 高 | 代码评审禁止 core 依赖 ice 专属枚举、DTO 和路径 |
| 旧新订单重复展示 | 高 | 统一订单号映射和兼容期唯一约束 |
| 在线/占用状态混用 | 中 | 两个独立字段和状态转换测试 |
| DMS/MQTT 回归 | 高 | 保留旧接口并执行制冰机全链路回归 |
| 设备订单与商城订单耦合 | 中 | `bizOrderId` 只做关联，核心不修改商城订单 |

## Contract Status

| 契约层 | 状态 | 说明 |
|--------|------|------|
| API | 变更 | 新增 core/ice 内部 API，旧制冰机 API 兼容 |
| DB | 变更 | 扩展现有设备和设备订单结构 |
| MQ | N/A | 本期不新增跨模块事件 |
| 权限 | 复用/校验 | 沿用租户和现有数据权限 |
| 外部系统 | 复用 | DMS/MQTT 契约不变 |
| ADR | 新增 | 记录 core/ice 边界和通用设备订单归属 |
