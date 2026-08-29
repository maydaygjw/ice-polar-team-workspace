# 测试环境部署记录：企业微信视频素材

- 部署时间：2026-08-29 17:20（Asia/Shanghai）
- 环境：test
- 后端提交：`e451e4890d37e4275f04f84bb73fff75b6d75b70`
- 后端运行时：Java 21.0.12
- 后端产物：`yshop-server.jar`
- 后端产物 SHA-256：`381cbf03418bb548daab3faa3298f24772e6ab29480e4a5daaceb1adae6c0759`
- 管理端构建：`pnpm build:dev`
- 管理端归档 SHA-256：`63b8e1397f382d1b007f88fd4213865d54184e221e727f927c9a39094b3fa1df`

## 部署结果

- 后端进程已启动，运行 `dev` profile，监听 `8888`。
- 后端公网健康检查：`https://yshop-api-test.holuntech.cn/actuator/health/` 返回 `200`。
- 管理端公网检查：`https://yshop-admin-test.holuntech.cn/` 返回 `200`。
- Nginx 配置检查通过并已 reload。
- 后端旧 JAR 与管理端旧 `dist` 均保留了带时间戳的远端备份。

## 未完成项

数据库迁移脚本 `backend/sql/upgrade-2026-08-29-wecom-material-video.sql` 尚未执行。根据部署规范，需获得单独授权并确认回滚方案后，才能执行迁移并进行视频素材上传、群发和新客户欢迎语的功能烟测。
