# Change Report

## 业务结果

- 企业微信菜单新增“引流海报”（不超过 6 个字）。
- 管理员可同步现有企业微信“联系我”配置并选择二维码。
- 管理员可上传背景图，选择联系我二维码，在前端拖动/缩放二维码，选择商圈后预览并保存海报。
- 前端 Canvas 输出 1125×1500 PNG 并上传 OSS，后端只保存图片 URL 和二维码几何参数，不再处理图片。
- MVP 不生成 AI 背景、不接小程序。

## 影响仓库

- `backend`：企微同步、海报 CRUD、商圈 API 契约、二维码几何参数校验、数据库升级脚本、权限菜单。
- `admin`：引流海报列表、Canvas 编辑/导出、企微联系我同步和接口封装。
- `miniapp`：无变更。

## 交付状态

- 当前保留在本地 worktree：`.worktrees/backend-wecom-lead-poster`、`.worktrees/admin-wecom-lead-poster`。
- 未 commit、未 push、未创建 PR。

## 建议 PR 标题

`feat(mp): add wecom lead poster management`
