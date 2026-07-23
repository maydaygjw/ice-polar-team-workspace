# API 测试案例

## 技术选型

使用现有 `governance/e2e` 的 Playwright + TypeScript，通过 `APIRequestContext` 发 HTTP 请求。

原因：

- 复用现有 `@playwright/test`、`expect`、HTML 报告、重试和 CI 配置；
- 与 E2E 共用测试数据、环境变量和失败证据；
- 支持请求前后置、并发、响应断言及 `try/finally` 清理；
- 不新增 pytest、Java RestAssured 或 Postman CLI 等第二套运行时。

后端模块的 Java 单元/集成测试仍放在 backend，不放入此目录。

## 目录与命名

```text
governance/e2e/specs/api/
├── README.md
└── {feature}/
    └── {feature}.api.spec.ts
```

案例只覆盖 API 行为；跨端用户链路仍放在 `specs/features/`，使用 Playwright 页面操作。

## 编写约定

```ts
import { test, expect } from '@playwright/test'

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8888'
const tenantId = process.env.TEST_TENANT_ID
const token = `test${process.env.TEST_USER_ID ?? '1'}`

test('API-001 查询成功', async ({ request }) => {
  const response = await request.get(`${apiBaseUrl}/admin-api/<module>/<resource>/page`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'tenant-id': tenantId!,
    },
  })

  expect(response.ok()).toBeTruthy()
  expect((await response.json()).code).toBe(0)
})
```

约定：

- 文件使用 `{feature}.api.spec.ts`，用例编号使用 `API-xxx`；
- `API_BASE_URL`、`TEST_TENANT_ID`、`TEST_USER_ID` 从 `governance/ENVIRONMENTS/test.env` 或 CI 注入；不得在案例中硬编码租户；
- 至少断言 HTTP 状态、`CommonResult.code` 和关键响应字段；
- 写接口用唯一测试标识，测试结束必须通过业务 API 清理并复核；必要时使用 `try/finally`；
- 不记录完整 Token、Cookie、密码或个人数据；
- 优先从 `governance/CONTRACT/backend-api.json` 和功能文档取得路径、参数及错误码。

## 运行

从 workspace 根目录执行：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
(
  cd governance/e2e
  API_BASE_URL="https://${DOMAIN_API}" \
    TEST_TENANT_ID="${TEST_TENANT_ID}" \
    TEST_USER_ID="1" \
    npx playwright test specs/api
)
```

本地后端将 `API_BASE_URL` 改为 `http://localhost:8888`。测试结果和清理结果写入对应功能的 `governance/feature-docs/{feature}/test-notes.md`。
