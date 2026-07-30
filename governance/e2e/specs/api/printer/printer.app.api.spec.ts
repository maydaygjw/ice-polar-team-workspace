/**
 * App / 打印 API tests.
 *
 * Required for discovery/preview:
 *   API_BASE_URL, APP_TEST_TENANT_ID, APP_PRINT_SHOP_ID, LIANKE_MOCK_BASE_URL
 *
 * Required for the paid end-to-end flow:
 *   APP_TEST_USER_ID, APP_PRINT_PRODUCT_ID
 *
 * The paid flow creates a real business order, pays it with yue (balance),
 * and waits for the scheduled Lianke mock callbacks to update App progress.
 */

import { expect, test, type APIRequestContext } from '@playwright/test'
import { appHeaders, assertFailure, mockToken, successData } from '../../../utils/api-helpers'
import { assertLiankeMockHealth, liankeMockBaseUrl } from '../../../utils/lianke-mock'

const apiBase = process.env.API_BASE_URL ?? 'http://localhost:8888'
const tenantId = process.env.APP_TEST_TENANT_ID ?? process.env.TEST_TENANT_ID
const shopId = process.env.APP_PRINT_SHOP_ID
const productId = process.env.APP_PRINT_PRODUCT_ID
const appUserId = process.env.APP_TEST_USER_ID
const otherAppUserId = process.env.APP_OTHER_USER_ID

const tenantHeaders = () => ({ 'tenant-id': tenantId ?? '' })
const userHeaders = () => appHeaders(mockToken(appUserId ?? '1'), tenantId ?? '')
const otherUserHeaders = () => appHeaders(mockToken(otherAppUserId ?? '1'), tenantId ?? '')

type OptionGroup = {
  id: number
  name: string
  displayName?: string
  options?: Array<{ id: number; name: string; status?: number }>
}

type PrintOption = {
  groupId: number
  optionId: number
  groupName: string
  optionName: string
}

type AppProgress = {
  operationStatus?: string
  businessStatus?: number
  failureReason?: string
  finished?: boolean
}

function requiredEnv(name: string, value: string | undefined): void {
  test.skip(!value, `缺少 ${name}`)
}

async function readPrintOptions(request: APIRequestContext): Promise<PrintOption[]> {
  requiredEnv('APP_PRINT_PRODUCT_ID', productId)

  const response = await request.get(`${apiBase}/app-api/product/detail/${productId}`, {
    headers: tenantHeaders(),
  })
  const product = await successData<{ optionGroups?: OptionGroup[] }>(response, '查询打印商品详情')
  const groups = product.optionGroups ?? []
  const paperName = process.env.APP_PRINT_PAPER_NAME ?? 'A4'
  const colorName = process.env.APP_PRINT_COLOR_NAME ?? '黑白'

  const choose = (groupPattern: RegExp, optionPattern: RegExp, label: string): PrintOption => {
    const group = groups.find((item) => groupPattern.test(item.displayName ?? item.name))
    const option = group?.options?.find((item) => optionPattern.test(item.name) && item.status !== 0)
    expect(group, `${label}选项分组`).toBeTruthy()
    expect(option, `${label}选项`).toBeTruthy()
    return {
      groupId: group!.id,
      optionId: option!.id,
      groupName: group!.displayName ?? group!.name,
      optionName: option!.name,
    }
  }

  return [
    choose(/纸/, new RegExp(paperName), '纸张'),
    choose(/色/, new RegExp(colorName), '颜色'),
  ]
}

async function waitForAppProgress(
  request: APIRequestContext,
  orderNo: string,
  expectedStatus: string,
): Promise<{ progress: AppProgress; seenStatuses: string[] }> {
  const timeoutMs = Number(process.env.APP_PRINT_TIMEOUT_MS ?? '15000')
  const deadline = Date.now() + timeoutMs
  const seenStatuses: string[] = []
  let lastProgress: AppProgress | undefined

  while (Date.now() < deadline) {
    const response = await request.get(`${apiBase}/app-api/device/printer/progress`, {
      headers: userHeaders(),
      params: { orderNo },
    })
    lastProgress = await successData<AppProgress>(response, `查询 App 打印进度 ${orderNo}`)
    if (lastProgress.operationStatus && !seenStatuses.includes(lastProgress.operationStatus)) {
      seenStatuses.push(lastProgress.operationStatus)
    }
    if (lastProgress.operationStatus === expectedStatus) {
      return { progress: lastProgress, seenStatuses }
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }

  throw new Error(
    `App 打印任务未进入 ${expectedStatus}: orderNo=${orderNo}, `
      + `last=${JSON.stringify(lastProgress)}, seen=${JSON.stringify(seenStatuses)}`,
  )
}

test.describe('App / 打印 API', () => {
  test.describe.configure({ mode: 'serial' })

  test.skip(!tenantId, '缺少 APP_TEST_TENANT_ID 或 TEST_TENANT_ID')
  test.skip(!shopId, '缺少 APP_PRINT_SHOP_ID')
  test.skip(!liankeMockBaseUrl(), '缺少 LIANKE_MOCK_BASE_URL，避免误调用真实链科')

  test.beforeEach(async ({ request }) => {
    await assertLiankeMockHealth(request)
  })

  test('APP-PRINTER-001 发现打印店并读取打印能力', async ({ request }) => {
    const nearbyResponse = await request.get(`${apiBase}/app-api/device/printer/shop/nearby`, {
      headers: tenantHeaders(),
    })
    const nearby = await successData<Array<{
      shopId: number
      shopName: string
      printerOnline: boolean
      deviceModel?: string
    }>>(nearbyResponse, '查询附近打印店')
    const shop = nearby.find((item) => item.shopId === Number(shopId))
    expect(shop, '打印店应出现在附近打印店列表').toBeTruthy()
    expect(shop?.shopName).toBeTruthy()

    const detailResponse = await request.get(`${apiBase}/app-api/device/printer/shop/detail`, {
      headers: tenantHeaders(),
      params: { shopId },
    })
    const detail = await successData<{
      shopId: number
      shopName: string
      canOrder: boolean
      deviceModel: string
      paperNames: string[]
      colorNames: string[]
    }>(detailResponse, '查询打印店详情')
    expect(detail.shopId).toBe(Number(shopId))
    expect(detail.deviceModel).toBeTruthy()
    expect(detail.paperNames.length).toBeGreaterThan(0)
    expect(detail.colorNames).toEqual(expect.arrayContaining(['黑白', '彩色']))
  })

  test('APP-PRINTER-002 App 打印预览返回计价结果', async ({ request }) => {
    const [paper, color] = await readPrintOptions(request)
    const response = await request.post(`${apiBase}/app-api/device/printer/preview`, {
      headers: tenantHeaders(),
      data: {
        shopId: Number(shopId),
        fileUrl: process.env.PRINTER_TEST_FILE_URL ?? 'https://e2e.invalid/app-printer-preview.pdf',
        fileExt: 'pdf',
        paperName: paper.optionName,
        colorName: color.optionName,
        copies: 1,
      },
    })
    const preview = await successData<{
      pageCount: number
      basePrice: number
      unitPrice: number
      totalPrice: number
      paperName: string
      colorName: string
    }>(response, 'App 打印预览')
    expect(preview.pageCount).toBe(3)
    expect(preview.basePrice).toBeGreaterThan(0)
    expect(preview.unitPrice).toBeGreaterThan(0)
    expect(preview.totalPrice).toBeGreaterThan(0)
    expect(preview.paperName).toBe(paper.optionName)
    expect(preview.colorName).toBe(color.optionName)
  })

  test('APP-PRINTER-003 创建打印订单并使用余额支付后由 scheduled 回调推进进度', async ({ request }) => {
    requiredEnv('APP_TEST_USER_ID', appUserId)
    requiredEnv('APP_PRINT_PRODUCT_ID', productId)

    const requestId = `api-test-printer-${Date.now()}`
    const optionSelections = await readPrintOptions(request)
    const createResponse = await request.post(`${apiBase}/app-api/device/printer/order`, {
      headers: userHeaders(),
      data: {
        requestId,
        shopId: Number(shopId),
        productId: Number(productId),
        spec: process.env.APP_PRINT_SPEC ?? '默认',
        optionSelections,
        copies: 1,
        fileKey: 'e2e/app-printer-test.pdf',
        fileUrl: process.env.PRINTER_TEST_FILE_URL ?? 'https://e2e.invalid/app-printer-order.pdf',
        fileName: 'app-printer-order.pdf',
        fileExt: 'pdf',
      },
    })
    const created = await successData<{
      orderNo: string
      payPrice: number
      productType: string
      pageCount: number
      copies: number
    }>(createResponse, '创建 App 打印订单')
    expect(created.orderNo).toBeTruthy()
    expect(created.productType).toBe('FILE_PRINT')
    expect(created.pageCount).toBe(3)
    expect(created.copies).toBe(1)
    expect(created.payPrice).toBeGreaterThan(0)

    const duplicateResponse = await request.post(`${apiBase}/app-api/device/printer/order`, {
      headers: userHeaders(),
      data: {
        requestId,
        shopId: Number(shopId),
        productId: Number(productId),
        spec: process.env.APP_PRINT_SPEC ?? '默认',
        optionSelections,
        copies: 1,
        fileKey: 'e2e/app-printer-test.pdf',
        fileUrl: process.env.PRINTER_TEST_FILE_URL ?? 'https://e2e.invalid/app-printer-order.pdf',
        fileName: 'app-printer-order.pdf',
        fileExt: 'pdf',
      },
    })
    const duplicate = await successData<{ orderNo: string }>(duplicateResponse, '重复 requestId 幂等下单')
    expect(duplicate.orderNo).toBe(created.orderNo)

    const payResponse = await request.post(`${apiBase}/app-api/order/pay`, {
      headers: userHeaders(),
      data: { from: 'routine', paytype: 'yue', uni: created.orderNo },
    })
    const paid = await successData<{ status: string }>(payResponse, '余额支付打印订单')
    expect(paid.status).toBe('ok')

    const completed = await waitForAppProgress(request, created.orderNo, 'SUCCEEDED')
    expect(completed.progress.finished).toBe(true)
    expect(completed.progress.operationStatus).toBe('SUCCEEDED')

    if (otherAppUserId) {
      const ownershipResponse = await request.get(`${apiBase}/app-api/device/printer/progress`, {
        headers: otherUserHeaders(),
        params: { orderNo: created.orderNo },
      })
      await assertFailure(ownershipResponse, '其他 App 用户不得查询打印进度')
    }
  })
})
