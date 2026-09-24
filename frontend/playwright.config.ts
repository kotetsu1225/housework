import { defineConfig, devices } from '@playwright/test'

/**
 * E2E テスト設定（frontend/e2e/README.md）
 *
 * 前提:
 *   - バックエンド（:8080）と PostgreSQL が起動していること
 *   - Vite dev server（:3000）は未起動なら自動で立ち上げる（/api は :8080 へ proxy）
 *
 * 環境変数:
 *   E2E_BASE_URL   フロントの URL（既定 http://127.0.0.1:3000）
 *   E2E_BROWSER    Chromium 実行ファイルのパス（Playwright 管理外のブラウザを使うとき）
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000'

export default defineConfig({
  testDir: './e2e',
  // 1つの DB を共有するので直列実行
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 30_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'e2e-report' }]],
  outputDir: 'e2e-results',
  use: {
    baseURL,
    ...devices['iPhone 13'],
    locale: 'ja-JP',
    timezoneId: 'Asia/Tokyo',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    launchOptions: process.env.E2E_BROWSER ? { executablePath: process.env.E2E_BROWSER } : {},
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } }],
  webServer: {
    command: 'npx vite --port 3000 --host 127.0.0.1',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
