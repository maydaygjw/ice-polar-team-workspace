# printer-shop UI/UX 设计（admin）

范围：admin 仅新增「打印任务管理」页。打印店复用现有「门店管理」、打印机复用现有「商品管理」，均不改动、不新增界面。复用现有 CRUD 规范（`ContentWrap` + 查询表单 + `el-table` + 详情弹窗），参考 `mall/store/shop/index.vue`。

## 打印任务管理

路由建议：`/mall/device/print-job`。

### 查询表单
task_id、店铺（下拉）、状态（下拉：排队/解析中/下发中/成功/失败/已取消）、创建时间范围。

### 表格列
task_id、店铺、文件（名称/链接）、页数、份数、规格（纸张/颜色）、状态 `el-tag`、失败原因、创建/完成时间、操作。

### 状态色
成功 success / 失败 danger / 解析·下发 warning / 排队 info / 已取消 info。

### 行操作
- 「查询」→ 主动调链科刷新状态，行内 loading 后更新该行的状态与完成时间。
- 「取消」→ 仅处理中（排队/解析/下发）任务可用，`el-messagebox` 二次确认。
- 「重试」→ 仅失败任务可用，确认后重新提交。
- 「详情」→ 弹窗：任务全字段（task_id/设备/店铺/文件/页数/份数/规格/状态/失败原因/时间），只读；含 `task_result.code/msg`。

### 组件状态与反馈
- 异步操作按钮 loading；成功 `message.success`、失败 `message.error` 带后端 msg。
- 「取消」为破坏性操作，必须二次确认。
- 列表加载/空/错误复用现有规范；失败原因超长省略 + tooltip。

### 文案
状态枚举中文映射与后端 `task_state`/DeviceOrder 状态对齐，集中维护一处常量。

无移动端/安全区要求（admin 桌面端）。
