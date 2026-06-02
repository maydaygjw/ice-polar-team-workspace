# P0-01「MiniApp DMS 直连整改」架构设计文档

> **文档编号**: ARCH-P0-01
> **版本**: v1.0
> **日期**: 2026-06-02
> **作者**: architecture-agent
> **状态**: 待评审

---

## 一、背景与问题定义

### 1.1 现状违规

`miniapp/pages/device-detail/device-detail.js` 直接通过 `wx.request` 调用 `icepolar-dms` API，严重违反 `governance/CLAUDE.md` 架构红线：

```
[MiniApp] --wx.request--> [DMS]  ❌ 当前违规（device-detail.js:67-68, 164-165）
```

违规代码位置：
- `miniapp/app.js:13` — `dmsUrl: 'https://dms.holuntech.com'`
- `miniapp/pages/device-detail/device-detail.js:4` — `const DMS_BASE_URL = app.globalData.dmsUrl`
- `miniapp/pages/device-detail/device-detail.js:67-68` — `GET /api/v1/devices/{imei}/status`
- `miniapp/pages/device-detail/device-detail.js:164-165` — `POST /api/v1/commands/{imei}/{type}`

### 1.2 风险分析

| 风险维度 | 具体风险 | 严重程度 |
|---------|---------|---------|
| 权限绕过 | 前端直接操控设备，backend 无法校验用户是否有权操作该设备 | 极高 |
| 租户隔离失效 | DMS 调用未经过 backend 的 `TenantLineInnerInterceptor` | 高 |
| 无审计日志 | 谁、何时、对哪个设备下发了什么指令 — 无记录 | 高 |
| 无速率限制 | 恶意用户可高频下发指令，导致设备故障 | 中 |
| DMS 地址暴露 | `dmsUrl` 硬编码在小程序中，可被逆向提取 | 中 |

### 1.3 目标架构

```
[MiniApp] --wx.request--> [backend /app-api/device/] --HttpClientUtils--> [DMS]
                              ↑
                    [权限校验] [租户隔离] [审计日志]
```

---

## 二、API 设计

### 2.1 接口总览

| 方法 | 路径 | 功能 | 鉴权 |
|------|------|------|------|
| `GET` | `/app-api/device/status` | 查询设备状态 | `@PreAuthenticated` |
| `POST` | `/app-api/device/command` | 下发设备指令 | `@PreAuthenticated` |

> 前缀说明：`/app-api/` 为 C-end API 统一前缀，已在 `AppDeviceManagementController` 中使用。

### 2.2 GET /app-api/device/status — 查询设备状态

#### 请求参数（Query）

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `imei` | String | 是 | 设备 IMEI 号 |

#### 请求头

```
Authorization: Bearer {accessToken}
tenant-id: 153
```

#### 响应 DTO — `AppDeviceStatusRespVO`

```java
@Data
@Builder
public class AppDeviceStatusRespVO {
    /** 设备 IMEI */
    private String imei;
    /** 在线状态: true-在线, false-离线 */
    private Boolean online;
    /** 制冰状态: 0-待机, 1-制冰中 */
    private Integer makeIceStatus;
    /** 缺冰状态: 0-正常, 1-缺冰 */
    private Integer lackIceStatus;
    /** 缺水状态: 0-正常, 1-缺水 */
    private Integer lackWaterStatus;
    /** 化冰状态: 0-待机, 1-化冰中 */
    private Integer meltIceStatus;
    /** 故障码: 0-正常, 1-设备故障, 2-杯少, 其他-保留 */
    private Integer errorCode;
    /** 出冰进度: 0-100 */
    private Integer iceProgress;
    /** 最后心跳时间 */
    private String lastHeartbeat;
}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "imei": "860123045678901",
    "online": true,
    "makeIceStatus": 1,
    "lackIceStatus": 0,
    "lackWaterStatus": 0,
    "meltIceStatus": 0,
    "errorCode": 0,
    "iceProgress": 75,
    "lastHeartbeat": "2026-06-02 14:32:18"
  },
  "msg": "success"
}
```

### 2.3 POST /app-api/device/command — 下发设备指令

#### 请求 DTO — `AppDeviceCommandReqVO`

```java
@Data
public class AppDeviceCommandReqVO {
    /** 设备 IMEI */
    @NotBlank(message = "设备号不能为空")
    private String imei;

    /** 指令类型: 1-11 */
    @NotNull(message = "指令类型不能为空")
    @Min(value = 1, message = "指令类型最小为1")
    @Max(value = 11, message = "指令类型最大为11")
    private Integer commandType;
}
```

#### 指令类型映射表

| type | 指令 | DMS 路径 | 说明 |
|------|------|---------|------|
| 1 | 水桶门 | `/api/v1/commands/{imei}/1` | 打开水桶门 |
| 2 | 杯子门 | `/api/v1/commands/{imei}/2` | 打开杯子门 |
| 3 | 开始制冰 | `/api/v1/commands/{imei}/3` | 启动制冰流程 |
| 4 | 停止制冰 | `/api/v1/commands/{imei}/4` | 停止制冰流程 |
| 5 | 蒸发器化冰 | `/api/v1/commands/{imei}/5` | 蒸发器化冰处理 |
| 6 | 冰桶化冰 | `/api/v1/commands/{imei}/6` | 冰桶化冰处理 |
| 7 | 出冰 | `/api/v1/commands/{imei}/7` | 执行出冰动作 |
| 8 | 出杯 | `/api/v1/commands/{imei}/8` | 执行出杯动作 |
| 9 | 自清洗 | `/api/v1/commands/{imei}/9` | 触发设备自清洗 |
| 10 | 语音 | `/api/v1/commands/{imei}/10` | 触发语音播报 |
| 11 | 授时 | `/api/v1/commands/{imei}/11` | 同步设备时间 |

#### 响应 DTO — `AppDeviceCommandRespVO`

```java
@Data
@Builder
public class AppDeviceCommandRespVO {
    /** 是否成功 */
    private Boolean success;
    /** 提示消息 */
    private String message;
    /** 设备 IMEI */
    private String imei;
    /** 指令类型 */
    private Integer commandType;
}
```

#### 响应示例

```json
{
  "code": 0,
  "data": {
    "success": true,
    "message": "指令已下发",
    "imei": "860123045678901",
    "commandType": 9
  },
  "msg": "success"
}
```

### 2.4 错误码定义

新增错误码常量（`yshop-module-device-api/.../ErrorCodeConstants.java`）：

```java
// ========== 设备管理 1008001000 ============
ErrorCode DEVICE_NOT_FOUND = new ErrorCode(1008001000, "设备不存在");
ErrorCode DEVICE_OFFLINE = new ErrorCode(1008001001, "设备离线，无法执行指令");
ErrorCode DEVICE_COMMAND_TIMEOUT = new ErrorCode(1008001002, "指令下发超时，请稍后重试");
ErrorCode DEVICE_COMMAND_FAILED = new ErrorCode(1008001003, "指令执行失败");
ErrorCode DEVICE_NO_PERMISSION = new ErrorCode(1008001004, "无权操作该设备");
ErrorCode DEVICE_COMMAND_TYPE_INVALID = new ErrorCode(1008001005, "指令类型无效");
ErrorCode DEVICE_IMEI_EMPTY = new ErrorCode(1008001006, "设备号不能为空");
```

#### 错误码映射（MiniApp 侧）

| 错误码 | 用户提示 | 处理建议 |
|--------|---------|---------|
| 1008001000 | 设备不存在 | 检查 IMEI 是否正确 |
| 1008001001 | 设备离线，请检查网络 | 稍后重试或联系运维 |
| 1008001002 | 指令下发超时 | 稍后重试 |
| 1008001003 | 指令执行失败 | 联系运维人员 |
| 1008001004 | 无权操作该设备 | 确认是否已绑定设备 |
| 1008001005 | 指令类型无效 | 联系客服 |
| 1008001006 | 设备号不能为空 | 检查参数 |

---

## 三、模块边界

### 3.1 类职责划分

```
AppDeviceManagementController  (现有，追加两个端点)
    ├── GET /app-api/device/status
    └── POST /app-api/device/command
            ↓
DeviceManagementServiceImpl  (现有，追加两个方法)
    ├── queryDeviceStatus(String imei) → DeviceStatusDTO
    └── sendDeviceCommand(String imei, Integer commandType) → DeviceCommandResultDTO
            ↓
HttpClientUtils  (现有，复用)
    ├── executeHttpGetRequest(uri) → JsonNode
    └── executeHttpRequest(uri, params) → JsonNode
            ↓
icepolar-dms
```

### 3.2 新增/修改的文件清单

#### Backend（yshop-module-device-biz）

| 类型 | 文件路径 | 动作 | 说明 |
|------|---------|------|------|
| Controller | `controller/app/AppDeviceManagementController.java` | 修改 | 追加 `status` 和 `command` 两个端点 |
| Service Interface | `service/devicemanagement/DeviceManagementService.java` | 修改 | 追加 `queryDeviceStatus`、`sendDeviceCommand` |
| Service Impl | `service/devicemanagement/DeviceManagementServiceImpl.java` | 修改 | 实现上述方法 |
| DTO | `service/devicemanagement/dto/DeviceStatusDTO.java` | 新增 | 设备状态数据对象 |
| DTO | `service/devicemanagement/dto/DeviceCommandResultDTO.java` | 新增 | 指令执行结果 |
| VO | `controller/app/vo/AppDeviceStatusRespVO.java` | 新增 | 状态查询响应 VO |
| VO | `controller/app/vo/AppDeviceCommandReqVO.java` | 新增 | 指令下发请求 VO |
| VO | `controller/app/vo/AppDeviceCommandRespVO.java` | 新增 | 指令下发响应 VO |
| ErrorCode | `enums/ErrorCodeConstants.java`（device-api） | 修改 | 追加设备相关错误码 |
| Mapper | `dal/mysql/device/DeviceManagementMapper.java` | 修改 | 追加 `selectByImeiAndUserId` |
| Service | `service/devicemanagement/DeviceManagementServiceImpl.java` | 修改 | 追加 `checkDevicePermission` 方法 |

#### MiniApp

| 文件路径 | 动作 | 说明 |
|---------|------|------|
| `app.js` | 修改 | 删除 `dmsUrl` 字段 |
| `pages/device-detail/device-detail.js` | 修改 | 删除 DMS 直连代码，改为调用 backend API |
| `pages/device-detail/device-detail.js` | 修改 | 使用 `app.request()` 替代 `wx.request()` |

### 3.3 复用 vs 新增决策

| 决策项 | 结论 | 理由 |
|--------|------|------|
| `DeviceManagementServiceImpl` 复用 | 是 | 已有 DMS 调用能力（`HttpClientUtils`、`queryDmsDeviceStatusByImei`） |
| `HttpClientUtils` 复用 | 是 | 已封装 GET/POST，配置化 DMS host |
| 新增 Service 方法 | 是 | `queryDeviceStatus` 和 `sendDeviceCommand` 为新增业务 |
| 新增 Controller 端点 | 是 | 在现有 `AppDeviceManagementController` 中追加 |
| 设备权限校验 | 复用 `canManage` | 已有 `GET /app-api/device/canManage` 逻辑 |

---

## 四、安全设计

### 4.1 设备操作权限校验

**校验逻辑**：用户必须满足以下任一条件方可操作设备：

1. 用户当前已连接该设备（`yshop_device` 表中存在 `user_id = {currentUserId}` 且 `imei = {imei}` 且 `deleted = false` 的记录）
2. 用户拥有 `YWYYG`（运维员工）岗位权限（复用现有 `canManageDevice` 逻辑）

**实现位置**：`DeviceManagementServiceImpl.checkDevicePermission(Long userId, String imei)`

```java
private void checkDevicePermission(Long userId, String imei) {
    // 1. 检查是否已连接该设备
    DeviceManagementDO device = deviceManagementMapper
        .selectByImeiAndUserId(imei, String.valueOf(userId));
    if (device != null) {
        return; // 已连接，有权操作
    }

    // 2. 检查是否有运维权限
    MemberUserRespDTO user = memberUserApi.getUser(userId);
    if (user != null && user.getMobile() != null
        && adminUserApi.checkUserHasPostByMobile(user.getMobile(), DEVICE_ADMIN_POST_CODE)) {
        return; // 运维人员，有权操作
    }

    // 3. 无权操作
    throw exception(DEVICE_NO_PERMISSION);
}
```

### 4.2 防止未授权设备操控

| 防御层 | 机制 | 实现 |
|--------|------|------|
| 第一层：身份认证 | JWT Token 校验 | `@PreAuthenticated` + Spring Security |
| 第二层：租户隔离 | 自动注入 tenant_id | `TenantLineInnerInterceptor` |
| 第三层：设备绑定 | 用户-设备关系校验 | `yshop_device` 表查询 |
| 第四层：岗位权限 | 运维人员白名单 | `adminUserApi.checkUserHasPostByMobile` |
| 第五层：指令类型白名单 | 仅允许 1-11 | `@Min(1) @Max(11)` 参数校验 |

### 4.3 审计日志

**新增表**：`yshop_device_command_log`（详见第六章）

**记录内容**：

| 字段 | 说明 |
|------|------|
| `user_id` | 操作用户 ID |
| `imei` | 被操作设备 IMEI |
| `command_type` | 指令类型（1-11） |
| `command_name` | 指令名称（中文） |
| `result` | 执行结果：0-成功, 1-失败, 2-超时 |
| `error_msg` | 失败原因 |
| `ip` | 请求来源 IP |
| `create_time` | 操作时间 |
| `tenant_id` | 租户 ID |

**记录时机**：在 `DeviceManagementServiceImpl.sendDeviceCommand` 中，无论成功失败均写入日志。

```java
@Override
public DeviceCommandResultDTO sendDeviceCommand(String imei, Integer commandType) {
    Long userId = getLoginUserId();
    checkDevicePermission(userId, imei);

    String commandName = CommandTypeEnum.fromCode(commandType).getName();
    String clientIp = ServletUtils.getClientIP();

    DeviceCommandResultDTO result;
    try {
        // 调用 DMS 下发指令
        result = executeCommand(imei, commandType);
        // 记录成功日志
        deviceCommandLogService.saveLog(userId, imei, commandType, commandName,
            result.getSuccess() ? 0 : 1, null, clientIp);
    } catch (Exception e) {
        // 记录失败日志
        deviceCommandLogService.saveLog(userId, imei, commandType, commandName,
            1, e.getMessage(), clientIp);
        throw e;
    }
    return result;
}
```

---

## 五、MiniApp 改造方案

### 5.1 删除项

| 文件 | 删除内容 |
|------|---------|
| `app.js:13` | 删除 `dmsUrl: 'https://dms.holuntech.com'` |
| `device-detail.js:4` | 删除 `const DMS_BASE_URL = app.globalData.dmsUrl` |
| `device-detail.js:67-87` | 删除 DMS 直连的状态查询 `wx.request` |
| `device-detail.js:164-187` | 删除 DMS 直连的指令下发 `wx.request` |

### 5.2 新增/修改项

#### `app.js` 修改

```javascript
// 删除 dmsUrl 字段
globalData: {
  userInfo: null,
  deviceConnected: false,
  deviceId: null,
  deviceImei: null,
  shopId: config.shopId,
  selectedCup: null,
  openid: null,
  config: config,
  // dmsUrl 已删除 —— 所有设备操作改走 backend API
}
```

#### `device-detail.js` 改造后代码

```javascript
const { getCommandList } = require('../../utils/device-admin');
const config = require('../../config/config');

const app = getApp();

Page({
  data: {
    device: null,
    commands: [],
    loading: false
  },

  onLoad(options) {
    const imei = options.id;
    // ... 原有参数解析逻辑不变 ...

    const commands = getCommandList().map((cmd) => ({
      ...cmd,
      icon: iconMap[cmd.key] || '',
      commandType: typeMap[cmd.key] || null
    }));

    this.setData({ commands });
    this.fetchStatus();
  },

  // ===== 改造后：通过 backend API 查询设备状态 =====
  fetchStatus() {
    const { imei } = this._baseInfo;
    this.setData({ loading: true });
    wx.showLoading({ title: '加载中', mask: true });

    app.request({
      url: `/app-api/device/status?imei=${encodeURIComponent(imei)}`,
      method: 'GET'
    }).then((res) => {
      if (res.data && res.data.code === 0) {
        this.buildDevice(res.data.data);
      } else {
        wx.showToast({
          title: res.data?.msg || '获取状态失败',
          icon: 'none'
        });
      }
    }).catch((err) => {
      wx.showToast({ title: err.message || '网络请求失败', icon: 'none' });
    }).finally(() => {
      this.setData({ loading: false });
      wx.hideLoading();
    });
  },

  // ===== 改造后：通过 backend API 下发设备指令 =====
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

    app.request({
      url: '/app-api/device/command',
      method: 'POST',
      data: { imei, commandType: type }
    }).then((res) => {
      if (res.data && res.data.code === 0) {
        wx.showToast({ title: `${label}指令已下发`, icon: 'success' });
      } else {
        // 根据错误码显示用户友好提示
        const errorMsg = this.mapErrorCode(res.data?.code, res.data?.msg);
        wx.showToast({ title: errorMsg, icon: 'none' });
      }
    }).catch((err) => {
      wx.showToast({ title: err.message || '网络请求失败', icon: 'none' });
    }).finally(() => {
      this._sending = false;
      wx.hideLoading();
    });
  },

  // 错误码映射
  mapErrorCode(code, defaultMsg) {
    const map = {
      1008001001: '设备离线，请检查网络',
      1008001002: '指令下发超时，请稍后重试',
      1008001003: '指令执行失败',
      1008001004: '无权操作该设备',
      1008001005: '指令类型无效'
    };
    return map[code] || defaultMsg || '操作失败';
  },

  // buildDevice 方法保持原有逻辑，字段名从 DMS 原始格式改为 backend 标准化格式
  buildDevice(data) {
    const { imei, model, address } = this._baseInfo;
    const states = [
      {
        key: 'making',
        label: '制冰状态',
        value: data.makeIceStatus === 1 ? '制冰中' : '待机',
        active: data.makeIceStatus === 1
      },
      {
        key: 'lackIce',
        label: '缺冰状态',
        value: data.lackIceStatus === 1 ? '缺冰' : '正常',
        active: data.lackIceStatus === 1
      },
      {
        key: 'lackWater',
        label: '缺水状态',
        value: data.lackWaterStatus === 1 ? '缺水' : '正常',
        active: data.lackWaterStatus === 1
      },
      {
        key: 'meltIce',
        label: '化冰状态',
        value: data.meltIceStatus === 1 ? '化冰中' : '待机',
        active: data.meltIceStatus === 1
      },
      {
        key: 'error',
        label: '故障状态',
        value: this.formatErrorCode(data.errorCode),
        active: data.errorCode !== 0
      }
    ];
    // ... 其余逻辑不变 ...
  },

  formatErrorCode(code) {
    const map = { 0: '正常', 1: '设备故障', 2: '杯少' };
    return map[code] || `故障码${code}`;
  }
});
```

### 5.3 错误处理策略

| 场景 | MiniApp 行为 | Backend 行为 |
|------|-------------|-------------|
| 设备离线 | 提示"设备离线，请检查网络" | 返回 1008001001，不调用 DMS |
| 指令超时 | 提示"指令下发超时，请稍后重试" | DMS 5s 超时，返回 1008001002 |
| 无权操作 | 提示"无权操作该设备" | 权限校验失败，返回 1008001004 |
| 网络异常 | `app.request()` catch 统一处理 | — |
| Token 过期 | `app.request()` 401 处理 → 跳转登录 | Spring Security 返回 401 |

---

## 六、数据库变更

### 6.1 新增表：设备指令审计日志表

```sql
-- =====================================================
-- P0-01: 新增设备指令审计日志表
-- 用途: 记录所有设备指令下发操作，满足安全审计要求
-- 执行顺序: 在 backend 部署前执行
-- =====================================================

CREATE TABLE `yshop_device_command_log` (
  `id` bigint NOT NULL AUTO_INCREMENT COMMENT 'id',
  `user_id` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '操作用户ID',
  `imei` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '设备IMEI',
  `command_type` tinyint NOT NULL COMMENT '指令类型: 1-水桶门 2-杯子门 3-开始制冰 4-停止制冰 5-蒸发器化冰 6-冰桶化冰 7-出冰 8-出杯 9-自清洗 10-语音 11-授时',
  `command_name` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL COMMENT '指令名称',
  `result` tinyint NOT NULL DEFAULT '0' COMMENT '执行结果: 0-成功 1-失败 2-超时',
  `error_msg` varchar(500) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '失败原因',
  `ip` varchar(64) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL COMMENT '请求来源IP',
  `create_time` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '操作时间',
  `tenant_id` bigint NOT NULL DEFAULT '0' COMMENT '租户编号',
  PRIMARY KEY (`id`) USING BTREE,
  KEY `idx_user_id` (`user_id`),
  KEY `idx_imei` (`imei`),
  KEY `idx_create_time` (`create_time`),
  KEY `idx_tenant_id` (`tenant_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='设备指令审计日志';
```

### 6.2 索引说明

| 索引名 | 字段 | 用途 |
|--------|------|------|
| `idx_user_id` | `user_id` | 按用户查询操作记录 |
| `idx_imei` | `imei` | 按设备查询操作记录 |
| `idx_create_time` | `create_time` | 按时间范围查询 |
| `idx_tenant_id` | `tenant_id` | 租户隔离 |

### 6.3 是否需要修改现有表

| 表名 | 是否修改 | 说明 |
|------|---------|------|
| `yshop_device` | 否 | 已有 `user_id` + `imei` + `deleted` 字段，满足权限校验需求 |
| `yshop_device_order` | 否 | 与本次变更无关 |

---

## 七、CONTRACTS.md 更新

在 `governance/CONTRACTS.md` 中追加「Device API Contract」章节：

```markdown
## Device API Contract

### 架构约束

- MiniApp 禁止直接调用 `icepolar-dms`，所有设备操作必须通过 backend `/app-api/device/*` 代理
- DMS host 配置在 backend `yshop.device.dms.host`，MiniApp 不感知 DMS 存在

### C-end Device API

#### 查询设备状态

```
GET /app-api/device/status?imei={imei}
Header: Authorization: Bearer {token}, tenant-id: 153
```

响应字段（`data` 内）：
| 字段 | 类型 | 说明 |
|------|------|------|
| imei | String | 设备 IMEI |
| online | Boolean | 在线状态 |
| makeIceStatus | Integer | 0-待机, 1-制冰中 |
| lackIceStatus | Integer | 0-正常, 1-缺冰 |
| lackWaterStatus | Integer | 0-正常, 1-缺水 |
| meltIceStatus | Integer | 0-待机, 1-化冰中 |
| errorCode | Integer | 0-正常, 1-设备故障, 2-杯少 |
| iceProgress | Integer | 0-100 |
| lastHeartbeat | String | 最后心跳时间 |

#### 下发设备指令

```
POST /app-api/device/command
Header: Authorization: Bearer {token}, tenant-id: 153, Content-Type: application/json
Body: { "imei": "...", "commandType": 1 }
```

指令类型（commandType）：
| 值 | 指令 | 说明 |
|----|------|------|
| 1 | 水桶门 | 打开水桶门 |
| 2 | 杯子门 | 打开杯子门 |
| 3 | 开始制冰 | 启动制冰 |
| 4 | 停止制冰 | 停止制冰 |
| 5 | 蒸发器化冰 | 蒸发器化冰 |
| 6 | 冰桶化冰 | 冰桶化冰 |
| 7 | 出冰 | 执行出冰 |
| 8 | 出杯 | 执行出杯 |
| 9 | 自清洗 | 设备自清洗 |
| 10 | 语音 | 语音播报 |
| 11 | 授时 | 同步时间 |

#### 权限校验

- 用户必须已连接该设备（`yshop_device` 中存在记录）或拥有 `YWYYG` 岗位权限
- 未授权用户收到错误码 `1008001004`

#### 错误码

| 错误码 | 含义 |
|--------|------|
| 1008001000 | 设备不存在 |
| 1008001001 | 设备离线 |
| 1008001002 | 指令下发超时 |
| 1008001003 | 指令执行失败 |
| 1008001004 | 无权操作该设备 |
| 1008001005 | 指令类型无效 |
| 1008001006 | 设备号不能为空 |
```

---

## 八、风险与回滚

### 8.1 部署风险

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| Backend API 部署失败 | 低 | 高 | 蓝绿部署，新 API 验证通过后再切流量 |
| MiniApp 审核延迟 | 中 | 高 | 使用小程序「体验版」先行验证 |
| DMS 接口变更 | 低 | 中 | Backend 层做字段映射，屏蔽 DMS 变更 |
| 性能下降（增加一跳） | 低 | 低 | Backend 到 DMS 内网通信，延迟 < 10ms |

### 8.2 回滚方案

**场景：backend API 部署后发现问题，需要回滚**

```
回滚步骤：
1. Backend 回滚到上一版本（保留 /app-api/device/status 和 /command 端点）
2. MiniApp 保持调用 backend API（无需回滚，因为 backend API 已存在）
3. 如 backend API 不可用，MiniApp 设备管理功能降级为"只读"（查询状态可用，指令下发禁用）
```

**兼容性保障**：

| 阶段 | Backend | MiniApp | 是否可用 |
|------|---------|---------|---------|
| 阶段1：Backend 部署新 API | 新 API 可用 | 仍调 DMS（旧代码） | 是（旧模式） |
| 阶段2：MiniApp 发布新版 | 新 API 可用 | 改调 backend | 是（新模式） |
| 阶段3：Backend 回滚 | 旧版本 | 改调 backend | **不可用**（需紧急处理） |

**阶段3 应急措施**：
- 在 backend 旧版本中临时追加 `/app-api/device/status` 和 `/command` 端点（hotfix）
- 或 MiniApp 紧急发布回滚版本（改回 DMS 直连，不推荐）

### 8.3 推荐部署顺序

```
Day 1: Backend 部署
  - 新增 API 端点（/status, /command）
  - 新增数据库表 yshop_device_command_log
  - 验证 API 可用性（Postman / 单元测试）

Day 2: MiniApp 体验版验证
  - 使用微信开发者工具上传体验版
  - 测试设备状态查询、指令下发全流程
  - 测试权限校验（未绑定设备用户应收到 1008001004）

Day 3: MiniApp 正式版发布
  - 提交微信审核
  - 审核通过后发布

Day 4: 监控与清理
  - 监控 backend API 调用量、错误率
  - 确认无 MiniApp 直接调用 DMS 的流量
  - 从 DMS 侧配置 IP 白名单，仅允许 backend 服务器访问
```

### 8.4 长期加固

| 措施 | 优先级 | 说明 |
|------|--------|------|
| DMS IP 白名单 | P1 | 仅允许 backend 服务器 IP 访问 DMS |
| DMS API Key | P1 | backend 调用 DMS 时携带 API Key 认证 |
| 指令频率限制 | P2 | 同一设备 1 分钟内最多下发 5 条指令 |
| 敏感指令二次确认 | P2 | 出冰、停止制冰等指令需用户二次确认 |

---

## 九、任务拆分与依赖

### 9.1 任务清单

| 编号 | 任务 | 负责人 | 依赖 | 预计工时 |
|------|------|--------|------|---------|
| T1 | Backend: 新增 DTO/VO/ErrorCode | backend-agent | 无 | 1h |
| T2 | Backend: 新增 `queryDeviceStatus` + `sendDeviceCommand` Service 方法 | backend-agent | T1 | 2h |
| T3 | Backend: 新增 Controller 端点 + 权限校验 | backend-agent | T2 | 1.5h |
| T4 | Backend: 新增 `yshop_device_command_log` 表及 DAO | backend-agent | T3 | 1.5h |
| T5 | Backend: 单元测试 | backend-agent | T3, T4 | 2h |
| T6 | MiniApp: 删除 `dmsUrl` + DMS 直连代码 | miniapp-agent | 无 | 0.5h |
| T7 | MiniApp: 改为调用 backend API | miniapp-agent | T3（backend API 可用） | 1h |
| T8 | MiniApp: 错误码映射 + 错误处理 | miniapp-agent | T7 | 0.5h |
| T9 | CONTRACTS.md 更新 | architecture-agent | T3 | 0.5h |
| T10 | 数据库升级 SQL 执行 | DBA / backend-agent | T4 | 0.5h |
| T11 | 集成测试（端到端） | QA | T5, T8 | 2h |

### 9.2 依赖图

```
T1 (DTO/VO) → T2 (Service) → T3 (Controller) → T5 (测试)
                         ↓
                    T4 (日志表) → T10 (SQL执行)
                         ↓
                    T6 (删除DMS) → T7 (改调backend) → T8 (错误处理)
                         ↓
                    T9 (CONTRACTS更新)
                         ↓
                    T11 (集成测试)
```

### 9.3 关键路径

```
T1 → T2 → T3 → T7 → T8 → T11
```

**总预计工时**: 约 13 人时（Backend 8h + MiniApp 2h + 架构 0.5h + 测试 2h）

---

## 十、验收标准

### 10.1 功能验收

| 编号 | 验收项 | 验收方法 |
|------|--------|---------|
| AC-1 | `GET /app-api/device/status` 返回标准化设备状态 | Postman 调用，字段名符合设计文档 |
| AC-2 | `POST /app-api/device/command` 成功下发指令到 DMS | 调用后端 API，DMS 收到对应指令 |
| AC-3 | 未绑定设备的用户收到 1008001004 | 使用测试用户调用，验证返回错误码 |
| AC-4 | 运维人员（YWYYG）可操作任意设备 | 使用运维账号测试 |
| AC-5 | 每次指令下发均记录到 `yshop_device_command_log` | 查询数据库验证 |
| AC-6 | MiniApp 无 `dmsUrl` 全局变量 | 全局搜索 `dmsUrl` 和 `dms.holuntech.com` |
| AC-7 | MiniApp 设备管理页面正常运作 | 微信开发者工具真机调试 |

### 10.2 安全验收

| 编号 | 验收项 | 验收方法 |
|------|--------|---------|
| AC-S1 | 无 JWT Token 时返回 401 | 不带 Authorization header 调用 |
| AC-S2 | 租户隔离生效（tenant_id 自动注入） | 检查 MyBatis Plus 生成的 SQL |
| AC-S3 | DMS 地址不在 MiniApp 中 | 反编译小程序包，搜索 `holuntech.com` |
| AC-S4 | 指令类型超出 1-11 时参数校验失败 | 传入 commandType=99，验证返回 400 |

### 10.3 性能验收

| 编号 | 验收项 | 目标 |
|------|--------|------|
| AC-P1 | 状态查询 P99 延迟 | < 500ms（含 backend → DMS 往返） |
| AC-P2 | 指令下发 P99 延迟 | < 2s（含 DMS 设备通信） |
| AC-P3 | 审计日志写入 | 异步写入，不影响主流程响应时间 |

---

## 十一、附录

### A. 参考文档

- `governance/CLAUDE.md` — 团队宪法
- `governance/ARCHITECTURE.md` — 系统架构
- `governance/CONTRACTS.md` — 跨仓库契约
- `governance/AUDIT-REPORTS/MINIAPP_AUDIT.md` — 小程序审计报告
- `governance/AUDIT-REPORTS/后端开发报告.md` — 后端审计报告
- `governance/AUDIT-REPORTS/架构师报告.md` — 架构审计报告
- `governance/AUDIT-REPORTS/TODO.md` — 整改待办清单

### B. 相关代码位置

| 组件 | 路径 |
|------|------|
| Backend Controller | `backend/yshop-module-mall/yshop-module-device-biz/.../AppDeviceManagementController.java` |
| Backend Service | `backend/yshop-module-mall/yshop-module-device-biz/.../DeviceManagementServiceImpl.java` |
| HttpClientUtils | `backend/yshop-module-mall/yshop-module-device-biz/.../HttpClientUtils.java` |
| MiniApp device-detail | `miniapp/pages/device-detail/device-detail.js` |
| MiniApp app.js | `miniapp/app.js` |
| DMS Config | `backend/yshop-server/.../application-dev.yaml` (`yshop.device.dms.host`) |

### C. 变更日志

| 版本 | 日期 | 作者 | 变更内容 |
|------|------|------|---------|
| v1.0 | 2026-06-02 | architecture-agent | 初始版本 |
