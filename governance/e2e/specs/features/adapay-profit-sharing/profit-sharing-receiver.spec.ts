import { test, expect, type Page } from '@playwright/test'
import { login } from '../../../utils/auth'

/**
 * PS-R-01: 新增平台级个人分账收款人
 *
 * 通过管理后台 UI 完成新增，验证弹窗提交、成功提示、列表回显。
 *
 * 注意：
 * - 本用例需要 Adapay 沙箱环境可正常创建 Member 并绑定结算账户。
 * - 同一身份证 + 银行卡组合在 Adapay 侧不能重复；如重复运行失败，请更换测试数据。
 */
test.describe('分账收款人管理', () => {
  const credentials = {
    tenant: process.env.E2E_TENANT!,
    username: process.env.E2E_USERNAME!,
    password: process.env.E2E_PASSWORD!,
  }

  const testData = {
    realName: '葛俊文',
    idCard: '310110198809065114',
    cardNo: '6230580000144581738',
  }

  async function navigateToProfitSharingReceiver(page: Page) {
    const menu = page.locator('.el-sub-menu__title').filter({ hasText: '门店中心' })
    await expect(menu).toBeVisible()

    const isExpanded = await menu.evaluate((el: HTMLElement) => el.classList.contains('is-opened'))
    if (!isExpanded) {
      await menu.click()
    }

    await page.getByRole('menuitem', { name: '分账收款人管理' }).click()
    await expect(page.getByRole('navigation', { name: 'Breadcrumb' })).toContainText('分账收款人管理')
  }

  test.beforeEach(async ({ page }) => {
    await login(page, credentials)
    await navigateToProfitSharingReceiver(page)
  })

  test('新增平台级个人分账收款人', async ({ page }) => {
    const timestamp = Date.now()
    const receiverName = `E2E平台收款人-${timestamp}`
    const phone = `138${String(timestamp).slice(-8)}`

    await page.getByRole('button', { name: '新增收款人' }).click()

    const dialog = page.locator('.el-dialog').filter({ hasText: '新增' })
    await expect(dialog).toBeVisible()

    await dialog.getByRole('radio', { name: '平台级' }).check()

    const roleSelect = dialog.getByRole('combobox', { name: '角色' })
    await roleSelect.click({ force: true })
    await page.waitForTimeout(200)
    await page.getByRole('option', { name: '平台' }).first().click({ force: true })
    await page.waitForTimeout(200)

    await dialog.getByRole('textbox', { name: '* 收款人名称' }).fill(receiverName)

    await dialog.getByRole('textbox', { name: '* 手机号' }).fill(phone)
    await dialog.getByRole('textbox', { name: '* 真实姓名' }).fill(testData.realName)
    await dialog.getByRole('textbox', { name: '* 身份证号' }).fill(testData.idCard)

    await dialog.getByRole('textbox', { name: '* 银行卡号' }).fill(testData.cardNo)
    await dialog.getByRole('textbox', { name: '* 开户名' }).fill(testData.realName)

    const bankCombobox = dialog.getByRole('combobox', { name: '* 银行' })
    await bankCombobox.click({ force: true })
    await page.waitForTimeout(500)
    await page.getByRole('option', { name: /中国工商银行/ }).first().click({ force: true })
    await page.waitForTimeout(200)

    await dialog.getByRole('radio', { name: '个人借记卡' }).check()
    await expect(dialog.getByRole('switch', { name: '* 状态' })).toBeChecked()

    await dialog.getByRole('button', { name: '确 定' }).click()

    await expect(page.locator('.el-message--success')).toContainText('新增成功', { timeout: 20_000 })
    await expect(dialog).not.toBeVisible()

    await expect(page.getByRole('cell', { name: receiverName })).toBeVisible()
  })
})
