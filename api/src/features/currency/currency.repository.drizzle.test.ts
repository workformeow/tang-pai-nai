import { eq } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/libsql/migrator'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/core/config'
import type { Database } from '@/core/database'
import { createDatabase } from '@/core/database/client'
import { users } from '@/core/database/schema/auth'
import { books } from '@/core/database/schema/book'
import { currencies } from '@/core/database/schema/currency'
import { wallets } from '@/core/database/schema/wallet'
import { makeTempDir, removeTempDir } from '@/shared/testing/temp-dir'
import { createDrizzleCurrencyRepository, currencySyncHandler } from './currency.repository.drizzle'
import type { Client } from '@libsql/client'

let dir: string
let client: Client
let db: Database

// currency.md → Data model: the set of #23, in the picker's (sortOrder) order.
const SET = [
  'THB',
  'JPY',
  'KRW',
  'CNY',
  'HKD',
  'MOP',
  'TWD',
  'SGD',
  'MYR',
  'VND',
  'LAK',
  'KHR',
  'IDR',
  'PHP',
  'MMK',
  'INR',
  'AED',
  'EUR',
  'GBP',
  'CHF',
  'TRY',
  'USD',
  'CAD',
  'AUD',
  'NZD',
]
const NO_DECIMALS = ['JPY', 'KRW', 'TWD', 'VND', 'LAK', 'KHR', 'IDR', 'MMK']

beforeEach(async () => {
  dir = makeTempDir('currency')
  const created = createDatabase({ ...env, DATABASE_URL: `file:${join(dir, 'test.db')}` })
  await migrate(created.db, { migrationsFolder: 'drizzle' })
  db = created.db
  client = created.client
})

afterEach(() => {
  client.close()
  removeTempDir(dir)
})

describe('createDrizzleCurrencyRepository', () => {
  it('lists the 25 currencies of the set, all active, in the picker order (0022)', async () => {
    const list = await createDrizzleCurrencyRepository(db).listActive()
    expect(list.map((currency) => currency.code)).toEqual(SET)
    expect(list.every((currency) => currency.isActive)).toBe(true)
  })

  it('gives the currencies used without decimals 0 digits and the rest 2 (rule 2)', async () => {
    const list = await createDrizzleCurrencyRepository(db).listActive()
    for (const currency of list) {
      expect([currency.code, currency.minorUnit]).toEqual([
        currency.code,
        NO_DECIMALS.includes(currency.code) ? 0 : 2,
      ])
    }
  })

  it('orders active currencies by sortOrder, then code', async () => {
    await db.update(currencies).set({ sortOrder: 0 }) // every row ties
    const list = await createDrizzleCurrencyRepository(db).listActive()
    expect(list.map((currency) => currency.code).slice(0, 4)).toEqual(['AED', 'AUD', 'CAD', 'CHF'])
  })

  it('leaves out a currency switched off (rule 3)', async () => {
    await db.update(currencies).set({ isActive: false }).where(eq(currencies.code, 'NZD'))
    const list = await createDrizzleCurrencyRepository(db).listActive()
    expect(list.map((currency) => currency.code)).not.toContain('NZD')
  })
})

describe('0022_currency_picker', () => {
  // The migration's statements, to run its UPDATE again on a database prepared for it.
  const statements = readFileSync(join('drizzle', '0022_currency_picker.sql'), 'utf8').split(
    '--> statement-breakpoint'
  )

  it('gives every changed row its own changeSeq after the counter and raises it', async () => {
    const rows = await db.select().from(currencies)
    const seqs = rows.map((row) => row.changeSeq)
    expect(new Set(seqs).size).toBe(25)
    expect(rows.find((row) => row.code === 'THB')?.changeSeq).toBe(1) // unchanged
    const state = await client.execute('SELECT last_seq FROM sync_state WHERE id = 1')
    expect(Number(state.rows[0]?.['last_seq'])).toBe(Math.max(...seqs))
  })

  it('keeps 2 digits for LAK while a wallet uses it (rule 2)', async () => {
    await db.update(currencies).set({ minorUnit: 2 }).where(eq(currencies.code, 'LAK'))
    await db.insert(users).values({ id: 'alice', email: 'a@example.com', displayName: 'a' })
    await db.insert(books).values({
      id: 'pa',
      userId: 'alice',
      name: 'pa',
      icon: 'lucideHouse',
      color: '#16a34a',
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      changeSeq: 1,
      updatedBy: 'alice',
    })
    await db.insert(wallets).values({
      id: 'w1',
      userId: 'alice',
      bookId: 'pa',
      name: 'Laos',
      currencyCode: 'LAK',
      initialBalance: 0,
      icon: 'lucideWallet',
      color: '#16a34a',
      excludeFromTotal: false,
      isCreditCard: false,
      isArchived: false,
      sortOrder: 0,
      hiddenCategoryIds: [],
      createdAt: 1,
      updatedAt: 1,
      deletedAt: null,
      changeSeq: 2,
      updatedBy: 'alice',
    })
    await db.update(currencies).set({ minorUnit: 2 }).where(eq(currencies.code, 'TWD'))
    await client.execute(statements[2] ?? '')
    const rows = await db.select().from(currencies)
    expect(rows.find((row) => row.code === 'LAK')?.minorUnit).toBe(2)
    expect(rows.find((row) => row.code === 'TWD')?.minorUnit).toBe(0)
  })
})

describe('currencySyncHandler', () => {
  it('pulls every currency, inactive ones too, keyed by code, after the cursor', async () => {
    await db
      .update(currencies)
      .set({ isActive: false, changeSeq: 900 })
      .where(eq(currencies.code, 'NZD'))
    const rows = await currencySyncHandler.pull(db, 'anyone', 899, 10)
    expect(rows).toMatchObject([{ id: 'NZD', code: 'NZD', changeSeq: 900, isActive: false }])
    expect(await currencySyncHandler.pull(db, 'anyone', 0, 3)).toHaveLength(3)
    expect(currencySyncHandler.push).toBeUndefined()
  })
})
