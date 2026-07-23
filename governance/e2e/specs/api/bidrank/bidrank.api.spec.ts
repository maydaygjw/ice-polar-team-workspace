import { test, expect, type APIRequestContext, type APIResponse } from '@playwright/test'

const apiBaseUrl = process.env.API_BASE_URL ?? 'http://localhost:8888'
const tenantId = process.env.TEST_TENANT_ID
const businessRegionId = process.env.BIDRANK_BUSINESS_REGION_ID
const appUserId = process.env.BIDRANK_APP_USER_ID ?? process.env.TEST_USER_ID ?? '1'
const adminUserId = process.env.BIDRANK_ADMIN_USER_ID ?? process.env.TEST_USER_ID ?? '1'

function authHeaders(userId: string): Record<string, string> {
  if (!tenantId) {
    throw new Error('TEST_TENANT_ID is required; load governance/ENVIRONMENTS/test.env first')
  }
  return {
    Authorization: `Bearer test${userId}`,
    'tenant-id': tenantId,
  }
}

async function successData<T>(response: APIResponse): Promise<T> {
  expect(response.ok()).toBeTruthy()
  const body = await response.json()
  expect(body.code).toBe(0)
  return body.data as T
}

async function currentAuction(request: APIRequestContext): Promise<{
  cycleId: number
  businessRegionId: number
  ranks: Array<{ id: number; startPrice: string; minIncrement: string }>
}> {
  if (!businessRegionId) {
    throw new Error('BIDRANK_BUSINESS_REGION_ID is required for bidrank API tests')
  }
  const response = await request.get(`${apiBaseUrl}/app-api/bidrank/auction/current`, {
    headers: authHeaders(appUserId),
    params: { businessRegionId },
  })
  const data = await successData<{
    cycleId: number
    businessRegionId: number
    ranks: Array<{ id: number; startPrice: string; minIncrement: string }>
  }>(response)
  expect(data).toBeTruthy()
  expect(data.businessRegionId).toBe(Number(businessRegionId))
  expect(data.cycleId).toBeTruthy()
  expect(data.ranks.length).toBeGreaterThan(0)
  return data
}

test.describe('商圈排名竞价 API', () => {
  test.beforeEach(() => {
    test.skip(!businessRegionId, '设置 BIDRANK_BUSINESS_REGION_ID 后运行竞价排名 API 测试')
  })

  test('BIDRANK-API-001 当前周期返回活动和档位', async ({ request }) => {
    const data = await currentAuction(request)

    expect(data.ranks[0]).toMatchObject({
      id: expect.any(Number),
      startPrice: expect.any(String),
      minIncrement: expect.any(String),
    })
  })

  test('BIDRANK-API-002 当前用户出价单按租户和用户返回', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/app-api/bidrank/my-order/page`, {
      headers: authHeaders(appUserId),
      params: { pageNo: 1, pageSize: 10 },
    })
    const data = await successData<{ list: unknown[]; total: number }>(response)

    expect(Array.isArray(data.list)).toBeTruthy()
    expect(data.total).toBeGreaterThanOrEqual(0)
  })

  test('BIDRANK-API-003 未认证不能查询当前周期', async ({ request }) => {
    const response = await request.get(`${apiBaseUrl}/app-api/bidrank/auction/current`, {
      headers: { 'tenant-id': tenantId ?? '' },
      params: { businessRegionId },
    })

    expect(response.status()).toBe(401)
  })

  test('BIDRANK-API-004 管理端可查询出价单和周期结果', async ({ request }) => {
    const current = await currentAuction(request)
    const headers = authHeaders(adminUserId)

    const orderPage = await request.get(`${apiBaseUrl}/admin-api/bidrank/order/page`, {
      headers,
      params: { pageNo: 1, pageSize: 10, cycleId: current.cycleId },
    })
    const pageData = await successData<{ list: unknown[]; total: number }>(orderPage)
    expect(Array.isArray(pageData.list)).toBeTruthy()

    const result = await request.get(`${apiBaseUrl}/admin-api/bidrank/order/result`, {
      headers,
      params: { cycleId: current.cycleId },
    })
    const resultData = await successData<unknown[]>(result)
    expect(Array.isArray(resultData)).toBeTruthy()
  })
})
