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
import { FadeIn } from '@/shared/components/fade'
import { CustomRangeSheet } from '@/shared/components/period'
import { Slide } from '@/shared/components/slide'
import { AppHeader } from './app-header'
import { BookCreateStep } from './book-create-step'
import { currentUrl, isBookTab, isWalletTab } from './book-routes'
import { BookSheet } from './book-sheet'
import { BookSwitchSheet } from './book-switch-sheet'
import { BottomTabBar } from './bottom-tab-bar'
import { CategorySheet } from './category-sheet'
import { SharedBookStep } from './shared-book-step'
import { TransactionSheet } from './transaction-sheet'
import { TransferSheet } from './transfer-sheet'
import { ViewWalletSheet } from './view-wallet-sheet'
import { WalletFirstStep } from './wallet-first-step'
import { WalletSheet } from './wallet-sheet'

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
  template: `
    <div class="mx-auto flex min-h-dvh max-w-[480px] flex-col">
      <app-header />
      <main
        class="flex-1 overflow-x-clip pb-[calc(4rem+env(safe-area-inset-bottom))]"
        [appFadeIn]="tab()"
      >
        <!-- A page opened deeper in the tab slides in from the right, ‹ from the left (§8). -->
        <div [appSlide]="navHistory.step()">
          @switch (gate()) {
            @case ('loading') {
              <!-- A new device's first pull (docs/features/loading.md rule 4): the one loader. -->
              <div class="flex flex-col items-center px-6 py-16 text-center" role="status">
                <span
                  class="mb-3 flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground"
                >
                  <ng-icon name="lucideCloudDownload" size="28" aria-hidden="true" />
                </span>
                <p class="font-semibold">{{ 'sync.firstLoad' | transloco }}</p>
                @if (pulledText(); as count) {
                  <p class="mt-1 text-sm text-muted-foreground tabular-nums">
                    {{ 'sync.firstLoadCount' | transloco: { count } }}
                  </p>
                }
              </div>
            }
            @case ('create') {
              <app-book-create-step />
            }
            @case ('firstWallet') {
              <app-wallet-first-step />
            }
            @case ('sharedOffline') {
              <app-shared-book-step reason="offline" />
            }
            @case ('sharedReports') {
              <app-shared-book-step reason="reports" />
            }
            @case ('sharedMine') {
              <app-shared-book-step reason="mine" />
            }
            @default {
              <router-outlet />
            }
          }
        </div>
      </main>
    </div>
    @if (!keyboardService.isOpen()) {
      <app-bottom-tab-bar
        class="fixed inset-x-0 bottom-0 z-10 bg-background pb-[env(safe-area-inset-bottom)]"
        [accountDot]="(sharing()?.inviteCount() ?? 0) > 0"
      />
    }
    @defer (when bookService.switchSheet()) {
      <app-book-switch-sheet [(open)]="switchSheetOpen" [sharing]="sharing()" />
    }
    @defer (when bookService.sheet() !== null) {
      <app-book-sheet />
    }
    @defer (when walletService.sheet() !== null) {
      <app-wallet-sheet />
    }
    @defer (when categoryService.sheet() !== null) {
      <app-category-sheet />
    }
    @defer (when transactionService.walletSheet()) {
      <app-view-wallet-sheet [(open)]="transactionService.walletSheet" />
    }
    @defer (when transactionService.customSheet()) {
      <app-custom-range-sheet
        [(open)]="transactionService.customSheet"
        [range]="transactionService.custom()"
        (applied)="transactionService.selectCustom($event)"
      />
    }
    @defer (when transactionService.sheet() !== null) {
      <app-transaction-sheet />
    }
    @defer (when transferService.sheet() !== null) {
      <app-transfer-sheet />
    }
  `,
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
    if (this.bookService.firstPull()) {
      return 'loading'
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
