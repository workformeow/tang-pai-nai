import { expect, test as base } from '@playwright/test'
import { randomInt, randomUUID } from 'node:crypto'
import { readMail } from './mail'

interface E2eFixtures {
  /** A new address for this test: its own user, its own per-email rate limits. */
  email: string
  /** This test's client address (`X-Forwarded-For`): its own per-IP rate limits. */
  clientIp: string
  /** Signs `email` up through the API (no UI) and opens the app signed in. */
  signIn: () => Promise<void>
}

/** A random private address; collisions between tests of one run are unlikely enough. */
const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`

/**
 * The tests' `test`: every test gets a fresh browser context (Playwright's default), a unique
 * email and its own client IP, so nothing one test does (users, rate limits) reaches another.
 * See tests/README.md → "A clean start for every test".
 */
export const test = base.extend<E2eFixtures>({
  // eslint-disable-next-line no-empty-pattern
  email: async ({}, use) => use(`e2e-${randomUUID()}@example.test`),
  // eslint-disable-next-line no-empty-pattern
  clientIp: async ({}, use) => use(randomIp()),
  extraHTTPHeaders: async ({ clientIp }, use) => use({ 'X-Forwarded-For': clientIp }),
  signIn: async ({ page, email }, use) =>
    use(async () => {
      const start = await page.request.post('/api/auth/email/start', {
        data: { email, lang: 'th' },
      })
      expect(start.status(), await start.text()).toBeLessThan(300)
      const { code } = await readMail(email)
      const verify = await page.request.post('/api/auth/email/verify', { data: { email, code } })
      expect(verify.status(), await verify.text()).toBeLessThan(300)
      await page.goto('/')
    }),
})

export { expect }
