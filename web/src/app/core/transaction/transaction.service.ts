import { DOCUMENT } from '@angular/common'
import { computed, effect, inject, Service, signal, untracked } from '@angular/core'
import { BookService } from '@/core/book'
import { CATEGORY_TABLE } from '@/core/category'
import type { CategoryType } from '@/core/category'
import { deleteOp, fromSql, OfflineService, queueWrite, SyncService, uuidv7 } from '@/core/offline'
import type { LocalDatabase, SqlValue } from '@/core/offline'
import {
  DEBT_ENTRY_SIGN_SQL,
  DEBT_ENTRY_TABLE,
  DEBT_TABLE,
  WALLET_TABLE,
  WalletService,
} from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { addDays, toDay } from '@/shared/utils'
import { hasOrphans, sweepOrphans } from './orphan-sweep'
import { PERIOD_UNITS, periodRange, periodTabs } from './period'
import { mergeEntries, toEventOption, toTransaction, toTransfer } from './transaction-rows'
import {
  EVENT_TABLE,
  TRANSACTION_PREF_PREFIX,
  TRANSACTION_TABLE,
  TRANSFER_TABLE,
} from './transaction.type'
import type { PeriodTab, PeriodUnit } from './period'
import type {
  DayRange,
  DebtEntryItem,
  EntryItem,
  EventOption,
  ListFilter,
  MoneySummary,
  Transaction,
  TransactionItem,
  TransactionSheetState,
  TransactionValues,
  TransferItem,
} from './transaction.type'

/** Rule 13: newest day first, then the one recorded last. */
const ORDER = 'ORDER BY t.occurred_on DESC, t.created_at DESC, t.id DESC'

/**
 * The current book's transactions on this device (docs/features/transaction.md). Reads come
 * from the local database through its indexes (Volume); every write goes through the outbox.
 * Also holds the Transactions tab's view (wallet, period) and the transaction sheet's state.
 * Who else wrote in the book is `ActivityService`.
 */
@Service()
export class TransactionService {
  private offlineService = inject(OfflineService)
  private syncService = inject(SyncService)
  private bookService = inject(BookService)
  private walletService = inject(WalletService)
  private window = inject(DOCUMENT).defaultView

  canWrite = this.bookService.canWrite
  serverDown = this.bookService.serverDown
  /** The device's date, refreshed when the app comes back and every minute. */
  today = signal(toDay())
  /** Transactions and transfers with an op still waiting to sync ("รอ sync"). */
  pendingIds = computed(
    () =>
      new Set(
        this.read(
          (db) =>
            db
              .selectObjects(
                `SELECT row_id FROM outbox WHERE tbl IN (?, ?, ?) AND status = 'pending'`,
                [TRANSACTION_TABLE, TRANSFER_TABLE, DEBT_ENTRY_TABLE]
              )
              .map((row) => String(row['row_id'])),
          []
        )
      )
  )

  // ── The transaction sheet ──────────────────────────────────────────────────

  /** The open transaction sheet (sheets/transaction-sheet), if any. */
  sheet = signal<TransactionSheetState | null>(null)

  open(state: TransactionSheetState): void {
    this.sheet.set(state)
  }

  /** "Fix" from the sync sheet: the refused values of a rejected transaction op. */
  openFix(opId: string): void {
    const op = this.syncService.rejectedOp(opId)
    if (!op || op.table !== TRANSACTION_TABLE) {
      return
    }
    const row = op.row
    const text = (key: string) => (typeof row[key] === 'string' ? row[key] : '')
    const bookId = text('bookId')
    this.open({
      mode: 'fix',
      opId,
      id: op.rowId,
      bookId: this.bookService.byId(bookId) ? bookId : (this.bookService.current()?.id ?? bookId),
      values: {
        walletId: text('walletId'),
        categoryId: text('categoryId'),
        amount: typeof row['amount'] === 'number' ? row['amount'] : 0,
        occurredOn: text('occurredOn'),
        note: text('note'),
        excludeFromReport: row['excludeFromReport'] === true,
        debtId: text('debtId') || null,
        eventId: text('eventId') || null,
      },
    })
  }

  // ── The Transactions tab's view (transaction.md → Web screens) ─────────────
  // Shared by the header (wallet switcher, ⋮ "ดูตาม") and the page. The wallet and the unit
  // are remembered per book.

  /** The chosen wallet, or null for "ทุกกระเป๋า". */
  viewWalletId = signal<string | null>(null)
  unit = signal<PeriodUnit>('month')
  tab = signal<PeriodTab>(0)
  custom = signal<DayRange>({ from: null, to: null })
  /** The header's wallet switcher sheet and the custom range sheet. */
  walletSheet = signal(false)
  customSheet = signal(false)

  /** The chosen wallet while it's live, else null ("ทุกกระเป๋า"). */
  viewWallet = computed<Wallet | null>(() => {
    const id = this.viewWalletId()
    return this.walletService.wallets().find((wallet) => wallet.id === id) ?? null
  })
  /**
   * Rule 11's "all wallets": the book's wallets without `excludeFromTotal`, and credit cards
   * (credit-card rule 2), archived ones included (their history stays); or the one chosen.
   */
  viewWalletIds = computed<string[]>(() => {
    const wallet = this.viewWallet()
    if (wallet) {
      return [wallet.id]
    }
    return this.walletService
      .wallets()
      .filter((item) => !item.excludeFromTotal || item.isCreditCard)
      .map((item) => item.id)
  })
  /** The book's oldest transaction or transfer day, where the period tabs start. */
  firstDay = computed<string | null>(() => {
    const bookId = this.bookService.current()?.id
    if (!bookId) {
      return null
    }
    return this.read((db) => {
      const value = db.selectValue(
        `SELECT min(day) FROM (
           SELECT min(occurred_on) AS day FROM ${TRANSACTION_TABLE}
           WHERE book_id = ? AND deleted_at IS NULL
           UNION ALL
           SELECT min(occurred_on) FROM ${TRANSFER_TABLE} WHERE book_id = ? AND deleted_at IS NULL
           UNION ALL
           SELECT min(occurred_on) FROM ${DEBT_ENTRY_TABLE}
           WHERE book_id = ? AND deleted_at IS NULL AND wallet_id IS NOT NULL
         )`,
        [bookId, bookId, bookId]
      )
      return typeof value === 'string' ? value : null
    }, null)
  })
  tabs = computed(() => periodTabs(this.unit(), this.today(), this.firstDay()))
  range = computed(() => periodRange(this.unit(), this.tab(), this.today(), this.custom()))
  items = computed(() => this.entries(this.range(), this.viewWalletIds()))
  summaryLines = computed(() => this.summary(this.range(), this.viewWalletIds()))

  constructor() {
    // Each book has its own remembered wallet and unit; a new book starts on "ทุกกระเป๋า".
    effect(() => {
      const bookId = this.bookService.currentId() ?? ''
      untracked(() => {
        const saved = this.readView(bookId)
        this.viewWalletId.set(saved.walletId)
        this.unit.set(saved.unit)
        this.tab.set(0)
      })
    })
    const refresh = () => this.today.set(toDay())
    this.window?.document.addEventListener('visibilitychange', refresh)
    this.window?.setInterval(refresh, 60_000)
    // Rule 10 (orphan-sweep.ts): rows left pointing at a tombstone here become tombstones too.
    effect(() => {
      this.offlineService.changes()
      if (!this.canWrite()) {
        return
      }
      untracked(() => {
        if (hasOrphans(this.offlineService.db())) {
          const now = Date.now()
          this.offlineService.write((tx) => sweepOrphans(tx, now))
        }
      })
    })
  }

  /** Chooses the wallet the tab shows (null: "ทุกกระเป๋า"); remembered for the book. */
  selectWallet(id: string | null): void {
    this.viewWalletId.set(id)
    this.writeView()
  }

  /** Chooses "ดูตาม"; the tabs start again on the current period. */
  selectUnit(unit: PeriodUnit): void {
    this.unit.set(unit)
    this.tab.set(0)
    this.writeView()
  }

  /** A custom range (from ≤ to). */
  selectCustom(range: DayRange): void {
    this.custom.set(range)
    this.selectUnit('custom')
  }

  // ── Reading the list ───────────────────────────────────────────────────────

  /**
   * The current book's live transactions in `range` (in order, rule 13), with their category
   * and wallet; only `walletIds` when given.
   */
  list(
    range: DayRange,
    walletIds: readonly string[] | null = null,
    filter: ListFilter = {}
  ): TransactionItem[] {
    const where = this.where(range, walletIds, filter)
    if (!where) {
      return []
    }
    return this.read(
      (db) =>
        db
          .selectObjects(
            `SELECT t.*, c.type AS c_type, c.name AS c_name, c.icon AS c_icon, c.color AS c_color,
               w.name AS w_name, w.currency_code AS w_currency, ev.name AS ev_name
             FROM ${TRANSACTION_TABLE} t
             LEFT JOIN ${CATEGORY_TABLE} c ON c.id = t.category_id
             LEFT JOIN ${WALLET_TABLE} w ON w.id = t.wallet_id
             LEFT JOIN ${EVENT_TABLE} ev ON ev.id = t.event_id AND ev.deleted_at IS NULL
             WHERE ${where.sql} ${ORDER}`,
            where.params
          )
          .map((row) => ({
            ...toTransaction(fromSql(TRANSACTION_TABLE, row)),
            kind: 'transaction' as const,
            type: row['c_type'] === 'income' ? 'income' : 'expense',
            categoryName: String(row['c_name'] ?? ''),
            categoryIcon: String(row['c_icon'] ?? ''),
            categoryColor: String(row['c_color'] ?? ''),
            walletName: String(row['w_name'] ?? ''),
            currencyCode: String(row['w_currency'] ?? ''),
            eventName: typeof row['ev_name'] === 'string' ? row['ev_name'] : null,
          })),
      []
    )
  }

  /**
   * The list's rows (rule 13's order): `list` merged with the transfer sides in view, a
   * transfer's outgoing side first (transfer → Web screens, Q5).
   */
  entries(range: DayRange, walletIds: readonly string[] | null = null): EntryItem[] {
    const transactions = this.list(range, walletIds)
    const sides = mergeEntries(
      this.transferSides(range, walletIds),
      this.debtEntries(range, walletIds)
    )
    if (sides.length === 0) {
      return transactions
    }
    return mergeEntries(transactions, sides)
  }

  /**
   * The sides of the current book's live transfers in `range` whose wallet is in
   * `walletIds` (all when null), in rule 13's order, the outgoing side first.
   */
  transferSides(range: DayRange, walletIds: readonly string[] | null = null): TransferItem[] {
    const bookId = this.bookService.current()?.id
    if (!bookId || walletIds?.length === 0) {
      return []
    }
    const side = (here: 'from' | 'to') => {
      const other = here === 'from' ? 'to' : 'from'
      const parts = ['r.book_id = ?', 'r.deleted_at IS NULL']
      const params: SqlValue[] = [bookId]
      if (range.from) {
        parts.push('r.occurred_on >= ?')
        params.push(range.from)
      }
      if (range.to) {
        parts.push('r.occurred_on <= ?')
        params.push(range.to)
      }
      if (walletIds) {
        parts.push(`r.${here}_wallet_id IN (${walletIds.map(() => '?').join(', ')})`)
        params.push(...walletIds)
      }
      return {
        sql: `SELECT r.*, '${here === 'from' ? 'out' : 'in'}' AS side,
                r.${here}_wallet_id AS here_id, wh.name AS here_name,
                wh.currency_code AS here_currency,
                r.${other}_wallet_id AS other_id, wo.name AS other_name
              FROM ${TRANSFER_TABLE} r
              LEFT JOIN ${WALLET_TABLE} wh ON wh.id = r.${here}_wallet_id
              LEFT JOIN ${WALLET_TABLE} wo ON wo.id = r.${other}_wallet_id
              WHERE ${parts.join(' AND ')}`,
        params,
      }
    }
    const out = side('from')
    const into = side('to')
    return this.read(
      (db) =>
        db
          .selectObjects(
            `${out.sql} UNION ALL ${into.sql}
             ORDER BY occurred_on DESC, created_at DESC, id DESC, side DESC`,
            [...out.params, ...into.params]
          )
          .map((row) => ({
            ...toTransfer(fromSql(TRANSFER_TABLE, row)),
            kind: 'transfer' as const,
            side: row['side'] === 'in' ? ('in' as const) : ('out' as const),
            walletId: String(row['here_id']),
            walletName: String(row['here_name'] ?? ''),
            otherWalletId: String(row['other_id']),
            otherWalletName: String(row['other_name'] ?? ''),
            currencyCode: String(row['here_currency'] ?? ''),
          })),
      []
    )
  }

  /**
   * The current book's live debt entries with a wallet in `range` whose wallet is in
   * `walletIds` (all when null), in rule 13's order (debt → Web screens).
   */
  debtEntries(range: DayRange, walletIds: readonly string[] | null = null): DebtEntryItem[] {
    const bookId = this.bookService.current()?.id
    if (!bookId || walletIds?.length === 0) {
      return []
    }
    const parts = ['e.book_id = ?', 'e.deleted_at IS NULL', 'e.wallet_id IS NOT NULL']
    const params: SqlValue[] = [bookId]
    if (range.from) {
      parts.push('e.occurred_on >= ?')
      params.push(range.from)
    }
    if (range.to) {
      parts.push('e.occurred_on <= ?')
      params.push(range.to)
    }
    if (walletIds) {
      parts.push(`e.wallet_id IN (${walletIds.map(() => '?').join(', ')})`)
      params.push(...walletIds)
    }
    return this.read(
      (db) =>
        db
          .selectObjects(
            `SELECT e.*, d.direction AS d_direction, d.person AS d_person,
               ${DEBT_ENTRY_SIGN_SQL} AS signed, w.name AS w_name, w.currency_code AS w_currency
             FROM ${DEBT_ENTRY_TABLE} e
             JOIN ${DEBT_TABLE} d ON d.id = e.debt_id
             LEFT JOIN ${WALLET_TABLE} w ON w.id = e.wallet_id
             WHERE ${parts.join(' AND ')}
             ORDER BY e.occurred_on DESC, e.created_at DESC, e.id DESC`,
            params
          )
          .map((row) => ({
            kind: 'debt' as const,
            id: String(row['id']),
            debtId: String(row['debt_id']),
            entryKind:
              row['kind'] === 'principal' ? ('principal' as const) : ('repayment' as const),
            direction: row['d_direction'] === 'lent' ? ('lent' as const) : ('borrowed' as const),
            person: String(row['d_person'] ?? ''),
            walletId: String(row['wallet_id']),
            walletName: String(row['w_name'] ?? ''),
            currencyCode: String(row['w_currency'] ?? ''),
            signed: Number(row['signed']),
            amount: Number(row['amount']),
            occurredOn: String(row['occurred_on']),
            note: typeof row['note'] === 'string' ? row['note'] : '',
            recurringId: typeof row['recurring_id'] === 'string' ? row['recurring_id'] : null,
            createdAt: Number(row['created_at']),
          })),
      []
    )
  }

  /** Rule 11: income, expense and net per currency, leaving out `excludeFromReport` rows. */
  summary(range: DayRange, walletIds: readonly string[] | null = null): MoneySummary[] {
    const where = this.where(range, walletIds)
    if (!where) {
      return []
    }
    const sums = new Map<
      string,
      { income: number; expense: number; transfer: number; debt: number; cardExpense: number }
    >()
    const empty = () => ({ income: 0, expense: 0, transfer: 0, debt: 0, cardExpense: 0 })
    const rows = this.read(
      (db) =>
        db.selectObjects(
          `SELECT w.currency_code AS currency, c.type AS type, w.is_credit_card AS card,
             sum(t.amount) AS total
           FROM ${TRANSACTION_TABLE} t
           JOIN ${CATEGORY_TABLE} c ON c.id = t.category_id
           JOIN ${WALLET_TABLE} w ON w.id = t.wallet_id
           WHERE ${where.sql} AND t.exclude_from_report = 0
           GROUP BY w.currency_code, c.type, w.is_credit_card`,
          where.params
        ),
      []
    )
    for (const row of rows) {
      const code = String(row['currency'])
      const sum = sums.get(code) ?? empty()
      const total = Number(row['total'])
      if (row['type'] === 'income') {
        sum.income += total
      } else {
        sum.expense += total
        sum.cardExpense += row['card'] ? total : 0
      }
      sums.set(code, sum)
    }
    // Transfer rule 5: never income or expense; their net in view explains the balance.
    for (const item of this.transferSides(range, walletIds)) {
      const sum = sums.get(item.currencyCode) ?? empty()
      sum.transfer += walletIds ? (item.side === 'in' ? item.amount : -item.amount) : 0
      sums.set(item.currencyCode, sum)
    }
    // Debt rule 7: never income or expense either; their net in view is the "หนี้" line.
    for (const item of this.debtEntries(range, walletIds)) {
      const sum = sums.get(item.currencyCode) ?? empty()
      sum.debt += item.signed
      sums.set(item.currencyCode, sum)
    }
    return [...sums.entries()]
      .sort(([a], [b]) => this.walletService.compareCurrency(a, b))
      .map(([currencyCode, { income, expense, transfer, debt, cardExpense }]) => ({
        currencyCode,
        minorUnit: this.walletService.minorUnit(currencyCode),
        income,
        expense,
        net: income - expense,
        transfer,
        debt,
        cardExpense,
      }))
  }

  // ── What the transaction form starts with and offers ───────────────────────

  /** The wallet a new transaction starts on: the last one used here, if still open. */
  defaultWalletId(bookId = this.bookService.current()?.id ?? ''): string | null {
    const open = this.walletService.openWallets()
    const last = this.storage()?.getItem(`${TRANSACTION_PREF_PREFIX}${bookId}`)
    return open.find((wallet) => wallet.id === last)?.id ?? open.at(0)?.id ?? null
  }

  /** The type a new transaction starts on: the last one added in the book here (8.2). */
  lastType(bookId = this.bookService.current()?.id ?? ''): CategoryType {
    try {
      return this.storage()?.getItem(`${TRANSACTION_PREF_PREFIX}type:${bookId}`) === 'income'
        ? 'income'
        : 'expense'
    } catch {
      return 'expense'
    }
  }

  rememberType(type: CategoryType, bookId = this.bookService.current()?.id ?? ''): void {
    try {
      this.storage()?.setItem(`${TRANSACTION_PREF_PREFIX}type:${bookId}`, type)
    } catch {
      // A full or blocked storage only loses the convenience.
    }
  }

  /**
   * "ใช้บ่อย" (8.2): ids of the book's `type` categories with the most live transactions dated
   * in the last `days` days, ties to the one recorded last. Through the (`book_id`,
   * `occurred_on`) index; the picker keeps those it offers.
   */
  frequentCategoryIds(bookId: string, type: CategoryType, days = 90, limit = 12): string[] {
    if (!bookId) {
      return []
    }
    return this.read(
      (db) =>
        db
          .selectObjects(
            `SELECT t.category_id AS id, count(*) AS uses, max(t.created_at) AS last
             FROM ${TRANSACTION_TABLE} t
             JOIN ${CATEGORY_TABLE} c ON c.id = t.category_id
             WHERE t.book_id = ? AND t.deleted_at IS NULL AND t.occurred_on >= ? AND c.type = ?
             GROUP BY t.category_id
             ORDER BY uses DESC, last DESC
             LIMIT ?`,
            [bookId, addDays(this.today(), -days), type, limit]
          )
          .map((row) => String(row['id'])),
      []
    )
  }

  /**
   * The book's live events the form offers (event rule 3): open ones by `startOn` desc, then
   * the latest created; plus `keepId` when the row already has it (a closed one stays on edit).
   */
  eventOptions(bookId: string, keepId: string | null = null): EventOption[] {
    return this.read(
      (db) =>
        db
          .selectObjects(
            `SELECT * FROM ${EVENT_TABLE}
              WHERE book_id = ? AND deleted_at IS NULL AND (is_closed = 0 OR id = ?)
              ORDER BY is_closed, start_on DESC, created_at DESC, id DESC`,
            [bookId, keepId ?? '']
          )
          .map((row) => toEventOption(fromSql(EVENT_TABLE, row))),
      []
    )
  }

  /** Event rule 5: the open event whose dates hold `day` (the latest start), or null. */
  defaultEventId(bookId: string, day: string): string | null {
    return (
      this.eventOptions(bookId).find(
        (event) =>
          !event.isClosed && event.startOn <= day && (event.endOn === null || day <= event.endOn)
      )?.id ?? null
    )
  }

  /** `id` when it names a live event, else null (a deleted event's rows keep its id, rule 7). */
  liveEventId(id: string | null | undefined): string | null {
    if (!id) {
      return null
    }
    return this.read(
      (db) =>
        db.selectValue(`SELECT 1 FROM ${EVENT_TABLE} WHERE id = ? AND deleted_at IS NULL`, [id]) ===
        1
          ? id
          : null,
      null
    )
  }

  /** The person of a live debt (the form's "หนี้" row, debt rule 3), or null. */
  debtPerson(id: string | null): string | null {
    if (!id) {
      return null
    }
    return this.read((db) => {
      const value = db.selectValue(
        `SELECT person FROM ${DEBT_TABLE} WHERE id = ? AND deleted_at IS NULL`,
        [id]
      )
      return typeof value === 'string' ? value : null
    }, null)
  }

  // ── Writing ────────────────────────────────────────────────────────────────

  /** A live transaction of any book on this device. */
  byId(id: string): Transaction | null {
    return this.read((db) => {
      const row = this.find(db, id)
      return row?.deletedAt === null ? row : null
    }, null)
  }

  /**
   * Creates (`id` null) or updates a transaction in the current book (a fix: the op's
   * book); a fix also drops the rejected op. Remembers the wallet for the next add.
   */
  save(
    id: string | null,
    values: TransactionValues,
    fixOpId: string | null = null,
    bookId = this.bookService.current()?.id ?? ''
  ): string {
    const now = Date.now()
    const rowId = id ?? uuidv7(now)
    this.offlineService.write((db) => {
      const current = this.find(db, rowId)
      queueWrite(db, TRANSACTION_TABLE, 'upsert', {
        ...current,
        id: rowId,
        bookId: current?.bookId ?? bookId,
        walletId: values.walletId,
        categoryId: values.categoryId,
        amount: values.amount,
        occurredOn: values.occurredOn,
        note: values.note.trim(),
        excludeFromReport: values.excludeFromReport,
        debtId: values.debtId === undefined ? (current?.debtId ?? null) : values.debtId,
        eventId: values.eventId === undefined ? (current?.eventId ?? null) : values.eventId,
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      })
      if (fixOpId) {
        deleteOp(db, fixOpId)
      }
    })
    this.rememberWallet(bookId, values.walletId)
    return rowId
  }

  /** Rule 7: a tombstone at once; `restore` is the toast's undo. */
  remove(id: string): void {
    const now = Date.now()
    this.offlineService.write((db) => {
      const current = this.find(db, id)
      if (current) {
        queueWrite(db, TRANSACTION_TABLE, 'delete', { ...current, updatedAt: now, deletedAt: now })
      }
    })
  }

  /** Undo of `remove`: the tombstone becomes live again (offline-sync rule 12). */
  restore(id: string): void {
    const now = Date.now()
    this.offlineService.write((db) => {
      const current = this.find(db, id)
      if (current && current.deletedAt !== null) {
        queueWrite(db, TRANSACTION_TABLE, 'upsert', { ...current, updatedAt: now, deletedAt: null })
      }
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  /** The WHERE clause of `list` / `summary`, or null when no wallet is chosen. */
  private where(
    range: DayRange,
    walletIds: readonly string[] | null,
    filter: ListFilter = {}
  ): { sql: string; params: SqlValue[] } | null {
    const bookId = this.bookService.current()?.id
    if (!bookId || walletIds?.length === 0) {
      return null
    }
    const parts = ['t.book_id = ?', 't.deleted_at IS NULL']
    const params: SqlValue[] = [bookId]
    if (range.from) {
      parts.push('t.occurred_on >= ?')
      params.push(range.from)
    }
    if (range.to) {
      parts.push('t.occurred_on <= ?')
      params.push(range.to)
    }
    if (walletIds) {
      parts.push(`t.wallet_id IN (${walletIds.map(() => '?').join(', ')})`)
      params.push(...walletIds)
    }
    if (filter.categoryIds) {
      parts.push(`t.category_id IN (${filter.categoryIds.map(() => '?').join(', ') || 'NULL'})`)
      params.push(...filter.categoryIds)
    }
    if (filter.report) {
      parts.push(`t.exclude_from_report = ${filter.report === 'excluded' ? 1 : 0}`)
    }
    if (filter.eventId) {
      parts.push('t.event_id = ?')
      params.push(filter.eventId)
    }
    if (filter.currencyCode) {
      parts.push(`t.wallet_id IN (SELECT id FROM ${WALLET_TABLE} WHERE currency_code = ?)`)
      params.push(filter.currencyCode)
    }
    return { sql: parts.join(' AND '), params }
  }

  private readView(bookId: string): { walletId: string | null; unit: PeriodUnit } {
    try {
      const raw = this.storage()?.getItem(`${TRANSACTION_PREF_PREFIX}view:${bookId}`)
      const parsed: unknown = raw ? JSON.parse(raw) : null
      if (parsed && typeof parsed === 'object') {
        const { walletId, unit } = parsed as Record<string, unknown>
        return {
          walletId: typeof walletId === 'string' ? walletId : null,
          // A custom range isn't kept, so it comes back as a month.
          unit:
            PERIOD_UNITS.includes(unit as PeriodUnit) && unit !== 'custom'
              ? (unit as PeriodUnit)
              : 'month',
        }
      }
    } catch {
      // A blocked or broken storage only loses the convenience.
    }
    return { walletId: null, unit: 'month' }
  }

  private writeView(): void {
    const bookId = this.bookService.current()?.id
    if (!bookId) {
      return
    }
    try {
      this.storage()?.setItem(
        `${TRANSACTION_PREF_PREFIX}view:${bookId}`,
        JSON.stringify({ walletId: this.viewWalletId(), unit: this.unit() })
      )
    } catch {
      // As above.
    }
  }

  private rememberWallet(bookId: string, walletId: string): void {
    try {
      this.storage()?.setItem(`${TRANSACTION_PREF_PREFIX}${bookId}`, walletId)
    } catch {
      // A full or blocked storage only loses the convenience.
    }
  }

  /** Lasting on a trusted device, for the tab's life on an untrusted one (like the book). */
  private storage(): Storage | null {
    try {
      return this.offlineService.isTrusted()
        ? (this.window?.localStorage ?? null)
        : (this.window?.sessionStorage ?? null)
    } catch {
      return null
    }
  }

  private find(db: LocalDatabase, id: string): Transaction | null {
    const row = db.selectObjects(`SELECT * FROM ${TRANSACTION_TABLE} WHERE id = ?`, [id]).at(0)
    return row ? toTransaction(fromSql(TRANSACTION_TABLE, row)) : null
  }

  private read<T>(work: (db: LocalDatabase) => T, fallback: T): T {
    this.offlineService.changes()
    return this.offlineService.isOpen() ? work(this.offlineService.db()) : fallback
  }
}
