# 部署与交接手册

本手册覆盖测试环境部署、测试数据库迁移和生产发布交接。故障诊断见[故障诊断手册](incident-response.md)。服务器和环境首次安装由外部 Ansible 及相关工具管理，不属于本手册范围。

## 测试环境部署

覆盖 `backend`、`admin`、`h5`。当前云效组织为 Region 版，通过 Region OpenAPI 独立触发流水线；日常部署不使用本地构建和 SSH 上传。

| 项目 | 流水线 | ID | 运行参数 | 验收地址 |
|---|---|---|---|---|
| backend | `yshop-dev-server` | `1408445` | `YSHOP_ENV=dev2` | `https://api-yshop-dev.holuntech.cn` |
| admin | `yshop-dev-admin` | `1409672` | `ADMIN_ENV=dev2` | `https://admin-yshop-dev.holuntech.cn` |
| h5 | `yshop-dev-h5` | `1409664` | `H5_ENV=dev2` | `https://h5-yshop-dev.holuntech.cn` |

表中 ID 使用云效流水线 URL 中的数字 ID。触发前从 workspace 根目录加载未跟踪的 `.env.local`：

```bash
set -a; source .env.local; set +a
chmod 600 .env.local
```

必需变量：`YUNXIAO_API_DOMAIN`、`YUNXIAO_TOKEN`，以及三条 `YUNXIAO_PIPELINE_*_ID`。`YUNXIAO_ORGANIZATION_ID` 仅用于组织识别，不拼入当前 Region API 路径。首次使用前确认 API 服务接入点和流水线权限。Token 不得出现在日志或发布记录中；已暴露的 Token 必须先轮换。

```bash
run_pipeline() {
  local name="$1" pipeline_id="$2" env_key="${3:-}" env_value="${4:-}" params body
  if [[ -n "$env_key" ]]; then
    params="$(jq -cn --arg comment "$name test deployment $(date '+%F %T %z')" \
      --arg env_key "$env_key" --arg env_value "$env_value" \
      '{envs: {($env_key): $env_value}, comment: $comment}')"
  else
    params="$(jq -cn --arg comment "$name test deployment $(date '+%F %T %z')" \
      '{comment: $comment}')"
  fi
  body="$(jq -cn --arg params "$params" '{params: $params}')"
  curl --fail-with-body --silent --show-error -X POST \
    "https://${YUNXIAO_API_DOMAIN}/oapi/v1/flow/pipelines/${pipeline_id}/runs" \
    -H 'Content-Type: application/json' \
    -H "x-yunxiao-token: ${YUNXIAO_TOKEN}" \
    --data-raw "$body"
}

run_pipeline backend "$YUNXIAO_PIPELINE_BACKEND_ID" YSHOP_ENV dev2
run_pipeline admin   "$YUNXIAO_PIPELINE_ADMIN_ID"
run_pipeline h5      "$YUNXIAO_PIPELINE_H5_ID" H5_ENV dev2
```

按表中参数传递流水线变量，记录返回的 `pipelineRunId`。如需指定分支、Tag 或其他变量，使用实际确认过的参数名；不要猜测参数名，也不要通过 `envs` 传递秘密。

### 测试部署验收

三条流水线的构建、制品、部署和健康检查阶段都成功（状态为 `SUCCESS`）后执行：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
curl --fail --silent --show-error "https://${DOMAIN_API}/actuator/health/"
curl --fail --silent --show-error --head "https://${DOMAIN_ADMIN}/"
curl --fail --silent --show-error --head "https://${DOMAIN_H5}/"
(cd governance/e2e && npm test)
```

另需确认 backend 运行 JAR 的 commit/hash、admin/H5 页面与静态资源、登录、关键 API、上传和 H5 ticket 换 Token；H5 首页和 `activity.html` 必须返回 200。只使用测试账号和租户。

流水线失败时记录失败阶段、日志、commit 和 `pipelineRunId`，修复后以明确的新版本重跑。部署验收失败时，通过对应流水线重新部署最近一次已验收的 commit、Tag 或不可变制品，再执行验收。不得使用本地重建、手工替换 JAR/dist 或未知版本覆盖测试环境。

## 测试数据库迁移

测试数据库使用云效 Flyway 流水线 `yshop-db-dev`（ID `1410661`），基线已建立。通过 `DB_MIGRATOR_COMMAND` 传入 `info`、`migrate` 或 `validate`。运行前确认流水线配置中的 `DB_URL`、`DB_USER`、`DB_PASSWORD` 指向测试库；私有数据库使用能访问其 VPC 的构建集群，密码不得写入日志。

- 发布前运行 `info` 确认目标库和待执行版本。存在预期的 `PENDING` 迁移时直接运行 `migrate`；不要先单独运行 `validate`，它会因待执行迁移而失败。`migrate` 会校验已应用历史。
- 发布后运行 `info` 和 `validate` 确认迁移状态。
- 回退需使用经审核的迁移回退 SQL/方案和备份。当前流水线没有 `rollback` 命令；未实现受控回退步骤前停止回退，不删除 `flyway_schema_history` 记录，也不以 `repair` 代替回退。

## 生产发布与交接

生产发布和回滚由具备权限的人员人工登录云效平台审核并执行。Agent 负责准备交接材料和受邀执行只读诊断，不触发或批准生产流水线，不上传、替换制品或重启服务。生产配置、数据库迁移、数据修复和凭据轮换均由人工按审批流程执行。

交接材料包括：

- 变更范围、目标环境、审批人及测试验证结果。
- 不可变制品标识、源码 commit、SHA-256、构建参数及配置来源；后端另附运行 JAR 身份，前端核对 API、租户及测试登录开关。
- 测试与生产的差异、已知风险、验收步骤及已知良好回滚版本。

制品由流水线构建和管理；生产不现场构建、安装依赖或手工修改制品。前端构建配置有环境差异时，须明确生产制品及其验证证据，不以测试页面正常代替生产配置验证。

生产发布后，按[故障诊断手册](incident-response.md)确认实际运行版本、配置、服务状态、日志、入口及关键业务链路。失败时保留证据并交人工按云效流程回滚，回滚后重新验收并记录结果。

API 参考：[CreatePipelineRun](https://help.aliyun.com/zh/yunxiao/developer-reference/createpipelinerun)、[GetPipelineRun](https://help.aliyun.com/zh/yunxiao/developer-reference/getpipelinerun)。
