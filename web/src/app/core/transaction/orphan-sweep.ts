import { CATEGORY_TABLE, followMerges, hasMergeLeftovers } from '@/core/category'
import { fromSql, queueWrite } from '@/core/offline'
import type { LocalDatabase } from '@/core/offline'
import { DEBT_ENTRY_TABLE, DEBT_TABLE, WALLET_TABLE } from '@/core/wallet'
import { toTransaction } from './transaction-rows'
import { TRANSACTION_TABLE } from './transaction.type'
import type { Transaction } from './transaction.type'

// Rule 10 (and debt rule 10): a wallet, category or debt deleted on a device that didn't hold
// all its rows leaves live ones behind; whichever device sees that tombstones the ones it holds.

/** Live transactions whose wallet or category is a tombstone here. */
const transactionOrphans = (db: LocalDatabase): Transaction[] =>
  db
    .selectObjects(
      `SELECT t.* FROM ${TRANSACTION_TABLE} t
       LEFT JOIN ${WALLET_TABLE} w ON w.id = t.wallet_id
       LEFT JOIN ${CATEGORY_TABLE} c ON c.id = t.category_id
       WHERE t.deleted_at IS NULL AND (w.deleted_at IS NOT NULL OR c.deleted_at IS NOT NULL)`
    )
    .map((row) => toTransaction(fromSql(TRANSACTION_TABLE, row)))

/** Live debts and entries left pointing at a tombstone here. */
const DEBT_ORPHANS = {
  // A repaid debt whose category is a tombstone (a merged one followed it already), or whose
  // book went (the book sweep covers that).
  debts: `SELECT d.* FROM ${DEBT_TABLE} d JOIN categories c ON c.id = d.category_id
          WHERE d.deleted_at IS NULL AND c.deleted_at IS NOT NULL`,
  // An entry whose debt or wallet is a tombstone.
  entries: `SELECT e.* FROM ${DEBT_ENTRY_TABLE} e
            LEFT JOIN ${DEBT_TABLE} d ON d.id = e.debt_id
            LEFT JOIN ${WALLET_TABLE} w ON w.id = e.wallet_id
            WHERE e.deleted_at IS NULL AND (d.deleted_at IS NOT NULL OR w.deleted_at IS NOT NULL)`,
} as const

/** Anything to sweep: a merged category's rows, an orphaned transaction, debt or entry. */
export const hasOrphans = (db: LocalDatabase): boolean =>
  hasMergeLeftovers(db) ||
  transactionOrphans(db).length > 0 ||
  db.selectObjects(`${DEBT_ORPHANS.debts} LIMIT 1`).length > 0 ||
  db.selectObjects(`${DEBT_ORPHANS.entries} LIMIT 1`).length > 0

/** Sweeps in one write: merged rows follow their category, orphans become tombstones. */
export const sweepOrphans = (db: LocalDatabase, now: number): void => {
  // A merged category's rows follow it instead (category rule 15).
  followMerges(db, now)
  for (const row of transactionOrphans(db)) {
    queueWrite(db, TRANSACTION_TABLE, 'delete', { ...row, updatedAt: now, deletedAt: now })
  }
  // The debts first, then every entry they leave.
  for (const [table, query] of [
    [DEBT_TABLE, DEBT_ORPHANS.debts],
    [DEBT_ENTRY_TABLE, DEBT_ORPHANS.entries],
  ] as const) {
    for (const row of db.selectObjects(query)) {
      queueWrite(db, table, 'delete', {
        ...fromSql(table, row),
        id: String(row['id']),
        updatedAt: now,
        deletedAt: now,
      })
    }
  }
}
