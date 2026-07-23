# API Testing Playbook

> test-agent 在本地或测试环境执行 yshop API 测试的最小操作手册。Mock Token 仅用于本地/测试环境，生产环境必须关闭。

## 1. 前置与变量

确认实际启动 Profile 的配置包含：

```yaml
yshop.security.mock-enable: true
```

修改配置后必须重启后端。测试环境统一从 [`test.env`](../ENVIRONMENTS/test.env) 读取租户：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
export BASE_URL="https://${DOMAIN_API}"       # 本地改为 http://localhost:8888
export TEST_USER_ID="1"                       # 测试库中真实存在的用户
export MOCK_TOKEN="test${TEST_USER_ID}"
echo "tenant=${TEST_TENANT_ID} base=${BASE_URL}"
```

不要在用例中另写租户 ID；`TEST_TENANT_ID` 必须来自环境文件。用户 ID 也必须对应测试库中的真实用户，且该用户应具备被测接口所需权限。

## 2. Mock Token

默认规则为 `mock-secret + 用户 ID`，其中 `mock-secret=test`：

```text
test1、test100
```

请求头使用 `Authorization: Bearer ${MOCK_TOKEN}`（也支持不带 `Bearer`）。后端先校验真实 Token，失败后才尝试 Mock Token，因此不需要先调用登录接口。Token 必须是 `test` 加数字，不能使用单独的 `test`。

| 前缀 | 用户类型 |
|---|---|
| `/admin-api` | 管理员 |
| `/app-api` | 会员 |

Mock Token 只模拟用户 ID、用户类型和租户上下文，不授予菜单/角色权限；`@PreAuthorize` 接口仍须为测试用户配置权限。

## 3. 执行 API 测试

先执行不修改数据的认证烟测：

```bash
curl -i "${BASE_URL}/admin-api/system/auth/get-permission-info" \
  -H "Authorization: Bearer ${MOCK_TOKEN}" \
  -H "tenant-id: ${TEST_TENANT_ID}"
```

预期请求不是未认证，业务成功时 JSON 的 `code=0`。无 Token 再请求一次，确认受保护接口的认证负例。

分页查询示例：

```bash
curl -i -G "${BASE_URL}/admin-api/<module>/<resource>/page" \
  -H "Authorization: Bearer ${MOCK_TOKEN}" \
  -H "tenant-id: ${TEST_TENANT_ID}" \
  --data-urlencode pageNo=1 --data-urlencode pageSize=10
```

写接口示例：

```bash
curl -i -X POST "${BASE_URL}/admin-api/<module>/<resource>/create" \
  -H "Authorization: Bearer ${MOCK_TOKEN}" \
  -H "tenant-id: ${TEST_TENANT_ID}" \
  -H 'Content-Type: application/json' \
  --data '{"name":"api-test-<日期>-<编号>"}'
```

按风险覆盖：成功、必填/类型/长度/枚举校验、无效 Token、无权限、跨租户访问、资源不存在、重复提交、状态限制和幂等。至少检查 HTTP 状态、`CommonResult.code`、关键字段及写操作后的查询结果；不得只看 HTTP 200。

E2E 仍须通过 UI 验证真实用户链路，API 直调只用于 API 测试，不得替代 E2E。

## 4. 测试后清理（必做）

测试结束必须清理本次创建或修改的数据，不得默认保留：

1. 先停止仍会产生数据的异步任务、回调或设备模拟操作。
2. 按依赖逆序清理子资源再清理父资源；修改过的共享数据恢复原状。
3. 优先使用业务删除/取消/撤销/恢复 API，并携带相同的 Mock Token 和 `tenant-id`。
4. 通过查询接口复核无残留。API 无法清理时，先查询影响范围；数据库清理必须限定 `tenant_id`、主键或唯一测试标识，并在执行破坏性 SQL 前取得明确批准。
5. 外部副作用（支付、退款、短信、设备、对象存储等）不能只删除本地记录抵消，须按测试计划回滚或人工处理。

清理失败时标记为“待清理”，保留证据，不得开始下一轮会污染环境的测试。

## 5. 测试记录

在 `governance/feature-docs/{feature}/test-notes.md` 记录：

```markdown
## API 测试
- 环境/基础地址：[test/local；不要记录秘密]
- 用户/租户：[用户 ID；${TEST_TENANT_ID}]
- 用例：[编号、方法、路径]
- 断言/结果：[HTTP、code、关键字段、副作用；通过/失败]
- 清理：[范围、方式、时间、复核结果]
- 失败归类：[产品缺陷/用例问题/环境问题/待清理]
```

禁止记录完整 Token、密码、API Key、Cookie、个人信息或支付信息。

## 6. 快速排障

| 现象 | 检查 |
|---|---|
| 401 | Profile、`mock-enable`、重启状态、Header、Token 是否为 `test+数字` |
| 403 | 测试用户是否有接口菜单权限；Mock Token 不授予权限 |
| 空数据/租户错误 | 是否使用 `${TEST_TENANT_ID}`、数据是否属于该租户 |
| 5xx | 保存脱敏响应和时间，查后端日志，区分环境依赖与接口缺陷 |

案例目录和技术约定见 [`governance/e2e/specs/api/README.md`](../e2e/specs/api/README.md)。参考：`backend/yshop-server/src/main/resources/application-dev.yaml`、`TokenAuthenticationFilter.java`、[`backend-api.json`](../CONTRACT/backend-api.json)。
