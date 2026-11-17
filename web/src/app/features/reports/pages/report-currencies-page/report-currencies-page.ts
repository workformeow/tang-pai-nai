import { Component, computed, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChartPie, lucideWallet } from '@ng-icons/lucide'
import { LanguageService } from '@/core/i18n'
import { ReportService } from '@/core/report'
import { reportView } from '@/features/reports/report-view'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import { EmptyState } from '@/shared/components/empty-state'
import { CustomRangeSheet, PeriodStrip, Swipe } from '@/shared/components/period'
import { formatAmount, formatMoney } from '@/shared/utils'

/**
 * "ภาพรวม" (#24, P1 of mockups/currency-overview.html): every currency of the Reports
 * period side by side, one row each, over every counted wallet of the book whatever the wallet
 * switcher chose. The period is the Reports tab's own (the header's unit menu, the chips, the
 * swipe), so going back keeps it. Rows are not links: ‹ is the way back.
 */
@Component({
  selector: 'app-report-currencies-page',
  imports: [TranslocoPipe, NgIcon, CurrencyFlag, EmptyState, PeriodStrip, Swipe, CustomRangeSheet],
  providers: [provideIcons({ lucideChartPie, lucideWallet })],
  host: { class: 'flex flex-col' },
  templateUrl: './report-currencies-page.html',
})
export class ReportCurrenciesPage {
  protected reportService = inject(ReportService)
  private languageService = inject(LanguageService)
  protected view = reportView()

  /** One row per currency in currency order (rule 6), each in its own digits. */
  protected rows = computed(() => {
    const locale = this.languageService.locale()
    const counts = this.reportService.walletCounts()
    return this.reportService.overview().map((line) => ({
      code: line.currencyCode,
      income: formatAmount(line.income, line.minorUnit, locale, true),
      expense: formatAmount(-line.expense, line.minorUnit, locale, true),
      net: formatMoney(line.net, line.currencyCode, line.minorUnit, locale, true),
      end: formatMoney(line.end, line.currencyCode, line.minorUnit, locale),
      wallets: counts.get(line.currencyCode) ?? 0,
    }))
  })
}
