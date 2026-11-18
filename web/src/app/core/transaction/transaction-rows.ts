import type { CategoryType } from '@/core/category'
import type { EntryItem, EventOption, Transaction } from './transaction.type'

// Rows as the local database gives them (after `fromSql`), and rule 13's order of the list.

export const toTransaction = (row: Record<string, unknown>): Transaction => ({
  id: String(row['id']),
  bookId: String(row['bookId']),
  walletId: String(row['walletId']),
  categoryId: String(row['categoryId']),
  amount: Number(row['amount']),
  occurredOn: String(row['occurredOn']),
  note: typeof row['note'] === 'string' ? row['note'] : '',
  excludeFromReport: row['excludeFromReport'] === true,
  recurringId: typeof row['recurringId'] === 'string' ? row['recurringId'] : null,
  debtId: typeof row['debtId'] === 'string' ? row['debtId'] : null,
  eventId: typeof row['eventId'] === 'string' ? row['eventId'] : null,
  addedBy: typeof row['addedBy'] === 'string' ? row['addedBy'] : null,
  updatedBy: typeof row['updatedBy'] === 'string' ? row['updatedBy'] : null,
  createdAt: Number(row['createdAt']),
  updatedAt: Number(row['updatedAt']),
  deletedAt: typeof row['deletedAt'] === 'number' ? row['deletedAt'] : null,
  changeSeq: typeof row['changeSeq'] === 'number' ? row['changeSeq'] : null,
})

export const toTransfer = (row: Record<string, unknown>) => ({
  id: String(row['id']),
  bookId: String(row['bookId']),
  fromWalletId: String(row['fromWalletId']),
  toWalletId: String(row['toWalletId']),
  amount: Number(row['amount']),
  occurredOn: String(row['occurredOn']),
  note: typeof row['note'] === 'string' ? row['note'] : '',
  recurringId: typeof row['recurringId'] === 'string' ? row['recurringId'] : null,
  createdAt: Number(row['createdAt']),
  updatedAt: Number(row['updatedAt']),
  deletedAt: typeof row['deletedAt'] === 'number' ? row['deletedAt'] : null,
  changeSeq: typeof row['changeSeq'] === 'number' ? row['changeSeq'] : null,
})

export const toEventOption = (row: Record<string, unknown>): EventOption => ({
  id: String(row['id']),
  name: typeof row['name'] === 'string' ? row['name'] : '',
  icon: typeof row['icon'] === 'string' ? row['icon'] : '',
  color: typeof row['color'] === 'string' ? row['color'] : '',
  startOn: typeof row['startOn'] === 'string' ? row['startOn'] : '',
  endOn: typeof row['endOn'] === 'string' ? row['endOn'] : null,
  isClosed: row['isClosed'] === true,
})

/** The sign of an amount from its category's type (rule 11): income +, expense −. */
export const signedAmount = (amount: number, type: CategoryType): number =>
  type === 'income' ? amount : -amount

/** Rule 13's order (negative: `a` shows first); a transfer's outgoing side before its incoming. */
const compareEntries = (a: EntryItem, b: EntryItem): number =>
  b.occurredOn.localeCompare(a.occurredOn) ||
  b.createdAt - a.createdAt ||
  b.id.localeCompare(a.id) ||
  (a.kind === 'transfer' && a.side === 'out' ? -1 : 0)

/** Two lists in rule 13's order merged into one (one pass). */
export const mergeEntries = (a: readonly EntryItem[], b: readonly EntryItem[]): EntryItem[] => {
  if (b.length === 0) {
    return [...a]
  }
  const merged: EntryItem[] = []
  let i = 0
  let j = 0
  while (i < a.length || j < b.length) {
    const x = a.at(i)
    const y = b.at(j)
    if (x && (!y || compareEntries(x, y) <= 0)) {
      merged.push(x)
      i++
    } else if (y) {
      merged.push(y)
      j++
    }
  }
  return merged
}
