import { computed, DOCUMENT, effect, inject, Service, signal, untracked } from '@angular/core'
import { TranslocoService } from '@jsverse/transloco'
import { toast } from '@spartan-ng/brain/sonner'
import { AuthStore } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import {
  deleteOp,
  findOp,
  fromSql,
  listOps,
  OfflineService,
  queueWrite,
  SyncService,
  uuidv7,
} from '@/core/offline'
import type { LocalDatabase, OutboxOp } from '@/core/offline'
import {
  DEFAULT_CATEGORY_TABLE,
  BOOK_CHILD_TABLES,
  BOOK_KEY_PREFIX,
  BOOK_LIMITS,
  BOOK_TABLE,
} from './book.type'
import { defaultCategoryRows } from './default-categories'
import type { Book, BookSheetState, BookValues, SharedBook } from './book.type'

const ORDER = 'ORDER BY sort_order, created_at, id'

/**
 * The user's books on this device and the current one (docs/features/book.md). Reads come
 * from the local database; every write goes through the outbox like any own data.
 */
@Service()
export class BookService {
  private window = inject(DOCUMENT).defaultView
  private transloco = inject(TranslocoService)
  private authStore = inject(AuthStore)
  private networkStatusService = inject(NetworkStatusService)
  private offlineService = inject(OfflineService)
  private syncService = inject(SyncService)
  private languageService = inject(LanguageService)

  /** Live books in order (rule 7). */
  books = computed(() =>
    this.read(
      (db) =>
        db
          .selectObjects(`SELECT * FROM ${BOOK_TABLE} WHERE deleted_at IS NULL ${ORDER}`)
          .map((row) => fromSql(BOOK_TABLE, row) as unknown as Book),
      []
    )
  )
  /** Books with an op still waiting to sync ("รอ sync"). */
  pendingIds = computed(
    () =>
      new Set(
        this.read(
          (db) =>
            db
              .selectObjects(`SELECT row_id FROM outbox WHERE tbl = ? AND status = 'pending'`, [
                BOOK_TABLE,
              ])
              .map((row) => String(row['row_id'])),
          []
        )
      )
  )
  /**
   * The shared book in use (sharing rule 10), set by `SharingService`; null = an own one. It is
   * never stored: opening the app starts on an own book.
   */
  shared = signal<SharedBook | null>(null)
  isShared = computed(() => this.shared() !== null)
  /**
   * The device's current book: the shared one in use, else the stored one while live, else
   * the first (rule 6).
   */
  current = computed(() => {
    const shared = this.shared()
    if (shared) {
      return shared.book
    }
    const books = this.books()
    return books.find((book) => book.id === this.storedId()) ?? books.at(0) ?? null
  })
  /**
   * The current book's id. `current()` is a new object after every local write or pull (the
   * rows are read again), so an effect that should run only when the book **changes** (a
   * screen's remembered view) reads this instead.
   */
  currentId = computed(() => this.current()?.id ?? null)
  /**
   * Whether the device knows its books: false only while a new device waits for its first
   * pull, so the create step doesn't flash before the user's books arrive.
   */
  ready = computed(
    () =>
      this.offlineService.isOpen() &&
      (this.books().length > 0 ||
        this.syncService.lastSyncedAt() !== null ||
        this.roundEnded() ||
        !this.syncService.canSync())
  )
  /**
   * A new device's first round is still running (docs/features/loading.md rule 4): the shell
   * shows its loader until every page has arrived, so the first numbers seen are the whole ones.
   */
  firstPull = computed(
    () =>
      this.offlineService.isOpen() &&
      this.syncService.lastSyncedAt() === null &&
      this.syncService.canSync() &&
      !this.roundEnded()
  )
  /**
   * Rule 10: the device's own data is always writable, offline too (offline-sync rule 1). Only a
   * database kept in memory (browser storage refused) writes online and while the server answers
   * (rule 11), since its rows live in memory until they're pushed.
   */
  canWrite = computed(() => {
    const online =
      this.networkStatusService.isOnline() && this.networkStatusService.serverReachable()
    const shared = this.shared()
    if (shared) {
      // Sharing rule 11: an editor, online, once the rows are in.
      return (
        this.offlineService.sharedActive() &&
        online &&
        shared.role === 'editor' &&
        shared.status === 'ready'
      )
    }
    return this.offlineService.isOpen() && (this.offlineService.isTrusted() || online)
  })
  /**
   * Why a shared book (or an in-memory database) can't write right now: the network is up but the server isn't
   * answering (rule 11), rather than no network. Picks the notice's wording.
   */
  serverDown = computed(
    () => this.networkStatusService.isOnline() && !this.networkStatusService.serverReachable()
  )
  atLimit = computed(() => this.books().length >= BOOK_LIMITS.PER_USER)
  /** The open book sheet (sheets/book-sheet), if any. */
  sheet = signal<BookSheetState | null>(null)
  /** Whether the switch sheet (sheets/book-switch-sheet) is open: the header and Account › หมวดหมู่ open it. */
  switchSheet = signal(false)

  private storedId = signal<string | null>(null)
  private roundEnded = signal(false)
  private deletingHere = new Set<string>()

  private userId = computed(
    () => this.authStore.user()?.id ?? this.offlineService.meta()?.userId ?? null
  )

  constructor() {
    effect(() => {
      const userId = this.userId()
      const trusted = this.offlineService.isTrusted()
      untracked(() =>
        this.storedId.set(userId ? this.storage(trusted).getItem(this.key(userId)) : null)
      )
    })
    // Locked or closed while a shared book was in use: its rows are gone with the database.
    effect(() => {
      if (!this.offlineService.sharedActive() && this.shared()?.status === 'ready') {
        untracked(() => this.shared.set(null))
      }
    })
    let wasSyncing = false
    effect(() => {
      const syncing = this.syncService.isSyncing()
      if (wasSyncing && !syncing) {
        this.roundEnded.set(true)
      }
      wasSyncing = syncing
    })
    // Rule 9: the current book was deleted on another device.
    effect(() => {
      const storedId = this.storedId()
      this.offlineService.changes()
      if (!storedId || !this.offlineService.isOpen()) {
        return
      }
      untracked(() => {
        const row = this.find(this.offlineService.db(), storedId)
        if (!row || row.deletedAt === null) {
          return
        }
        if (!this.deletingHere.delete(storedId)) {
          toast(this.transloco.translate('books.deletedElsewhere', { name: row.name }))
        }
        this.select(this.current()?.id ?? null)
      })
    })
    // Wallet rule 11: a book deleted on a device that didn't know all its wallets leaves live
    // ones behind; whichever device sees that tombstones the ones it holds.
    effect(() => {
      this.offlineService.changes()
      if (!this.canWrite()) {
        return
      }
      untracked(() => {
        const db = this.offlineService.db()
        if (BOOK_CHILD_TABLES.some((table) => this.orphans(db, table).length > 0)) {
          this.offlineService.write((tx) => this.tombstoneChildren(tx, null, Date.now()))
        }
      })
    })
  }

  open(state: BookSheetState): void {
    this.sheet.set(state)
  }

  /** "Fix" from the sync sheet: the refused values of a rejected book op. */
  openFix(opId: string): void {
    const op = this.syncService.rejectedOp(opId)
    if (!op || op.table !== BOOK_TABLE) {
      return
    }
    const text = (key: string) => (typeof op.row[key] === 'string' ? op.row[key] : '')
    this.open({
      mode: 'fix',
      opId,
      id: op.rowId,
      values: { name: text('name'), icon: text('icon'), color: text('color') },
    })
  }

  byId(id: string): Book | null {
    return this.books().find((book) => book.id === id) ?? null
  }

  select(id: string | null): void {
    this.leaveShared()
    const userId = this.userId()
    this.storedId.set(id)
    if (!userId) {
      return
    }
    const storage = this.storage(this.offlineService.isTrusted())
    if (id) {
      storage.setItem(this.key(userId), id)
    } else {
      storage.removeItem(this.key(userId))
    }
  }

  /** Back to an own book: the shared one's TEMP tables go (sharing rule 15). */
  leaveShared(): void {
    if (this.shared()) {
      this.shared.set(null)
    }
    this.offlineService.leaveShared()
  }

  /** Rule 2 as far as this device knows. */
  nameTaken(name: string, exceptId: string | null): boolean {
    const wanted = name.trim().toLowerCase()
    return this.books().some((book) => book.id !== exceptId && book.name.toLowerCase() === wanted)
  }

  /** Creates (`id` null) or updates a book; a fix also drops the rejected op. */
  save(id: string | null, values: BookValues, fixOpId: string | null = null): string {
    const now = Date.now()
    const rowId = id ?? uuidv7(now)
    const last = this.books().at(-1)
    // A new row (also a "fix" of a refused create, whose local row went away) becomes current.
    const isNew = this.byId(rowId) === null
    this.offlineService.write((db) => {
      const current = this.find(db, rowId)
      const live = current?.deletedAt === null ? current : null
      // Read before the book's row comes back, which ends the "refused create" state.
      const refused = fixOpId ? this.refusedChildrenIn(db, fixOpId) : []
      queueWrite(db, BOOK_TABLE, 'upsert', {
        ...current,
        id: rowId,
        name: values.name.trim(),
        icon: values.icon,
        color: values.color,
        sortOrder: live?.sortOrder ?? (last ? last.sortOrder + 1 : 0),
        createdAt: current?.createdAt ?? now,
        updatedAt: now,
        deletedAt: null,
      })
      // Category rule 8: a book made here comes with the default set, in the same write.
      // A fixed refused create gets its refused child rows back instead (category rule 12).
      if (!current && !fixOpId) {
        const language = this.languageService.language().id
        for (const row of defaultCategoryRows(rowId, language, now, () => uuidv7())) {
          queueWrite(db, DEFAULT_CATEGORY_TABLE, 'upsert', row)
        }
      }
      if (fixOpId) {
        // Category rule 12: the refused create's child rows go again, after the book.
        for (const child of refused) {
          queueWrite(db, child.table, 'upsert', {
            ...child.row,
            id: child.rowId,
            bookId: rowId,
            updatedAt: now,
            deletedAt: null,
          })
          deleteOp(db, child.opId)
        }
        deleteOp(db, fixOpId)
      }
    })
    if (isNew) {
      this.select(rowId)
    }
    return rowId
  }

  /** Rule 8: a tombstone, with its wallets' (and from #8 their transactions') in one write. */
  remove(id: string): void {
    const now = Date.now()
    if (this.current()?.id === id) {
      this.deletingHere.add(id)
    }
    this.offlineService.write((db) => {
      const current = this.find(db, id)
      if (current) {
        this.tombstoneChildren(db, id, now)
        queueWrite(db, BOOK_TABLE, 'delete', { ...current, updatedAt: now, deletedAt: now })
      }
    })
  }

  /**
   * The rejected ops as the user sees them (category rule 12): a refused book create with the
   * refused child rows that went with it, and every other rejected op on its own.
   */
  rejectedItems = computed<{ op: OutboxOp; children: OutboxOp[] }[]>(() => {
    const rejected = this.syncService.rejected()
    if (!this.offlineService.isOpen()) {
      return []
    }
    const db = this.offlineService.db()
    const grouped = new Map<string, OutboxOp[]>()
    for (const op of rejected) {
      if (op.table === BOOK_TABLE) {
        grouped.set(op.opId, this.refusedChildrenIn(db, op.opId))
      }
    }
    const inGroup = new Set([...grouped.values()].flat().map((child) => child.opId))
    return rejected
      .filter((op) => !inGroup.has(op.opId))
      .map((op) => ({ op, children: grouped.get(op.opId) ?? [] }))
  })

  /** Discards a rejected book op with its refused child rows (category rule 12). */
  discardRefused(bookOpId: string): void {
    this.offlineService.write((db) => {
      for (const child of this.refusedChildrenIn(db, bookOpId)) {
        deleteOp(db, child.opId)
      }
      deleteOp(db, bookOpId)
    })
  }

  /** How many live wallets go with the book (the delete confirm, rule 8). */
  walletCount(id: string): number {
    return this.childCount('wallets', id)
  }

  /** The book's live categories (rule 8's confirm, category rule 12). */
  categoryCount(id: string): number {
    return this.childCount('categories', id)
  }

  /** The book's live transactions and transfers (rule 8's confirm, transfer rule 9). */
  transactionCount(id: string): number {
    return this.childCount('transactions', id) + this.childCount('transfers', id)
  }

  /** The book's live debts (the delete confirm, debt rule 10). */
  debtCount(id: string): number {
    return this.childCount('debts', id)
  }

  /** The book's live events (the delete confirm, event rule 8). */
  eventCount(id: string): number {
    return this.childCount('events', id)
  }

  /** The book's live recurring rules (Account › รายการซ้ำ, the delete confirm). */
  ruleCount(id: string): number {
    return this.childCount('recurring_rules', id)
  }

  private childCount(table: (typeof BOOK_CHILD_TABLES)[number], id: string): number {
    this.offlineService.changes()
    if (!this.offlineService.isOpen()) {
      return 0
    }
    return Number(
      this.offlineService
        .db()
        .selectValue(`SELECT count(*) FROM ${table} WHERE book_id = ? AND deleted_at IS NULL`, [id])
    )
  }

  /** Rule 7: moves a book to `to` (an index in the list); rewrites `sortOrder` where it changed. */
  moveTo(id: string, to: number): void {
    const books = [...this.books()]
    const from = books.findIndex((book) => book.id === id)
    if (from < 0 || to < 0 || to >= books.length || from === to) {
      return
    }
    const [moved] = books.splice(from, 1)
    books.splice(to, 0, moved)
    const now = Date.now()
    this.offlineService.write((db) => {
      books.forEach((book, index) => {
        if (book.sortOrder !== index) {
          queueWrite(db, BOOK_TABLE, 'upsert', { ...book, sortOrder: index, updatedAt: now })
        }
      })
    })
  }

  /**
   * Tombstones the live child rows of `bookId`, or (null) of every deleted book on the
   * device (wallet rule 11).
   */
  private tombstoneChildren(db: LocalDatabase, bookId: string | null, now: number): void {
    for (const table of BOOK_CHILD_TABLES) {
      const rows =
        bookId === null
          ? this.orphans(db, table)
          : db
              .selectObjects(`SELECT * FROM ${table} WHERE book_id = ? AND deleted_at IS NULL`, [
                bookId,
              ])
              .map((row) => fromSql(table, row))
      for (const row of rows) {
        queueWrite(db, table, 'delete', {
          ...row,
          id: String(row['id']),
          updatedAt: now,
          deletedAt: now,
        })
      }
    }
  }

  private refusedChildrenIn(db: LocalDatabase, bookOpId: string): OutboxOp[] {
    const op = findOp(db, bookOpId)
    if (!op || op.table !== BOOK_TABLE || op.status !== 'rejected' || op.op !== 'upsert') {
      return []
    }
    // Only a refused create: the server has no such book, so the device has no row left.
    if (this.find(db, op.rowId)) {
      return []
    }
    const tables: readonly string[] = BOOK_CHILD_TABLES
    return listOps(db, 'rejected').filter(
      (child) =>
        tables.includes(child.table) && child.op === 'upsert' && child.row['bookId'] === op.rowId
    )
  }

  /** Live rows of `table` whose book is a tombstone here. */
  private orphans(db: LocalDatabase, table: string): Record<string, unknown>[] {
    return db
      .selectObjects(
        `SELECT c.* FROM ${table} c JOIN ${BOOK_TABLE} p ON p.id = c.book_id
         WHERE c.deleted_at IS NULL AND p.deleted_at IS NOT NULL`
      )
      .map((row) => fromSql(table, row))
  }

  private find(db: LocalDatabase, id: string): Book | null {
    const row = db.selectObjects(`SELECT * FROM ${BOOK_TABLE} WHERE id = ?`, [id]).at(0)
    return row ? (fromSql(BOOK_TABLE, row) as unknown as Book) : null
  }

  private key(userId: string): string {
    return `${BOOK_KEY_PREFIX}${userId}`
  }

  /** Rule 6: lasting on a trusted device, for the tab's life on an untrusted one. */
  private storage(trusted: boolean): Storage {
    const window = this.window
    if (!window) {
      return new MemoryStorage()
    }
    return trusted ? window.localStorage : window.sessionStorage
  }

  private read<T>(work: (db: LocalDatabase) => T, fallback: T): T {
    this.offlineService.changes()
    return this.offlineService.isOpen() ? work(this.offlineService.db()) : fallback
  }
}

/** Stand-in when there's no window (never in the browser). */
class MemoryStorage implements Storage {
  private items = new Map<string, string>()
  get length(): number {
    return this.items.size
  }
  clear(): void {
    this.items.clear()
  }
  getItem(key: string): string | null {
    return this.items.get(key) ?? null
  }
  key(index: number): string | null {
    return [...this.items.keys()][index] ?? null
  }
  removeItem(key: string): void {
    this.items.delete(key)
  }
  setItem(key: string, value: string): void {
    this.items.set(key, value)
  }
}
