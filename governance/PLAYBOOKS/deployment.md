# 部署与交接

服务器首次安装由 Ansible 管理。测试部署和数据库迁移使用云效流水线；故障诊断见[故障诊断手册](incident-response.md)。

## Dev2 测试环境

| 项目 | 流水线 ID | 参数 | 验收地址 |
|---|---:|---|---|
| backend | `1408445` | `YSHOP_ENV=dev2` | `https://api-yshop-dev.holuntech.cn` |
| admin | `1409672` | `ADMIN_ENV=dev2` | `https://admin-yshop-dev.holuntech.cn` |
| H5 | `1409664` | `H5_ENV=dev2` | `https://h5-yshop-dev.holuntech.cn` |

从 workspace 根目录运行脚本。它会静默加载 `.env.local`，并输出流水线运行 ID 和状态：

```bash
chmod 600 .env.local
bash governance/SCRIPTS/deploy-yunxiao.sh --target backend --branch feat/example
# 目标可选 backend、admin、h5、all；--branch 可省略
```

确认本次涉及的流水线最终状态为 `SUCCESS` 后，记录运行 ID 并验收对应服务：后端检查 `/actuator/health/`，管理后台和 H5 首页返回 HTTP 200；按变更范围完成登录、关键 API 和业务冒烟。H5 还需检查 `activity.html` 和 ticket 换 Token。只使用测试账号和租户。失败时记录阶段、commit 和运行 ID；修复后重跑。验收失败时，通过流水线部署最近一次已验收版本，不手工替换制品。

查询最近一次运行及任务日志：

```bash
bash governance/SCRIPTS/query-yunxiao.sh --pipeline backend --latest
# pipeline 可选 backend、admin、h5、db，也可直接填写流水线 ID；查看指定运行用 --run <运行ID>
```

日志读取需要云效 Token 有流水线运行任务的只读权限。

## 测试数据库迁移

迁移流水线 ID 为 `1410661`。运行前确认流水线连接的是测试库，且构建集群能访问数据库。每一步都要等流水线结束并检查结果，再进行下一步：

```bash
bash governance/SCRIPTS/deploy-yunxiao.sh --target db-info --branch feat/example
# 确认有预期的 PENDING 迁移后再执行：
bash governance/SCRIPTS/deploy-yunxiao.sh --target db-migrate --branch feat/example
# migrate 成功后复查：
bash governance/SCRIPTS/deploy-yunxiao.sh --target db-info --branch feat/example
bash governance/SCRIPTS/deploy-yunxiao.sh --target db-validate --branch feat/example
```

先看 `info` 的目标库和待执行迁移，再决定是否 `migrate`。存在预期的 `PENDING` 迁移时不要先跑 `validate`。流水线没有受控 `rollback`；回退须由人工使用审核过的方案和备份，不得删除 Flyway 历史或以 `repair` 代替回退。

## 生产发布

生产发布、迁移和回滚由有权限的人员在云效审核执行。Agent 只准备交接材料或进行只读诊断，不触发生产部署、替换制品或重启服务。交接需注明变更范围、审批、测试结果、commit、制品标识及回滚版本。生产发布后按[故障诊断手册](incident-response.md)验收。
