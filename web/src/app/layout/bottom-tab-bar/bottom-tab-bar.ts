import { Component, computed, DOCUMENT, inject, input } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChartPie,
  lucideCircleUser,
  lucidePlus,
  lucideReceiptText,
  lucideWallet,
} from '@ng-icons/lucide'
import { BookService } from '@/core/book'
import { NavHistory } from '@/core/routing'
import { TransactionService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'

interface Tab {
  path: string
  /** Translation key. */
  label: string
  icon: string
}

/** Money Lover style bar: two tabs, a raised ➕ (add transaction), two tabs. */
@Component({
  selector: 'app-bottom-tab-bar',
  imports: [TranslocoPipe, RouterLink, NgIcon],
  providers: [
    provideIcons({ lucideChartPie, lucideCircleUser, lucidePlus, lucideReceiptText, lucideWallet }),
  ],
  templateUrl: './bottom-tab-bar.html',
})
export class BottomTabBar {
  /** Invitations to me are waiting (sharing.md → Web screens). */
  accountDot = input(false)
  /**
   * ➕ opens the transaction form over the current tab; with no book or no wallet yet it
   * leads to the create step or the first-wallet step on the Transactions tab (book rule 5,
   * wallet rule 12).
   */
  private walletService = inject(WalletService)
  private bookService = inject(BookService)
  private transactionService = inject(TransactionService)
  private router = inject(Router)
  private window = inject(DOCUMENT).defaultView
  /** The lit tab: a page opened from another tab keeps that one lit (NavHistory). */
  protected navHistory = inject(NavHistory)

  /** A shared book I can't write now: a viewer, offline, still loading (sharing rule 10). */
  protected sharedReadOnly = computed(
    () => this.bookService.isShared() && !this.bookService.canWrite()
  )

  protected add(): void {
    if (this.bookService.current() && this.walletService.hasWallet()) {
      this.transactionService.open({ mode: 'create' })
      return
    }
    void this.router.navigate(['/transactions'])
  }

  /**
   * Tapping the tab already showing scrolls it back to the top, as native tab bars do (the
   * router ignores a link to the same URL). Any other tab is a new page, which starts at the
   * top by itself (`withInMemoryScrolling` in app.config).
   */
  protected toTop(path: string): void {
    if (this.router.url.split(/[?#]/)[0] !== path) {
      return
    }
    const view = this.window
    // `matchMedia` may be missing (the test DOM): no motion then.
    const smooth =
      typeof view?.matchMedia === 'function' &&
      !view.matchMedia('(prefers-reduced-motion: reduce)').matches
    view?.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' })
  }

  /** The ➕ sits between the 2nd and 3rd tab. */
  protected readonly tabs: readonly Tab[] = [
    { path: '/transactions', label: 'nav.transactions', icon: 'lucideReceiptText' },
    { path: '/wallets', label: 'nav.wallets', icon: 'lucideWallet' },
    { path: '/reports', label: 'nav.reports', icon: 'lucideChartPie' },
    { path: '/account', label: 'nav.account', icon: 'lucideCircleUser' },
  ]
}
