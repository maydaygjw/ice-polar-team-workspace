# 企业微信回调配置管理端部署记录（test）

## 发布信息

| 项目 | 值 |
|---|---|
| 环境 | test |
| 仓库 | `icepolar/yshop-drink-vue` |
| 分支 | `master` |
| 提交 | `60d6cdc`（PR !57 合并提交） |
| 构建命令 | `pnpm build:dev` |
| 发布时间 | 2026-08-12 23:39 CST |

## 执行结果

- 本地 test 构建成功；仅有项目既存 Sass deprecation warning。
- 部署前首页 HTTP 200，Nginx active。
- 远端原静态资源已备份至 `/opt/holun/yshop-drink-vue/dist.backup.20260812233937.tar.gz`。
- 新静态资源已整体替换至 `/opt/holun/yshop-drink-vue/dist`。
- 部署后首页 HTTP 200，Nginx 配置检查通过且服务 active。
- 公网 `AccountForm` chunk HTTP 200，确认包含 `callbackConfigured` 新功能标记。
- Nginx 最近五分钟无 journal 错误记录。

## 回滚

如需回滚，清空当前 `dist` 后将上述备份压缩包解压至该目录，并重新执行首页与 Nginx 健康检查。
