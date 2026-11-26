import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests (ROADMAP → Backlog "End-to-end tests"): the app at phone size in Chromium and
 * WebKit (closest to Safari). They live in `tests/`, outside `src/`, so `ng test` (Vitest) never
 * picks them up. See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  workers: process.env['CI'] ? 1 : undefined,
  reporter: 'html',
  use: {
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Pixel 7'] } },
    { name: 'webkit', use: { ...devices['iPhone 15'] } },
  ],
})
