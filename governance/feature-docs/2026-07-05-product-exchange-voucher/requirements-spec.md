## Feature: 商品兑换券

### Scope

#### In-scope
1. 券码生成与管理（admin 后台 + 后端 API）
   - 批量生成唯一兑换券码（支持前缀 + 随机字符串 / 雪花 ID）
   - 配置兑换券属性：关联商品、有效起止时间、总发行量、单用户限领次数
   - 兑换券状态管理：未启用 / 已启用 / 已停用
2. 券码核销（小程序端）
   - 用户输入或扫描券码完成核销
   - 核销后自动创建 0 元订单（无需支付）
   - 订单关联设备，触发制冰履约流程
3. 兑换券查询（小程序端）
   - 我的兑换券列表（未使用 / 已使用 / 已过期）
   - 兑换券详情（商品信息、有效期、使用状态）
4. 兑换记录与对账（admin 后台）
   - 兑换券发放/核销流水查询
   - 按批次/商品/时间维度统计核销率

#### Out-of-scope
- 不改动现有优惠券（Coupon）模块逻辑；兑换券为独立领域
- 不支持部分核销（一张券兑换一次，不可拆分）
- 不支持转赠/分享券码（V1 仅支持本人核销）
- 不支持退款/退券逻辑（外部渠道已收款，系统内 0 元订单不退款）
- 不接入微信支付（订单 payPrice = 0，跳过支付环节）
- 不改动 DMS 设备指令协议（复用现有 `/app-api/device/_initiateDirect` 链路）
- 不新增物流/配送履约（仅支持设备现场提货）

### Stakeholders & Scenarios

| 角色 | 场景 | 触发点 |
|------|------|--------|
| 运营人员 | 在 admin 后台创建兑换券批次，生成券码，导出给线下门店/第三方渠道 | admin 后台 |
| 终端用户 | 在小程序输入/扫描券码，兑换商品，在设备上提货 | 冰立得小程序 |
| 门店/渠道 | 将券码随商品交付给用户，用户凭券到设备提货 | 线下/第三方系统 |
| 财务人员 | 查看兑换券核销报表，核对线下收款与系统履约数据 | admin 后台 |

**核心用户旅程：**
```
用户获得券码（线下/第三方）
    ↓
打开冰立得小程序 → 进入"兑换券"入口
    ↓
输入/扫描券码 → 后端校验券码有效性
    ↓
展示兑换商品信息 → 用户确认兑换
    ↓
创建 0 元订单 → 自动标记已支付
    ↓
跳转设备选择/连接页面 → 触发制冰
    ↓
设备出冰完成 → 订单状态变为已完成
```

### Data Model Changes (conceptual)

#### 1. New Table: `yshop_product_voucher`（兑换券批次）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | 批次 ID |
| `tenant_id` | bigint NOT NULL | 租户隔离（固定 153） |
| `title` | varchar(128) | 批次名称 |
| `product_id` | bigint NOT NULL | 关联商品 ID |
| `product_name` | varchar(256) | 冗余商品名称（快照） |
| `product_image` | varchar(500) | 冗余商品图片 |
| `start_time` | datetime | 有效开始时间 |
| `end_time` | datetime | 有效结束时间 |
| `total_count` | int NOT NULL DEFAULT 0 | 总发行量 |
| `claimed_count` | int NOT NULL DEFAULT 0 | 已领取量 |
| `used_count` | int NOT NULL DEFAULT 0 | 已核销量 |
| `status` | tinyint NOT NULL DEFAULT 0 | 0=未启用, 1=已启用, 2=已停用 |
| `limit_per_user` | int NOT NULL DEFAULT 1 | 单用户限领次数 |
| `code_prefix` | varchar(16) | 券码前缀（如 ICE2024） |
| `deleted` | bit NOT NULL DEFAULT 0 | 软删除 |
| `create_time` / `update_time` | datetime | 标准审计字段 |

#### 2. New Table: `yshop_product_voucher_code`（券码实例）
| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | bigint PK | |
| `tenant_id` | bigint NOT NULL | 租户隔离 |
| `batch_id` | bigint NOT NULL | 关联批次 |
| `code` | varchar(64) NOT NULL | 唯一券码 |
| `user_id` | bigint | 领取用户 ID（NULL = 未领取） |
| `status` | tinyint NOT NULL DEFAULT 0 | 0=未领取, 1=已领取未使用, 2=已使用, 3=已过期 |
| `claim_time` | datetime | 领取时间 |
| `use_time` | datetime | 核销时间 |
| `order_id` | varchar(64) | 关联订单号（核销时写入） |
| `deleted` | bit NOT NULL DEFAULT 0 | 软删除 |
| `create_time` / `update_time` | datetime | 标准审计字段 |

索引：`idx_tenant_id`, `idx_code` (UNIQUE), `idx_batch_id`, `idx_user_id_status`

#### 3. Alter Table: `yshop_store_order`（可选，视实现方式）
- 新增 `voucher_id` bigint — 关联兑换券实例 ID（与现有 `coupon_id` 并列）
- 或复用 `mark` / `remark` 字段记录兑换券信息（不推荐，不利于查询）

**推荐方案：** 新增 `voucher_id` 字段，保持与 `coupon_id` 对称。

### API Requirements

#### Backend — Admin API (`/admin-api`)

| 方法 | 路径 | 功能 | 权限 |
|------|------|------|------|
| POST | `/admin-api/product-voucher/batch` | 创建兑换券批次 | admin |
| PUT | `/admin-api/product-voucher/batch/{id}` | 修改批次（仅未启用可改） | admin |
| POST | `/admin-api/product-voucher/batch/{id}/codes` | 批量生成券码 | admin |
| GET | `/admin-api/product-voucher/batch` | 批次列表（分页） | admin |
| GET | `/admin-api/product-voucher/batch/{id}` | 批次详情 | admin |
| GET | `/admin-api/product-voucher/batch/{id}/codes` | 券码列表（分页） | admin |
| POST | `/admin-api/product-voucher/batch/{id}/export` | 导出券码（CSV） | admin |
| PUT | `/admin-api/product-voucher/batch/{id}/status` | 启用/停用批次 | admin |
| GET | `/admin-api/product-voucher/stats` | 核销统计报表 | admin |

#### Backend — App API (`/app-api`)

| 方法 | 路径 | 功能 | 认证 |
|------|------|------|------|
| POST | `/app-api/product-voucher/claim` | 领取/核销券码（输入券码兑换） | Bearer Token |
| GET | `/app-api/product-voucher/my` | 我的兑换券列表 | Bearer Token |
| GET | `/app-api/product-voucher/my/{id}` | 兑换券详情 | Bearer Token |
| POST | `/app-api/product-voucher/redeem` | 使用兑换券创建订单 | Bearer Token |

**关键接口语义：**

- `POST /app-api/product-voucher/claim`
  - Request: `{ "code": "ICE2024A1B2C3D4" }`
  - 校验：券码存在、批次已启用、未过期、未领取、未超限
  - 成功后券码状态变为 `1`（已领取），绑定当前用户
  - Response: 兑换券详情（含商品信息）

- `POST /app-api/product-voucher/redeem`
  - Request: `{ "voucherId": 12345, "imei": "860123456789012" }`（imei 可选，不传则进入设备选择页）
  - 校验：券码属于当前用户、状态为已领取未使用、未过期
  - 创建 `StoreOrderDO`：`payPrice = 0`, `paid = 1`, `payType = "voucher"`, `status = 1`（已支付/待履约）
  - 写入 `voucher_id` 到订单
  - 更新券码状态为 `2`（已使用），写入 `order_id` 和 `use_time`
  - 触发设备订单创建流程（复用 `DeviceManagementServiceImpl.createMallOrder` 模式）
  - Response: `{ "orderId": "xxx", "orderNo": "xxx" }`

#### 跨模块调用约束

- 兑换券模块（`yshop-module-product-voucher-biz`）依赖：
  - `yshop-module-product-api` — 查询商品信息
  - `yshop-module-order-api` — 创建订单
  - `yshop-module-device-api` — 创建设备订单（如需要设备履约）
- 订单模块（`yshop-module-order-biz`）依赖：
  - `yshop-module-product-voucher-api` — 校验兑换券有效性、回退状态（如订单取消）

> 引用 `CONTRACTS.md` 跨模块调用规则：任何模块禁止直接依赖其他模块的 `-biz` 包，必须通过 `-api` 模块交互。

### Frontend Requirements

#### MiniApp（冰立得小程序）

1. **兑换券入口**
   - 在小程序首页或个人中心新增"兑换券"入口
   - 入口展示未使用兑换券数量角标（如有）

2. **兑换券列表页**（`/pages/voucher/voucher`）
   - 顶部 Tab：未使用 / 已使用 / 已过期
   - 卡片展示：商品图片、商品名称、有效期、状态标签
   - 未使用卡片："立即使用"按钮
   - 已使用卡片：展示关联订单号、核销时间

3. **券码核销页**（`/pages/voucher/redeem`）
   - 输入框：支持手动输入券码（16-32 位字母数字）
   - 扫描按钮：调用 `wx.scanCode` 扫描 QR 码（QR 内容即券码）
   - 确认兑换按钮：调用 `POST /app-api/product-voucher/claim`
   - 兑换成功：展示商品信息，提供"去使用"按钮
   - 兑换失败：展示具体错误（券码无效 / 已使用 / 已过期 / 批次已停用）

4. **兑换券使用流程**
   - 点击"立即使用" → 跳转设备连接页（复用 `scan` 页逻辑）
   - 或已连接设备 → 直接调用 `POST /app-api/product-voucher/redeem` 创建订单
   - 订单创建成功 → 跳转出冰进度页（复用现有订单履约流程）

5. **订单列表适配**
   - 订单列表页展示兑换券订单（`payType = "voucher"`）
   - 订单卡片展示"兑换券"标签，不展示支付金额（或展示 0.00）

#### Admin 后台（yshop-drink-vue）

1. **兑换券批次管理页**
   - 列表：批次名称、关联商品、有效期、发行量/已领取/已核销、状态
   - 操作：创建、编辑（未启用）、启用/停用、删除（未启用且无领取）

2. **券码管理页**
   - 按批次展示券码列表
   - 筛选：状态（未领取 / 已领取 / 已使用 / 已过期）
   - 导出：CSV 格式（券码、状态、领取人、使用时间、关联订单）

3. **核销统计页**
   - 按批次汇总：发行量、领取量、核销量、核销率
   - 按商品汇总：各商品兑换次数
   - 按时间维度：日/周/月核销趋势

### Edge Cases

| 场景 | 预期行为 |
|------|----------|
| 重复核销同一券码 | 第二次请求返回错误：券码已使用（幂等校验） |
| 券码已过期 | 领取/核销时返回错误：券码已过期；已领取未使用的过期券码自动标记为已过期 |
| 批次已停用 | 新领取请求返回错误：批次已停用；已领取的未使用券码仍可核销（保障用户权益） |
| 错误租户/门店 | 券码校验时校验 `tenant_id`，跨租户券码返回"券码无效"（不暴露存在性） |
| 外部订单退款 | 系统内不处理退款；已核销券码状态保持已使用，不退回 |
| 网络故障（领取阶段） | 客户端重试 3 次；服务端领取操作需幂等（同一用户同一券码重复领取返回成功） |
| 网络故障（核销创建订单阶段） | 订单创建与券码状态更新必须在同一事务；失败时券码状态回滚为已领取 |
| 设备离线 | 订单已创建（状态=已支付），但设备命令发送失败；用户可在订单列表重新发起出冰（复用现有重试机制） |
| 并发领取同一券码 | 数据库唯一索引 `idx_code` + 乐观锁（`status` 条件更新）防止并发冲突 |
| 并发使用同一兑换券创建订单 | 数据库行锁（`SELECT FOR UPDATE` 或分布式锁）确保同一券码只创建一次订单 |
| 商品已下架 | 券码仍可核销（兑换券是商品快照，不依赖商品实时状态）；但 admin 创建批次时应校验商品有效性 |
| 用户未绑定手机号 | 遵循现有小程序登录规则：未登录用户先触发登录流程，再允许核销 |

### Acceptance Criteria

#### 后端

- [ ] 管理员可在后台创建兑换券批次，配置关联商品、有效期、发行量
- [ ] 批量生成券码不重复，支持前缀自定义
- [ ] 券码领取接口幂等：同一用户重复领取同一券码返回成功，不同用户领取已占用券码返回错误
- [ ] 券码核销创建订单事务一致：订单创建失败时券码状态回滚
- [ ] 兑换券订单 `payPrice = 0`，`paid = 1`，跳过支付回调
- [ ] 兑换券订单正常触发设备履约流程（复用现有 DMS 链路）
- [ ] 租户隔离：所有兑换券查询自动注入 `tenant_id = 153`
- [ ] 软删除：批次/券码删除仅标记 `deleted = 1`，不物理删除

#### 小程序

- [ ] 用户可通过输入或扫描完成券码核销
- [ ] 核销成功展示商品信息，可跳转设备连接页
- [ ] 已连接设备时可直接使用兑换券创建订单并触发出冰
- [ ] 我的兑换券列表正确展示未使用/已使用/已过期状态
- [ ] 兑换券订单在订单列表中正确展示，带有"兑换券"标识
- [ ] 券码无效/已使用/已过期/批次停用均有明确错误提示

#### Admin

- [ ] 批次列表支持分页、状态筛选
- [ ] 券码列表支持按状态筛选、分页
- [ ] 券码支持导出 CSV
- [ ] 核销统计报表数据准确

### Open Questions / Assumptions

1. **券码格式**：假设采用 `前缀 + 10位随机字母数字`（如 `ICE2024A1B2C3D4`），总长度 16-24 位。是否需支持纯数字（便于线下门店手动输入）？
2. **商品快照**：兑换券领取时是否冻结商品信息（名称、图片、规格）？若商品后续修改，已领取券码展示原信息还是最新信息？
3. **设备选择**：核销后是否必须立即连接设备，还是允许先领取券码、后续再选择设备使用？（当前设计支持后者：领取 → 我的券码 → 使用时选设备）
4. **多商品兑换**：V1 仅支持一张券兑换一个商品。是否需支持一张券兑换多商品（如套餐）？
5. **券码发放渠道**：系统仅生成券码，由运营人员导出后通过外部渠道发放。是否需系统内直接发放（如短信、小程序消息推送）？
6. **过期处理**：已领取未使用的券码过期后自动标记，是否需要通知用户？（小程序订阅消息 / 服务通知）
7. **订单佣金**：兑换券订单 `payPrice = 0`，佣金计算是否按商品原价计算还是按 0 计算？需财务确认。
8. **库存扣减**：兑换券创建订单时是否扣减商品库存？（建议扣减，防止超卖）
