# 契约变更：店铺商品导入异步确认

## 管理后台 API

现有接口路径、权限和请求参数保持不变：

- `POST /admin-api/product/import/confirm`
- `GET /admin-api/product/import/get?id={id}`
- `GET /admin-api/product/import/page`

确认接口不再同步等待全部商品、SKU 和选项写入完成。请求校验、草稿编辑和批次锁定完成后立即返回批次；返回的 `status` 为 `PROCESSING` 时表示后台正在导入。管理端通过现有查询接口轮询，直到状态变为 `IMPORTED` 或 `FAILED`。

批次状态新增：

- `PROCESSING`：已确认，后台处理中；同一批次不可重复确认。
- `FAILED`：后台任务发生未捕获异常；`errorMessage` 返回可展示的错误摘要，已成功写入的商品不会被删除。

`IMPORTED` 仍表示后台处理完成；单个商品失败继续记录在明细的 `FAILED` 行和批次 `failedRows` 中，不影响其他商品继续导入。

## 执行语义

- 后台任务按导入商品分组逐个写入，避免长时间占用管理端 HTTP 请求线程。
- 批次进入 `PROCESSING` 后才允许后台执行；重复点击确认不会创建第二个店铺或重复执行同一批次。
- 后台任务按当前租户恢复租户上下文；批次和明细查询继续受租户隔离。
- 不新增数据库字段、权限或迁移脚本；状态字段继续使用现有字符串字段。
