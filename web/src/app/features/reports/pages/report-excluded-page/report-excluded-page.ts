import { Component, computed, inject } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { ReportService } from '@/core/report'
import { TransactionService } from '@/core/transaction'
import { ReportDayList } from '@/features/reports/components/day-list'
import { reportView } from '@/features/reports/report-view'
import { PeriodStrip, Swipe } from '@/shared/components/period'

/**
 * "ไม่รวมในรายงาน n รายการ" (report.md rule 11, E5): the period's rows marked
 * `excludeFromReport` in the wallets in view, so a total that looks low is explained. A row
 * opens the transaction sheet (where the switch can be turned off).
 */
@Component({
  selector: 'app-report-excluded-page',
  imports: [TranslocoPipe, PeriodStrip, Swipe, ReportDayList],
  host: { class: 'flex flex-col' },
  templateUrl: './report-excluded-page.html',
})
export class ReportExcludedPage {
  protected reportService = inject(ReportService)
  private transactionService = inject(TransactionService)
  protected view = reportView()

  protected items = computed(() =>
    this.transactionService.list(this.reportService.range(), this.reportService.walletIds(), {
      report: 'excluded',
      currencyCode: this.reportService.currencyCode() ?? undefined,
    })
  )
  protected showWallet = computed(() => this.transactionService.viewWallet() === null)
}
