# Review Report

## 范围

本次审查覆盖 backend/admin 独立 worktree 中的欢迎语模板管理实现，以及对应数据库升级脚本。客户添加回调解析和欢迎语发送不在本次范围内。

## 结论

- 多租户隔离沿用 MyBatis Tenant 机制；模板新增额外校验企业微信配置和启用商圈。
- `(tenant_id, account_id, business_region_id, deleted)` 唯一约束保证每个企业微信配置和商圈最多保留一个模板。
- 图片上传同时写入本地文件服务和企业微信 `media/uploadimg`，模板只保存 URL，不保存 Secret。
- 企业微信只通过 `media/uploadimg` 上传图片素材；系统模板新增/编辑/删除均为本地操作。
- UI 只做模板管理，不注册回调、不读取 `welcome_code`、不调用 `send_welcome_msg`。

## 风险与后续

- 当前仍需测试环境使用真实企业微信凭据验证 multipart 上传字段和 `media/uploadimg` 返回结构。
- 本地文件上传成功但企业微信上传失败时可能留下本地孤儿文件；后续可补文件清理 API 或异步补偿任务。
- 全量 `vue-tsc` 受当前仓库既有自动导入/类型声明问题影响，已使用 Vite production build 验证 SFC 编译和打包。
