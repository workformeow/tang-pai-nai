import { migrate } from 'drizzle-orm/libsql/migrator'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { env } from '@/core/config'
import type { Database } from '@/core/database'
import { createDatabase } from '@/core/database/client'
import { users } from '@/core/database/schema/auth'
import type { SyncPushHandler, SyncRowWrite } from '@/core/sync'
import { makeTempDir, removeTempDir } from '@/shared/testing/temp-dir'
import { BOOK_MESSAGE } from './book.const'
import { bookSyncHandler } from './book.repository.drizzle'

let dir: string
let close: () => void
let db: Database

const push = bookSyncHandler.push as SyncPushHandler

const book = (id: string, name: string, changeSeq: number, extra: Partial<SyncRowWrite> = {}) => ({
  id,
  name,
  icon: 'lucideHouse',
  color: '#16a34a',
  sortOrder: 0,
  createdAt: 1000,
  updatedAt: 1000,
  deletedAt: null,
  changeSeq,
  updatedBy: 'alice',
  ...extra,
})

beforeEach(async () => {
  dir = makeTempDir('book')
  const created = createDatabase({ ...env, DATABASE_URL: `file:${join(dir, 'test.db')}` })
  await migrate(created.db, { migrationsFolder: 'drizzle' })
  await created.db.insert(users).values([
    { id: 'alice', email: 'a@example.com', displayName: 'a' },
    { id: 'bob', email: 'b@example.com', displayName: 'b' },
  ])
  db = created.db
  close = () => created.client.close()
})

afterEach(() => {
  close()
  removeTempDir(dir)
})

describe('bookSyncHandler', () => {
  it('writes a book and replaces it on the next write, without leaking userId', async () => {
    const written = await push.write(db, 'alice', book('p1', 'Home', 15))
    expect(written).toEqual(book('p1', 'Home', 15))
    await push.write(db, 'alice', book('p1', 'Shop', 16, { sortOrder: 3 }))
    expect(await push.find(db, 'p1')).toEqual({
      ownerId: 'alice',
      row: book('p1', 'Shop', 16, { sortOrder: 3 }),
    })
    expect(await push.find(db, 'nope')).toBeNull()
  })

  it("pulls only the user's books after the cursor, tombstones included", async () => {
    await push.write(db, 'alice', book('p1', 'A', 15))
    await push.write(db, 'bob', book('p2', 'B', 16, { updatedBy: 'bob' }))
    await push.write(db, 'alice', book('p3', 'C', 17, { deletedAt: 1000 }))
    const rows = await bookSyncHandler.pull(db, 'alice', 15, 10)
    expect(rows.map((row) => row.id)).toEqual(['p3'])
    expect(await bookSyncHandler.pull(db, 'alice', 0, 1)).toHaveLength(1)
    expect((await bookSyncHandler.pull(db, 'bob', 0, 10)).map((row) => row.id)).toEqual(['p2'])
  })

  it("refuses a name already used by another of the user's live books, in any case", async () => {
    await push.write(db, 'alice', book('p1', 'Home', 15))
    await push.write(db, 'alice', book('p2', 'Old', 16, { deletedAt: 1000 }))
    expect(await push.check(db, 'alice', book('p9', 'HOME', 0))).toBe(BOOK_MESSAGE.NAME_TAKEN)
    expect(await push.check(db, 'alice', book('p1', 'Home', 0))).toBeNull() // itself
    expect(await push.check(db, 'alice', book('p9', 'Old', 0))).toBeNull() // deleted
    expect(await push.check(db, 'bob', book('p9', 'Home', 0))).toBeNull() // someone else's
    expect(await push.check(db, 'alice', book('p9', 'Home', 0, { deletedAt: 5 }))).toBeNull()
  })

  it('refuses a 21st live book but lets the 20 be edited and a deleted one be replaced', async () => {
    for (let i = 1; i <= 20; i++) {
      await push.write(db, 'alice', book(`p${i}`, `P${i}`, 100 + i))
    }
    expect(await push.check(db, 'alice', book('p21', 'P21', 0))).toBe(BOOK_MESSAGE.TOO_MANY)
    expect(await push.check(db, 'alice', book('p20', 'Renamed', 0))).toBeNull()
    expect(await push.check(db, 'bob', book('b1', 'Mine', 0))).toBeNull()
    await push.write(db, 'alice', book('p20', 'P20', 200, { deletedAt: 2000 }))
    expect(await push.check(db, 'alice', book('p21', 'P21', 0))).toBeNull()
  })

  it('purges tombstones deleted before a time and answers the highest changeSeq removed', async () => {
    await push.write(db, 'alice', book('p1', 'A', 15, { deletedAt: 100 }))
    await push.write(db, 'alice', book('p2', 'B', 16, { deletedAt: 200 }))
    await push.write(db, 'alice', book('p3', 'C', 17, { deletedAt: 900 }))
    await push.write(db, 'alice', book('p4', 'D', 18))
    expect(await push.purge(db, 500)).toEqual({ removed: 2, maxSeq: 16 })
    expect(await push.purge(db, 500)).toEqual({ removed: 0, maxSeq: 0 })
  })
})
