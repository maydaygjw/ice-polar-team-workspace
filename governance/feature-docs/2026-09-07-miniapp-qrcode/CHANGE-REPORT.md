# 变更报告

新增微信小程序码 app-api：接收 `path`、`scene`，调用租户小程序主账户生成 430px 小程序码，上传到 OSS 临时目录并返回图片 URL 与预期过期时间。临时文件保留 48 小时，目录按租户隔离。

影响仓库：`backend`。

契约：新增 `POST /app-api/mp/miniapp/qrcode`；无数据库、MQ 或依赖变更。详细定义见 `contract-changes.md`。

验证：模块测试通过，新增测试覆盖输入校验、PNG/JPEG、环境版本、租户目录及微信/存储失败；整包 server 构建受 worktree Git 元数据插件限制未完成。

残余风险：需在部署环境完成真实微信和 OSS 联调。建议 PR 标题：`feat(mp): add temporary miniapp qrcode url api`。
