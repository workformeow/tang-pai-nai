import { expect, test as base } from '@playwright/test'
import { randomInt, randomUUID } from 'node:crypto'
import { bookRow, categoryRow, pushRows, signUp, walletRow } from './api'

/** What a fixture set up, for the test to refer to. */
export interface Book {
  id: string
  name: string
}

/** A book with one expense category and one THB wallet, as `withWallet` pushed them. */
export interface WalletSetup {
  /** The user's access token, for reading back what reached the server (`pullRows`). */
  token: string
  book: Book
  category: { id: string; name: string }
  wallet: { id: string; name: string; initialBalance: number }
}

interface E2eFixtures {
  /** A new address for this test: its own user, its own per-email rate limits. */
  email: string
  /** This test's client address (`X-Forwarded-For`): its own per-IP rate limits. */
  clientIp: string
  /** Signs `email` up through the API (no UI), opens the app signed in; answers the token. */
  signIn: () => Promise<string>
  /** A signed-in user with one book (pushed through the API), the app open on it. */
  withBook: Book
  /** A signed-in user with a book, one expense category and one wallet, the app open on it. */
  withWallet: WalletSetup
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
      const token = await signUp(page.request, email)
      await page.goto('/')
      return token
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
  withWallet: async ({ page, email }, use) => {
    const token = await signUp(page.request, email)
    const book = bookRow('ครอบครัว')
    const category = categoryRow(book.id, 'expense', 'อาหาร')
    const wallet = walletRow(book.id, 'เงินสด', 100_000)
    // In this order: a row is pushed after the rows it points at.
    await pushRows(page.request, token, [
      { table: 'books', row: book },
      { table: 'categories', row: category },
      { table: 'wallets', row: wallet },
    ])
    // The first pull brings them in; the Transactions tab replaces the first-wallet step.
    await page.goto('/')
    await expect(
      page.getByText('ยอดรวม ฿1,000.00'),
      'fixture withWallet: the app never showed the pushed wallet'
    ).toBeVisible()
    await use({
      token,
      book: { id: book.id, name: book.name },
      category: { id: category.id, name: category.name },
      wallet: { id: wallet.id, name: wallet.name, initialBalance: wallet.initialBalance },
    })
  },
})

export { expect }
