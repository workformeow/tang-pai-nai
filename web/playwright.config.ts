import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (plan: tests/README.md): the app at phone size in Chromium and WebKit
 * (closest to Safari), against the real API on its own empty database. They live in `tests/`,
 * outside `src/`, so `ng test` (Vitest) never picks them up. Ports differ from `npm run dev`
 * (API 3000, web 4200), so both can run at once.
 */
const API_PORT = 3100
const WEB_PORT = 4300
const WEB_ORIGIN = `https://localhost:${WEB_PORT}`
const CI = !!process.env['CI']

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  workers: CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: WEB_ORIGIN,
    // `ng serve --ssl` makes its own certificate.
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
  webServer: [
    {
      // A new database every run, so never an API left running from before.
      command: 'node tests/support/start-api.ts',
      url: `http://localhost:${API_PORT}/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_ORIGIN: WEB_ORIGIN },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: `npx ng serve --ssl --port ${WEB_PORT} --proxy-config tests/support/proxy.e2e.json`,
      ignoreHTTPSErrors: true,
      url: WEB_ORIGIN,
      reuseExistingServer: !CI,
      timeout: 180_000,
    },
  ],
})
