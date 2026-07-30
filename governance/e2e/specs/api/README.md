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

竞价排名案例：[`bidrank.api.spec.ts`](bidrank/bidrank.api.spec.ts)。它默认只读，不创建出价、不调用支付；运行前需要设置 `BIDRANK_BUSINESS_REGION_ID`，并准备有竞价查询权限的管理用户和测试商家用户。

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
- 涉及出价/支付的扩展案例必须使用唯一测试门店和测试标识，并在 `try/finally` 中清理出价、支付单及关联记录；未配置支付沙箱时不得启用。

## 运行

从 workspace 根目录执行：

```bash
source governance/SCRIPTS/deploy-helper.sh && load_env test
(
  cd governance/e2e
  API_BASE_URL="https://${DOMAIN_API}" \
    TEST_TENANT_ID="${TEST_TENANT_ID}" \
    TEST_USER_ID="1" \
    BIDRANK_BUSINESS_REGION_ID="<测试商圈 ID>" \
    BIDRANK_APP_USER_ID="<测试商家用户 ID>" \
    BIDRANK_ADMIN_USER_ID="<有 bidrank:order:query 权限的管理员 ID>" \
    npx playwright test specs/api
)
```

本地后端将 `API_BASE_URL` 改为 `http://localhost:8888`。测试结果和清理结果写入对应功能的 `governance/feature-docs/{YYYY-MM-DD}-{feature}/test-notes.md`。

### 打印 / Lianke Mock Server

打印 API 测试使用独立的 `mock-external-server`。Playwright 不拦截后端出站请求；后端通过
`LIANKE_PRINT_HOST` 访问 Mock Server，测试脚本只通过业务 API 验证结果。

后端运行环境配置：

```env
LIANKE_PRINT_HOST=http://127.0.0.1:8085/api
LIANKE_PRINT_API_KEY=e2e-fake-key
LIANKE_PRINT_CALLBACK_BASE_URL=https://yshop-api.holuntech.com
```

当前 rprod18 的 Mock 仅监听本机回环地址。测试从本地运行时，先建立隧道：

```bash
ssh -N -L 18085:127.0.0.1:8085 root@rprod18
```

再运行测试：

```bash
cd governance/e2e
LIANKE_MOCK_BASE_URL=http://127.0.0.1:18085 \\
API_BASE_URL=https://yshop-api.holuntech.com \\
TEST_TENANT_ID=<测试租户> \\
PRINTER_ADMIN_USER_ID=<具备打印设备/任务权限的管理员> \\
PRINTER_SHOP_ID=<一次性测试店铺> \\
  npx playwright test specs/api/printer/printer.api.spec.ts
```

默认 `config/responses.yaml` 使用 scheduled 场景：`READY → PARSING → SENDING → SUCCESS`。
预览用例还需要设置 `PRINTER_PREVIEW_PRODUCT_READY=1`。人工失败场景额外需要测试实例开启
Mock 管理接口，并设置 `LIANKE_MOCK_ADMIN_TOKEN`；生产实例管理接口关闭，因此该用例会跳过。

真实提交测试还需显式设置 `PRINTER_CREATE_JOB_READY=1`。它调用
`POST /admin-api/device/print-job/create`，Mock 按 scheduled 场景连续回调，测试通过
`/admin-api/device/print-job/get` 断言本地状态经过 `PROCESSING` 最终到达 `SUCCEEDED`。
该接口会创建设备订单；当前没有业务删除接口，只能使用一次性测试数据并在测试记录中保留订单号。

App 打印 API 使用 `printer.app.api.spec.ts`。前两个用例只读/预览，不扣余额：

```bash
LIANKE_MOCK_BASE_URL=http://127.0.0.1:18085 \\
API_BASE_URL=https://yshop-api.holuntech.com \\
APP_TEST_TENANT_ID=157 \\
APP_PRINT_SHOP_ID=73 \\
  npx playwright test specs/api/printer/printer.app.api.spec.ts -g 'APP-PRINTER-001|APP-PRINTER-002'
```

完整链路用例 `APP-PRINTER-003` 会创建真实业务订单，并调用
`POST /app-api/order/pay`，请求体使用 `{ from: "routine", paytype: "yue", uni: orderNo }`。
它还会轮询 App 进度，验证 `CREATED → PROCESSING → SUCCEEDED`，因此必须使用有余额的专用测试用户，
设置 `APP_TEST_USER_ID`、`APP_PRINT_PRODUCT_ID` 后执行。测试环境已准备用户 `59`，余额 2000 元，
对应打印店为 `Automation-test` 租户的店铺 `73`，文件打印商品为 `3848`。
当前没有确认可安全取消已完成打印订单的业务接口，测试订单号和余额扣减必须记录在测试结果中。

注意：完整链路要求后端已包含 `ProductApiImpl` 对商品 `shopId` 的映射修复，否则合法商品会被错误返回
`1009002000 / 打印商品不存在`，余额支付请求不会被执行。
