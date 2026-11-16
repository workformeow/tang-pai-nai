import { and, asc, count, eq, gt, isNull, lt, max, ne } from 'drizzle-orm'
import type { Executor } from '@/core/database'
import { books } from '@/core/database/schema/book'
import { events } from '@/core/database/schema/event'
import { wrapUnexpected } from '@/core/error'
import type { SyncRowInput, SyncTableHandler } from '@/core/sync'
import { EVENT_LIMITS, EVENT_MESSAGE } from './event.const'
import { validateEvent } from './event.schema'
import type { Event } from './event.entity'

type EventRow = typeof events.$inferSelect

const toEvent = ({ userId: _userId, ...row }: EventRow): Event => row

const run = async <T>(operation: string, work: () => Promise<T>, metadata?: object) =>
  wrapUnexpected(work, { operation: `eventSync.${operation}`, metadata: { ...metadata } })

const findRow = async (executor: Executor, id: string) =>
  (await executor.select().from(events).where(eq(events.id, id))).at(0)

const isLiveBook = async (executor: Executor, userId: string, bookId: string) => {
  const rows = await executor
    .select({ id: books.id })
    .from(books)
    .where(and(eq(books.id, bookId), eq(books.userId, userId), isNull(books.deletedAt)))
  return rows.length > 0
}

/** Rules a device can't check offline (event rule 1); the message or null. */
const checkEvent = async (
  executor: Executor,
  userId: string,
  row: SyncRowInput
): Promise<string | null> => {
  // A tombstone breaks no rule (offline-sync rule 10: deletes run no check).
  if (row.deletedAt !== null) {
    return null
  }
  const bookId = String(row.bookId)
  const stored = await findRow(executor, row.id)
  if (stored && stored.bookId !== bookId) {
    return EVENT_MESSAGE.BOOK_FIXED
  }
  if (!(await isLiveBook(executor, userId, bookId))) {
    return EVENT_MESSAGE.BOOK_GONE
  }
  // At most 50 open events per book; a stored live open one already counts.
  if (row.isClosed === true || (stored && stored.deletedAt === null && !stored.isClosed)) {
    return null
  }
  const [{ total }] = await executor
    .select({ total: count() })
    .from(events)
    .where(
      and(
        eq(events.bookId, bookId),
        isNull(events.deletedAt),
        eq(events.isClosed, false),
        ne(events.id, row.id)
      )
    )
  return total >= EVENT_LIMITS.OPEN_PER_BOOK ? EVENT_MESSAGE.LIMIT : null
}

/** The events table's sync handler (docs/features/event.md rule 1). */
export const eventSyncHandler: SyncTableHandler = {
  table: 'events',
  pull: async (executor, userId, since, limit) =>
    run('pull', async () => {
      const rows = await executor
        .select()
        .from(events)
        .where(and(eq(events.userId, userId), gt(events.changeSeq, since)))
        .orderBy(asc(events.changeSeq))
        .limit(limit)
      return rows.map(toEvent)
    }),
  push: {
    validate: validateEvent,
    find: async (executor, id) =>
      run(
        'find',
        async () => {
          const row = await findRow(executor, id)
          return row ? { ownerId: row.userId, row: toEvent(row) } : null
        },
        { id }
      ),
    check: async (executor, userId, row) =>
      run('check', async () => checkEvent(executor, userId, row), { id: row.id }),
    write: async (executor, userId, row) =>
      run(
        'write',
        async () => {
          const values = {
            id: row.id,
            userId,
            bookId: String(row.bookId),
            name: String(row.name),
            icon: String(row.icon),
            color: String(row.color),
            startOn: String(row.startOn),
            endOn: typeof row.endOn === 'string' ? row.endOn : null,
            isClosed: row.isClosed === true,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt,
            deletedAt: row.deletedAt,
            changeSeq: row.changeSeq,
            updatedBy: row.updatedBy,
          }
          const [written] = await executor
            .insert(events)
            .values(values)
            .onConflictDoUpdate({ target: events.id, set: values })
            .returning()
          return toEvent(written)
        },
        { id: row.id }
      ),
    purge: async (executor, before) =>
      run('purge', async () => {
        const old = lt(events.deletedAt, before)
        const [{ maxSeq }] = await executor
          .select({ maxSeq: max(events.changeSeq) })
          .from(events)
          .where(old)
        const removed = await executor.delete(events).where(old).returning({ id: events.id })
        return { removed: removed.length, maxSeq: maxSeq ?? 0 }
      }),
  },
}
