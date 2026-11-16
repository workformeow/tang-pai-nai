import { and, asc, count, eq, gt, isNull, lt, max, ne, sql } from 'drizzle-orm'
import type { Executor } from '@/core/database'
import { books } from '@/core/database/schema/book'
import { wrapUnexpected } from '@/core/error'
import type { SyncTableHandler } from '@/core/sync'
import { BOOK_LIMITS, BOOK_MESSAGE } from './book.const'
import { validateBook } from './book.schema'
import type { Book } from './book.entity'

type BookRow = typeof books.$inferSelect

const toBook = ({ userId: _userId, ...row }: BookRow): Book => row

const run = async <T>(operation: string, work: () => Promise<T>, metadata?: object) =>
  wrapUnexpected(work, { operation: `bookSync.${operation}`, metadata: { ...metadata } })

/** The user's other live books matching `extra`. */
const countLiveOthers = async (
  executor: Executor,
  userId: string,
  id: string,
  extra?: ReturnType<typeof sql>
) => {
  const [{ total }] = await executor
    .select({ total: count() })
    .from(books)
    .where(and(eq(books.userId, userId), isNull(books.deletedAt), ne(books.id, id), extra))
  return total
}

/** The books table's sync handler (docs/features/book.md rule 1). */
export const bookSyncHandler: SyncTableHandler = {
  table: 'books',
  pull: async (executor, userId, since, limit) =>
    run('pull', async () => {
      const rows = await executor
        .select()
        .from(books)
        .where(and(eq(books.userId, userId), gt(books.changeSeq, since)))
        .orderBy(asc(books.changeSeq))
        .limit(limit)
      return rows.map(toBook)
    }),
  push: {
    validate: validateBook,
    find: async (executor, id) =>
      run(
        'find',
        async () => {
          const rows = await executor.select().from(books).where(eq(books.id, id))
          const row = rows.at(0)
          return row ? { ownerId: row.userId, row: toBook(row) } : null
        },
        { id }
      ),
    // Rules a device can't check offline: a name unique among the user's live books (rule 2)
    // and at most 20 of them (rule 4). A tombstone breaks neither.
    check: async (executor, userId, row) =>
      run('check', async () => {
        if (row.deletedAt !== null) {
          return null
        }
        const name = String(row.name)
        const sameName = sql`lower(${books.name}) = lower(${name})`
        if ((await countLiveOthers(executor, userId, row.id, sameName)) > 0) {
          return BOOK_MESSAGE.NAME_TAKEN
        }
        if ((await countLiveOthers(executor, userId, row.id)) >= BOOK_LIMITS.PER_USER) {
          return BOOK_MESSAGE.TOO_MANY
        }
        return null
      }),
    write: async (executor, userId, row) =>
      run(
        'write',
        async () => {
          const values = {
            id: row.id,
            userId,
            name: String(row.name),
            icon: String(row.icon),
            color: String(row.color),
            sortOrder: Number(row.sortOrder),
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
            changeSeq: row.changeSeq,
            updatedBy: row.updatedBy,
          }
          const [written] = await executor
            .insert(books)
            .values(values)
            .onConflictDoUpdate({ target: books.id, set: values })
            .returning()
          return toBook(written)
        },
        { id: row.id }
      ),
    purge: async (executor, before) =>
      run('purge', async () => {
        const old = lt(books.deletedAt, before)
        const [{ maxSeq }] = await executor
          .select({ maxSeq: max(books.changeSeq) })
          .from(books)
          .where(old)
        const removed = await executor.delete(books).where(old).returning({ id: books.id })
        return { removed: removed.length, maxSeq: maxSeq ?? 0 }
      }),
  },
}
