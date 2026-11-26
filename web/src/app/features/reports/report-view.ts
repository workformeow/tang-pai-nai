import { computed, inject } from '@angular/core'
import { TranslocoService } from '@jsverse/transloco'
import { LanguageService } from '@/core/i18n'
import { ReportService } from '@/core/report'
import { FUTURE, PeriodService } from '@/core/transaction'
import type { PeriodUnit } from '@/core/transaction'
import { formatAmount, fromDay } from '@/shared/utils'

/** `dd/mm/yyyy`, as the period chips write dates (ค.ศ.). */
const dmy = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`

/**
 * A period by name, not by distance (`ต.ค. 2026`, `Q3 2026`, `2026`, `01/10/2026 – 15/10/2026`),
 * for the summary's heading and a category's share line.
 * e.g. (the app's Thai locale) `periodName('month', { from: '2026-10-01', to: '2026-10-31' }, locale)` →
 * `'ต.ค. 2026'`; `'quarter'` from `'2026-07-01'` → `'Q3 2026'`; `'custom'` 1–15 Oct →
 * `'01/10/2026 – 15/10/2026'`
 */
export const periodName = (
  unit: PeriodUnit,
  range: { from: string; to: string },
  locale: string
): string => {
  const date = fromDay(range.from)
  switch (unit) {
    case 'month':
      return new Intl.DateTimeFormat(locale, { month: 'short', year: 'numeric' }).format(date)
    case 'quarter':
      return `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}`
    case 'year':
      return String(date.getFullYear())
    case 'day':
      return dmy(range.from)
    default:
      return `${dmy(range.from)} – ${dmy(range.to)}`
  }
}

/**
 * A share of a whole as a rounded percentage (display only; the amounts stay exact).
 * e.g. `sharePercent(1, 3, locale)` → `'33.3%'`, `sharePercent(5, 0, locale)` → `'0%'`
 */
export const sharePercent = (part: number, whole: number, locale: string): string =>
  new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 }).format(
    whole > 0 ? part / whole : 0
  )

/**
 * The period's name and the money formatting every report page shares (call in an injection
 * context). The chips and the swipe are `PeriodService`'s, shared with the Transactions tab.
 */
export const reportView = () => {
  const reportService = inject(ReportService)
  const periodService = inject(PeriodService)
  const languageService = inject(LanguageService)
  const transloco = inject(TranslocoService)

  return {
    /** The chosen period by name; "อนาคต" and "ทั้งหมด" by their chip's word. */
    period: computed(() => {
      languageService.language()
      const unit = periodService.unit()
      if (periodService.tab() === FUTURE || unit === 'all') {
        return transloco.translate(
          unit === 'all' ? 'transactions.period.all' : 'transactions.period.future'
        )
      }
      return periodName(unit, reportService.range(), languageService.locale())
    }),
    /** Signed figures without the symbol (one currency in view, as the Transactions tab). */
    amount: (minor: number, signed = true) =>
      formatAmount(minor, reportService.minorUnit(), languageService.locale(), signed),
  }
}
