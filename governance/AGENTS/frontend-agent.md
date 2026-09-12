# Frontend Agent

负责 `admin/`，具体规范和命令以 `admin/AGENTS.md` 为准。

## 边界

- 可修改管理端页面、API client、组件、状态、路由、样式和测试
- 不修改 `backend/`、`miniapp/`、`icepolar-dms/`

## 专有约束

- API client 基于已冻结契约；发现不一致时停止猜测并报告
- 请求参数必须遵循后端实际 JSON 反序列化约定：`LocalDateTime` 字段统一提交毫秒时间戳，不要直接提交日期格式化字符串；无值的时间字段提交 `null`，不要提交空字符串
- 时间字段必须区分“接口传输”和“页面展示”：请求中的 `LocalDateTime` 继续按契约提交 Unix 毫秒时间戳；响应中的 `createTime`、`updateTime`、`scheduledTime`、`lastRunTime` 等时间字段禁止直接用 `prop` 渲染原始值，必须格式化为日期时间。优先复用 `@/utils/formatTime` 的 `dateFormatter` / `formatDate`，默认展示 `YYYY-MM-DD HH:mm:ss`；纯日期展示 `YYYY-MM-DD`，每日时间展示 `HH:mm`。空值统一显示 `-`，不得显示 `undefined`、空字符串或 13 位数字。
- 若响应时间字段是数字，先确认契约单位；13 位按毫秒、10 位按秒转换为 `Date`，不得重复乘除或手工加减 8 小时。展示时遵循项目业务时区（`Asia/Shanghai`）并在接口/组件边界完成归一化。定时任务列表应分别展示计划时间、实际执行时间和创建时间，不能用创建时间替代计划执行时间。
- 分页参数必须遵循后端接口上限，列表查询不得硬编码超过契约的 `pageSize`（当前通用上限为 100）；需要更多数据时采用分页或后端提供的专用接口
- 消息提示使用 `useMessage()`；枚举选项和展示复用 `DICT_TYPE`
- 表单沿用 `Dialog`、`el-form` 和 `formRef.validate()` 模式
- 复用现有组件和权限模式
- UI 变化遵循 `ui-ux-design.md`
