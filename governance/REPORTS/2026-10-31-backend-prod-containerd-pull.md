# Backend 生产部署镜像拉取失败诊断

## 事件信息

- 时间：2026-10-31 00:57:29–00:59:47（Asia/Shanghai）
- 环境：生产
- 主机：`yshop-sh-prod-node-01`
- 流水线：`yshop-prod-server`（ID `1409711`）
- 任务：查询 Registry 最新镜像并部署
- 目标镜像：`registry.cn-shanghai.aliyuncs.com/holuntech-yshop/yshop-backend:20261030125408`

## 已证实

1. 流水线在生产主机执行；从 OSS 更新 `/opt/yshop/docker-compose.yml` 后，`docker compose --env-file .env config` 成功。
2. 失败发生在 `docker compose --env-file .env pull server`。containerd 提交层 `sha256:3b106b8efb12984fdbaf6201dee4afc81fdabb8ee54ad9e353e382cddca8ca18` 时，重命名 ingest 文件报 `no such file or directory`。
3. 同一时刻 dockerd 记录 extract snapshot 不存在，以及删除 lease 时报告 `NotFound`。containerd journal 有对应 `(*service).Write failed` 错误。
4. 日志没有出现 `docker compose up` 或服务重启步骤。01:06 只读检查时，`yshop-server` 仍为 running/healthy，运行镜像是 `20261029100747`，健康接口返回 `UP`。其启动时间为 2026-10-29 13:47:25 UTC。
5. 流水线已在失败前更新主机上的 compose 文件到目标版本；当前运行容器仍是旧镜像。因此运行服务未被本次拉取失败替换，但主机部署配置已变化。
6. 主机版本为 Docker 29.8.2、containerd 2.3.6；Docker/containerd 均 active，`NRestarts=0`。01:06 检查时根文件系统使用率 20%、inode 使用率 4%；00:55–01:02 的内核日志没有匹配的 I/O、ENOSPC 或文件系统错误。
7. 同一主机在 00:59:11 成功拉取并启动 H5 生产镜像 `yshop-h5-prod:6ae50332b89b`，与 Backend 镜像拉取时间重叠。
8. 主机 auditd 未启用；systemd timers、cron 日志及指定目录中的清理脚本搜索没有发现匹配的 Docker prune 任务。

## 根因判断

- **已证实的直接失败原因：** Backend 镜像拉取期间，containerd 的 ingest 文件及关联 snapshot/lease 不存在，导致内容存储提交失败。
- **高相关待验证假设：** 与 Docker 29 containerd image store 下 `docker image prune` 删除正在进行的 pull lease 问题高度吻合。Moby issue [#53321](https://github.com/moby/moby/issues/53321) 报告了相同的 ingest rename `ENOENT`、lease 不存在等签名；故障时 H5 镜像拉取也在同一主机发生。
- **仍未证实：** 当前没有 auditd 或流水线调用证据证明故障窗口确实执行了 `docker image prune` / `docker system prune`。并发镜像拉取本身不能单独证明就是触发原因；实际删除 lease 的调用方尚未定位。
- 不能仅凭当前磁盘占用数据还原故障瞬间状态，但故障窗口无内核存储错误，当前磁盘/inode 余量充足，未见空间耗尽证据。

## 只读操作与建议

- 已读取流水线日志、生产主机 Docker/containerd 版本与服务状态、相关 journal、当前容器镜像/启动时间、健康接口、Docker 事件、定时器、cron 和清理脚本路径。
- 未重启服务、清理镜像或文件、修改生产主机、重跑流水线。
- 由具备生产权限的运维人员检查 Yunxiao 及其他部署/清理客户端在 00:57–01:00 的命令记录，重点查找 `docker image prune`、`docker system prune` 或等效的镜像清理 API 调用，并核对 H5 流水线部署是否调用了清理。
- 在触发方确认前，不应把并发拉取单独当作已证实根因。生产重跑应由具备权限人员按发布流程评估并执行。
