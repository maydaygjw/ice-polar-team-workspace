/**
 * 打印 / Lianke API tests.
 *
 * The backend must be configured to call the deployed mock server, for example:
 *   LIANKE_PRINT_HOST=http://127.0.0.1:8085/api
 *   LIANKE_PRINT_API_KEY=e2e-fake-key
 *
 * LIANKE_MOCK_BASE_URL points to the mock server health endpoint. If the mock
 * server listens on a remote host's loopback address, use an SSH tunnel first.
 * The default scheduled scenario is tested without enabling the admin API.
 *
 * Required:
 *   API_BASE_URL, TEST_TENANT_ID, PRINTER_ADMIN_USER_ID, PRINTER_SHOP_ID
 *   LIANKE_MOCK_BASE_URL
 *
 * Optional preview prerequisites:
 *   PRINTER_PREVIEW_PRODUCT_READY=1
 *   PRINTER_CREATE_JOB_READY=1 for the persistent real-print submission test
 *
 * Optional manual-state test:
 *   LIANKE_MOCK_ADMIN_TOKEN, with MOCK_ADMIN_ENABLED=true on the mock server
 */

import { expect, test, type APIRequestContext } from '@playwright/test'
import { adminHeaders, assertFailure, mockToken, successData } from '../../../utils/api-helpers'
import {
  assertLiankeMockHealth,
  configureLiankeMock,
  hasLiankeMockAdmin,
  liankeMockBaseUrl,
  resetLiankeMock,
  setLiankeTaskState,
} from '../../../utils/lianke-mock'

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:8888'
const tenantId = process.env.TEST_TENANT_ID
const adminUserId = process.env.PRINTER_ADMIN_USER_ID ?? process.env.ADMIN_USER_ID
const shopId = process.env.PRINTER_SHOP_ID
const adminToken = mockToken(adminUserId ?? '1')

const headers = () => adminHeaders(adminToken, tenantId ?? '')

type PreviewResult = {
  finished: boolean
  taskState: string
  previewImages?: string[]
  taskTicket?: string
  resultCode?: number
  resultMsg?: string
}

type DeviceOrder = {
  orderNo: string
  deviceCode: string
  deviceType: string
  operationType: string
  status: string
  taskId?: string
  finishedAt?: string
  failureReason?: string
}

async function waitForPreviewResult(
  request: APIRequestContext,
  shop: string,
  taskId: string,
): Promise<PreviewResult> {
  const timeoutMs = Number(process.env.PRINTER_PREVIEW_TIMEOUT_MS ?? '10000')
  const deadline = Date.now() + timeoutMs
  let lastResult: PreviewResult | undefined

  while (Date.now() < deadline) {
    const response = await request.get(`${apiBase}/admin-api/device/print-job/preview-result`, {
      headers: headers(),
      params: { shopId: shop, taskId },
    })
    lastResult = await successData<PreviewResult>(response, '轮询打印预览结果')
    if (lastResult.finished) return lastResult
    await new Promise((resolve) => setTimeout(resolve, 500))
  }

  throw new Error(`Lianke mock scheduled task did not finish: ${JSON.stringify(lastResult)}`)
}

async function waitForDeviceOrderStatus(
  request: APIRequestContext,
  orderNo: string,
  expectedStatus: string,
): Promise<{ order: DeviceOrder; seenStatuses: string[] }> {
  const timeoutMs = Number(process.env.PRINTER_CREATE_TIMEOUT_MS ?? '10000')
  const deadline = Date.now() + timeoutMs
  const seenStatuses: string[] = []
  let lastOrder: DeviceOrder | null = null

  while (Date.now() < deadline) {
    const response = await request.get(`${apiBase}/admin-api/device/print-job/get`, {
      headers: headers(),
      params: { orderNo },
    })
    lastOrder = await successData<DeviceOrder | null>(response, `查询打印任务 ${orderNo}`)
    if (lastOrder?.status && !seenStatuses.includes(lastOrder.status)) {
      seenStatuses.push(lastOrder.status)
    }
    if (lastOrder?.status === expectedStatus) {
      return { order: lastOrder, seenStatuses }
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(
    `打印任务未进入 ${expectedStatus}: orderNo=${orderNo}, `
      + `last=${JSON.stringify(lastOrder)}, seen=${JSON.stringify(seenStatuses)}`,
  )
}

test.describe('打印 / Lianke API', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!tenantId, '缺少 TEST_TENANT_ID，避免误用默认租户')
  test.skip(!adminUserId, '缺少 PRINTER_ADMIN_USER_ID 或 ADMIN_USER_ID')
  test.skip(!liankeMockBaseUrl(), '缺少 LIANKE_MOCK_BASE_URL，避免误调用真实链科')

  test.beforeEach(async ({ request }) => {
    await assertLiankeMockHealth(request)
  })

  test('PRINTER-API-002 无效打印文件类型被拒绝', async ({ request }) => {
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
  })

  test('PRINTER-API-003 scheduled Mock 自动完成预览任务', async ({ request }) => {
    test.skip(
      process.env.PRINTER_PREVIEW_PRODUCT_READY !== '1',
      '需要已准备文件打印商品、SKU、纸张/颜色 Option 时设置 PRINTER_PREVIEW_PRODUCT_READY=1',
    )
    test.skip(!shopId, '缺少 PRINTER_SHOP_ID')

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
    expect(preview.taskId).toMatch(/^mock-task-/)
    expect(preview.totalPrice).toBeGreaterThan(0)

    const result = await waitForPreviewResult(request, shopId, preview.taskId)
    expect(result.taskState).toBe('SUCCESS')
    expect(result.finished).toBe(true)
    expect(result.taskTicket).toBe(`ticket-${preview.taskId}`)
  })

  test('PRINTER-API-004 scheduled Mock 提交真实打印任务并连续回调推进本地状态', async ({ request }) => {
    test.skip(process.env.PRINTER_CREATE_JOB_READY !== '1', '真实提交会落库，显式设置 PRINTER_CREATE_JOB_READY=1 后执行')
    test.skip(
      process.env.PRINTER_PREVIEW_PRODUCT_READY !== '1',
      '需要已准备文件打印商品、SKU、纸张/颜色 Option 时设置 PRINTER_PREVIEW_PRODUCT_READY=1',
    )
    test.skip(!shopId, '缺少 PRINTER_SHOP_ID')

    const createResponse = await request.post(`${apiBase}/admin-api/device/print-job/create`, {
      headers: headers(),
      data: {
        shopId: Number(shopId),
        fileUrl: process.env.PRINTER_TEST_FILE_URL ?? 'https://e2e.invalid/printer-submit.pdf',
        fileExt: 'pdf',
        paperName: process.env.PRINTER_PAPER_NAME ?? 'A4',
        colorName: process.env.PRINTER_COLOR_NAME ?? '黑白',
        copies: 1,
      },
    })
    const created = await successData<{
      orderNo: string
      taskId: string
      pageCount: number
      totalPrice: number
    }>(createResponse, '提交真实打印任务')

    expect(created.orderNo).toBeTruthy()
    expect(created.taskId).toMatch(/^mock-task-/)
    expect(created.pageCount).toBe(3)
    expect(created.totalPrice).toBeGreaterThan(0)

    const processing = await waitForDeviceOrderStatus(request, created.orderNo, 'PROCESSING')
    expect(processing.order.taskId).toBe(created.taskId)
    expect(processing.order.operationType).toBe('print_order')

    const completed = await waitForDeviceOrderStatus(request, created.orderNo, 'SUCCEEDED')
    expect(completed.order.taskId).toBe(created.taskId)
    expect(completed.seenStatuses).toEqual(expect.arrayContaining(['QUEUED', 'PROCESSING', 'SUCCEEDED']))
    expect(completed.order.finishedAt).toBeTruthy()
  })

  test('PRINTER-API-005 可选人工场景控制失败结果', async ({ request }) => {
    test.skip(!hasLiankeMockAdmin(), '未配置 LIANKE_MOCK_ADMIN_TOKEN，跳过人工场景测试')
    test.skip(!shopId, '缺少 PRINTER_SHOP_ID')
    test.skip(
      process.env.PRINTER_PREVIEW_PRODUCT_READY !== '1',
      '需要已准备文件打印商品、SKU、纸张/颜色 Option 时设置 PRINTER_PREVIEW_PRODUCT_READY=1',
    )

    await resetLiankeMock(request)
    try {
      await configureLiankeMock(request, { callback_mode: 'manual', transitions: {} })
      const previewResponse = await request.post(`${apiBase}/admin-api/device/print-job/preview`, {
        headers: headers(),
        data: {
          shopId: Number(shopId),
          fileUrl: 'https://e2e.invalid/printer-failure.pdf',
          fileExt: 'pdf',
          paperName: 'A4',
          colorName: '黑白',
          copies: 1,
        },
      })
      const preview = await successData<{ taskId: string }>(previewResponse, '失败场景预览')

      await setLiankeTaskState(request, preview.taskId, {
        state: 'FAILURE',
        result_code: 503,
        result_msg: '测试打印失败',
        notify_callback: false,
      })
      const resultResponse = await request.get(`${apiBase}/admin-api/device/print-job/preview-result`, {
        headers: headers(),
        params: { shopId, taskId: preview.taskId },
      })
      const result = await successData<PreviewResult>(resultResponse, '查询失败预览结果')
      expect(result.finished).toBe(true)
      expect(result.taskState).toBe('FAILURE')
      expect(result.resultCode).toBe(503)
      expect(result.resultMsg).toBe('测试打印失败')
    } finally {
      await resetLiankeMock(request)
    }
  })
})
