import { Component, input } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import type { MoneySummaryLine } from './money-summary'

/** A line of the "ทั้งหมด" table: one currency's figures. */
export type MoneySummaryRow = MoneySummaryLine & { currencyCode: string }

/**
 * Every currency of the period, one compact row each (owner 2026-11: the Transactions tab's
 * "ทั้งหมด" chip), instead of a summary card per currency stacked above the list.
 */
@Component({
  selector: 'app-money-summary-table',
  imports: [TranslocoPipe, CurrencyFlag],
  host: { class: 'block' },
  templateUrl: './money-summary-table.html',
})
export class MoneySummaryTable {
  lines = input.required<MoneySummaryRow[]>()
}
