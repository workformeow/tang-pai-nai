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
  template: `
    <app-period-strip
      class="pt-2"
      [chips]="view.chips()"
      [selected]="reportService.tab()"
      [label]="'transactions.periods' | transloco"
      (chosen)="view.choose($event)"
    />
    <div class="flex flex-col gap-3 px-4 pt-1 pb-4" appSwipe (swiped)="view.move($event)">
      <p
        class="flex items-center gap-1.5 self-start rounded-full bg-muted px-3 py-1 text-sm text-muted-foreground"
      >
        <ng-icon name="lucideWallet" size="14" aria-hidden="true" />
        {{ 'reports.overviewScope' | transloco }}
      </p>
      @if (rows().length > 0) {
        <ul
          class="flex flex-col rounded-xl border border-border bg-card px-4 text-card-foreground"
          [attr.aria-label]="'reports.overviewTitle' | transloco"
        >
          @for (row of rows(); track row.code) {
            <li class="flex flex-col gap-1 border-b border-border py-3 last:border-b-0">
              <div class="flex items-center gap-3">
                <span class="flex w-16 shrink-0 items-center gap-1.5 text-sm font-semibold">
                  <app-currency-flag class="h-3.5 w-5" [code]="row.code" />
                  {{ row.code }}
                </span>
                <span class="min-w-0 flex-1 truncate text-sm tabular-nums">
                  <span class="sr-only">{{ 'categories.income' | transloco }}</span>
                  <span class="text-income">{{ row.income }}</span>
                  <span class="text-muted-foreground" aria-hidden="true"> · </span>
                  <span class="sr-only">{{ 'categories.expense' | transloco }}</span>
                  <span class="text-expense">{{ row.expense }}</span>
                </span>
                <span class="shrink-0 text-lg font-semibold tabular-nums">
                  <span class="sr-only">{{ 'reports.net' | transloco }}</span>
                  {{ row.net }}
                </span>
              </div>
              <div class="flex justify-between gap-3 pl-19 text-xs text-muted-foreground">
                <span>
                  @if (row.wallets > 0) {
                    {{
                      'reports.walletCount' + (row.wallets === 1 ? 'One' : '')
                        | transloco: { count: row.wallets }
                    }}
                  }
                </span>
                <span class="tabular-nums">{{ 'reports.end' | transloco }} {{ row.end }}</span>
              </div>
            </li>
          }
        </ul>
      } @else {
        <app-empty-state
          [heading]="'reports.emptyHeading' | transloco"
          [description]="'reports.overviewEmpty' | transloco"
        >
          <ng-icon name="lucideChartPie" />
        </app-empty-state>
      }
    </div>
    <!-- The header's "ดูตาม › กำหนดเอง" on this page. -->
    @defer (when reportService.customSheet()) {
      <app-custom-range-sheet
        [(open)]="reportService.customSheet"
        [range]="reportService.custom()"
        (applied)="reportService.selectCustom($event)"
      />
    }
  `,
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
