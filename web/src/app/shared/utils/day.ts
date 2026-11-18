// Calendar days of transactions (ROADMAP → Money & data): `YYYY-MM-DD` in the device's local
// time, Gregorian. The era (พ.ศ.) is display only.

const pad = (value: number, size = 2) => String(value).padStart(size, '0')

/** The device's local date as `YYYY-MM-DD`. e.g. `toDay(new Date(2026, 10, 18))` → `'2026-11-18'` */
export const toDay = (date: Date = new Date()): string =>
  `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/**
 * `YYYY-MM-DD` as a local Date at noon (safe from DST edges).
 * e.g. `fromDay('2026-11-18')` → `new Date(2026, 10, 18, 12)`
 */
export const fromDay = (day: string): Date => {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date, 12)
}

/**
 * `day` moved by `days` (may be negative).
 * e.g. `addDays('2026-11-30', 1)` → `'2026-12-01'`, `addDays('2026-01-01', -1)` → `'2025-12-31'`
 */
export const addDays = (day: string, days: number): string => {
  const date = fromDay(day)
  date.setDate(date.getDate() + days)
  return toDay(date)
}

/**
 * `day` moved by `months`, clamped to the target month's last day.
 * e.g. `addMonths('2026-01-31', 1)` → `'2026-02-28'`, `addMonths('2026-11-18', -12)` → `'2025-11-18'`
 */
export const addMonths = (day: string, months: number): string => {
  const date = fromDay(day)
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1, 12)
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0, 12).getDate()
  target.setDate(Math.min(date.getDate(), last))
  return toDay(target)
}

/**
 * Whether `value` is a real `YYYY-MM-DD` date.
 * e.g. `isDay('2028-02-29')` → `true`, `isDay('2026-02-29')` → `false`
 */
export const isDay = (value: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) && toDay(fromDay(value)) === value
