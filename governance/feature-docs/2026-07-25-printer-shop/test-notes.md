# printer-shop 测试记录

## 编译

| 命令 | 结果 |
|------|------|
| `mvn -pl yshop-module-mall/yshop-module-device-biz -am compile -DskipTests` | pass |
| `mvn -pl yshop-module-mall/yshop-module-order-biz -am compile -DskipTests` | pass |
| `mvn -pl order-biz,device-biz -am compile -DskipTests`（重命名后） | BUILD SUCCESS |
| admin `pnpm build:prod` | Build successful（含打印任务管理页） |

## 单元测试

| 命令 | 结果 |
|------|------|
| `mvn -pl yshop-module-mall/yshop-module-device-biz -am test -Dtest=PrintShopServiceTest` | 6/6 pass |
| 同上（M1-M6 修复后复跑） | 6/6 pass，BUILD SUCCESS |

`PrintShopServiceTest` 覆盖回调核心逻辑：
- 未知 device_id 丢弃
- 未知 task_id 丢弃
- SUCCESS 前进 + 推配送 + 触发配送占位
- FAILURE 触发自动退款（不退配送）
- 终态不可逆（SUCCEEDED 后收 FAILURE 忽略）
- 乱序忽略（PROCESSING 后收 READY 忽略）

## M1-M6 修复验证（review conditional → 修复复跑）

| 项 | 修复 | 验证 |
|----|------|------|
| M1 retry 清字段 | 单条 `LambdaUpdateWrapper` 显式 `.set(taskId/failureReason/finishedAt/startedAt, null)` + status=CREATED | 编译通过 |
| M2 提交幂等 | `submitPrintJobByOrder` 加 Redisson 锁 `printer:submit:{orderNo}`，锁内二次检查 taskId | 编译+单测通过 |
| M3 退款失败静默 | `OrderApi.autoRefundOrder` 改返回 boolean；失败保留 refund_status=1 并 log.error；`refundAndLog` 失败显式告警 | 单测日志出现「自动退款失败，订单需人工退款」ERROR |
| M4 taskId 搜索 | `DeviceOrderPageReqVO`+`DeviceOrderMapper.selectPage` 加 taskId eqIfPresent | 编译通过 |
| M5 retry 返回值 | `retryJob` 重查后按 taskId 非空且非 FAILED 返回真实 boolean | 编译+单测通过 |
| M6 落库一致性 | 提交成功落库失败时 `cancelJob` 补偿，避免链科孤儿任务 | 编译通过 |

附带修复 Minor：m5（CANCELLED 也记 failureReason）、m6（`selectListByUserIdIgnoreDeleted` 补 task_id/page_count 列）、m7（buildFailureReason 提取复用）。

## admin 前端

- 新增 `src/views/mall/device/printJob/index.vue`（打印任务管理页）+ `src/api/mall/device/printJob/index.ts`。
- 后端新增 `PrintJobController`（`/admin-api/device/print-job`）：page/get/query/cancel/retry，权限 `device:print-job:*`。
- 菜单 SQL 已并入 `upgrade-2026-07-25-printer-shop.sql`（挂「订单中心」2175 下，含 3 按钮权限）。
- **验证**：`pnpm build:prod` 通过。
- **未通过项说明**：`pnpm ts:check` 在**干净 origin/master 树上同样失败**（`@intlify/unplugin-vue-i18n/types`、`element-plus/global` 等 type library 解析错误），为预存环境问题，与本功能无关；隔离单文件 vue-tsc 报的 `@/` 别名与 auto-import 错误是无项目上下文的误报，build:prod 已包含本页且成功。

## 未执行 / 说明

- **全仓 `mvn test` 未全绿**：`yshop-spring-boot-starter-web` 的 `DesensitizeTest.test` 失败（期望 `芋***` 实际 `y****`），为**预存框架测试问题**，与本功能无关（diff 未触碰该文件）。device-biz 自身测试通过。
- **真机联调未执行**：链科凭证（`LIANKE_PRINT_API_KEY` 等）需本地配置后联调；提交/查询/取消的真实 HTTP 未对真机验证。
- **下单链路（页数/文件/规格上送）未实现**：属小程序 feature，本期 `fillJobFileAndSpec` 占位；端到端"下单→打印"待该链路补齐后验证。
- **配送平台**：`PrintDeliveryGateway` 占位，未真实下单。

## 覆盖缺口

- `LiankePrinterGateway` 的 HTTP 字段映射无单测（依赖真实链科响应样例；建议联调时补契约测试）。
- 自动退款 `autoRefundOrder` 未做集成测试（涉及支付通道，需 mock manager）。
- admin 打印任务页无 E2E（菜单需先执行升级 SQL 后人工/Playwright 验证）。

## API 测试方案

### 1. 目标与范围

验证打印任务管理 API 和链科状态回调的接口契约、鉴权、权限、租户隔离、参数校验、状态机前进、重复回调幂等及必要的业务副作用：

- 管理端：分页、详情、主动查询、取消、重试。
- 链科入向：`POST /app-api/device/printer/callback`。
- 业务副作用：设备订单状态推进、打印成功后的配送占位调用、失败/撤销后的自动退款及退款失败告警。
- 不在本轮直接验证链科真实 HTTP 字段映射、支付通道真实退款和小程序下单链路；这些分别属于真机契约联调、支付集成测试和后续小程序 feature。

API 测试使用 `governance/e2e` 的 Playwright `APIRequestContext`，不替代管理后台 E2E。测试脚本计划放在 `governance/e2e/specs/api/printer-shop/printer-shop.api.spec.ts`。

### 2. 执行前置

| 项目 | 要求 |
|------|------|
| 环境 | 仅 local/test；启用 `yshop.security.mock-enable=true`，生产必须关闭 |
| 基础地址 | `API_BASE_URL`，本地默认 `http://localhost:8888`；测试环境从 `load_env test` 获取 |
| 租户 | 使用 `TEST_TENANT_ID`，不得在脚本中硬编码租户 ID |
| 用户 | `ADMIN_USER_ID` 对应测试租户中的后台用户；另准备无打印任务权限的后台用户用于 403 用例 |
| Token | 按 playbook 使用 `test<用户ID>`，只写入运行环境，不写入文档或报告 |
| 管理权限 | `device:print-job:query`、`device:print-job:cancel`、`device:print-job:retry` 分别配置到测试角色；Mock Token 不会自动授予菜单权限 |
| 店铺 | 通过现有门店管理创建一次性测试店铺；绑定唯一 printer 设备，并确保 `deviceId = shop_code = device_code`，一店一云盒一打印机 |
| 打印商品 | 通过现有商品管理创建并启用一次性打印商品；准备基础 SKU，并将纸张/颜色等配置为商品 Option 及对应价格，且与打印设备能力一致 |
| 设备 | 测试租户中准备唯一的 `deviceType=printer` 设备，`device_id/device_code/shop_code` 关系有效，凭证仅使用环境配置 |
| 订单 | 准备可追踪、可丢弃的 printer `DeviceOrder` fixtures：至少 CREATED/QUEUED、PROCESSING、SUCCEEDED、FAILED、CANCELLED 各一条，并记录 `orderNo/taskId` |
| 外部依赖 | 使用独立 HTTP Mock 服务承接后端发往链科的请求；回调测试不依赖链科主动投递。若未配置 mock，跳过会触发真实链科请求的用例并标记环境阻塞 |
| 契约 | 将新增路径及响应模型补入并校验 `governance/CONTRACT/backend-api.json`；当前快照尚未覆盖本 feature 的新增路径 |

完整链路测试必须提前准备测试店铺、打印商品和 SKU，并使用测试文件、测试用户及测试支付环境创建订单。当前小程序下单链路尚未实现，无法直接通过本 feature 的 API 完成“创建订单 → 支付 → 提交打印”；因此现阶段订单 fixture 必须由后续下单链路、专用测试数据准备流程或测试环境预置产生。

仅测试打印任务管理和回调接口时，可以复用已经创建的测试店铺/打印商品，也可以只使用与测试租户绑定的 printer 设备和一次性 `DeviceOrder` fixture；但 fixture 仍必须具备可核对的 `orderNo/taskId`、设备归属和租户信息。不得在 API 测试中用数据库临时插入数据来绕过业务链路；若状态回调会永久修改订单，必须使用一次性 fixture，并通过业务退款/取消/恢复能力清理或恢复。

### 2.1 链科 HTTP 层 Mock 方案

本方案采用“后端指向独立 Mock 服务”的方式，不在 Playwright 中拦截后端出站请求。原因是 Playwright 的 `APIRequestContext` 只能控制测试脚本发出的请求，不能拦截 Spring Boot 进程内部的 OkHttp 请求。

Mock 服务可选 WireMock、MockWebServer 或等价的本地 HTTP 服务；服务只监听 `127.0.0.1` 或测试网络，不允许代理真实链科地址。后端已有 `LIANKE_PRINT_HOST` 配置入口，启动前注入：

```bash
export LIANKE_PRINT_HOST="http://127.0.0.1:18080/api"
export LIANKE_PRINT_API_KEY="api-test-placeholder"
export LIANKE_PRINT_CALLBACK_BASE_URL="http://127.0.0.1:8888"
```

修改后重启后端，并在测试开始前用 Mock 服务的请求日志确认请求没有发往真实链科。Mock 不需要真实 ApiKey；测试报告不得记录任何真实 ApiKey、`deviceKey` 或签名文件 URL。

#### Mock 路由与响应

后端网关会在配置的 host 后拼接 `/print/job`，因此 Mock 服务需提供以下路由：

| 方法 | 路径 | 用途 | 成功响应要点 |
|------|------|------|--------------|
| POST | `/api/print/job` | 提交任务 | HTTP 200；JSON `code=200`；`data.task_id` 为唯一 mock task ID |
| GET | `/api/print/job?deviceId=...&deviceKey=...&task_id=...` | 查询状态 | HTTP 200；JSON `code=200`；`data.task_id/task_state` 与场景一致 |
| DELETE | `/api/print/job?deviceId=...&deviceKey=...&task_id=...` | 取消任务 | HTTP 200；JSON `code=200`；返回任务成功结果 |

提交成功模板：

```json
{
  "code": 200,
  "msg": "success",
  "data": { "task_id": "mock-task-001" }
}
```

查询成功模板（按用例替换状态）：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "task_id": "mock-task-001",
    "task_state": "SUCCESS",
    "page_count": 3,
    "task_result": { "code": 0, "msg": "打印成功" }
  }
}
```

#### Mock 场景矩阵

| Mock 场景 | 配置 | 验证目标 |
|-----------|------|----------|
| 提交成功 | POST 返回唯一 `task_id` | 任务号落库、状态进入 QUEUED/PROCESSING |
| 提交业务失败 | HTTP 200，`code` 非 200 | 后端识别提交失败，不伪造 taskId，并按失败策略处理 |
| 查询 PROCESSING/SUCCESS/FAILURE | GET 返回对应 `task_state` | 主动查询结果解析正确，状态只前进 |
| 取消成功 | DELETE 返回 `code=200` | 管理端取消返回成功，任务最终为 CANCELLED |
| HTTP 4xx/5xx | 返回对应 HTTP 状态 | `PrintJobResult.success=false`，接口不报告成功 |
| 连接超时/断开 | 延迟超过后端 read timeout 或直接关闭连接 | 记录链科调用失败，保留可补偿状态，不产生未追踪成功任务 |
| 非法 JSON/缺少 data | HTTP 200 但响应结构不完整 | 按失败处理，不抛出未处理异常 |

每个 Mock 场景都要记录请求方法、路径、查询参数和关键表单字段是否符合链科契约；不得记录完整 `deviceKey`、ApiKey、文件 URL 或用户信息。提交、查询和取消测试应使用不同的 mock task ID，避免状态串扰。

#### 与 API 用例的组合方式

- `PRINTER-API-020～023` 使用 Mock 查询/取消响应，验证管理端 API 到链科网关的完整后端链路。
- `PRINTER-API-024～027` 使用提交成功、提交失败、超时和落库失败响应，验证重试幂等与补偿。
- `PRINTER-API-030～039` 不依赖 Mock 服务返回回调；测试脚本直接向后端回调接口发送状态通知，再通过管理端 API 查询副作用。
- Mock 服务异常时，相关用例归类为环境问题；只有在请求已到达 Mock 且后端响应/状态不符合预期时，才归类为产品缺陷。

### 3. 通用断言

每个请求至少断言：

1. HTTP 状态码符合接口约定；
2. JSON `CommonResult.code`：成功为 `0`，失败为非 `0`；
3. `msg` 在错误场景能说明认证、权限、参数、资源或业务状态原因；
4. 关键响应字段和类型：分页 `list/total`、详情 `orderNo/deviceType/taskId/status`、链科结果 `success/taskId/taskState`；
5. 写操作之后重新查询数据库可见的业务结果，且不产生重复退款、重复配送或重复状态迁移。

### 4. 用例矩阵

#### 4.1 认证、权限与租户隔离

| 编号 | 请求 | 场景 | 预期 |
|------|------|------|------|
| PRINTER-API-001 | `GET /admin-api/device/print-job/page` | 有效管理员 Token + 当前测试租户 | HTTP 成功，`code=0`，列表只含当前租户 printer 任务 |
| PRINTER-API-002 | 同上 | 缺少 Authorization、格式错误 Token、无效 Mock Token | 认证失败；不得返回业务数据 |
| PRINTER-API-003 | 同上 | 有 Token 但无 `device:print-job:query` | `code` 非 0，HTTP/错误语义为权限不足，不得误判为无数据 |
| PRINTER-API-004 | `get/query/cancel/retry` | 分别使用无对应按钮权限的用户 | 各接口均拒绝，不能因拥有 query 权限而越权取消或重试 |
| PRINTER-API-005 | `page/get/query/cancel/retry` | 使用另一测试租户的 `orderNo/taskId` | 不得读到、查询、取消或重试跨租户任务；响应按现有资源不存在/无权限语义断言 |
| PRINTER-API-006 | `POST /app-api/device/printer/callback` | 无 Token、无 `tenant-id`、带伪造租户头 | 仍返回 HTTP 200 且 `code=0`，但非法回调不改变任何本地订单；回调不依赖租户上下文 |

#### 4.2 分页与详情

| 编号 | 请求 | 场景 | 预期 |
|------|------|------|------|
| PRINTER-API-010 | `GET /admin-api/device/print-job/page?pageNo=1&pageSize=10` | 基础分页 | 成功；所有返回记录 `deviceType=printer`，包含可核对的 `taskId/extraParams` |
| PRINTER-API-011 | `.../page` | `taskId`、状态、时间范围、边界 pageNo/pageSize | 过滤条件生效；页码/页大小非法时返回参数错误，不返回越界或全量数据 |
| PRINTER-API-012 | `GET /admin-api/device/print-job/get?orderNo=<valid>` | 查询存在的打印设备订单 | 成功；详情中的订单号、任务号、状态和页数快照一致 |
| PRINTER-API-013 | 同上 | 空 orderNo、超长 orderNo、不存在订单号、其他设备类型订单号 | 返回明确失败或空结果；不得泄露其他设备订单 |

#### 4.3 主动查询、取消与重试

| 编号 | 请求 | 场景 | 预期 |
|------|------|------|------|
| PRINTER-API-020 | `POST /admin-api/device/print-job/query?taskId=<valid>` | mock 链科返回 PROCESSING/SUCCESS/FAILURE | HTTP 成功、`code=0`，返回 `taskId/taskState`；若接口职责包含同步，则重新查询确认本地状态只前进 |
| PRINTER-API-021 | 同上 | 空 taskId、未知 taskId、属于其他租户的 taskId、非 printer taskId | 非成功业务码；不得调用错误设备或返回他租户结果 |
| PRINTER-API-022 | `POST /admin-api/device/print-job/cancel?taskId=<queued>` | 取消排队/处理中任务 | 调用链科取消成功，返回任务号；回调/查询确认本地变为 CANCELLED，记录取消原因 |
| PRINTER-API-023 | 同上 | 已成功、已失败、已取消任务；空/未知 taskId | 按状态限制拒绝或幂等成功；不得把终态回退或重复退款 |
| PRINTER-API-024 | `POST /admin-api/device/print-job/retry?orderNo=<failed>` | 失败任务重试 | 清空旧 `taskId/failureReason/finishedAt`，重新提交仅一次；成功后落新 taskId，状态回到 CREATED/QUEUED/PROCESSING |
| PRINTER-API-025 | 同上 | 非失败任务、空/未知/他租户 orderNo | 拒绝重试；原状态、失败原因和完成时间不被错误修改 |
| PRINTER-API-026 | 并发发送两次 retry 或重复投递 pay notice 的等价场景 | 幂等与竞态 | 最多一个有效链科任务；本地只有一个新 taskId，不重复计费/配送 |
| PRINTER-API-027 | query/cancel/retry | mock 链科超时、5xx、无效响应、落库失败 | 返回可识别失败结果，保留可补偿状态并记录告警；不得报告成功或留下未追踪的链科孤儿任务 |

#### 4.4 链科回调、状态机与副作用

回调 body 使用契约字段：`device_id/task_id/task_state/create_time/finish_time/task_result{code,msg}`。所有回调用例都应检查 HTTP 200、`code=0`，并通过后台详情/分页确认实际副作用。

| 编号 | 回调场景 | 预期 |
|------|----------|------|
| PRINTER-API-030 | 合法 device_id + task_id，READY → PARSING → SENDING | 设备订单状态依次前进为 QUEUED/PROCESSING；业务订单仍为待制作；无退款 |
| PRINTER-API-031 | 合法回调 SUCCESS | 设备订单为 SUCCEEDED；业务订单推进到 1 配送中；配送占位网关最多调用一次 |
| PRINTER-API-032 | 合法回调 FAILURE，`task_result.code != 0` | 设备订单为 FAILED，记录 failureReason；自动退款按 `0→1→2` 完成，业务主状态为 `-2` |
| PRINTER-API-033 | 合法回调 REVOKED | 设备订单为 CANCELLED，记录取消/失败原因；已支付订单触发一次退款 |
| PRINTER-API-034 | 相同 SUCCESS/FAILURE/REVOKED 回调重复发送 | 每次均可安全返回；状态、退款、配送不重复执行 |
| PRINTER-API-035 | SUCCESS 后发送 FAILURE/REVOKED，或 PROCESSING 后发送 READY | 返回成功但忽略回退；状态、退款和配送保持原值 |
| PRINTER-API-036 | 未知 device_id、device_id 属于非 printer、task_id 不匹配、已删除任务 | 返回成功以避免链科重投；不更新任何订单、不触发退款 |
| PRINTER-API-037 | 缺少字段、空 task_state、未知 task_state、错误字段类型、超大 body | 返回成功或统一错误语义以符合回调防重投约定；不得抛出未处理异常，不得修改订单 |
| PRINTER-API-038 | 回调处理内部异常（mock 订单/退款服务异常） | 仍返回 HTTP 200 + `code=0`；日志记录脱敏异常；不产生半成功的重复副作用 |
| PRINTER-API-039 | 退款服务返回失败 | 设备订单仍为失败终态，`refund_status=1` 保留待人工处理并产生 ERROR 告警；不能伪报退款完成 |

### 5. 推荐执行顺序

1. 先运行认证烟测和只读分页/详情用例（PRINTER-API-001～013）。
2. 在 mock 链科环境运行 query/cancel/retry，并在每个写用例后重新查询验证（PRINTER-API-020～027）。
3. 使用独立一次性订单按状态机顺序运行回调成功、失败、撤销、乱序和重复用例（PRINTER-API-030～039）；禁止并行复用同一 fixture。
4. 最后执行 Playwright 管理端 E2E，验证真实用户从菜单进入打印任务管理并完成查询/详情/操作；API 通过不能替代这一步。

运行命令：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
(
  cd governance/e2e
  API_BASE_URL="https://${DOMAIN_API}" \
    TEST_TENANT_ID="${TEST_TENANT_ID}" \
    ADMIN_USER_ID="<测试管理员用户 ID>" \
    npx playwright test specs/api/printer-shop/printer-shop.api.spec.ts
)
```

本地运行时将 `API_BASE_URL` 改为 `http://localhost:8888`。报告不得输出完整 Token、Cookie、deviceKey、ApiKey、文件签名 URL 或个人信息。

### 6. 清理与失败归类

- 只使用本轮创建或专门预置的测试任务；停止仍可能投递回调/MQ 的模拟器后再清理。
- 按任务 → 设备订单 → 业务订单 → 打印商品/SKU → 店铺/设备的依赖逆序，通过取消、退款、恢复及现有管理 API 清理；清理后用 page/get 和对应管理查询复核无残留或已恢复基线。共享测试店铺、商品或设备不得直接删除，应恢复原配置。
- 不直接执行未获批准的 SQL；若接口无法恢复状态，停止后续测试，记录受影响的 `orderNo/taskId` 和“待清理”，不得用删除记录掩盖外部打印/退款副作用。
- 认证失败、权限不足、业务校验失败、产品缺陷、测试数据问题、链科/支付环境故障分别归类，不以 HTTP 200 单独判定成功。

本方案执行完成后，应在本节下补充实际环境（local/test）、脱敏的用户/租户标识、每个用例的通过/失败、关键响应断言、清理结果和失败归类。当前已知阻塞为：打印订单创建链路尚未实现、链科真实凭证未配置、机器契约快照未更新。
