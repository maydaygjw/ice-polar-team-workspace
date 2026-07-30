import { defineConfig, devices } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL ?? 'https://yshop-admin.holuntech.com/'

process.env.E2E_TENANT ??= 'HolunEase'
process.env.E2E_USERNAME ??= 'HolunEase'
process.env.E2E_PASSWORD ??= 'HolunEase'

export default defineConfig({
  testDir: './specs',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    headless: !process.env.HEADED,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // 默认关闭视频录制；E2E_RECORD_VIDEO=1 时为所有 Playwright 用例开启录制。
    video: process.env.E2E_RECORD_VIDEO === '1' ? 'on' : 'off',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
