import { Component, computed, inject, input, output } from '@angular/core'
import { RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideArrowDownLeft, lucideArrowUpRight, lucideChevronRight } from '@ng-icons/lucide'
import type { CategoryType } from '@/core/category'
import { LanguageService } from '@/core/i18n'
import type { ReportSummary } from '@/core/report'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import { formatAmount } from '@/shared/utils'

/**
 * The Reports tab's summary card for the chosen currency (report.md → Web screens, owner's
 * choice H1 in #10, B in #23): its flag and code in the heading, income and expense as the
 * headline in tinted tiles that also choose the breakdown's type, the net on
 * one line under them, the balances on one line
 * (rule 9), and small notes for the average per day (rule 10), the transfers and the rows left
 * out (rule 11), each only when it has something to say.
 */
@Component({
  selector: 'app-report-summary-card',
  imports: [RouterLink, TranslocoPipe, NgIcon, CurrencyFlag],
  providers: [provideIcons({ lucideArrowDownLeft, lucideArrowUpRight, lucideChevronRight })],
  templateUrl: './summary-card.html',
})
export class ReportSummaryCard {
  private languageService = inject(LanguageService)

  line = input.required<ReportSummary>()
  /** The period by name (`ต.ค. 2026`). */
  period = input.required<string>()
  /** The breakdown's type, outlined on its tile. */
  type = input.required<CategoryType>()
  typeChosen = output<CategoryType>()

  protected money = computed(() => {
    const line = this.line()
    const locale = this.languageService.locale()
    const format = (minor: number, signed = false) =>
      formatAmount(minor, line.minorUnit, locale, signed)
    return {
      net: format(line.net, true),
      income: format(line.income, true),
      expense: format(-line.expense, true),
      start: format(line.start),
      end: format(line.end),
      perDay: line.perDay !== null && line.expense > 0 ? format(line.perDay) : null,
      transfer: line.transfer ? format(line.transfer, true) : null,
      debt: line.debt ? format(line.debt, true) : null,
      excluded: format(line.excluded, true),
    }
  })
}
