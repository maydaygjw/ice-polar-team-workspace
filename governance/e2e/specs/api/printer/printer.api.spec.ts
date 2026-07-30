/**
 * 打印 / Lianke API tests.
 *
 * The backend must be started with:
 *   LIANKE_PRINT_HOST=http://127.0.0.1:18080/api
 *   LIANKE_PRINT_API_KEY=e2e-fake-key
 *
 * Start the fake automatically from this directory with:
 *   PRINTER_API_FAKE=1 npx playwright test specs/api/printer/printer.api.spec.ts
 *
 * Required for the initialization case:
 *   API_BASE_URL, TEST_TENANT_ID, PRINTER_ADMIN_USER_ID, PRINTER_SHOP_ID
 *
 * Optional preview case:
 *   PRINTER_PREVIEW_PRODUCT_READY=1
 */

import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminHeaders, assertFailure, mockToken, successData } from '../../../utils/api-helpers'

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:8888'
const tenantId = process.env.TEST_TENANT_ID
const adminUserId = process.env.PRINTER_ADMIN_USER_ID ?? process.env.ADMIN_USER_ID
const shopId = process.env.PRINTER_SHOP_ID
const fakeBase = process.env.LIANKE_FAKE_BASE_URL
  ?? `http://127.0.0.1:${process.env.LIANKE_FAKE_PORT ?? '18080'}`
const adminToken = mockToken(adminUserId ?? '1')

const headers = () => adminHeaders(adminToken, tenantId ?? '')

async function resetFake(request: APIRequestContext) {
  const response = await request.post(`${fakeBase}/__admin/reset`)
  expect(response.ok(), 'Lianke fake reset').toBeTruthy()
}

async function configureFake(
  request: APIRequestContext,
  config: Record<string, unknown>,
) {
  const response = await request.post(`${fakeBase}/__admin/config`, { data: config })
  expect(response.ok(), 'Lianke fake config').toBeTruthy()
}

async function fakeTaskState(
  request: APIRequestContext,
  taskId: string,
  state: Record<string, unknown>,
) {
  const response = await request.post(
    `${fakeBase}/__admin/tasks/${encodeURIComponent(taskId)}/state`,
    { data: state },
  )
  expect(response.ok(), `Lianke fake task state: ${taskId}`).toBeTruthy()
}

test.describe('打印 / Lianke API', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!tenantId, '缺少 TEST_TENANT_ID，避免误用默认租户')
  test.skip(!adminUserId, '缺少 PRINTER_ADMIN_USER_ID 或 ADMIN_USER_ID')

  test.beforeEach(async ({ request }) => {
    const health = await request.get(`${fakeBase}/__health`)
    test.skip(!health.ok(), 'Lianke fake 未启动；请设置 PRINTER_API_FAKE=1')
    await resetFake(request)
  })

  test('PRINTER-API-001 初始化打印设备并读取 Fake 能力', async ({ request }) => {
    test.skip(!shopId, '缺少 PRINTER_SHOP_ID')

    const response = await request.post(`${apiBase}/admin-api/device/print-device/init`, {
      headers: headers(),
      data: {
        shopId: Number(shopId),
        // This is a fake credential, never a real Lianke deviceKey.
        deviceKey: process.env.PRINTER_FAKE_DEVICE_KEY ?? 'e2e-device-key',
      },
    })
    const data = await successData<{
      deviceId: number
      deviceCode: string
      deviceModel: string
      devicePort: string
      papers: string[]
      colors: number[]
      orientations: number[]
      duplexes: number[]
    }>(response, '初始化打印设备')

    expect(data.deviceId).toBeGreaterThan(0)
    expect(data.deviceCode).toBeTruthy()
    expect(data.deviceModel).toBe('E2E-PRINTER-MODEL')
    expect(data.devicePort).toBe('1')
    expect(data.papers).toEqual(['A4', 'A5'])
    expect(data.colors).toEqual([1, 2])
    expect(data.orientations).toEqual([1, 2])
    expect(data.duplexes).toEqual([1, 2, 3])

    const listResponse = await request.get(`${apiBase}/admin-api/device/print-device/list-by-shop`, {
      headers: headers(),
      params: { shopId },
    })
    const devices = await successData<Array<{
      deviceCode: string
      deviceModel: string
      devicePort: string
      hasDeviceKey: boolean
    }>>(listResponse, '查询打印设备')
    const device = devices.find((item) => item.deviceCode === data.deviceCode)
    expect(device, '初始化后的打印设备').toBeTruthy()
    expect(device?.deviceModel).toBe('E2E-PRINTER-MODEL')
    expect(device?.devicePort).toBe('1')
    expect(device?.hasDeviceKey).toBe(true)

    const fakeRequests = await request.get(`${fakeBase}/__admin/requests`)
    const recorded = (await fakeRequests.json()).requests as Array<{
      method: string
      path: string
      apiKeyPresent: boolean
      query: Record<string, string>
    }>
    expect(recorded).toEqual(expect.arrayContaining([
      expect.objectContaining({
        method: 'GET',
        path: '/api/external_api/printer_list',
        apiKeyPresent: true,
      }),
      expect.objectContaining({
        method: 'GET',
        path: '/api/print/paper_dimension_list',
        apiKeyPresent: true,
      }),
      expect.objectContaining({
        method: 'GET',
        path: '/api/print/printer_params',
        apiKeyPresent: true,
      }),
    ]))
  })

  test('PRINTER-API-002 无效打印文件类型被拒绝且不调用 Lianke', async ({ request }) => {
    test.skip(!shopId, '缺少 PRINTER_SHOP_ID')

    const response = await request.post(`${apiBase}/admin-api/device/print-job/preview`, {
      headers: headers(),
      data: {
        shopId: Number(shopId),
        fileUrl: 'https://e2e.invalid/not-supported.exe',
        fileExt: 'exe',
        paperName: 'A4',
        colorName: '黑白',
        copies: 1,
      },
    })
    await assertFailure(response, '拒绝非法文件类型')

    const fakeRequests = await request.get(`${fakeBase}/__admin/requests`)
    expect((await fakeRequests.json()).requests).toHaveLength(0)
  })

  test('PRINTER-API-003 打印预览调用 Fake 页数、提交任务并轮询预览图', async ({ request }) => {
    test.skip(
      process.env.PRINTER_PREVIEW_PRODUCT_READY !== '1',
      '需要已准备文件打印商品、SKU、纸张/颜色 Option 时设置 PRINTER_PREVIEW_PRODUCT_READY=1',
    )
    test.skip(!shopId, '缺少 PRINTER_SHOP_ID')

    await configureFake(request, { pageCount: 3, defaultTaskState: 'READY' })
    const previewResponse = await request.post(`${apiBase}/admin-api/device/print-job/preview`, {
      headers: headers(),
      data: {
        shopId: Number(shopId),
        fileUrl: process.env.PRINTER_TEST_FILE_URL ?? 'https://e2e.invalid/printer-test.pdf',
        fileExt: 'pdf',
        paperName: process.env.PRINTER_PAPER_NAME ?? 'A4',
        colorName: process.env.PRINTER_COLOR_NAME ?? '黑白',
        copies: 1,
      },
    })
    const preview = await successData<{
      pageCount: number
      taskId: string
      totalPrice: number
    }>(previewResponse, '打印预览')
    expect(preview.pageCount).toBe(3)
    expect(preview.taskId).toMatch(/^e2e-task-/)
    expect(preview.totalPrice).toBeGreaterThan(0)

    await fakeTaskState(request, preview.taskId, {
      state: 'SUCCESS',
      resultCode: 200,
      imgList: ['https://e2e.invalid/preview-page-1.png'],
      taskTicket: 'e2e-ticket-001',
      notifyCallback: false,
    })

    const resultResponse = await request.get(`${apiBase}/admin-api/device/print-job/preview-result`, {
      headers: headers(),
      params: { shopId, taskId: preview.taskId },
    })
    const result = await successData<{
      finished: boolean
      taskState: string
      previewImages: string[]
      taskTicket: string
    }>(resultResponse, '查询打印预览结果')
    expect(result.finished).toBe(true)
    expect(result.taskState).toBe('SUCCESS')
    expect(result.previewImages).toEqual(['https://e2e.invalid/preview-page-1.png'])
    expect(result.taskTicket).toBe('e2e-ticket-001')
  })
})
