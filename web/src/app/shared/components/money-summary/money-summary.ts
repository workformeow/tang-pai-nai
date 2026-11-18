import { Component, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'

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
}

/**
 * The period's summary card (transaction rule 11, DESIGN.md §6): income on the left, expense
 * right-aligned, net under a line, then the transfer and debt lines when they don't cancel out.
 * One card for the Transactions tab and a wallet shared with me, so the two never drift apart.
 */
@Component({
  selector: 'app-money-summary-card',
  imports: [TranslocoPipe],
  host: { class: 'block' },
  templateUrl: './money-summary.html',
})
export class MoneySummaryCard {
  line = input.required<MoneySummaryLine>()
}
