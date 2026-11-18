import { CdkDrag, CdkDragHandle, CdkDragPlaceholder, CdkDropList } from '@angular/cdk/drag-drop'
import type { CdkDragDrop } from '@angular/cdk/drag-drop'
import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, signal } from '@angular/core'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideArrowLeftRight,
  lucideChevronDown,
  lucideChevronRight,
  lucideGripVertical,
  lucideHandCoins,
  lucidePlus,
} from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { BookService } from '@/core/book'
import { DEBTS_ROUTE, DebtService } from '@/core/debt'
import { LanguageService } from '@/core/i18n'
import { TransactionService, TransferService } from '@/core/transaction'
import { DEFAULT_CURRENCY, WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { formatMoney } from '@/shared/utils'

/**
 * The Wallets tab (docs/features/wallet.md → Web screens): the current book's total per
 * currency, its wallets in order (with an order mode), and the archived ones folded away. The
 * shell shows the first-wallet step instead while the book has none (rule 12).
 */
@Component({
  selector: 'app-wallets-page',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    IconBadge,
    CurrencyFlag,
    CdkDropList,
    CdkDrag,
    CdkDragHandle,
    CdkDragPlaceholder,
    RouterLink,
  ],
  providers: [
    provideIcons({
      lucideArrowLeftRight,
      lucideChevronDown,
      lucideChevronRight,
      lucideGripVertical,
      lucideHandCoins,
      lucidePlus,
    }),
  ],
  templateUrl: './wallets-page.html',
})
export class WalletsPage {
  private languageService = inject(LanguageService)
  protected walletService = inject(WalletService)
  protected transferService = inject(TransferService)
  private debtService = inject(DebtService)
  private bookService = inject(BookService)
  private transactionService = inject(TransactionService)
  private router = inject(Router)

  /** A book shared with me is in use (sharing rule 10). */
  protected shared = this.bookService.isShared
  protected defaultIcon = WALLET_DEFAULT_ICON
  /** A wallet in another currency shows its flag and code under the name (currency.md). */
  protected defaultCurrency = DEFAULT_CURRENCY
  protected debtsRoute = DEBTS_ROUTE

  // ── The total (rule 7; credit-card rule 6) ─────────────────────────────────

  /** Rule 7: one line per currency; ฿0.00 while nothing counts. */
  protected totals = computed(() => {
    const locale = this.languageService.locale()
    const totals = this.walletService.totals()
    const lines =
      totals.length > 0
        ? totals
        : [
            {
              currencyCode: this.walletService.defaultCurrency(),
              minorUnit: this.walletService.minorUnit(this.walletService.defaultCurrency()),
              amount: 0,
            },
          ]
    return lines.map((line) => ({
      ...line,
      text: formatMoney(line.amount, line.currencyCode, line.minorUnit, locale),
    }))
  })

  /** Credit-card rule 6 (Q1): the total less what the cards owe, while they owe something. */
  protected afterCards = computed(() => {
    const locale = this.languageService.locale()
    const totals = this.walletService.totals()
    return this.walletService.owedTotals().map((owed) => {
      const total = totals.find((line) => line.currencyCode === owed.currencyCode)?.amount ?? 0
      return {
        currencyCode: owed.currencyCode,
        text: formatMoney(total - owed.amount, owed.currencyCode, owed.minorUnit, locale),
      }
    })
  })

  // ── Debts (debt.md Q8–Q9) ──────────────────────────────────────────────────

  /** Open debts per direction: how many, overdue, what is left (one currency per line). */
  protected debtLines = computed(() => {
    const locale = this.languageService.locale()
    const open = this.debtService.openItems()
    return (['borrowed', 'lent'] as const).map((direction) => {
      const items = open.filter((item) => item.debt.direction === direction)
      const sums = new Map<string, { amount: number; minorUnit: number }>()
      for (const item of items) {
        const sum = sums.get(item.debt.currencyCode) ?? { amount: 0, minorUnit: item.minorUnit }
        sum.amount += Math.max(0, item.left)
        sums.set(item.debt.currencyCode, sum)
      }
      const code = this.walletService.defaultCurrency()
      const lines =
        sums.size > 0
          ? [...sums.entries()]
          : [[code, { amount: 0, minorUnit: this.walletService.minorUnit(code) }] as const]
      return {
        direction,
        count: items.length,
        overdue: items.filter((item) => item.overdue).length,
        text: lines
          .map(([currency, sum]) => formatMoney(sum.amount, currency, sum.minorUnit, locale))
          .join(' · '),
      }
    })
  })

  /** Any open debt either way; without one the card is a single row to the debts page. */
  protected hasDebts = computed(() => this.debtLines().some((line) => line.count > 0))

  // ── The wallet list and its order mode ─────────────────────────────────────

  /** Order mode: every open wallet, cards too, with a drag handle. */
  protected ordering = signal(false)
  /** The archived wallets, folded away until opened. */
  protected showArchived = signal(false)

  /**
   * The wallet list: open wallets without the cards, which have their own section
   * (credit-card rule 6); all of them in order mode, which keeps one order.
   */
  protected listedWallets = computed(() => {
    const open = this.walletService.openWallets()
    return this.ordering() ? open : open.filter((wallet) => !wallet.isCreditCard)
  })

  /** Touch: press and hold the handle before dragging, so scrolling the list still works. */
  protected dragDelay = { touch: 300, mouse: 0 }

  // ── Credit cards (credit-card rule 6) ──────────────────────────────────────

  /** What the cards owe per currency, joined; null while they owe nothing. */
  protected owedText = computed(() => {
    const locale = this.languageService.locale()
    const lines = this.walletService.owedTotals()
    return lines.length > 0
      ? lines
          .map((line) => formatMoney(line.amount, line.currencyCode, line.minorUnit, locale))
          .join(' · ')
      : null
  })

  // ── Template actions ───────────────────────────────────────────────────────

  /** A wallet's balance in its currency. */
  protected balanceText(wallet: Wallet): string {
    return formatMoney(
      this.walletService.balance(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
  }

  /** What a card owes, in its currency. */
  protected owedOf(wallet: Wallet): string {
    return formatMoney(
      this.walletService.owed(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
  }

  /** Own: the wallet's sheet; shared: its transactions (no wallet changes, sharing rule 10). */
  protected openWallet(wallet: Wallet): void {
    if (this.shared()) {
      this.transactionService.selectWallet(wallet.id)
      void this.router.navigateByUrl('/transactions')
      return
    }
    this.walletService.open({ mode: 'edit', id: wallet.id })
  }

  /** A drag ended: the wallet moves to where it was dropped. */
  protected drop(event: CdkDragDrop<unknown>): void {
    const wallet = this.walletService.openWallets().at(event.previousIndex)
    if (wallet) {
      this.walletService.moveTo(wallet.id, event.currentIndex)
    }
  }

  /** The handle's keyboard way (DESIGN.md §8: a drag is never the only way). */
  protected moveBy(event: Event, id: string, step: -1 | 1): void {
    event.preventDefault()
    // The row's place now, not the rendered one: a second press may come before the re-render.
    const index = this.walletService.openWallets().findIndex((item) => item.id === id)
    this.walletService.moveTo(id, index + step)
    const target = event.target
    // The row re-renders in its new place; keep the focus on its handle.
    queueMicrotask(() => target instanceof HTMLElement && target.focus())
  }
}
