# 测试记录 — 通用设备平台与制冰机迁移

## 当前阶段

- 阶段：implementation 第一阶段。
- 已修改 backend worktree：增加通用设备核心 API、状态枚举、设备/设备订单通用字段、迁移脚本，并将制冰机 DMS 协议抽到 `device.ice` 网关。
- 未修改 DMS、MQTT 协议、后台页面和小程序接口。

## 已执行验证

| 命令 | 结果 |
|---|---|
| `mvn -pl yshop-module-mall/yshop-module-device-biz -am compile -DskipTests` | 通过 |
| `mvn -pl yshop-module-mall/yshop-module-device-biz -am -Dtest=DmsIceDeviceGatewayTest -Dsurefire.failIfNoSpecifiedTests=false test` | 通过，2 个测试 |
| `git diff --check` | 通过 |

全量 `mvn ... test` 目前被既有 `yshop-spring-boot-starter-web` 的 `DesensitizeTest` 失败阻断；失败断言为历史脱敏测试的 `芋***` 与 `y****` 不一致，不涉及本次设备代码。

## 计划验证

- 验证 `device-core` 设备规范、状态维度和通用设备订单生命周期。
- 验证 `device-ice` 状态查询、命令下发和制冰机订单迁移。
- 验证旧 API、旧 `imei` 数据和 DMS/MQTT 链路兼容。
- 验证租户隔离、重复请求、设备占用和失败恢复。

## 未决前置条件

- `device-core-api/biz` 与 `device-ice-api/biz` 当前先以现有 device API/BIZ 工程内的 `core`、`ice` 包实现，最终 Maven 拆分仍待后续独立变更。
- 通用设备订单是否长期留在 device-core，需在实现后根据支付/财务需求复评。
- 现有设备表中历史 `imei` 与新 `deviceCode` 的完整映射需要在迁移阶段确认。
