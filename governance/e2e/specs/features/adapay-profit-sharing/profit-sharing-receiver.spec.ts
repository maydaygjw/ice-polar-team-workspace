import { test, expect } from '../../../utils/auth'

/**
 * PS-R-01: 新增平台级个人分账收款人
 *
 * 通过管理后台 UI 完成新增，验证弹窗提交、成功提示、列表回显，
 * 并在用例结束时删除该收款人，避免测试数据残留。
 *
 * 注意：
 * - 本用例需要 Adapay 沙箱环境可正常创建 Member 并绑定结算账户。
 * - 同一身份证 + 银行卡组合在 Adapay 侧不能重复；如重复运行失败，请更换测试数据。
 */
test.describe('分账收款人管理', () => {
  const testData = {
    realName: '葛俊文',
    idCard: '310110198809065114',
    cardNo: '6230580000144581738',
  }

  test.beforeEach(async ({ adminPage: page }) => {
    await page.goto('/shop/profit-sharing-receiver')
    await expect(page.getByRole('button', { name: '新增收款人' })).toBeVisible()
  })

  test('PS-R-01 新增平台级个人分账收款人后删除', async ({ adminPage: page }) => {
    const timestamp = Date.now()
    const receiverName = `E2E平台收款人-${timestamp}`
    const phone = `138${String(timestamp).slice(-8)}`

    // 1. 打开新增弹窗
    await page.getByRole('button', { name: '新增收款人' }).click()

    const dialog = page.locator('.el-dialog').filter({ hasText: '新增' })
    await expect(dialog).toBeVisible()

    // 2. 填写平台级个人收款人信息
    await dialog.getByRole('radio', { name: '平台级' }).check()

    const roleSelect = dialog.getByRole('combobox', { name: '角色' })
    await roleSelect.click({ force: true })
    const roleOption = page.getByRole('option', { name: '平台' }).first()
    await roleOption.waitFor({ state: 'visible' })
    await roleOption.click({ force: true })
    await expect(page.locator('.el-select-dropdown').last()).toBeHidden()

    await dialog.getByRole('textbox', { name: '* 收款人名称' }).fill(receiverName)

    await dialog.getByRole('textbox', { name: '* 手机号' }).fill(phone)
    await dialog.getByRole('textbox', { name: '* 真实姓名' }).fill(testData.realName)
    await dialog.getByRole('textbox', { name: '* 身份证号' }).fill(testData.idCard)

    await dialog.getByRole('textbox', { name: '* 银行卡号' }).fill(testData.cardNo)
    await dialog.getByRole('textbox', { name: '* 开户名' }).fill(testData.realName)

    const bankCombobox = dialog.getByRole('combobox', { name: '* 银行' })
    await bankCombobox.click({ force: true })
    const bankOption = page.getByRole('option', { name: /中国工商银行/ }).first()
    await bankOption.waitFor({ state: 'visible' })
    await bankOption.click({ force: true })
    await expect(page.locator('.el-select-dropdown').last()).toBeHidden()

    await dialog.getByRole('radio', { name: '个人借记卡' }).check()
    await expect(dialog.getByRole('switch', { name: '* 状态' })).toBeChecked()

    // 3. 提交并验证创建成功
    await dialog.getByRole('button', { name: '确 定' }).click()

    await expect(page.locator('.el-message--success')).toContainText('新增成功', { timeout: 20_000 })
    await expect(dialog).not.toBeVisible()

    // 4. 在列表中定位到刚创建的收款人
    await page.getByPlaceholder('收款人名称').fill(receiverName)
    await page.getByRole('button', { name: '搜索' }).click()
    await expect(page.getByRole('cell', { name: receiverName })).toBeVisible()

    // 5. 删除该收款人并验证清理成功
    const row = page.getByRole('row').filter({ hasText: receiverName })
    await row.getByRole('button', { name: '删除' }).click()

    const confirmDialog = page.locator('.el-message-box').filter({ hasText: '是否删除所选中数据？' })
    await expect(confirmDialog).toBeVisible()
    await confirmDialog.getByRole('button', { name: '确定' }).click()

    await expect(page.locator('.el-message--success')).toContainText('删除成功', { timeout: 20_000 })
    await expect(page.getByText('暂无分账收款人')).toBeVisible()
  })
})
