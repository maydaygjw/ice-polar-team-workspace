# 语音播报管理功能技术设计

## 变更概述

在三处放宽指令值校验，并在小程序新增 UI 入口。

## 影响仓库

| 仓库 | 文件 | 变更内容 |
|------|------|----------|
| `icepolar-dms/` | `app/routes/commands.py` | 放宽 `command` Path 参数校验 `le=16` → 支持 51-56 |
| `icepolar-dms/` | `app/services/device_manager.py` | 放宽 `send_device_command` 指令值校验 |
| `backend/` | `AppDeviceManagementController.java` | 更新 Swagger 注解，说明支持 51-56 |
| `backend/` | `DeviceManagementServiceImpl.java` | 放宽 `sendCommand` commandType 校验 |
| `miniapp/` | `utils/device-admin.js` | 新增 `getVoiceBroadcastList()` |
| `miniapp/` | `pages/device-detail/device-detail.js` | 新增语音播报按钮点击逻辑、弹窗控制 |
| `miniapp/` | `pages/device-detail/device-detail.wxml` | 新增语音播报区域、弹窗选择器 |
| `miniapp/` | `pages/device-detail/device-detail.wxss` | 新增弹窗和播报选项样式 |

## API 变更

### Backend Proxy API

`POST /app-api/device/command/{imei}/{commandType}`

- **变更前**: `commandType` 有效范围 `1-11`
- **变更后**: `commandType` 有效范围 `1-11` 或 `51-56`

### DMS Internal API

`POST /api/v1/commands/{device_imei}/{command}`

- **变更前**: `command` 有效范围 `1-16`
- **变更后**: `command` 有效范围 `1-16` 或 `51-56`

## 数据流

```
用户点击「语音播报」→ 小程序弹窗选择 → 选择内容（如「出冰完成」= 56）
  → POST /app-api/device/command/{imei}/56
    → Backend 校验权限 + 校验 commandType ∈ {1..11} ∪ {51..56}
      → POST /api/v1/commands/{imei}/56
        → DMS 校验 command ∈ {1..16} ∪ {51..56}
          → MQTT sset order=56 → 设备
```

## UI 交互设计

### 方案：弹窗选择器

1. 在「设备指令」区域末尾新增一个「语音播报」卡片按钮
2. 点击后从底部弹出 `action-sheet` 风格的选择面板
3. 面板标题「选择播报内容」，列出 6 个选项
4. 选中后立即下发对应指令，并 toast 提示

### 样式规范

- 语音播报按钮使用现有 `command-card` 样式
- 新增图标 `icon-speaker.svg`
- 弹窗使用微信小程序原生 `wx.showActionSheet` API（无需自定义弹窗）

## 安全与权限

- 复用现有 `canManage()` 权限校验逻辑
- 指令值白名单校验：`1-11` 或 `51-56`，其余值拒绝
