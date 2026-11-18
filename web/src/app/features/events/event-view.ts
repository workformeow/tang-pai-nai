import type { EventItem, EventMoney, TripEvent } from '@/core/event'
import { shortDate } from '@/core/recurring'
import { fromDay, formatMoney } from '@/shared/utils'

type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * An event's dates (Thai `t`, the app's Thai locale).
 * e.g. 7 to 12 Nov 2026 → `'7–12 พ.ย. 2026'`; from 1 Oct 2026 without an end → `'ตั้งแต่ 1 ต.ค. 2026'`
 */
export const eventDates = (event: TripEvent, t: Translate, locale: string): string =>
  event.endOn
    ? new Intl.DateTimeFormat(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      }).formatRange(fromDay(event.startOn), fromDay(event.endOn))
    : t('events.since', { date: shortDate(event.startOn, locale) })

/**
 * The expense of each currency, "0.00" in THB when nothing is tagged yet.
 * e.g. `expenseLines([], locale)` → `['฿0.00']`; THB 150050 and JPY 19930 → `['฿1,500.50', '¥19,930']`
 */
export const expenseLines = (money: readonly EventMoney[], locale: string): string[] =>
  money.length === 0
    ? [formatMoney(0, 'THB', 2, locale)]
    : money.map((line) => formatMoney(line.expense, line.currencyCode, line.minorUnit, locale))

/**
 * `events.<key>` with `count`, or its `<key>One` form for one.
 * e.g. (Thai) `counted(t, 'rows', 3)` → `'3 รายการ'`, `counted(t, 'rows', 1)` → `'1 รายการ'`
 */
export const counted = (t: Translate, key: string, count: number): string =>
  t(`events.${key}${count === 1 ? 'One' : ''}`, { count })

/** A row of the events list (mock-up frame 1). */
export const eventRow = (item: EventItem, t: Translate, locale: string) => ({
  item,
  dates: eventDates(item.event, t, locale),
  expense: expenseLines(item.money, locale).join(' · '),
  count: counted(t, 'rows', item.count),
})
