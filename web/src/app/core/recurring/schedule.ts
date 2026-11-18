import { addDays, addMonths, fromDay } from '@/shared/utils'
import type { RecurringSchedule } from './recurring.type'

// docs/features/recurring.md rule 3: occurrence k is `startOn` + k × `interval` units, always
// counted from `startOn` (so the 31st comes back after a short month).

const DAY_MS = 86_400_000

const daysBetween = (from: string, to: string): number =>
  Math.round((fromDay(to).getTime() - fromDay(from).getTime()) / DAY_MS)

const monthsBetween = (from: string, to: string): number =>
  (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 +
  (Number(to.slice(5, 7)) - Number(from.slice(5, 7)))

// The e.g. lines use `monthly` = every month from `'2026-01-31'`, and `end3` = the same with
// `endCount: 3`.

/**
 * The day of occurrence `k` (0 = `startOn`); a missing day of the month is its last day.
 * e.g. `occurrenceOn(monthly, 1)` → `'2026-02-28'`, `occurrenceOn(monthly, 2)` → `'2026-03-31'`
 */
export const occurrenceOn = (schedule: RecurringSchedule, k: number): string => {
  const { startOn, frequency, interval } = schedule
  switch (frequency) {
    case 'day':
      return addDays(startOn, k * interval)
    case 'week':
      return addDays(startOn, k * interval * 7)
    case 'month':
      return addMonths(startOn, k * interval)
    default:
      return addMonths(startOn, k * interval * 12)
  }
}

/** The index of the first occurrence on or after `day`. e.g. `indexOnOrAfter(monthly, '2026-03-01')` → `2` */
export const indexOnOrAfter = (schedule: RecurringSchedule, day: string): number => {
  if (day <= schedule.startOn) {
    return 0
  }
  const { frequency, interval } = schedule
  let k =
    frequency === 'day' || frequency === 'week'
      ? Math.ceil(daysBetween(schedule.startOn, day) / (interval * (frequency === 'week' ? 7 : 1)))
      : Math.max(
          0,
          Math.floor(
            monthsBetween(schedule.startOn, day) / (interval * (frequency === 'year' ? 12 : 1))
          )
        )
  while (occurrenceOn(schedule, k) < day) {
    k += 1
  }
  return k
}

/** Whether occurrence `k` is past the rule's end (rule 3). e.g. `isPastEnd(end3, 2)` → `false`, `isPastEnd(end3, 3)` → `true` */
export const isPastEnd = (schedule: RecurringSchedule, k: number): boolean =>
  (schedule.endCount !== null && k >= schedule.endCount) ||
  (schedule.endOn !== null && occurrenceOn(schedule, k) > schedule.endOn)

/**
 * The first occurrence on or after `day` that the rule still has, or null (ended).
 * e.g. `nextOnOrAfter(monthly, '2026-02-15')` → `'2026-02-28'`, `nextOnOrAfter(end3, '2026-04-01')` → `null`
 */
export const nextOnOrAfter = (schedule: RecurringSchedule, day: string): string | null => {
  const k = indexOnOrAfter(schedule, day)
  return isPastEnd(schedule, k) ? null : occurrenceOn(schedule, k)
}

/** The rule's last occurrence, when it has an end. e.g. `lastOccurrence(end3)` → `'2026-03-31'`, `monthly` → `null` */
export const lastOccurrence = (schedule: RecurringSchedule): string | null => {
  if (schedule.endCount !== null) {
    const day = occurrenceOn(schedule, schedule.endCount - 1)
    return schedule.endOn !== null && day > schedule.endOn ? null : day
  }
  if (schedule.endOn !== null) {
    const k = indexOnOrAfter(schedule, addDays(schedule.endOn, 1))
    return k === 0 ? null : occurrenceOn(schedule, k - 1)
  }
  return null
}

/**
 * The occurrences from `from` to `to` (both included), at most `max`.
 * e.g. `occurrencesBetween(monthly, '2026-01-01', '2026-04-30', 10)` →
 * `['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']`; with `max` 2 → the first two
 */
export const occurrencesBetween = (
  schedule: RecurringSchedule,
  from: string,
  to: string,
  max = 400
): string[] => {
  const days: string[] = []
  for (let k = indexOnOrAfter(schedule, from); days.length < max && !isPastEnd(schedule, k); k++) {
    const day = occurrenceOn(schedule, k)
    if (day > to) {
      break
    }
    days.push(day)
  }
  return days
}
