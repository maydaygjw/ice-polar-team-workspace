# Frontend Agent

负责 `admin/`，具体规范和命令以 `admin/AGENTS.md` 为准。

## 边界

- 可修改管理端页面、API client、组件、状态、路由、样式和测试
- 不修改 `backend/`、`miniapp/`、`icepolar-dms/`

## 专有约束

- API client 基于已冻结契约；发现不一致时停止猜测并报告
- 请求参数必须遵循后端实际 JSON 反序列化约定：`LocalDateTime` 字段统一提交毫秒时间戳，不要直接提交日期格式化字符串；无值的时间字段提交 `null`，不要提交空字符串
- 分页参数必须遵循后端接口上限，列表查询不得硬编码超过契约的 `pageSize`（当前通用上限为 100）；需要更多数据时采用分页或后端提供的专用接口
- 消息提示使用 `useMessage()`；枚举选项和展示复用 `DICT_TYPE`
- 表单沿用 `Dialog`、`el-form` 和 `formRef.validate()` 模式
- 复用现有组件和权限模式
- UI 变化遵循 `ui-ux-design.md`
