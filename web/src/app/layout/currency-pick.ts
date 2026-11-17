import { Component, computed, inject, input, output } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { LanguageService } from '@/core/i18n'
import { WalletService } from '@/core/wallet'
import { CURRENCY_GROUPS, CurrencyFlag } from '@/shared/components/currency-flag'
import type { CurrencyGroup } from '@/shared/components/currency-flag'

let nextId = 0

/**
 * The wallet sheet's "สกุลเงิน" view (docs/features/currency.md → Web screens, mock-up 2B): the
 * book's own currencies first, then one grid of round flags per continent. Names are only in the
 * buttons' labels. Picking emits `chosen`; the sheet goes back to the form.
 */
@Component({
  selector: 'app-currency-pick',
  imports: [TranslocoPipe, CurrencyFlag],
  templateUrl: './currency-pick.html',
})
export class CurrencyPick {
  private walletService = inject(WalletService)
  private languageService = inject(LanguageService)

  /** The form's currency. */
  value = input.required<string>()
  /** The wallet's own currency, kept even if it was switched off since (currency rule 3). */
  own = input<string | null>(null)
  /** The book whose wallets make the first group. */
  bookId = input<string | null>(null)
  chosen = output<string>()

  protected idPrefix = `currency-pick-${nextId++}`

  /** Currency rule 3: active ones, plus the wallet's own. */
  private pickable = computed(() => {
    const own = this.own()
    return this.walletService
      .currencies()
      .filter((currency) => currency.isActive || currency.code === own)
      .map((currency) => currency.code)
  })

  protected groups = computed<CurrencyGroup[]>(() => {
    const pickable = new Set(this.pickable())
    const bookId = this.bookId()
    const inBook = bookId
      ? this.walletService.bookCurrencies(bookId).filter((code) => pickable.has(code))
      : []
    const grouped = new Set(CURRENCY_GROUPS.flatMap((group) => group.codes))
    // Rule 9: a code the web doesn't map goes into "อื่น ๆ".
    const other = this.pickable().filter((code) => !grouped.has(code))
    return [
      { key: 'inBook', codes: inBook },
      ...CURRENCY_GROUPS.map((group) => ({
        key: group.key,
        codes: group.codes.filter((code) => pickable.has(code)),
      })),
      { key: 'other', codes: other },
    ].filter((group) => group.codes.length > 0)
  })

  /** Full names for the labels (`Intl.DisplayNames`), in the UI language. */
  protected names = computed<Record<string, string | undefined>>(() => {
    const names = new Intl.DisplayNames(this.languageService.locale(), { type: 'currency' })
    return Object.fromEntries(this.pickable().map((code) => [code, names.of(code)]))
  })
}
