import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
} from '@angular/core'
import { RouterOutlet } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCloudDownload } from '@ng-icons/lucide'
import { AuthStore } from '@/core/auth'
import { BookService } from '@/core/book'
import { CategoryService } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { SyncService } from '@/core/offline'
import { NavHistory } from '@/core/routing'
import type { SharingService } from '@/core/sharing'
import { TransactionService, TransferService } from '@/core/transaction'
import { KeyboardService } from '@/core/viewport'
import { WalletService } from '@/core/wallet'
import { AppHeader } from '@/layout/app-header/app-header'
import { BookCreateStep } from '@/layout/book-create-step/book-create-step'
import { currentUrl, isBookTab, isWalletTab } from '@/layout/book-routes'
import { BottomTabBar } from '@/layout/bottom-tab-bar/bottom-tab-bar'
import { DemoBanner } from '@/layout/demo-banner/demo-banner'
import { DemoLoader } from '@/layout/demo-loader/demo-loader'
import { SharedBookStep } from '@/layout/shared-book-step/shared-book-step'
import { WalletFirstStep } from '@/layout/wallet-first-step/wallet-first-step'
import { FadeIn } from '@/shared/components/fade'
import { CustomRangeSheet } from '@/shared/components/period'
import { Slide } from '@/shared/components/slide'
import { BookSheet } from '@/sheets/book-sheet/book-sheet'
import { BookSwitchSheet } from '@/sheets/book-switch-sheet/book-switch-sheet'
import { CategorySheet } from '@/sheets/category-sheet/category-sheet'
import { TransactionSheet } from '@/sheets/transaction-sheet/transaction-sheet'
import { TransferSheet } from '@/sheets/transfer-sheet/transfer-sheet'
import { ViewWalletSheet } from '@/sheets/view-wallet-sheet/view-wallet-sheet'
import { WalletSheet } from '@/sheets/wallet-sheet/wallet-sheet'

/**
 * Pages about the current book that a shared one doesn't have (sharing rule 10): its
 * categories, rules, debts, events, export and sharing are the owner's.
 */
const OWN_ONLY = [
  '/account/categories',
  '/account/recurring',
  '/account/export',
  '/account/sharing',
  '/wallets/debts',
  '/transactions/events',
]

/** Layout route for the signed-in tabs: header, page, fixed bottom tab bar. */
@Component({
  selector: 'app-shell',
  providers: [provideIcons({ lucideCloudDownload })],
  imports: [
    RouterOutlet,
    TranslocoPipe,
    NgIcon,
    AppHeader,
    BottomTabBar,
    DemoBanner,
    DemoLoader,
    BookCreateStep,
    SharedBookStep,
    BookSheet,
    WalletFirstStep,
    WalletSheet,
    CategorySheet,
    BookSwitchSheet,
    ViewWalletSheet,
    CustomRangeSheet,
    TransactionSheet,
    TransferSheet,
    FadeIn,
    Slide,
  ],
  templateUrl: './app-shell.html',
})
export class AppShell {
  protected keyboardService = inject(KeyboardService)
  protected bookService = inject(BookService)
  protected walletService = inject(WalletService)
  /** Also keeps its sweep of orphaned sub-categories running (category rule 6). */
  protected categoryService = inject(CategoryService)
  /** Also keeps its sweep of transactions whose wallet or category was deleted (rule 10). */
  protected transactionService = inject(TransactionService)
  /** Also keeps its sweep of transfers whose wallet was deleted (transfer rule 8). */
  protected transferService = inject(TransferService)
  protected switchSheetOpen = this.bookService.switchSheet
  private syncService = inject(SyncService)
  private languageService = inject(LanguageService)
  /** Rows the first pull brought so far, formatted; null until some arrive. */
  protected pulledText = computed(() => {
    const count = this.syncService.pulledRows()
    return count > 0 ? count.toLocaleString(this.languageService.locale()) : null
  })
  private networkStatusService = inject(NetworkStatusService)
  private authStore = inject(AuthStore)
  private url = currentUrl()
  private injector = inject(Injector)
  /** Family sharing (#16): loaded after the first render, for the Account tab's invite dot. */
  protected sharing = signal<SharingService | null>(null)

  constructor() {
    // Recurring rule 7: due occurrences are recorded whatever tab shows. Loaded after the first
    // render as its own chunk, so the shell's bundle doesn't carry it.
    let destroyed = false
    inject(DestroyRef).onDestroy(() => (destroyed = true))
    afterNextRender(() => {
      void import('@/core/recurring').then(({ RecurringService }) => {
        // The chunk may arrive after the shell is gone (signed out, a spec's teardown).
        if (!destroyed) {
          this.injector.get(RecurringService)
        }
      })
      void import('@/core/sharing').then(({ SharingService }) => {
        if (!destroyed) {
          this.sharing.set(this.injector.get(SharingService))
        }
      })
    })
  }

  protected navHistory = inject(NavHistory)
  /** The bottom tab lit (a page keeps the tab it was opened from): a new one fades in (§8). */
  protected tab = this.navHistory.tab

  /**
   * Book rule 5: the data tabs need a book (wait for a new device's first pull); wallet
   * rule 12: the Transactions and Wallets tabs then need a wallet.
   */
  protected gate = computed(() => {
    const url = this.url()
    const shared = this.bookService.shared()
    if (shared && OWN_ONLY.some((path) => url.startsWith(path))) {
      return 'sharedMine'
    }
    if (!isBookTab(url)) {
      return 'page'
    }
    if (shared) {
      return this.sharedGate(url, shared.status)
    }
    // Demo rule 8: a demo's first pull is a checklist, and a failed one says so with ลองใหม่.
    const demo = this.authStore.user()?.isDemo === true
    if (this.bookService.firstPull()) {
      return demo ? 'demoLoading' : 'loading'
    }
    if (demo && this.bookService.current() === null && this.syncService.lastSyncedAt() === null) {
      return 'demoFailed'
    }
    if (this.bookService.current() === null) {
      return this.bookService.ready() ? 'create' : 'loading'
    }
    return isWalletTab(url) && !this.walletService.hasWallet() ? 'firstWallet' : 'page'
  })

  /** Sharing rule 10: a shared book shows only online, and has no reports. */
  private sharedGate(url: string, status: 'loading' | 'ready') {
    const online =
      this.networkStatusService.isOnline() && this.networkStatusService.serverReachable()
    if (!online) {
      return 'sharedOffline'
    }
    if (status === 'loading') {
      return 'loading'
    }
    return url.startsWith('/reports') ? 'sharedReports' : 'page'
  }
}
