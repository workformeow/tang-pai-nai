import { Component, computed, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChartPie } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { ReportService } from '@/core/report'
import { PeriodService, TransactionService } from '@/core/transaction'
import { ReportShareList } from '@/features/reports/components/share-list'
import { ReportSummaryCard } from '@/features/reports/components/summary-card'
import { ReportTrend } from '@/features/reports/components/trend-chart'
import { reportView } from '@/features/reports/report-view'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import { EmptyState } from '@/shared/components/empty-state'
import { PeriodStrip, Swipe } from '@/shared/components/period'

/**
 * The Reports tab (docs/features/report.md → Web screens, owner's choices in #10). The header
 * (layout/transactions-header, `view="reports"`) holds the wallet switcher and "ดูตาม"; this
 * page shows the period chips, the summary card per currency (H1), the breakdown by top-level
 * category (Q1-B), then the trend for a period longer than a month (rule 7), in the order a
 * report is read: how much came in and went out, what it went on, how it moved. Everything is
 * read from the local database.
 */
@Component({
  selector: 'app-reports-page',
  imports: [
    TranslocoPipe,
    NgIcon,
    HlmButton,
    CurrencyFlag,
    EmptyState,
    PeriodStrip,
    Swipe,
    ReportSummaryCard,
    ReportTrend,
    ReportShareList,
  ],
  providers: [provideIcons({ lucideChartPie })],
  host: { class: 'flex flex-col' },
  templateUrl: './reports-page.html',
})
export class ReportsPage {
  protected reportService = inject(ReportService)
  protected periodService = inject(PeriodService)
  protected transactionService = inject(TransactionService)
  protected view = reportView()

  /** The chosen currency's summary: the one card the page shows (B in #23). */
  protected summary = computed(() =>
    this.reportService
      .summaries()
      .find((item) => item.currencyCode === this.reportService.currencyCode())
  )

  /** The chosen type's total in the chosen currency: the base of every share. */
  protected typeTotal = computed(() => {
    const line = this.summary()
    if (!line) {
      return 0
    }
    return this.reportService.type() === 'income' ? line.income : line.expense
  })
}
