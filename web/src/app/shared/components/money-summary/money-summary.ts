import { Component, computed, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideCreditCard, lucideWallet } from '@ng-icons/lucide'
import { glyphColor, userColor } from '@/shared/components/icon-badge'

/** How the expense was paid, already formatted (signed): cash / transfer vs credit cards. */
export interface MoneySplit {
  own: string
  card: string
  /** The card wallet's colour, as stored (the first open card's). */
  cardColor: string
}

/** One currency's figures, already formatted (signed) for display. */
export interface MoneySummaryLine {
  income: string
  /** Whether there is any income: the amount takes the income colour only then. */
  hasIncome: boolean
  expense: string
  /** Income − expense. */
  net: string
  /** Transfers in − out; `null` hides the line (they cancel out). */
  transfer: string | null
  /** Debt entries in − out; `null` hides the line. */
  debt: string | null
  /** Cash / transfer vs card spending; absent or `null` hides it (one wallet, or one kind). */
  split?: MoneySplit | null
}

/**
 * The period's summary card (transaction rule 11, DESIGN.md §6): income top left, expense top
 * right, net under the expense, and under the income how the expense was paid (on
 * "ทุกกระเป๋า"); then the transfer and debt lines when they don't cancel out. One card for the
 * Transactions tab and a wallet shared with me, so the two never drift apart.
 */
@Component({
  selector: 'app-money-summary-card',
  imports: [TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideCreditCard, lucideWallet })],
  host: { class: 'block' },
  templateUrl: './money-summary.html',
})
export class MoneySummaryCard {
  line = input.required<MoneySummaryLine>()

  /** The card chip in the card wallet's colour, its glyph readable on it. */
  protected cardFill = computed(() => {
    const split = this.line().split
    if (!split) {
      return null
    }
    const fill = userColor(split.cardColor)
    return { fill, glyph: glyphColor(fill) }
  })
}
