# CHANGE-REPORT: 语音播报管理功能

## 变更概述

在小程序设备管理端新增「语音播报」管理操作，支持向设备下发 51-56 语音播报指令。

## 受影响仓库及文件清单

### `icepolar-dms/`
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `app/routes/commands.py` | 修改 | 更新 `command` Path 参数描述，移除 `le=16` 限制，支持 51-56 |
| `app/services/device_manager.py` | 修改 | `send_device_command` 放宽校验：`1-16` 或 `51-56` |

### `backend/`
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `yshop-module-mall/yshop-module-device-biz/src/main/java/.../AppDeviceManagementController.java` | 修改 | 更新 Swagger `@Parameter` 描述为 `1-11, 51-56` |
| `yshop-module-mall/yshop-module-device-biz/src/main/java/.../DeviceManagementServiceImpl.java` | 修改 | `sendCommand` 放宽校验：`1-11` 或 `51-56` |

### `miniapp/`
| 文件 | 变更类型 | 说明 |
|------|----------|------|
| `utils/device-admin.js` | 修改 | 新增 `voiceBroadcastList` 和 `getVoiceBroadcastList()` |
| `pages/device-detail/device-detail.js` | 修改 | 新增 `voiceBroadcasts` 数据、`handleVoiceBroadcastTap`、`sendVoiceBroadcastCommand` |
| `pages/device-detail/device-detail.wxml` | 修改 | 新增「语音播报」按钮（使用 `command-card--accent` 样式） |
| `pages/device-detail/device-detail.wxss` | 修改 | 新增 `.command-card--accent` 差异化样式 |

## API 变更摘要

- `POST /app-api/device/command/{imei}/{commandType}`: `commandType` 有效范围从 `1-11` 扩展为 `1-11, 51-56`
- `POST /api/v1/commands/{device_imei}/{command}`: `command` 有效范围从 `1-16` 扩展为 `1-16, 51-56`
- 接口请求/响应结构无变化，完全向后兼容。

## 数据库变更

无。

## UI/UX 变更

- 设备详情页「设备指令」区域新增「语音播报」卡片按钮（橙色系渐变，与现有蓝色系区分）
- 点击后调用微信小程序原生 `wx.showActionSheet`，展示 6 个播报选项：
  - 广告播报、扫码未下单、下单未支付、支付未确认-买杯、支付未确认-自带杯、出冰完成
- 选择后立即下发对应指令（51-56），并 toast 提示结果

## 测试覆盖情况

- DMS 现有测试未覆盖指令值边界校验，本次变更未引入新测试（校验逻辑简单直接）
- Backend 现有测试未覆盖指令值边界校验
- MiniApp 为原生微信小程序，无自动化测试套件

## 审查结论

**PASS**

- 实现与需求规格一致
- API 合同变更已归档至 `governance/feature-docs/voice-broadcast/contract-changes.md`
- 无硬编码密钥
- 复用现有 `canManage()` 权限校验，租户隔离不变
- 无数据库变更
- 向后兼容，1-11 指令行为不变

## 风险评估

- **低风险**：变更仅为校验范围放宽 + UI 入口新增，不涉及核心业务逻辑重构
- DMS `/api/v1/commands/{device_imei}/{command}` 在 apidoc.md 中仍仅记录 1-6，但代码实际支持 1-16 和 51-56。建议后续更新 apidoc.md
