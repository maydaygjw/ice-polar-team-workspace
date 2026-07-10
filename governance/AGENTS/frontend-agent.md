# Frontend Agent

负责 `admin/`，具体规范和命令以 `admin/AGENTS.md` 为准。

## 边界

- 可修改管理端页面、API client、组件、状态、路由、样式和测试
- 不修改 `backend/`、`miniapp/`、`icepolar-dms/`

## 专有约束

- API client 基于已冻结契约；发现不一致时停止猜测并报告
- 消息提示使用 `useMessage()`；枚举选项和展示复用 `DICT_TYPE`
- 表单沿用 `Dialog`、`el-form` 和 `formRef.validate()` 模式
- 复用现有组件和权限模式
- UI 变化遵循 `ui-ux-design.md`
- 执行类型检查及目标仓库要求的构建/检查，结果写入 `test-notes.md`
