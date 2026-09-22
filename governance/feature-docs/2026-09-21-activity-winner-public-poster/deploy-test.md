# 测试环境部署记录：活动中奖公示长图与中奖名单

## 发布信息

| 项目 | 值 |
|---|---|
| 环境 | test |
| 部署时间 | 2026-09-21 18:57（Asia/Shanghai） |
| Backend commit | `3b14c5f81200490590244376e19604a6d215f668` |
| Backend JAR SHA-256 | `25fc6391971a79218ca9494ece45d05221a90b78f1b847c2df4133d5f317fcc6` |
| Admin commit | `c574659c222b50c6672151358719ba3bbcc7b4e6` |
| Admin 构建 | `pnpm build:prod` |
| Admin dist tar SHA-256 | `80c238fb8bc33eca4177060ee50fb11ef8ea7d30eaea4ee8c7b02195966a1c23` |
| H5 commit | `3bf2240581d9c42cfd606b0ebf204e28ef779da4` |
| H5 构建参数 | 测试 API、租户 158、测试认证开启 |
| H5 dist tar SHA-256 | `46b3a3fb4b1a9326c200ecc138f2becd9e4a4a001d6bd1147536cafeaf5b1792` |

## 部署结果

- Backend 已备份旧 JAR 并替换，实际运行 commit 与制品一致，8888 监听正常，健康检查通过。
- Admin 已备份旧静态目录，Nginx 配置检查和 reload 通过。
- H5 已备份旧静态目录，Nginx 配置检查和 reload 通过。

## 冒烟验证

- `https://yshop-admin-test.holuntech.cn/`：HTTP 200。
- `https://yshop-h5-test.holuntech.cn/activity.html`：HTTP 200。
- `GET /app-api/activity/period/winners?periodId=1` 携带测试租户 158：HTTP 200，返回“活动期次不存在”，说明路由、租户上下文和业务错误响应链路可达。

## 回滚

- Backend 备份：`/opt/holun/yshop-drink/yshop-server/target/yshop-server.jar.bak.20260921185350`
- Admin 备份：`/opt/holun/yshop-drink-vue/dist.bak.20260921185722`
- H5 备份：`/opt/holun/yshop-h5/dist.bak.20260921185737`

本次未执行数据库迁移，未修改生产环境。
