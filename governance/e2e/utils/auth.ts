import { test as base, expect, type Page } from '@playwright/test'

export interface LoginCredentials {
  tenant: string
  username: string
  password: string
}

export async function login(page: Page, credentials: LoginCredentials): Promise<void> {
  await page.goto('/login')

  const tenantInput = page.getByPlaceholder('请输入租户名称')
  await expect(tenantInput).toBeVisible()
  await tenantInput.fill(credentials.tenant)

  await page.getByPlaceholder('请输入用户名').fill(credentials.username)
  await page.getByPlaceholder('请输入密码').fill(credentials.password)

  await page.getByRole('button', { name: '登录' }).click()

  await expect(page.locator('.el-menu--vertical').first()).toBeVisible({ timeout: 15_000 })
}

interface AdminFixtures {
  adminPage: Page
}

export const test = base.extend<AdminFixtures>({
  adminPage: async ({ page }, use) => {
    const credentials: LoginCredentials = {
      tenant: process.env.E2E_TENANT ?? 'HolunEase',
      username: process.env.E2E_USERNAME ?? 'HolunEase',
      password: process.env.E2E_PASSWORD ?? 'HolunEase',
    }
    await login(page, credentials)
    await use(page)
  },
})

export { expect }
