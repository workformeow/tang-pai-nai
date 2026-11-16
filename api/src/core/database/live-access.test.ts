import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/core/config'
import { makeTempDir, removeTempDir } from '@/shared/testing/temp-dir'
import { createDatabase } from './client'
import { listenableBooks, sharedBookOf } from './live-access'
import { users } from './schema/auth'
import { books } from './schema/book'
import { walletMembers, wallets } from './schema/wallet'
import type { Database } from './client'

let dir: string
let close: () => void
let db: Database

const sync = (userId: string) => ({ createdAt: 1, updatedAt: 1, changeSeq: 1, updatedBy: userId })

const wallet = (
  id: string,
  extra: Partial<typeof wallets.$inferInsert> = {}
): typeof wallets.$inferInsert => ({
  id,
  userId: 'alice',
  bookId: 'pa',
  name: id,
  currencyCode: 'THB',
  initialBalance: 0,
  icon: 'lucideWallet',
  color: '#2563eb',
  excludeFromTotal: false,
  isArchived: false,
  sortOrder: 0,
  deletedAt: null,
  ...sync('alice'),
  ...extra,
})

beforeEach(async () => {
  dir = makeTempDir('live-access')
  const created = createDatabase({ ...env, DATABASE_URL: `file:${join(dir, 'test.db')}` })
  await migrate(created.db, { migrationsFolder: 'drizzle' })
  await created.db.insert(users).values([
    { id: 'alice', email: 'a@example.com', displayName: 'a' },
    { id: 'bob', email: 'b@example.com', displayName: 'b' },
    { id: 'carol', email: 'c@example.com', displayName: 'c' },
  ])
  const book = (id: string, deletedAt: number | null = null) => ({
    id,
    userId: 'alice',
    name: id,
    icon: 'lucideHouse',
    color: '#15803d',
    sortOrder: 0,
    deletedAt,
    ...sync('alice'),
  })
  await created.db.insert(books).values([book('pa'), book('gone', 5), book('solo-book')])
  await created.db
    .insert(wallets)
    .values([
      wallet('home'),
      wallet('old', { isArchived: true }),
      wallet('deleted', { deletedAt: 5 }),
      wallet('orphan', { bookId: 'gone' }),
      wallet('solo', { bookId: 'solo-book' }),
    ])
  await created.db.insert(walletMembers).values(
    ['home', 'old', 'deleted', 'orphan'].flatMap((walletId) => [
      { walletId, userId: 'bob', role: 'editor' as const, addedAt: 1 },
      { walletId, userId: 'carol', role: 'viewer' as const, addedAt: 1 },
    ])
  )
  db = created.db
  close = () => created.client.close()
})

afterEach(() => {
  close()
  removeTempDir(dir)
})

describe('sharedBookOf', () => {
  it('answers the book of a live wallet that has members', async () => {
    expect(await sharedBookOf(db, 'home')).toBe('pa')
  })

  it('answers null for an unshared, archived, deleted or unknown wallet, or a deleted book', async () => {
    for (const walletId of ['solo', 'old', 'deleted', 'orphan', 'nope']) {
      expect(await sharedBookOf(db, walletId)).toBeNull()
    }
  })
})

describe('listenableBooks', () => {
  it('gives the owner and every member the books with a live, shared wallet', async () => {
    expect(await listenableBooks(db, 'alice')).toEqual(['pa'])
    expect(await listenableBooks(db, 'bob')).toEqual(['pa'])
    expect(await listenableBooks(db, 'carol')).toEqual(['pa'])
  })

  it('gives nothing to a user no live wallet is shared with', async () => {
    await db.delete(walletMembers)
    expect(await listenableBooks(db, 'bob')).toEqual([])
    expect(await listenableBooks(db, 'alice')).toEqual([])
  })
})
