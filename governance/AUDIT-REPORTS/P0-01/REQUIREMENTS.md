# P0-01「MiniApp DMS 直连整改」需求定义

> 需求编号：P0-01
> 需求名称：MiniApp DMS 直连整改（Device Proxy API）
> 需求类型：架构安全整改
> 优先级：P0（阻塞发布）
> 提出日期：2026-06-02
> 分支命名：`feat/device-dms-proxy`

---

## 1. 背景与问题陈述

### 1.1 架构红线

根据 `governance/CLAUDE.md` 系统边界定义：

> `icepolar-dms` 是 Device Management System，负责硬件级设备管理（connect, dispense ice, deice, self-clean, status query）。**它由 `yshop-drink` backend（`yshop-module-device-biz`）调用，never by frontend directly。**

### 1.2 违规现状

`miniapp/pages/device-detail/device-detail.js` 存在两处直接调用 DMS API 的代码：

```javascript
// device-detail.js:67-68 —— 查询设备状态
wx.request({
  url: `${DMS_BASE_URL}/api/v1/devices/${imei}/status`,
  method: 'GET',
});

// device-detail.js:164-165 —— 下发设备指令
wx.request({
  url: `${DMS_BASE_URL}/api/v1/commands/${imei}/${type}`,
  method: 'POST',
});
```

其中 `DMS_BASE_URL = app.globalData.dmsUrl = 'https://dms.holuntech.com'`。

### 1.3 风险分析

| 风险项 | 严重程度 | 说明 |
|--------|---------|------|
| 未授权设备操控 | **致命** | 任何获取 IMEI 的人可直接调用 DMS 下发指令，无需登录/鉴权 |
| 绕过 tenant 隔离 | **致命** | DMS 调用无 tenant-id 校验，可跨租户操作设备 |
| 绕过业务审计 | **高** | 设备指令无 backend 日志记录，无法追踪操作人 |
| DMS 地址暴露 | **中** | 小程序源码可被反编译，DMS 域名直接暴露 |
| 架构契约失效 | **高** | 破坏 backend 作为唯一 DMS 调用方的架构约定 |

---

## 2. 功能需求

### 2.1 需求总览

```
┌─────────────────┐     ┌─────────────────────┐     ┌─────────────────┐
│  icepolarminiapp │ ──→ │  yshop-drink        │ ──→ │  icepolar-dms   │
│  (Mini Program)  │     │  (backend proxy)    │     │  (DMS backend)  │
└─────────────────┘     └─────────────────────┘     └─────────────────┘
        │                        │                         │
   wx.request            @PreAuthenticated           HttpClientUtils
   /app-api/device/*     tenant-id 校验               yshop.device.dms.host
   Bearer Token          权限校验（canManage）         /api/v1/devices/...
```

### 2.2 FR-001：Backend 新增 Device Proxy API

**目标**：在 `yshop-module-device-biz` 新增两个 App API 端点，作为 MiniApp 调用 DMS 的唯一代理通道。

#### 2.2.1 API-1：查询设备状态

```
GET /app-api/device/status/{imei}
```

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| imei | Path | String | 是 | 设备 IMEI 号 |
| tenant-id | Header | String | 是 | 租户 ID，固定 `153` |
| Authorization | Header | String | 是 | Bearer Token |

**响应结构**（复用现有 `CommonResult<DeviceStatusRespVO>`）：

```json
{
  "code": 0,
  "data": {
    "imei": "862123045678901",
    "online": true,
    "iceProgress": 75,
    "lastHeartbeat": "2026-06-02 14:30:00",
    "states": [
      { "key": "making", "label": "制冰状态", "value": "制冰中", "active": true },
      { "key": "lackIce", "label": "缺冰状态", "value": "正常", "active": false },
      { "key": "lackWater", "label": "缺水状态", "value": "正常", "active": false },
      { "key": "meltIce", "label": "化冰状态", "value": "待机", "active": false },
      { "key": "error", "label": "故障状态", "value": "正常", "active": false }
    ]
  },
  "msg": "success"
}
```

**实现要求**：
- 复用现有 `DeviceManagementServiceImpl.queryDmsDeviceStatusByImei(String imei)` 方法
- 复用现有 `HttpClientUtils.executeHttpGetRequest(String uri)` 调用 DMS
- DMS 路径：`GET /api/v1/devices/{imei}/status`
- 返回字段映射（DMS → backend → MiniApp）：

| DMS 字段 | backend 字段 | MiniApp 字段 | 说明 |
|----------|-------------|-------------|------|
| `conn_status` | `connectionStatus` | `online` | `1` → `true`, `0` → `false` |
| `make_ice_status` | — | `states[0].active` | `1` → `active: true` |
| `lack_ice_status` | — | `states[1].active` | `1` → 缺冰 |
| `lack_water_status` | — | `states[2].active` | `1` → 缺水 |
| `melt_ice_status` | — | `states[3].active` | `1` → 化冰中 |
| `error_code` | — | `states[4].value` | `0`→正常, `1`→故障, `2`→杯少 |
| `ice_progress` | `iceProgress` | `iceProgress` | 0-100 |
| `last_heartbeat` | `lastSeen` | `lastHeartbeat` | 格式化为 `YYYY-MM-DD HH:mm` |

#### 2.2.2 API-2：下发设备指令

```
POST /app-api/device/command/{imei}/{commandType}
```

**请求参数**：

| 参数 | 位置 | 类型 | 必填 | 说明 |
|------|------|------|------|------|
| imei | Path | String | 是 | 设备 IMEI 号 |
| commandType | Path | Integer | 是 | 指令类型（1-11） |
| tenant-id | Header | String | 是 | 租户 ID，固定 `153` |
| Authorization | Header | String | 是 | Bearer Token |

**指令类型映射**（yinerda DTU 规范）：

| commandType | 指令名称 | DMS 路径 |
|-------------|---------|---------|
| 1 | 水桶门 | `POST /api/v1/commands/{imei}/1` |
| 2 | 杯子门 | `POST /api/v1/commands/{imei}/2` |
| 3 | 开始制冰 | `POST /api/v1/commands/{imei}/3` |
| 4 | 停止制冰 | `POST /api/v1/commands/{imei}/4` |
| 5 | 蒸发器化冰 | `POST /api/v1/commands/{imei}/5` |
| 6 | 冰桶化冰 | `POST /api/v1/commands/{imei}/6` |
| 7 | 出冰 | `POST /api/v1/commands/{imei}/7` |
| 8 | 出杯 | `POST /api/v1/commands/{imei}/8` |
| 9 | 自清洗 | `POST /api/v1/commands/{imei}/9` |
| 10 | 语音 | `POST /api/v1/commands/{imei}/10` |
| 11 | 授时 | `POST /api/v1/commands/{imei}/11` |

**响应结构**：

```json
{
  "code": 0,
  "data": {
    "success": true,
    "message": "指令已下发"
  },
  "msg": "success"
}
```

**实现要求**：
- 新增 `DeviceManagementService.sendCommand(String imei, Integer commandType)` 方法
- 通过 `HttpClientUtils.executeHttpRequest(String uri, Map params)` 调用 DMS
- DMS 路径：`POST /api/v1/commands/{imei}/{commandType}`
- 请求体为空（DMS 端无需参数）
- 校验 `commandType` 范围：`1 <= commandType <= 11`，否则返回 `IllegalArgumentException`

#### 2.2.3 权限控制

- 两个 API 均需 `@PreAuthenticated`（登录校验）
- **权限校验**：端点内部调用 `canManage()` 方法（复用 `/canManage` 逻辑），校验用户手机号是否关联 `YWYYG` 岗位编码
  - 有权限 → 继续执行
  - 无权限 → 返回 `CommonResult.error(403, "无设备管理权限")`
- **注**：不使用 `@PreAuthorize` 注解，因为小程序 C 端接口无岗位授权环节，改为方法内显式校验

### 2.3 FR-002：MiniApp 移除 DMS 直连代码

**目标**：删除所有 MiniApp 中直接调用 DMS 的代码，改为调用 backend Proxy API。

#### 2.3.1 删除项

| 文件 | 删除内容 |
|------|---------|
| `miniapp/app.js:13` | `dmsUrl: 'https://dms.holuntech.com'` |
| `miniapp/pages/device-detail/device-detail.js:3-4` | `const DMS_BASE_URL = app.globalData.dmsUrl;` |
| `miniapp/pages/device-detail/device-detail.js:67-87` | `wx.request` 查询 DMS 状态（改为调用 backend API） |
| `miniapp/pages/device-detail/device-detail.js:164-187` | `wx.request` 下发 DMS 指令（改为调用 backend API） |

#### 2.3.2 新增/修改项

**`device-detail.js` —— 查询设备状态**：

```javascript
fetchStatus() {
  const { imei } = this._baseInfo;
  this.setData({ loading: true });
  wx.showLoading({ title: '加载中', mask: true });

  const config = require('../../config/config');
  wx.request({
    url: `${config.api.baseUrl}/app-api/device/status/${imei}`,
    method: 'GET',
    header: config.getAuthHeaders('form'),
    success: (res) => {
      if (res.data && res.data.code === 0) {
        this.buildDevice(res.data.data);
      } else {
        wx.showToast({
          title: res.data?.msg || '获取状态失败',
          icon: 'none'
        });
      }
    },
    fail: () => {
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    },
    complete: () => {
      this.setData({ loading: false });
      wx.hideLoading();
    }
  });
}
```

**`device-detail.js` —— 下发设备指令**：

```javascript
handleCommandTap(e) {
  const { label, type } = e.currentTarget.dataset;

  if (!type) {
    wx.showToast({ title: `已发送${label}指令`, icon: 'none' });
    return;
  }

  if (this._sending) return;
  this._sending = true;
  wx.showLoading({ title: '发送中', mask: true });

  const { imei } = this._baseInfo;
  const config = require('../../config/config');

  wx.request({
    url: `${config.api.baseUrl}/app-api/device/command/${imei}/${type}`,
    method: 'POST',
    header: config.getAuthHeaders('json'),
    success: (res) => {
      if (res.data && res.data.code === 0) {
        wx.showToast({ title: `${label}指令已下发`, icon: 'success' });
      } else {
        wx.showToast({
          title: res.data?.msg || '指令下发失败',
          icon: 'none'
        });
      }
    },
    fail: () => {
      wx.showToast({ title: '网络请求失败', icon: 'none' });
    },
    complete: () => {
      this._sending = false;
      wx.hideLoading();
    }
  });
}
```

#### 2.3.3 全局清理

- 全局搜索 `dms.holuntech.com`，确保无任何残留
- 全局搜索 `globalData.dmsUrl`，确保无任何引用
- 全局搜索 `DMS_BASE_URL`，确保无任何引用

### 2.4 FR-003：Governance 更新 CONTRACTS.md

**目标**：在 `governance/CONTRACTS.md` 中补充 Device API Contract 章节。

#### 2.4.1 新增章节内容

```markdown
## Device API Contract

### Proxy API（MiniApp → backend → DMS）

MiniApp 禁止直接调用 DMS。所有设备操作必须通过 backend Proxy API：

#### 查询设备状态

```
GET /app-api/device/status/{imei}
Headers:
  tenant-id: 153
  Authorization: Bearer {accessToken}
```

Response: `CommonResult<DeviceStatusRespVO>`

#### 下发设备指令

```
POST /app-api/device/command/{imei}/{commandType}
Headers:
  tenant-id: 153
  Authorization: Bearer {accessToken}
```

| commandType | 指令 | DMS 内部路径 |
|-------------|------|-------------|
| 1 | 水桶门 | /api/v1/commands/{imei}/1 |
| 2 | 杯子门 | /api/v1/commands/{imei}/2 |
| ... | ... | ... |
| 11 | 授时 | /api/v1/commands/{imei}/11 |

### 权限要求

- 必须登录（Bearer Token 有效）
- 用户必须拥有 `YWYYG` 岗位编码（设备运维员）
- tenant-id 必须为 `153`

### 错误码

| Code | 含义 |
|------|------|
| 0 | 成功 |
| 401 | 未登录或 Token 过期 |
| 403 | 无设备管理权限 |
| 404 | 设备不存在 |
| 500 | DMS 服务异常 |
```

---

## 3. 非功能需求

### 3.1 安全需求（NFR-001）

| 编号 | 需求 | 优先级 |
|------|------|--------|
| NFR-001-1 | MiniApp 源码中不得出现任何 DMS URL、DMS API 路径 | 必须 |
| NFR-001-2 | Backend Proxy API 必须校验登录状态（`@PreAuthenticated`） | 必须 |
| NFR-001-3 | Backend Proxy API 必须校验设备管理权限：方法内调用 `canManage()` 复用 `/canManage` 逻辑（校验 `YWYYG` 岗位），无权限返回 403 | 必须 |
| NFR-001-4 | Backend 调用 DMS 时，必须记录操作日志（操作人、IMEI、指令类型、时间） | 必须 |
| NFR-001-5 | 指令下发 API 必须校验 `commandType` 范围（1-11），防止非法指令 | 必须 |

### 3.2 性能需求（NFR-002）

| 编号 | 需求 | 指标 |
|------|------|------|
| NFR-002-1 | 状态查询响应时间 | ≤ 3s（含 DMS 往返） |
| NFR-002-2 | 指令下发响应时间 | ≤ 5s（含 DMS 往返） |
| NFR-002-3 | 并发请求 | 支持至少 50 并发设备状态查询 |

### 3.3 兼容性需求（NFR-003）

| 编号 | 需求 | 说明 |
|------|------|------|
| NFR-003-1 | MiniApp 页面 UI/UX 保持不变 | 用户无感知切换 |
| NFR-003-2 | 设备状态字段映射保持向后兼容 | `buildDevice()` 方法字段名不变 |
| NFR-003-3 | Backend 现有 DMS 调用逻辑不受影响 | `HttpClientUtils` 不修改 |
| NFR-003-4 | 现有 `/app-api/device/*` API 不受影响 | 新增 API，不修改已有端点 |

### 3.4 可观测性需求（NFR-004）

| 编号 | 需求 | 说明 |
|------|------|------|
| NFR-004-1 | Backend 记录所有 Proxy API 调用日志 | INFO 级别，含 IMEI、commandType、userId |
| NFR-004-2 | DMS 调用失败时记录 ERROR 日志 | 含异常堆栈 |
| NFR-004-3 | 新增 API 必须包含 Swagger/OpenAPI 注解 | `@Operation`、`@Tag`、`@Parameter` |

---

## 4. 验收标准

### 4.1 代码验收

| 序号 | 验收项 | 验证方法 |
|------|--------|---------|
| AC-01 | MiniApp 中无任何 `wx.request` 调用 DMS 地址 | `grep -r "dms.holuntech.com" miniapp/` 返回空 |
| AC-02 | `app.globalData.dmsUrl` 已删除 | `grep -r "dmsUrl" miniapp/` 返回空 |
| AC-03 | `miniapp/pages/device-detail/device-detail.js` 改为调用 backend API | 代码审查 |
| AC-04 | Backend 新增 `GET /app-api/device/status/{imei}` | Swagger UI 可见，可调用 |
| AC-05 | Backend 新增 `POST /app-api/device/command/{imei}/{commandType}` | Swagger UI 可见，可调用 |
| AC-06 | Backend 新增 API 有 `@PreAuthenticated` 注解，且方法内调用 `canManage()` 做权限校验 | 代码审查 |
| AC-07 | Backend 指令下发有 `commandType` 范围校验 | 代码审查 + 单元测试 |
| AC-08 | `governance/CONTRACTS.md` 已补充 Device API Contract | 文档审查 |

### 4.2 功能验收

| 序号 | 验收项 | 验证方法 |
|------|--------|---------|
| AC-09 | 登录用户可正常查询设备状态 | 端到端测试 |
| AC-10 | 登录用户可正常下发所有 11 种指令 | 端到端测试 |
| AC-11 | 未登录用户调用 API 返回 401 | 接口测试 |
| AC-12 | 无设备管理权限的用户调用 API 返回 403（方法内 `canManage()` 校验） | 接口测试 |
| AC-13 | `commandType = 0` 或 `commandType = 12` 返回参数错误 | 接口测试 |
| AC-14 | DMS 不可用时 backend 返回友好错误（非 500 裸抛） | 接口测试 |

### 4.3 回归验收

| 序号 | 验收项 | 验证方法 |
|------|--------|---------|
| AC-15 | 现有 `/app-api/device/_connect` 不受影响 | 回归测试 |
| AC-16 | 现有 `/app-api/device/_queryDeviceStatus` 不受影响 | 回归测试 |
| AC-17 | 现有 `/app-api/device/_order` 不受影响 | 回归测试 |
| AC-18 | 现有 `/app-api/device/queryDeviceAndShop` 不受影响 | 回归测试 |
| AC-19 | 出冰流程（`_initiateDirect`）不受影响 | 回归测试 |

---

## 5. 风险清单

| 编号 | 风险 | 可能性 | 影响 | 缓解措施 |
|------|------|--------|------|---------|
| R-01 | DMS API 响应格式与现有 `queryDmsDeviceStatusByImei` 不一致 | 低 | 高 | 复用现有方法，不改动 DMS 调用逻辑 |
| R-02 | MiniApp `buildDevice()` 字段映射错误导致 UI 显示异常 | 中 | 中 | 对照现有 `device-detail.js:90-139` 逐字段验证 |
| R-03 | Backend 新增 API 路径与现有路径冲突 | 低 | 高 | 路径设计为 `/status/{imei}`、`/command/{imei}/{type}`，与现有 `/device` 下路径无冲突 |
| R-04 | 权限校验遗漏导致未授权用户可操作设备 | 低 | **致命** | 强制要求 `@PreAuthenticated` + `YWYYG` 岗位校验，代码审查重点检查 |
| R-05 | 多仓库 PR 合并顺序错误导致临时状态不一致 | 中 | 中 | **先合并 backend PR**（提供 API），**再合并 miniapp PR**（调用新 API） |
| R-06 | DMS 服务超时导致 backend 线程阻塞 | 中 | 中 | 复用现有 `HttpClientUtils`，其已使用 OkHttp 超时配置；P1-04 将引入熔断 |
| R-07 | MiniApp 发版审核期间 backend API 未部署 | 中 | 高 | Backend 先部署到生产，确认 API 可用后再提交 MiniApp 审核 |
| R-08 | `tenant-id: 153` 在 backend 新 API 中被忽略 | 低 | 中 | 现有 backend 已通过 `TenantLineInnerInterceptor` 自动注入，无需额外处理 |

---

## 6. 分支与 PR 策略

### 6.1 分支命名

所有仓库统一使用分支名：`feat/device-dms-proxy`

### 6.2 PR 拆分

本 feature 涉及 **3 个独立仓库**，需分别提交 3 个 PR：

| 顺序 | 仓库 | PR 内容 | 依赖 |
|------|------|---------|------|
| **1** | `backend/` | 新增 `GET /app-api/device/status/{imei}` 和 `POST /app-api/device/command/{imei}/{commandType}` | 无 |
| **2** | `governance/` | 更新 `CONTRACTS.md` 补充 Device API Contract | 无（可与 backend 并行） |
| **3** | `miniapp/` | 删除 DMS 直连代码，改为调用 backend Proxy API | **依赖 backend PR 合并并部署** |

### 6.3 合并顺序

```
Day 1: backend PR 创建 → 代码审查 → 合并 → 部署到生产
Day 1: governance PR 创建 → 合并（文档更新，无部署依赖）
Day 2: miniapp PR 创建 → 代码审查 → 合并 → 提交微信审核
```

> 重要：miniapp PR 必须在 backend 新 API 部署到生产环境后才能合并，否则小程序用户将遇到 API 404 错误。

---

## 7. 变更文件清单

### 7.1 backend/ 变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `yshop-module-device-biz/.../controller/app/AppDeviceManagementController.java` | 修改 | 新增两个 `@GetMapping` 和 `@PostMapping` 方法 |
| `yshop-module-device-biz/.../service/devicemanagement/DeviceManagementService.java` | 修改 | 新增 `sendCommand(String imei, Integer commandType)` 接口方法 |
| `yshop-module-device-biz/.../service/devicemanagement/DeviceManagementServiceImpl.java` | 修改 | 实现 `sendCommand` 方法 |
| `yshop-module-device-biz/.../controller/app/vo/DeviceStatusRespVO.java` | **新增** | 设备状态查询响应 VO |
| `yshop-module-device-biz/.../controller/app/vo/DeviceCommandRespVO.java` | **新增** | 指令下发响应 VO |

### 7.2 miniapp/ 变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `miniapp/app.js` | 修改 | 删除 `dmsUrl` 全局变量 |
| `miniapp/pages/device-detail/device-detail.js` | 修改 | 重写 `fetchStatus()` 和 `handleCommandTap()` |

### 7.3 governance/ 变更

| 文件 | 变更类型 | 说明 |
|------|---------|------|
| `governance/CONTRACTS.md` | 修改 | 新增「Device API Contract」章节 |

---

## 8. 参考文档

| 文档 | 路径 |
|------|------|
| 团队宪法（架构红线） | `governance/CLAUDE.md` |
| 系统架构 | `governance/ARCHITECTURE.md` |
| 现有 API 契约 | `governance/CONTRACTS.md` |
| MiniApp 设备详情页 | `miniapp/pages/device-detail/device-detail.js` |
| MiniApp 全局配置 | `miniapp/app.js` |
| Backend App Device Controller | `backend/.../controller/app/AppDeviceManagementController.java` |
| Backend Device Service | `backend/.../service/devicemanagement/DeviceManagementServiceImpl.java` |
| Backend DMS HTTP 工具 | `backend/.../utils/HttpClientUtils.java` |
| 整改 TODO 清单 | `governance/AUDIT-REPORTS/TODO.md`（P0-01、P0-06） |

---

## 9. 附录：DMS 原始响应格式参考

### 查询设备状态（DMS `GET /api/v1/devices/{imei}/status`）

```json
{
  "code": 0,
  "data": {
    "device_imei": "862123045678901",
    "conn_status": 1,
    "make_ice_status": 1,
    "lack_ice_status": 0,
    "lack_water_status": 0,
    "melt_ice_status": 0,
    "error_code": 0,
    "ice_progress": 75,
    "last_heartbeat": "2026-06-02T14:30:00"
  },
  "message": "success"
}
```

### 下发指令（DMS `POST /api/v1/commands/{imei}/{type}`）

```json
{
  "code": 0,
  "data": {
    "success": true,
    "message": "指令已下发"
  },
  "message": "success"
}
```

---

> 本文档由 requirements-agent 编写，供 backend-agent、miniapp-agent 和架构师评审使用。
> 任何变更需经架构师评审后方可进入开发阶段。
