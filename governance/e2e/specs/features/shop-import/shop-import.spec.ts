import { test, expect, chromium, type Locator, type Page } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { recordVideoOptions } from '../../../utils/recording'

/**
 * 店铺导入 E2E：验证「美团外卖用户端模板」可以创建店铺并导入商品。
 * 设置 E2E_RECORD_VIDEO=1 后才会在 test-results/videos/ 下生成 webm 视频。
 */

const VIDEO_PAUSE = 650

async function highlightForVideo(page: Page, locator: Locator, pause = VIDEO_PAUSE) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 })
  await locator.scrollIntoViewIfNeeded()
  await locator.evaluate((element) => {
    const target = element as HTMLElement
    target.style.setProperty('outline', '3px solid #f59e0b', 'important')
    target.style.setProperty('outline-offset', '3px', 'important')
    target.style.setProperty('box-shadow', '0 0 0 7px rgba(245, 158, 11, 0.28)', 'important')
    target.style.setProperty('transition', 'box-shadow 160ms ease, outline 160ms ease', 'important')
  })
  await page.waitForTimeout(pause)
}

async function clearHighlight(locator: Locator) {
  try {
    await locator.evaluate((element) => {
      const target = element as HTMLElement
      target.style.removeProperty('outline')
      target.style.removeProperty('outline-offset')
      target.style.removeProperty('box-shadow')
      target.style.removeProperty('transition')
    })
  } catch {
    // 点击后元素可能已被 Vue 重建，旧节点无需再清理。
  }
}

async function clickForVideo(page: Page, locator: Locator, pause = VIDEO_PAUSE) {
  await highlightForVideo(page, locator, pause)
  await page.locator('.el-loading-mask:not(.is-hidden)').waitFor({ state: 'detached', timeout: 15_000 })
  await locator.click()
  await page.waitForTimeout(450)
  await clearHighlight(locator)
}

async function fillForVideo(page: Page, locator: Locator, value: string, pause = 450) {
  await highlightForVideo(page, locator, pause)
  await locator.fill(value)
  await page.waitForTimeout(350)
  await clearHighlight(locator)
}

test('店铺导入 E2E（美团外卖用户端模板）', async () => {
  test.setTimeout(600_000)
  const browser = await chromium.launch({
    headless: process.env.E2E_HEADLESS === '1',
    slowMo: 350,
    args: ['--start-fullscreen'],
  })
  const context = await browser.newContext({
    viewport: { width: 1600, height: 900 },
    recordVideo: recordVideoOptions,
  })
  const page = await context.newPage()
  page.setDefaultTimeout(15_000)
  page.setDefaultNavigationTimeout(30_000)
  const shopName = `莱运小笼·纯蟹粉蟹膏小笼（静安店）-${Date.now()}`
  const importSourceFile = '/Users/gejunwen/Downloads/数据导出-莱运小笼·纯蟹粉蟹膏小笼（静安店）.xlsx'
  // 当前解析器会从文件名提取店铺名，因此运行时复制一份带时间戳的临时 Excel，
  // 确保实际创建出的店铺名每次唯一；原始测试数据不做修改。
  const importFile = path.join(os.tmpdir(), `数据导出-${shopName}.xlsx`)
  fs.copyFileSync(importSourceFile, importFile)

  try {
    // 1. 登录
    await page.goto('https://yshop-admin.holuntech.com/login')
    await expect(page.getByPlaceholder('请输入租户名称')).toBeVisible()
    await fillForVideo(page, page.getByPlaceholder('请输入租户名称'), process.env.E2E_TENANT ?? 'HolunEase')
    await fillForVideo(page, page.getByPlaceholder('请输入用户名'), process.env.E2E_USERNAME ?? 'HolunEase')
    await fillForVideo(page, page.getByPlaceholder('请输入密码'), process.env.E2E_PASSWORD ?? 'HolunEase')
    await clickForVideo(page, page.getByRole('button', { name: '登录' }))
    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15_000 })
    console.log('[shop-import] 1/7 登录完成')

    // 录制设置：浏览器已通过 --start-fullscreen 启动为浏览器全屏，
    // 不点击系统内的全屏按钮，避免切换到应用自己的全屏模式。
    const sizeDropdown = page.locator('.v-size-dropdown').first()
    await clickForVideo(page, sizeDropdown)
    await clickForVideo(page, page.getByRole('menuitem', { name: '小', exact: true }))
    await page.waitForTimeout(800)
    console.log('[shop-import] 录制设置完成：浏览器全屏 + 小字体')

    // 2. 通过菜单导航进入店铺导入页面
    await clickForVideo(page, page.getByText('门店', { exact: true }).first())
    await page.waitForTimeout(800)
    await clickForVideo(page, page.getByRole('menuitem', { name: '店铺导入', exact: true }))
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    console.log('[shop-import] 2/7 已进入店铺导入页面')

    // 3. 点击「新建导入」
    await clickForVideo(page, page.getByRole('button', { name: '新建导入' }))
    await expect(page.getByText('选择参数并上传')).toBeVisible()
    await page.waitForTimeout(1000)
    console.log('[shop-import] 3/7 已打开新建导入')

    // 4. 选择商圈
    const regionFormItem = page.locator('.el-dialog .el-form-item').filter({ hasText: '所属商圈' })
    await clickForVideo(page, regionFormItem.locator('.el-select'))
    await page.waitForTimeout(800)
    await clickForVideo(page, page.getByText('湖南城市学院', { exact: true }))
    console.log('[shop-import] 4/7 已选择商圈')

    // 5. 新店铺名称
    await fillForVideo(
      page,
      page.getByPlaceholder('默认从文件名去除“数据导出-”前缀提取，可手动兜底'),
      shopName
    )
    console.log('[shop-import] 5/7 已填写店铺名称')

    // 6. 店铺图片：通过素材库真实上传并选择图片
    const imageField = page.getByRole('group', { name: '* 店铺图片' })
    await clickForVideo(page, imageField.locator('.el-upload--picture-card'))

    const materialDialog = page.getByRole('dialog', { name: '图片素材库' })
    await expect(materialDialog).toBeVisible()

    const shopImage = process.env.E2E_SHOP_IMAGE ?? path.resolve(process.cwd(), '../../admin/dist/card01.jpg')
    const materialCheckboxes = materialDialog.locator('.el-checkbox')
    await page.waitForTimeout(1200)

    if ((await materialCheckboxes.count()) > 0) {
      // 素材库已有图片时直接使用第一张，避免每次录制都重复上传素材。
      await clickForVideo(page, materialCheckboxes.first())
      console.log('[shop-import] 6/7 素材库已有图片，已选择第一张')
    } else {
      const materialUploadButton = materialDialog.getByRole('button', { name: '批量上传' })
      await highlightForVideo(page, materialUploadButton)
      // 素材库为空时才上传；不打开原生文件选择器，直接设置隐藏 input。
      await materialDialog.locator('input[type="file"]').setInputFiles(shopImage, { timeout: 15_000 })
      await clearHighlight(materialUploadButton)
      await expect(materialDialog.getByText(path.basename(shopImage), { exact: true })).toBeVisible({ timeout: 30_000 })
      console.log('[shop-import] 6/7 素材库为空，图片上传完成')

      // 新上传的素材按创建时间倒序排列，选择第一项。
      await clickForVideo(page, materialDialog.locator('.el-checkbox').first())
    }

    await clickForVideo(page, materialDialog.getByRole('button', { name: '确 定' }))
    await expect(imageField.locator('.el-upload-list__item-thumbnail')).toBeVisible()
    console.log('[shop-import] 7/7 图片选择完成，准备设置 Excel')

    // 7. 上传导入文件
    const importFileField = page.getByRole('group', { name: '* 导入文件' })
    // Excel 控件不做高亮，也不点击拖拽区域，避免原生文件选择器阻塞录制。
    const importFileInput = page.locator('input[type="file"][accept=".xlsx,.xls"]').first()
    await expect(importFileInput).toBeAttached({ timeout: 15_000 })
    await importFileInput.setInputFiles(importFile, { timeout: 15_000 })
    await expect.poll(
      () => importFileInput.evaluate((input: HTMLInputElement) => input.files?.[0]?.name ?? ''),
      { timeout: 10_000 }
    ).toBe(path.basename(importFile))
    await expect(importFileField.getByText(path.basename(importFile), { exact: true })).toBeVisible()
    console.log(`[shop-import] Excel 已选择：${path.basename(importFile)}`)

    if (process.env.E2E_VERIFY_UPLOAD_ONLY === '1') {
      await page.waitForTimeout(1500)
      return
    }

    // 8. 开始预览
    await clickForVideo(page, page.getByRole('button', { name: '开始预览' }))
    await expect(page.getByRole('button', { name: '确认导入' })).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(2500)

    // 8. 确认导入
    await clickForVideo(page, page.getByRole('button', { name: '确认导入' }))

    // 10. 处理确认弹窗
    const confirmDialog = page.getByRole('dialog', { name: '系统提示' }).filter({ hasText: /确认创建新店铺并导入商品吗/ })
    await expect(confirmDialog).toBeVisible({ timeout: 10_000 })
    await clickForVideo(page, confirmDialog.getByRole('button', { name: '确定' }))

    // 11. 等待导入完成
    await expect(page.getByText('导入已完成')).toBeVisible({ timeout: 300_000 })
    await page.waitForTimeout(4000)

    // 12. 关闭弹窗
    await clickForVideo(page, page.getByRole('button', { name: '关闭' }))
    await page.waitForTimeout(1200)

    // 13. 按唯一店铺名查询导入批次，断言使用美团外卖用户端模板并已完成。
    const importShopNameInput = page.getByPlaceholder('请输入店铺名称')
    await fillForVideo(page, importShopNameInput, shopName)
    await clickForVideo(page, page.getByRole('button', { name: '搜索' }))

    const importRow = page.locator('.el-table__row').first()
    await expect(importRow).toBeVisible({ timeout: 30_000 })
    await expect(importRow).toContainText(shopName)
    await expect(importRow).toContainText('meituan-user')
    await expect(importRow).toContainText('已导入')
    console.log(`[shop-import] 导入批次断言通过：${shopName}`)

    // 14. 清理导入记录（不删除店铺、商品或分类）。
    const deleteBtn = importRow.locator('button').filter({ hasText: /删除数据|删除店铺及商品|删除导入记录/ })
    await expect(deleteBtn).toBeVisible({ timeout: 10_000 })
    await clickForVideo(page, deleteBtn)

    const delConfirm = page.getByRole('dialog', { name: '系统提示' }).filter({ hasText: /确认删除/ })
    await expect(delConfirm).toBeVisible({ timeout: 10_000 })
    await clickForVideo(page, delConfirm.getByRole('button', { name: '确定' }))
    await page.waitForTimeout(2500)

    // 15. 进入门店管理，按唯一店铺名查询并断言店铺已创建。
    await clickForVideo(page, page.getByText('门店', { exact: true }).first())
    await page.waitForTimeout(800)
    await clickForVideo(page, page.getByRole('menuitem', { name: '门店管理', exact: true }))
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)

    const shopNameInput = page.getByPlaceholder('请输入店铺名称')
    await fillForVideo(page, shopNameInput, shopName)

    // 店铺创建和门店列表查询存在短暂的最终一致性，最多重试 5 次。
    const searchButton = page.getByRole('button', { name: '搜索' })
    const matchingShopRows = page.locator('.el-table__row').filter({ hasText: shopName })
    let shopFound = false
    for (let attempt = 1; attempt <= 5; attempt += 1) {
      await clickForVideo(page, searchButton)
      try {
        await expect(matchingShopRows.first()).toBeVisible({ timeout: 5_000 })
        shopFound = true
        break
      } catch {
        if (attempt < 5) await page.waitForTimeout(3_000)
      }
    }
    expect(shopFound).toBe(true)

    const shopRow = matchingShopRows.first()
    await expect(shopRow).toContainText(shopName)
    console.log(`[shop-import] 店铺查询断言通过：${shopName}`)

    // 16. 进入商品管理，按店铺筛选并断言至少查到一个商品。
    await clickForVideo(page, page.getByText('商品', { exact: true }).first())
    await page.waitForTimeout(800)
    await clickForVideo(page, page.getByRole('menuitem', { name: '商品管理', exact: true }))
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)

    const shopSelect = page.locator('.el-form-item').filter({ hasText: '选择门店' }).locator('.el-select').first()
    await clickForVideo(page, shopSelect)
    await clickForVideo(page, page.getByRole('option', { name: shopName, exact: true }))
    await clickForVideo(page, page.getByRole('tab', { name: '待上架产品', exact: true }))
    await page.waitForTimeout(1500)
    const visibleProductCount = await page.evaluate((name) => {
      return Array.from(document.querySelectorAll('.el-table__row')).filter((tr) => {
        const style = window.getComputedStyle(tr)
        return style.display !== 'none' && style.visibility !== 'hidden' && tr.textContent?.includes(name)
      }).length
    }, shopName)
    expect(visibleProductCount).toBeGreaterThan(0)
    console.log('[shop-import] 商品查询断言通过：至少查到 1 个商品')

    // 回到门店管理执行 teardown。
    await clickForVideo(page, page.getByText('门店', { exact: true }).first())
    await page.waitForTimeout(800)
    await clickForVideo(page, page.getByRole('menuitem', { name: '门店管理', exact: true }))
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1200)
    await fillForVideo(page, page.getByPlaceholder('请输入店铺名称'), shopName)
    await clickForVideo(page, page.getByRole('button', { name: '搜索' }))
    const teardownShopRow = page.locator('.el-table__row').filter({ hasText: shopName }).first()
    await expect(teardownShopRow).toBeVisible({ timeout: 30_000 })

    // 17. teardown：在门店管理页面删除本次创建的店铺，并确认列表中已不存在。
    await clickForVideo(page, teardownShopRow.getByRole('button', { name: '删除' }))
    const shopDeleteDialog = page.getByRole('dialog').filter({ hasText: /删除/ }).last()
    await expect(shopDeleteDialog).toBeVisible({ timeout: 10_000 })
    await clickForVideo(page, shopDeleteDialog.getByRole('button', { name: '确定' }))
    await expect(page.locator('.el-table__row').filter({ hasText: shopName })).toHaveCount(0, { timeout: 30_000 })
    console.log(`[shop-import] teardown 完成，店铺已删除：${shopName}`)
  } finally {
    fs.rmSync(importFile, { force: true })
    await context.close()
    await browser.close()
  }
})
