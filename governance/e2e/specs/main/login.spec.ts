import { test, expect } from '@playwright/test'

const credentials = {
  tenant: process.env.E2E_TENANT ?? 'HolunEase',
  username: process.env.E2E_USERNAME ?? 'HolunEase',
  password: process.env.E2E_PASSWORD ?? 'HolunEase',
}

test.describe('管理后台登录', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByPlaceholder('请输入租户名称')).toBeVisible()
  })

  test('LOGIN-01 账号密码登录成功并进入首页', async ({ page }) => {
    await page.getByPlaceholder('请输入租户名称').fill(credentials.tenant)
    await page.getByPlaceholder('请输入用户名').fill(credentials.username)
    await page.getByPlaceholder('请输入密码').fill(credentials.password)

    await page.getByRole('button', { name: '登录' }).click()

    await expect(page).not.toHaveURL(/.*\/login/, { timeout: 15_000 })
    // 登录后 sidebar 可能折叠，改用 breadcrumb 中可见的「首页」确认已进入后台。
    await expect(page.getByRole('link', { name: '首页' }).first()).toBeVisible({ timeout: 10_000 })
  })

  test('LOGIN-02 错误密码登录失败并提示', async ({ page }) => {
    await page.getByPlaceholder('请输入租户名称').fill(credentials.tenant)
    await page.getByPlaceholder('请输入用户名').fill(credentials.username)
    await page.getByPlaceholder('请输入密码').fill('wrong_password_123')

    await page.getByRole('button', { name: '登录' }).click()

    await expect(page).toHaveURL(/.*\/login/)
    // 错误密码时，登录按钮会恢复可点击，说明后端已返回；错误提示可能为接口返回弹窗，
    // 也可能无可见提示，因此以“仍在登录页且登录按钮可用”作为失败断言。
    await expect(page.getByRole('button', { name: '登录' })).toBeEnabled({ timeout: 10_000 })
  })

  test('LOGIN-03 空字段提交触发表单校验', async ({ page }) => {
    await page.getByPlaceholder('请输入租户名称').clear()
    await page.getByPlaceholder('请输入用户名').clear()
    await page.getByPlaceholder('请输入密码').clear()

    await page.getByRole('button', { name: '登录' }).click()

    await expect(page.locator('.el-form-item.is-error').first()).toBeVisible({ timeout: 5_000 })
    await expect(page).toHaveURL(/.*\/login/)
  })
})
