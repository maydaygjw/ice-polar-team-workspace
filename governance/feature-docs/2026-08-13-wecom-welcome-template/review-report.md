# Review Report

## 范围

本次审查覆盖 backend/admin 的欢迎语模板扩展、客户添加事件发送分支，以及对应数据库增量脚本。

## 结论

- 多租户隔离沿用 MyBatis Tenant 机制；模板新增额外校验企业微信配置和启用商圈。
- `(tenant_id, account_id, business_region_id, deleted)` 唯一约束保证每个企业微信配置和商圈最多保留一个模板。
- 图片上传同时写入本地文件服务和企业微信 `media/uploadimg`；小程序封面只在发送时上传临时素材，不保存临时 `media_id`。
- 小程序 AppID 只能来自当前租户默认小程序主账户，模板校验图片/小程序附件互斥。
- 客户添加事件按附件类型只构造一个 `send_welcome_msg` 附件；小程序发送前重新上传本地封面，规避临时 media_id 过期。

## 风险与后续

- 当前仍需测试环境使用真实企业微信凭据验证两类 multipart 上传字段及 `send_welcome_msg` 返回结构。
- 本地文件上传成功但企业微信上传失败时可能留下本地孤儿文件；后续可补文件清理 API 或异步补偿任务。
- 全量 `vue-tsc` 受当前仓库既有自动导入/类型声明问题影响；已过滤确认本次欢迎语文件无新增错误，并使用 Vite production build 验证 SFC 编译和打包。
