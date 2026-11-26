import { expect, test as base } from '@playwright/test'
import { randomInt, randomUUID } from 'node:crypto'
import { bookRow, pushRows, signUp } from './api'

/** What a fixture set up, for the test to refer to. */
export interface Book {
  id: string
  name: string
}

interface E2eFixtures {
  /** A new address for this test: its own user, its own per-email rate limits. */
  email: string
  /** This test's client address (`X-Forwarded-For`): its own per-IP rate limits. */
  clientIp: string
  /** Signs `email` up through the API (no UI) and opens the app signed in. */
  signIn: () => Promise<void>
  /** A signed-in user with one book (pushed through the API), the app open on it. */
  withBook: Book
}

/** A random private address; collisions between tests of one run are unlikely enough. */
const randomIp = () => `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`

/**
 * The tests' `test`: every test gets a fresh browser context (Playwright's default), a unique
 * email and its own client IP, so nothing one test does (users, rate limits) reaches another.
 * Fixtures that set things up go through the API, never the UI another test covers.
 * See tests/README.md → "A clean start for every test", "One test, one behavior".
 */
export const test = base.extend<E2eFixtures>({
  // eslint-disable-next-line no-empty-pattern
  email: async ({}, use) => use(`e2e-${randomUUID()}@example.test`),
  // eslint-disable-next-line no-empty-pattern
  clientIp: async ({}, use) => use(randomIp()),
  extraHTTPHeaders: async ({ clientIp }, use) => use({ 'X-Forwarded-For': clientIp }),
  signIn: async ({ page, email }, use) =>
    use(async () => {
      await signUp(page.request, email)
      await page.goto('/')
    }),
  withBook: async ({ page, email }, use) => {
    const token = await signUp(page.request, email)
    const row = bookRow('ครอบครัว')
    await pushRows(page.request, token, [{ table: 'books', row }])
    // The first pull brings the book in; the switcher names it once it's there.
    await page.goto('/')
    await expect(
      page.getByRole('button', { name: `สมุด ${row.name} เปลี่ยนสมุด` }),
      'fixture withBook: the app never showed the pushed book'
    ).toBeVisible()
    await use({ id: row.id, name: row.name })
  },
})

export { expect }
