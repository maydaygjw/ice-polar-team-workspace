import { expect, type APIRequestContext } from '@playwright/test'

const configuredBaseUrl = process.env.LIANKE_MOCK_BASE_URL?.replace(/\/$/, '')
const adminToken = process.env.LIANKE_MOCK_ADMIN_TOKEN

export function liankeMockBaseUrl(): string | undefined {
  return configuredBaseUrl
}

export function hasLiankeMockAdmin(): boolean {
  return Boolean(configuredBaseUrl && adminToken)
}

function adminHeaders(): Record<string, string> {
  return {
    'X-Mock-Admin-Token': adminToken ?? '',
    'Content-Type': 'application/json',
  }
}

export async function assertLiankeMockHealth(request: APIRequestContext): Promise<void> {
  expect(configuredBaseUrl, 'LIANKE_MOCK_BASE_URL').toBeTruthy()
  const response = await request.get(`${configuredBaseUrl}/health`)
  expect(response.ok(), 'Lianke mock health').toBeTruthy()
  expect((await response.json()).status).toBe('ok')
}

export async function resetLiankeMock(request: APIRequestContext): Promise<void> {
  expect(hasLiankeMockAdmin(), 'LIANKE_MOCK_ADMIN_TOKEN').toBeTruthy()
  const response = await request.post(`${configuredBaseUrl}/__mock/admin/reset`, {
    headers: adminHeaders(),
  })
  expect(response.ok(), 'Lianke mock reset').toBeTruthy()
}

export async function configureLiankeMock(
  request: APIRequestContext,
  config: Record<string, unknown>,
): Promise<void> {
  const response = await request.post(`${configuredBaseUrl}/__mock/admin/config`, {
    headers: adminHeaders(),
    data: config,
  })
  expect(response.ok(), 'Lianke mock config').toBeTruthy()
}

export async function setLiankeTaskState(
  request: APIRequestContext,
  taskId: string,
  state: Record<string, unknown>,
): Promise<void> {
  const response = await request.post(
    `${configuredBaseUrl}/__mock/admin/tasks/${encodeURIComponent(taskId)}/state`,
    { headers: adminHeaders(), data: state },
  )
  expect(response.ok(), `Lianke mock task state: ${taskId}`).toBeTruthy()
}
