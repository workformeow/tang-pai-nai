import { NgTemplateOutlet } from '@angular/common'
import { Component, computed, inject, model, signal } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCheck, lucideChevronDown, lucidePlus, lucideWallet } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { BookService } from '@/core/book'
import { LanguageService } from '@/core/i18n'
import { TransactionService } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import type { Wallet } from '@/core/wallet'
import { IconBadge, WALLET_DEFAULT_ICON } from '@/shared/components/icon-badge'
import { SheetFrame } from '@/shared/components/sheet'
import { formatMoney } from '@/shared/utils'

/**
 * The Transactions tab's wallet switcher (transaction.md → Web screens): "ทุกกระเป๋า" with the
 * total, the open wallets with their balances, "เพิ่มกระเป๋าเงิน", then the archived ones folded.
 * Adding closes this sheet and opens the wallet sheet over the same page (owner, 2026-11: no
 * page change, the view stays as it was).
 */
@Component({
  selector: 'app-view-wallet-sheet',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    NgIcon,
    HlmButton,
    HlmDrawerImports,
    IconBadge,
    SheetFrame,
  ],
  providers: [provideIcons({ lucideCheck, lucideChevronDown, lucidePlus, lucideWallet })],
  templateUrl: './view-wallet-sheet.html',
})
export class ViewWalletSheet {
  protected walletService = inject(WalletService)
  private transactionService = inject(TransactionService)
  protected bookService = inject(BookService)
  private languageService = inject(LanguageService)

  open = model(false)

  protected defaultIcon = WALLET_DEFAULT_ICON
  protected showArchived = signal(false)
  protected current = computed(() => this.transactionService.viewWallet()?.id ?? null)
  /** Wallet rule 7: the total per currency, joined on one line. */
  protected totalText = computed(() => {
    const locale = this.languageService.locale()
    const totals = this.walletService.totals()
    const code = this.walletService.defaultCurrency()
    const lines =
      totals.length > 0
        ? totals
        : [{ currencyCode: code, minorUnit: this.walletService.minorUnit(code), amount: 0 }]
    return lines
      .map((line) => formatMoney(line.amount, line.currencyCode, line.minorUnit, locale))
      .join(' · ')
  })

  protected balanceText(wallet: Wallet): string {
    return formatMoney(
      this.walletService.balance(wallet),
      wallet.currencyCode,
      this.walletService.minorUnit(wallet.currencyCode),
      this.languageService.locale()
    )
  }

  protected add(): void {
    this.open.set(false)
    this.walletService.open({ mode: 'create' })
  }

  protected pick(id: string | null): void {
    this.transactionService.selectWallet(id)
    this.open.set(false)
  }
}
