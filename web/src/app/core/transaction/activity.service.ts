import { computed, inject, Service, signal } from '@angular/core'
import { AuthStore } from '@/core/auth'
import { BookService } from '@/core/book'
import { CATEGORY_TABLE } from '@/core/category'
import { fromSql, OfflineService } from '@/core/offline'
import type { LocalDatabase, SqlValue } from '@/core/offline'
import { WALLET_TABLE } from '@/core/wallet'
import { ACTIVITY_MS, ACTOR_SQL, latestAction } from './activity'
import { toTransaction } from './transaction-rows'
import { TransactionService } from './transaction.service'
import { TRANSACTION_TABLE } from './transaction.type'
import type { ActivityItem, ActivityScope } from './transaction.type'

/**
 * Who else wrote in the current book (docs/features/shared-activity.md): the activity scope and
 * list, and the names behind `addedBy` (sharing rule 15). `core/sharing` fills `people` and
 * `shares` from its online reads; both live in memory only.
 */
@Service()
export class ActivityService {
  private offlineService = inject(OfflineService)
  private bookService = inject(BookService)
  private authStore = inject(AuthStore)
  private transactionService = inject(TransactionService)

  /** Names behind `addedBy`: the owner's members, a shared book's people. */
  people = signal<ReadonlyMap<string, string>>(new Map())
  /**
   * Per own book, what the owner's sharing read said (`core/sharing` `loadOwner`): the wallets
   * shared with at least one member and how many members there are.
   */
  shares = signal<ReadonlyMap<string, { walletIds: readonly string[]; members: number }>>(new Map())

  /**
   * The current book's activity scope (rules 1, 7), or null when it has none: a shared book in
   * use reaches all its wallets; an own book the wallets shared with someone plus any holding a
   * row someone else wrote in the last 90 days, so it stays after the sharing ends until that row
   * is 90 days old.
   */
  scope = computed<ActivityScope | null>(() => {
    const book = this.bookService.current()
    if (!book) {
      return null
    }
    if (this.bookService.isShared()) {
      return { walletIds: null, ended: false, expiresAt: null }
    }
    this.transactionService.today() // the 90 days move on with the date
    const me = this.authStore.user()?.id ?? ''
    const foreign = this.read(
      (db) =>
        db.selectObjects(
          `SELECT t.wallet_id AS wallet_id, MAX(t.updated_at) AS last
             FROM ${TRANSACTION_TABLE} t
             WHERE t.book_id = ? AND t.updated_at >= ? AND (${ACTOR_SQL}) IS NOT NULL
               AND (${ACTOR_SQL}) <> ?
             GROUP BY t.wallet_id`,
          [book.id, Date.now() - ACTIVITY_MS, me]
        ),
      []
    )
    const share = this.shares().get(book.id)
    const walletIds = [
      ...new Set([...(share?.walletIds ?? []), ...foreign.map((row) => String(row['wallet_id']))]),
    ]
    if (walletIds.length === 0) {
      return null
    }
    const last = foreign.reduce((max, row) => Math.max(max, Number(row['last'])), 0)
    return {
      walletIds,
      ended: share !== undefined && share.members === 0,
      expiresAt: last > 0 ? last + ACTIVITY_MS : null,
    }
  })

  /**
   * The current book's activity within `scope` (rules 1–4): its rows touched in the last 90
   * days, deleted ones included, newest action first.
   */
  list(scope: ActivityScope): ActivityItem[] {
    const book = this.bookService.current()
    if (!book) {
      return []
    }
    this.transactionService.today()
    const me = this.authStore.user()?.id ?? null
    const ownerId = this.bookService.shared()?.owner.id ?? me
    const pending = this.transactionService.pendingIds()
    const params: SqlValue[] = [book.id, Date.now() - ACTIVITY_MS]
    let wallets = ''
    if (scope.walletIds) {
      if (scope.walletIds.length === 0) {
        return []
      }
      wallets = `AND t.wallet_id IN (${scope.walletIds.map(() => '?').join(', ')})`
      params.push(...scope.walletIds)
    }
    return this.read(
      (db) =>
        db
          .selectObjects(
            `SELECT t.*, c.type AS c_type, c.name AS c_name, c.icon AS c_icon, c.color AS c_color,
               w.name AS w_name, w.currency_code AS w_currency
             FROM ${TRANSACTION_TABLE} t
             LEFT JOIN ${CATEGORY_TABLE} c ON c.id = t.category_id
             LEFT JOIN ${WALLET_TABLE} w ON w.id = t.wallet_id
             WHERE t.book_id = ? AND t.updated_at >= ? ${wallets}
             ORDER BY t.updated_at DESC, t.id DESC`,
            params
          )
          .map((row) => {
            const transaction = toTransaction(fromSql(TRANSACTION_TABLE, row))
            return {
              ...transaction,
              ...latestAction(transaction, ownerId, me, pending.has(transaction.id)),
              kind: 'transaction' as const,
              type: row['c_type'] === 'income' ? ('income' as const) : ('expense' as const),
              categoryName: String(row['c_name'] ?? ''),
              categoryIcon: String(row['c_icon'] ?? ''),
              categoryColor: String(row['c_color'] ?? ''),
              walletName: String(row['w_name'] ?? ''),
              currencyCode: String(row['w_currency'] ?? ''),
              eventName: null,
            }
          }),
      []
    )
  }

  /** What the owner's sharing read says about `bookId` (see `shares`). */
  setShares(bookId: string, walletIds: readonly string[], members: number): void {
    this.shares.update((map) => new Map(map).set(bookId, { walletIds, members }))
  }

  /** Adds names behind `addedBy` (sharing rule 15). */
  addPeople(people: readonly { id: string; displayName: string }[]): void {
    const next = new Map(this.people())
    for (const person of people) {
      next.set(person.id, person.displayName)
    }
    this.people.set(next)
  }

  private read<T>(work: (db: LocalDatabase) => T, fallback: T): T {
    this.offlineService.changes()
    return this.offlineService.isOpen() ? work(this.offlineService.db()) : fallback
  }
}
