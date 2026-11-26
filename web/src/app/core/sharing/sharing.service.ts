import { DOCUMENT, Injectable, computed, effect, inject, signal, untracked } from '@angular/core'
import { TranslocoService } from '@jsverse/transloco'
import { toast } from '@spartan-ng/brain/sonner'
import { ApiClient, isUnreachable, toApiError } from '@/core/api'
import { AuthStore } from '@/core/auth'
import { BookService } from '@/core/book'
import type { Book } from '@/core/book'
import { LiveService } from '@/core/live'
import { NetworkStatusService } from '@/core/network'
import { deleteOp, listOps, OfflineService, putRow, SyncService } from '@/core/offline'
import type { LocalDatabase, SyncRow } from '@/core/offline'
import { ActivityService } from '@/core/transaction'
import type {
  OwnerSharing,
  ShareRole,
  ShareGroup,
  SharedBookRows,
  SharedWithMe,
  SharingInvite,
} from './sharing.type'

/** Codes the API answers with (sharing.md → Endpoints); anything else is a generic failure. */
const KNOWN_CODES = new Set([
  'SHARE_SELF',
  'SHARE_ALREADY_MEMBER',
  'SHARE_INVITE_PENDING',
  'SHARE_MEMBER_LIMIT',
  'SHARE_WALLETS_INVALID',
  'SHARE_INVITE_EMPTY',
  'SHARE_DAILY_LIMIT',
  'SHARE_RESEND_COOLDOWN',
  'RATE_LIMITED',
])

/**
 * Family sharing (docs/features/sharing.md): every call is online REST, and what it reads stays
 * in memory only (offline-sync rule 15), cleared when the signed-in user changes. The shell loads
 * this service with a dynamic `import()` after its first render, so it stays out of the initial
 * bundle; pages inject it directly.
 */
/** Rows per read of a shared book, like a pull page. */
const ROWS_PAGE = 5000
/** How often a shared book in use reads what changed (others' writes). */
const REFRESH_MS = 60_000
/** The same while live sync is connected: pokes bring the changes, this only catches a lost one. */
const LIVE_REFRESH_MS = 5 * 60_000

@Injectable({ providedIn: 'root' })
export class SharingService {
  private api = inject(ApiClient)
  private authStore = inject(AuthStore)
  private network = inject(NetworkStatusService)
  private offlineService = inject(OfflineService)
  private syncService = inject(SyncService)
  private bookService = inject(BookService)
  private activityService = inject(ActivityService)
  private transloco = inject(TranslocoService)
  private liveService = inject(LiveService)
  private window = inject(DOCUMENT).defaultView

  /** Invites to me and wallets shared with me; `null` until read once. */
  withMe = signal<SharedWithMe | null>(null)
  /** The owner's view per book id. */
  private owners = signal<ReadonlyMap<string, OwnerSharing>>(new Map())
  /** The shared book in use: its id and the last `changeSeq` read (sharing rule 9). */
  private session: { bookId: string; cursor: number; walletIds: Set<string> } | null = null
  private pushing: Promise<void> | null = null
  private refreshing: Promise<void> | null = null
  private refreshAgain = false
  /** When the shared book's rows were last read in full (`Date.now()`), 0 before any. */
  private rowsReadAt = 0
  /** The shared book in use, once its rows are in (live-sync rule 10). */
  private liveBookId = computed(() => {
    const shared = this.bookService.shared()
    return shared?.status === 'ready' && this.offlineService.sharedActive() ? shared.book.id : null
  })
  /** When the data on screen was read (the offline notice says it). */
  readAt = signal<number | null>(null)

  canCall = computed(() => this.network.isOnline() && this.network.serverReachable())
  inviteCount = computed(() => this.withMe()?.invites.length ?? 0)

  constructor() {
    let userId: string | null = null
    effect(() => {
      const id = this.authStore.user()?.id ?? null
      const online = this.canCall()
      untracked(() => {
        if (id !== userId) {
          userId = id
          this.clear()
        }
        if (id && online && !this.withMe()) {
          void this.loadWithMe().catch(() => undefined)
        }
      })
    })
    // An editor's write lands in the TEMP outbox: push it at once (sharing rule 11).
    effect(() => {
      this.offlineService.changes()
      if (this.offlineService.sharedActive() && this.canCall()) {
        untracked(() => void this.pushShared())
      }
    })
    // Back online with a shared book in use: read what changed meanwhile.
    effect(() => {
      if (this.canCall() && this.offlineService.sharedActive()) {
        untracked(() => void this.refreshShared())
      }
    })
    // Live sync (rules 10–11): another member's push pokes a read of the book in use.
    effect((onCleanup) => {
      const bookId = this.liveBookId()
      if (!bookId) {
        return
      }
      const stop = this.liveService.listenBook(bookId, {
        deviceId: () => this.offlineService.syncMeta('deviceId'),
        cursor: () => (this.session?.bookId === bookId ? this.session.cursor : 0),
        onPoke: () => void this.refreshShared(),
      })
      onCleanup(stop)
    })
    // Timed reads: every minute, or every 5 while live sync is connected (live-sync decision 1).
    // A poke's read counts too, so a busy book is read less; half a tick of slack keeps the
    // gap near 5 minutes, not 6.
    this.window?.setInterval(() => {
      const quiet = Date.now() - this.rowsReadAt < LIVE_REFRESH_MS - REFRESH_MS / 2
      if (!(this.liveService.connected() && quiet)) {
        void this.refreshShared()
      }
    }, REFRESH_MS)
    this.window?.document.addEventListener('visibilitychange', () => {
      if (this.window?.document.visibilityState === 'visible') {
        void this.refreshShared()
      }
    })
  }

  // ---------- A shared book in use (sharing rules 9–15) ----------

  /** Switches to a book shared with me: its rows go into the TEMP tables. */
  async openShared(group: ShareGroup): Promise<void> {
    const book: Book = {
      ...group.book,
      sortOrder: 0,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
      changeSeq: null,
    }
    this.bookService.leaveShared()
    this.bookService.shared.set({
      book,
      role: group.role,
      owner: { id: group.owner.id, displayName: group.owner.displayName },
      status: 'loading',
    })
    try {
      // Read the rows while a running own sync round ends: the TEMP tables wait for it.
      const [pages] = await Promise.all([this.fetchRows(book.id, 0), this.syncService.idle()])
      if (this.bookService.shared()?.book.id !== book.id) {
        return // another book was picked meanwhile
      }
      this.offlineService.enterShared()
      this.session = { bookId: book.id, cursor: 0, walletIds: new Set() }
      this.putPages(pages)
      const shared = this.bookService.shared()
      if (shared?.book.id === book.id) {
        this.bookService.shared.set({ ...shared, status: 'ready' })
      }
    } catch (error) {
      this.endShared()
      toast.error(this.transloco.translate(this.failure(error)))
    }
  }

  /**
   * Reads what changed in the shared book in use (others' writes, a removal). A call during a
   * read runs one more after it (live-sync rule 11).
   */
  async refreshShared(): Promise<void> {
    if (this.refreshing) {
      this.refreshAgain = true
      return this.refreshing
    }
    this.refreshing = (async () => {
      do {
        this.refreshAgain = false
        await this.refreshOnce()
      } while (this.wantsRefresh())
    })().finally(() => {
      this.refreshing = null
    })
    return this.refreshing
  }

  /** A call came in during the read (a method: TS can't see the flag change). */
  private wantsRefresh(): boolean {
    return this.refreshAgain
  }

  private async refreshOnce(): Promise<void> {
    const session = this.session
    if (!session || !this.offlineService.sharedActive() || !this.canCall()) {
      return
    }
    try {
      await this.readRows(session.bookId)
    } catch (error) {
      if (toApiError(error).status === 404) {
        this.removedFromShared()
      }
    }
  }

  private async readRows(bookId: string): Promise<void> {
    const pages = await this.fetchRows(bookId, this.session?.cursor ?? 0)
    if (this.session?.bookId === bookId && this.offlineService.sharedActive()) {
      this.putPages(pages)
    }
  }

  /** Every page from `since` on (sharing rule 9). */
  private async fetchRows(bookId: string, since: number): Promise<SharedBookRows[]> {
    const pages: SharedBookRows[] = []
    let cursor = since
    for (;;) {
      const data = (
        await this.api.get<SharedBookRows>(
          `/sharing/with-me/${bookId}/rows?since=${cursor}&limit=${ROWS_PAGE}`
        )
      ).data as SharedBookRows
      pages.push(data)
      cursor = data.cursor
      if (!data.hasMore) {
        this.rowsReadAt = Date.now()
        return pages
      }
    }
  }

  private putPages(pages: readonly SharedBookRows[]): void {
    for (const data of pages) {
      this.putRows(data)
      if (this.session) {
        this.session.cursor = data.cursor
      }
    }
  }

  /** Wallets and categories are read whole each time; transactions by `changeSeq`. */
  private putRows(data: SharedBookRows): void {
    const walletIds = new Set(data.wallets.map((row) => String(row['id'])))
    this.offlineService.fillShared((db) => {
      db.exec('DELETE FROM wallets')
      db.exec('DELETE FROM categories')
      for (const row of data.wallets) {
        putRow(db, 'wallets', row)
      }
      for (const row of data.categories) {
        putRow(db, 'categories', row)
      }
      const { columns, rows } = data.transactions
      for (const values of rows) {
        const row: SyncRow = Object.fromEntries<unknown>(
          columns.map((column, i) => [column, values[i]])
        )
        // A pending write of mine stays until its push answers (offline-sync rule 9).
        if (!hasPending(db, String(row['id']))) {
          putRow(db, 'transactions', row)
        }
      }
      // A wallet no longer shared takes its rows with it.
      if (this.session) {
        for (const id of this.session.walletIds) {
          if (!walletIds.has(id)) {
            db.exec('DELETE FROM transactions WHERE wallet_id = ?', [id])
          }
        }
        this.session.walletIds = walletIds
      }
    })
    this.activityService.addPeople(data.people)
    const shared = this.bookService.shared()
    if (shared) {
      this.bookService.shared.set({
        ...shared,
        role: data.role,
        book: { ...shared.book, ...data.book },
      })
    }
  }

  /** Pushes the TEMP outbox and settles what the server refused (sharing rules 13, 16). */
  private async pushShared(): Promise<void> {
    if (this.pushing || !hasOps(this.offlineService)) {
      return
    }
    this.pushing = this.syncService
      .pushShared()
      .then(async () => this.settleRefused())
      .catch(() => undefined)
      .finally(() => {
        this.pushing = null
      })
    await this.pushing
  }

  private async settleRefused(): Promise<void> {
    if (!this.offlineService.sharedActive()) {
      return
    }
    const refused = listOps(this.offlineService.db(), 'rejected')
    if (refused.length === 0) {
      return
    }
    // The rows already went back to the server's versions (or away, for a refused add).
    this.offlineService.fillShared((db) => {
      for (const op of refused) {
        deleteOp(db, op.opId)
      }
    })
    if (refused.some((op) => op.code === 'NOT_SHARED')) {
      this.removedFromShared()
      return
    }
    const stale = refused.some((op) => op.code === 'STALE')
    toast.error(this.transloco.translate(stale ? 'sharing.stale' : 'sharing.refused'))
    await this.refreshShared()
  }

  /** Sharing rule 16: told, then back to an own book. */
  private removedFromShared(): void {
    toast.error(this.transloco.translate('sharing.removedFromShared'))
    this.endShared()
    void this.loadWithMe().catch(() => undefined)
  }

  private endShared(): void {
    this.session = null
    this.bookService.leaveShared()
  }

  owner(bookId: string): OwnerSharing | null {
    return this.owners().get(bookId) ?? null
  }

  /** The translation key for a failed call. */
  failure(error: unknown): string {
    const apiError = toApiError(error)
    if (isUnreachable(apiError)) {
      return 'sharing.needsOnline'
    }
    return apiError.code && KNOWN_CODES.has(apiError.code)
      ? `sharing.error.${apiError.code}`
      : 'sharing.error.generic'
  }

  async loadWithMe(): Promise<SharedWithMe> {
    const data = (await this.api.get<SharedWithMe>('/sharing/with-me')).data as SharedWithMe
    this.withMe.set(data)
    this.readAt.set(Date.now())
    return data
  }

  async loadOwner(bookId: string): Promise<OwnerSharing> {
    const data = (await this.api.get<OwnerSharing>(`/sharing/books/${bookId}`)).data as OwnerSharing
    this.owners.update((map) => new Map(map).set(bookId, data))
    // Sharing rule 15: the names behind "เพิ่มโดย …" on the owner's rows.
    this.activityService.addPeople(
      data.members.map((member) => ({ id: member.userId, displayName: member.displayName }))
    )
    // Shared-activity rule 1: which wallets the book's activity reaches, and whether it ended.
    this.activityService.setShares(
      bookId,
      [...new Set(data.members.flatMap((member) => member.walletIds))],
      data.members.length
    )
    return data
  }

  // ---------- Owner ----------

  async invite(
    bookId: string,
    values: { email: string; role: ShareRole; walletIds: string[] },
    lang: string
  ): Promise<SharingInvite> {
    const data = (
      await this.api.post<SharingInvite>(`/sharing/books/${bookId}/invites`, {
        ...values,
        lang,
      })
    ).data as SharingInvite
    await this.loadOwner(bookId)
    return data
  }

  async resend(bookId: string, inviteId: string, lang: string): Promise<void> {
    await this.api.post(`/sharing/invites/${inviteId}/resend`, { lang })
    await this.loadOwner(bookId)
  }

  async cancel(bookId: string, inviteId: string): Promise<void> {
    await this.api.delete(`/sharing/invites/${inviteId}`)
    await this.loadOwner(bookId)
  }

  async updateMember(
    bookId: string,
    userId: string,
    values: { role: ShareRole; walletIds: string[] }
  ): Promise<void> {
    await this.api.put(`/sharing/books/${bookId}/members/${userId}`, values)
    await this.loadOwner(bookId)
  }

  async removeMember(bookId: string, userId: string): Promise<void> {
    await this.api.delete(`/sharing/books/${bookId}/members/${userId}`)
    await this.loadOwner(bookId)
  }

  // ---------- Member ----------

  async accept(inviteId: string): Promise<void> {
    try {
      await this.api.post(`/sharing/invites/${inviteId}/accept`, {})
    } finally {
      await this.loadWithMe().catch(() => undefined)
    }
  }

  async decline(inviteId: string): Promise<void> {
    await this.api.post(`/sharing/invites/${inviteId}/decline`, {})
    await this.loadWithMe()
  }

  async leave(bookId: string): Promise<void> {
    await this.api.delete(`/sharing/with-me/${bookId}`)
    await this.loadWithMe()
  }

  private clear(): void {
    this.withMe.set(null)
    this.owners.set(new Map())
    this.readAt.set(null)
    if (this.session) {
      this.endShared()
    }
  }
}

const hasPending = (db: LocalDatabase, rowId: string): boolean =>
  db.selectValue(`SELECT 1 FROM outbox WHERE tbl = 'transactions' AND row_id = ?`, [rowId]) !==
  undefined

const hasOps = (offlineService: OfflineService): boolean =>
  offlineService.sharedActive() &&
  offlineService.db().selectValue(`SELECT 1 FROM outbox WHERE status = 'pending' LIMIT 1`) !==
    undefined
