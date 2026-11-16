import { and, eq, exists, isNull, or, sql } from 'drizzle-orm'
import { books } from './schema/book'
import { walletMembers, wallets } from './schema/wallet'
import type { Executor } from './client'

// Who hears a shared book's pokes (docs/features/live-sync.md rules 3, 6). Sync and live both
// read the sharing tables, which no other feature may import, so this lives here (like
// `wallet-access`).

/** A wallet a member may see (sharing rule 8): live, open, on a live book. */
const visible = and(
  isNull(wallets.deletedAt),
  eq(wallets.isArchived, false),
  isNull(books.deletedAt)
)

const hasMembers = (executor: Executor) =>
  exists(
    executor
      .select({ one: sql`1` })
      .from(walletMembers)
      .where(eq(walletMembers.walletId, wallets.id))
  )

/** The wallet's book when someone besides the owner may see the wallet, else null (rule 6). */
export const sharedBookOf = async (
  executor: Executor,
  walletId: string
): Promise<string | null> => {
  const row = (
    await executor
      .select({ bookId: wallets.bookId })
      .from(wallets)
      .innerJoin(books, eq(books.id, wallets.bookId))
      .where(and(eq(wallets.id, walletId), visible, hasMembers(executor)))
  ).at(0)
  return row?.bookId ?? null
}

/**
 * Rule 3: the books whose `book:` channel `userId` may hear: theirs or not, with at least
 * one live, shared wallet that `userId` owns or is a member of.
 */
export const listenableBooks = async (executor: Executor, userId: string): Promise<string[]> => {
  const rows = await executor
    .selectDistinct({ bookId: wallets.bookId })
    .from(wallets)
    .innerJoin(books, eq(books.id, wallets.bookId))
    .where(
      and(
        visible,
        hasMembers(executor),
        or(
          eq(wallets.userId, userId),
          exists(
            executor
              .select({ one: sql`1` })
              .from(walletMembers)
              .where(and(eq(walletMembers.walletId, wallets.id), eq(walletMembers.userId, userId)))
          )
        )
      )
    )
  return rows.map((row) => row.bookId)
}
