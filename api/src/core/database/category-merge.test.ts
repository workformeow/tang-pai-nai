import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/core/config'
import { makeTempDir, removeTempDir } from '@/shared/testing/temp-dir'
import { findMergeTarget } from './category-merge'
import { createDatabase } from './client'
import { users } from './schema/auth'
import { books } from './schema/book'
import { categories } from './schema/category'
import type { Database } from './client'

let dir: string
let close: () => void
let db: Database

const sync = (userId: string) => ({ createdAt: 1, updatedAt: 1, changeSeq: 1, updatedBy: userId })

const category = (
  id: string,
  extra: Partial<typeof categories.$inferInsert> = {}
): typeof categories.$inferInsert => ({
  id,
  userId: 'alice',
  bookId: 'pa',
  type: 'expense',
  parentId: null,
  name: id,
  icon: 'lucideShapes',
  color: '#475569',
  isArchived: false,
  sortOrder: 0,
  mergedIntoId: null,
  deletedAt: null,
  ...sync('alice'),
  ...extra,
})

const merged = (id: string, into: string, extra: Partial<typeof categories.$inferInsert> = {}) =>
  category(id, { deletedAt: 900, mergedIntoId: into, ...extra })

beforeEach(async () => {
  dir = makeTempDir('merge')
  const created = createDatabase({ ...env, DATABASE_URL: `file:${join(dir, 'test.db')}` })
  await migrate(created.db, { migrationsFolder: 'drizzle' })
  await created.db.insert(users).values([
    { id: 'alice', email: 'a@example.com', displayName: 'a' },
    { id: 'bob', email: 'b@example.com', displayName: 'b' },
  ])
  const book = (id: string, userId: string) => ({
    id,
    userId,
    name: id,
    icon: 'lucideHouse',
    color: '#15803d',
    sortOrder: 0,
    deletedAt: null,
    ...sync(userId),
  })
  await created.db
    .insert(books)
    .values([book('pa', 'alice'), book('pa2', 'alice'), book('pb', 'bob')])
  db = created.db
  close = () => created.client.close()
})

afterEach(() => {
  close()
  removeTempDir(dir)
})

describe('findMergeTarget', () => {
  it('answers the live category a merged tombstone went into, archived included', async () => {
    await db
      .insert(categories)
      .values([category('rice', { isArchived: true }), merged('water', 'rice')])
    expect((await findMergeTarget(db, 'alice', 'water'))?.id).toBe('rice')
  })

  it('follows later merges, up to five', async () => {
    await db
      .insert(categories)
      .values([
        category('end'),
        merged('m1', 'm2'),
        merged('m2', 'm3'),
        merged('m3', 'm4'),
        merged('m4', 'm5'),
        merged('m5', 'end'),
        merged('m0', 'm1'),
      ])
    expect((await findMergeTarget(db, 'alice', 'm1'))?.id).toBe('end')
    expect(await findMergeTarget(db, 'alice', 'm0')).toBeNull()
  })

  it('answers null for a live category, a plain tombstone, an unknown id or a dead end', async () => {
    await db
      .insert(categories)
      .values([
        category('live'),
        category('plain', { deletedAt: 900 }),
        merged('toPlain', 'plain'),
        merged('toNowhere', 'nope'),
      ])
    for (const id of ['live', 'plain', 'nope', 'toPlain', 'toNowhere']) {
      expect(await findMergeTarget(db, 'alice', id)).toBeNull()
    }
  })

  it("never leads to another owner's, book's or type's category, or its own child", async () => {
    await db
      .insert(categories)
      .values([
        category('bobs', { userId: 'bob', bookId: 'pb', ...sync('bob') }),
        category('other', { bookId: 'pa2' }),
        category('salary', { type: 'income' }),
        merged('toBob', 'bobs'),
        merged('toOther', 'other'),
        merged('toSalary', 'salary'),
        merged('home', 'rent'),
        category('rent', { parentId: 'home' }),
      ])
    for (const id of ['toBob', 'toOther', 'toSalary', 'home']) {
      expect(await findMergeTarget(db, 'alice', id)).toBeNull()
    }
    expect(await findMergeTarget(db, 'bob', 'toBob')).toBeNull()
  })
})
