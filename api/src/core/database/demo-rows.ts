import { and, count, eq, isNull } from 'drizzle-orm'
import { users } from './schema/auth'
import { books } from './schema/book'
import { categories } from './schema/category'
import { debtEntries, debts } from './schema/debt'
import { events } from './schema/event'
import { recurringRules } from './schema/recurring'
import { transactions } from './schema/transaction'
import { transfers } from './schema/transfer'
import { wallets } from './schema/wallet'
import type { Executor } from './client'

// docs/features/demo.md rule 11: a demo user's own rows, which sync caps. The users table belongs
// to auth and the rows to many features, so the count lives here (like `live-access`).

const OWN_TABLES = [
  books,
  wallets,
  categories,
  transactions,
  transfers,
  recurringRules,
  debts,
  debtEntries,
  events,
] as const

/** How many live rows a demo user owns; null when the user isn't a demo. */
export const demoRowCount = async (executor: Executor, userId: string): Promise<number | null> => {
  const found = await executor
    .select({ isDemo: users.isDemo })
    .from(users)
    .where(eq(users.id, userId))
  if (found.at(0)?.isDemo !== true) {
    return null
  }
  let total = 0
  for (const table of OWN_TABLES) {
    const [row] = await executor
      .select({ n: count() })
      .from(table)
      .where(and(eq(table.userId, userId), isNull(table.deletedAt)))
    total += row.n
  }
  return total
}
