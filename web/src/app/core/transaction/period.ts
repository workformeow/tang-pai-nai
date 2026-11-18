import { addDays, addMonths, fromDay, toDay } from '@/shared/utils'
import type { DayRange } from './transaction.type'

/** "ดูตาม" in the ⋮ menu (transaction.md → Web screens). */
export type PeriodUnit = 'day' | 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom'

export const PERIOD_UNITS: readonly PeriodUnit[] = [
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'all',
  'custom',
]

/** The month view's last tab: every row after this month (decided at the start of #8). */
export const FUTURE = 'future'

/** One tab under the header: an offset from the current period (0, −1, …) or the future. */
export type PeriodTab = number | typeof FUTURE

/** The first day of the period `offset` periods from the one holding `today`. */
const startOf = (unit: PeriodUnit, today: string, offset: number): string => {
  const date = fromDay(today)
  switch (unit) {
    case 'day':
      return addDays(today, offset)
    case 'week': {
      // Weeks start on Monday.
      const monday = addDays(today, -((date.getDay() + 6) % 7))
      return addDays(monday, offset * 7)
    }
    case 'month':
      return addMonths(`${today.slice(0, 8)}01`, offset)
    case 'quarter': {
      const first = `${today.slice(0, 5)}${String(Math.floor(date.getMonth() / 3) * 3 + 1).padStart(2, '0')}-01`
      return addMonths(first, offset * 3)
    }
    case 'year':
      return `${date.getFullYear() + offset}-01-01`
    default:
      return today
  }
}

const LENGTH: Partial<Record<PeriodUnit, (start: string) => string>> = {
  day: (start) => start,
  week: (start) => addDays(start, 6),
  month: (start) => addDays(addMonths(start, 1), -1),
  quarter: (start) => addDays(addMonths(start, 3), -1),
  year: (start) => addDays(addMonths(start, 12), -1),
}

/**
 * The days a tab covers; `custom` is the range the user chose.
 * e.g. today `'2026-11-18'`: `periodRange('month', 0, today, none)` → `{ from: '2026-11-01', to: '2026-11-30' }`,
 * `('week', -1, …)` → `{ from: '2026-11-09', to: '2026-11-15' }` (weeks start on Monday),
 * `('month', 'future', …)` → `{ from: '2026-12-01', to: null }`, `('all', 0, …)` → `{ from: null, to: null }`
 */
export const periodRange = (
  unit: PeriodUnit,
  tab: PeriodTab,
  today: string,
  custom: DayRange
): DayRange => {
  if (unit === 'all') {
    return { from: null, to: null }
  }
  if (unit === 'custom') {
    return custom
  }
  if (tab === FUTURE) {
    // Rows after the current period (only the month view has this tab).
    const end = LENGTH[unit]?.(startOf(unit, today, 0)) ?? today
    return { from: addDays(end, 1), to: null }
  }
  const start = startOf(unit, today, tab)
  return { from: start, to: LENGTH[unit]?.(start) ?? start }
}

/**
 * The tabs of `unit`, oldest first: back to the period holding `firstDay` (the book's oldest
 * transaction), at least the previous one, then the current one; the month view ends with the
 * future. `all` and `custom` have one tab.
 * e.g. `periodTabs('month', '2026-11-18', '2026-08-03')` → `[-3, -2, -1, 0, 'future']`,
 * `periodTabs('year', '2026-11-18', null)` → `[-1, 0]`
 */
export const periodTabs = (
  unit: PeriodUnit,
  today: string,
  firstDay: string | null
): PeriodTab[] => {
  if (unit === 'all' || unit === 'custom') {
    return [0]
  }
  let back = 1
  if (firstDay && firstDay < today) {
    // Count whole periods between the oldest row's period and today's, capped for very old data.
    while (back < 400 && startOf(unit, today, -back) > firstDay) {
      back += 1
    }
  }
  const tabs: PeriodTab[] = Array.from({ length: back + 1 }, (_, i) => i - back)
  return unit === 'month' ? [...tabs, FUTURE] : tabs
}

/** The label's pieces; the page translates `key` or shows `text` (always ค.ศ.). */
export type PeriodLabel = { key: string } | { text: string }

const pad = (value: number) => String(value).padStart(2, '0')
const dm = (day: string) => `${day.slice(8, 10)}/${day.slice(5, 7)}`
const dmy = (day: string) => `${dm(day)}/${day.slice(0, 4)}`

/**
 * A tab's label: a key for this and the last period, else dates (ค.ศ.).
 * e.g. today `'2026-11-18'`: `periodLabel('month', 0, today, none)` → `{ key: 'transactions.period.monthThis' }`,
 * `('month', -2, …)` → `{ text: '09/2026' }`, `('quarter', -2, …)` → `{ text: 'Q2 2026' }`,
 * `('week', -2, …)` → `{ text: '02/11 – 08/11/2026' }`,
 * `('custom', 0, today, { from: '2026-11-01', to: null })` → `{ text: '01/11/2026 – …' }`
 */
export const periodLabel = (
  unit: PeriodUnit,
  tab: PeriodTab,
  today: string,
  custom: DayRange
): PeriodLabel => {
  if (unit === 'all') {
    return { key: 'transactions.period.all' }
  }
  if (unit === 'custom') {
    return { text: `${custom.from ? dmy(custom.from) : '…'} – ${custom.to ? dmy(custom.to) : '…'}` }
  }
  if (tab === FUTURE) {
    return { key: 'transactions.period.future' }
  }
  if (tab === 0 || tab === -1) {
    return { key: `transactions.period.${unit}${tab === 0 ? 'This' : 'Last'}` }
  }
  const { from, to } = periodRange(unit, tab, today, custom)
  const start = from ?? today
  const date = fromDay(start)
  switch (unit) {
    case 'day':
      return { text: dmy(start) }
    case 'week':
      return { text: `${dm(start)} – ${dmy(to ?? start)}` }
    case 'month':
      return { text: `${pad(date.getMonth() + 1)}/${date.getFullYear()}` }
    case 'quarter':
      return { text: `Q${Math.floor(date.getMonth() / 3) + 1} ${date.getFullYear()}` }
    default:
      return { text: String(date.getFullYear()) }
  }
}

/** Today on this device. */
export const today = (): string => toDay()
