# Test Environment Pipeline Playbook

> 覆盖 `backend`、`admin`、`h5`。当前云效组织为 Region 版，三条流水线通过 Region OpenAPI 独立触发；不再使用本地构建和 SSH 上传作为日常部署方式。

## 流水线

| 项目 | 流水线 | ID | 验收地址 |
|---|---|---|---|
| backend | `yshop-dev-server` | `1408445` | `https://yshop-api-test.holuntech.cn` |
| admin | `yshop-dev-admin` | `1409672` | `https://yshop-admin-test.holuntech.cn` |
| h5 | `yshop-dev-h5` | `1409664` | `https://yshop-h5-test.holuntech.cn` |

表中的 ID 必须使用云效流水线 URL 中的数字 ID，不使用控制台列表里的其他标识。

## 触发

从 workspace 根目录加载未跟踪的 `.env.local`：

```bash
set -a; source .env.local; set +a
chmod 600 .env.local
```

必需变量：`YUNXIAO_API_DOMAIN`、`YUNXIAO_TOKEN`，以及三条 `YUNXIAO_PIPELINE_*_ID`。`YUNXIAO_ORGANIZATION_ID` 仅用于组织识别，不拼入当前 Region API 路径。Token 不得出现在日志或发布记录中；已暴露的 Token 必须先轮换。首次使用前确认 API 服务接入点和流水线权限正确。

```bash
run_pipeline() {
  local name="$1" pipeline_id="$2" h5_env="${3:-}" params body
  if [[ -n "$h5_env" ]]; then
    params="$(jq -cn --arg comment "$name test deployment $(date '+%F %T %z')" --arg h5_env "$h5_env" \
      '{envs: {H5_ENV: $h5_env}, comment: $comment}')"
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

run_pipeline backend "$YUNXIAO_PIPELINE_BACKEND_ID"
run_pipeline admin   "$YUNXIAO_PIPELINE_ADMIN_ID"
run_pipeline h5      "$YUNXIAO_PIPELINE_H5_ID" dev2
```

返回值是 `pipelineRunId`，必须记录。当前组织是 Region 版，使用上述不带 `organizationId` 的 API 路径。H5 流水线必须传 `envs.H5_ENV=dev2`；若需指定分支、Tag 或其他流水线变量，将真实参数放入 `params`，不要猜测参数名，也不要通过 `envs` 传递秘密。

## 验收

三条流水线的构建、制品、部署和健康检查阶段都成功（状态为 `SUCCESS`）后：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
curl --fail --silent --show-error "https://${DOMAIN_API}/actuator/health/"
curl --fail --silent --show-error --head "https://${DOMAIN_ADMIN}/"
curl --fail --silent --show-error --head "https://${DOMAIN_H5}/"
(cd governance/e2e && npm test)
```

另需确认：backend 运行 JAR 的 commit/hash，admin/H5 的页面和静态资源，登录、关键 API、上传和 H5 ticket 换 Token；H5 首页和 `activity.html` 必须返回 200。只使用测试账号和租户。

## 失败与回滚

- 流水线失败：记录阶段、日志、commit 和 `pipelineRunId`，修复后使用明确的新版本重跑。
- 部署后验收失败：用对应流水线重新部署最近一次已验收的 commit、Tag 或不可变制品，再执行验收。
- 不得用本地重建、手工替换 JAR/dist 或未知版本覆盖测试环境。

API 参考：[CreatePipelineRun](https://help.aliyun.com/zh/yunxiao/developer-reference/createpipelinerun)、[GetPipelineRun](https://help.aliyun.com/zh/yunxiao/developer-reference/getpipelinerun)。
