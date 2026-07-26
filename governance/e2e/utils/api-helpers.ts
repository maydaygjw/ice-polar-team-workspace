/**
 * API 测试共享 helper。
 *
 * 通用逻辑（与具体 feature 无关）：Mock Token 规则、请求头组装、CommonResult 断言。
 * 各 feature 的 `specs/api/{feature}/{feature}.api.spec.ts` 从这里 import，
 * 避免跨用例复制（bidrank / printer-shop 等）。
 *
 * 约定见 `governance/PLAYBOOKS/api-testing.md` 与 `governance/e2e/specs/api/README.md`。
 */
import { expect, type APIResponse } from '@playwright/test'

/**
 * Mock Token 规则：`test + 用户ID`。
 *
 * 仅本地/测试环境可用（生产必须关闭 `yshop.security.mock-enable`）。
 * 只模拟用户 ID/用户类型/租户上下文，**不授予菜单/角色权限**；
 * `@PreAuthorize` 接口仍须为测试用户配置对应权限。
 */
export function mockToken(userId: string | number): string {
  return `test${userId}`
}

/** 管理端请求头：Mock Token + 租户 + JSON。token 用 {@link mockToken} 构造。 */
export function adminHeaders(token: string, tenantId: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    'tenant-id': tenantId,
    'Content-Type': 'application/json',
  }
}

/** App 端请求头：与管理端结构相同（token 前缀决定用户类型）。 */
export function appHeaders(token: string, tenantId: string): Record<string, string> {
  return adminHeaders(token, tenantId)
}

/** 断言 CommonResult 成功（HTTP ok 且 `code=0`）并返回 `data`。 */
export async function successData<T>(response: APIResponse, ctx: string): Promise<T> {
  expect(response.ok(), `${ctx}: HTTP status`).toBeTruthy()
  const body = await response.json()
  expect(body.code, `${ctx}: CommonResult.code`).toBe(0)
  return body.data as T
}

/**
 * 断言 CommonResult 失败（`code !== 0`），可选校验 HTTP 状态码。
 * 返回 body 便于进一步断言 `msg` 的错误语义。
 */
export async function assertFailure(
  response: APIResponse,
  ctx: string,
  expectedHttp?: number,
): Promise<{ code: number; msg?: string; data?: unknown }> {
  if (expectedHttp != null) {
    expect(response.status(), `${ctx}: HTTP status`).toBe(expectedHttp)
  }
  const body = await response.json()
  expect(body.code, `${ctx}: CommonResult.code should be non-zero`).not.toBe(0)
  return body
}
