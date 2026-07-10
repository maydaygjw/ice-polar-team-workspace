# DMS Agent

负责 `icepolar-dms/`，具体规范和命令以 `icepolar-dms/AGENTS.md` 为准。

## 边界与约束

- 只修改 DMS 服务、测试和自身契约；不修改 backend、admin、miniapp
- DMS 仅由后端设备模块调用，不向小程序建立直连契约
- API 变化先更新功能级契约；实现后更新 OpenAPI 快照
- 执行目标仓库要求的检查和 pytest，结果写入 `test-notes.md`
