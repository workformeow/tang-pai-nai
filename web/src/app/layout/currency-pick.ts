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
  template: `
    <div class="flex flex-col gap-3">
      @for (group of groups(); track group.key) {
        @let headingId = idPrefix + '-' + group.key;
        <p class="-mb-1 text-sm text-muted-foreground" [id]="headingId">
          {{ 'currencyGroups.' + group.key | transloco }}
        </p>
        <div
          class="grid grid-cols-5 justify-items-center gap-x-1 gap-y-3"
          role="group"
          [attr.aria-labelledby]="headingId"
        >
          @for (code of group.codes; track code) {
            @let picked = code === value();
            <button
              type="button"
              class="flex w-full flex-col items-center gap-1 rounded-xl py-1 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              [class.text-brand]="picked"
              [attr.aria-pressed]="picked"
              [attr.aria-label]="names()[code] ?? code"
              (click)="chosen.emit(code)"
            >
              <span
                class="grid size-12 place-items-center rounded-full"
                [class.ring-2]="picked"
                [class.ring-primary]="picked"
              >
                <app-currency-flag class="size-10" shape="round" [code]="code" />
              </span>
              {{ code }}
            </button>
          }
        </div>
      }
    </div>
  `,
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
