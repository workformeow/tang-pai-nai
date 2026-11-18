import { addDays, fromDay } from '@/shared/utils'
import { lastOccurrence, nextOnOrAfter, occurrencesBetween } from './schedule'
import type { RecurringSchedule, RepeatValues, RuleItem } from './recurring.type'

// The e.g. lines use the Thai `t` and the app's Thai locale `th-TH-u-ca-gregory` as `locale`.

/** A translate function (`TranslocoService.translate`). */
export type Translate = (key: string, params?: Record<string, unknown>) => string

/**
 * A day as the app writes it in a line.
 * e.g. `shortDate('2026-11-25', locale)` → `'25 พ.ย. 2026'`,
 * `shortDate('2026-11-25', 'en-GB', false)` → `'25 Nov'`
 */
export const shortDate = (day: string, locale: string, withYear = true): string =>
  new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  }).format(fromDay(day))

/**
 * How often a rule repeats, from `startOn` (rule 3).
 * e.g. `describeRepeat({ frequency: 'month', interval: 1 }, '2026-11-25', t, locale)` →
 * `'ทุกเดือน วันที่ 25'`; `{ frequency: 'week', interval: 2 }` from `'2026-11-20'` →
 * `'ทุก 2 สัปดาห์ วันศุกร์'`; `{ frequency: 'year', interval: 1 }` → `'ทุกปี 25 พ.ย.'`
 */
export const describeRepeat = (
  repeat: Pick<RepeatValues, 'frequency' | 'interval'>,
  startOn: string,
  t: Translate,
  locale: string
): string => {
  const date = fromDay(startOn)
  const params = {
    n: repeat.interval,
    weekday: new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(date),
    day: date.getDate(),
    date: shortDate(startOn, locale, false),
  }
  return t(`recurring.${repeat.interval === 1 ? 'every' : 'everyN'}.${repeat.frequency}`, params)
}

/**
 * How a rule ends.
 * e.g. `describeEnd({ endOn: null, endCount: null }, t, locale)` → `'ไม่สิ้นสุด'`,
 * `{ endOn: '2027-12-31', endCount: null }` → `'ถึง 31 ธ.ค. 2027'`, `{ endOn: null, endCount: 12 }` →
 * `'12 ครั้ง'`
 */
export const describeEnd = (
  repeat: Pick<RepeatValues, 'endOn' | 'endCount'>,
  t: Translate,
  locale: string
): string => {
  if (repeat.endCount !== null) {
    return t('recurring.endCountText', { n: repeat.endCount })
  }
  return repeat.endOn !== null
    ? t('recurring.endOnText', { date: shortDate(repeat.endOn, locale) })
    : t('recurring.endNever')
}

/**
 * The end and how a due one is recorded.
 * e.g. no end, `confirm: false` → `'ไม่สิ้นสุด · บันทึกให้อัตโนมัติ'`; `endCount: 12, confirm: true` →
 * `'12 ครั้ง · ถามก่อนบันทึก'`
 */
export const describeRest = (repeat: RepeatValues, t: Translate, locale: string): string =>
  `${describeEnd(repeat, t, locale)} · ${t(repeat.confirm ? 'recurring.ask' : 'recurring.auto')}`

/**
 * The line under a sheet's "ทำซ้ำ" card (recurring.md → Web screens). Adding: when the first or
 * next one is recorded. On a rule (`rule`): its next date, how many are recorded, and that an
 * edit changes the next ones only.
 *
 * e.g. monthly, today `'2026-11-18'`: from `'2026-11-25'` → `'ครั้งถัดไป 25 พ.ย. 2026'`; from
 * `'2026-11-01'` → `'ครั้งถัดไป 1 ธ.ค. 2026 · งวด 1 พ.ย. บันทึกตอนนี้'`; a rule
 * `{ nextOn: '2026-12-01', recorded: 3 }` → `'ครั้งถัดไป 1 ธ.ค. 2026 · บันทึกแล้ว 3 ครั้ง · …'`
 */
export const describeRepeatHint = (
  repeat: RepeatValues,
  startOn: string,
  today: string,
  rule: { nextOn: string | null; recorded: number } | null,
  t: Translate,
  locale: string
): string | null => {
  if (rule) {
    return [
      rule.nextOn
        ? t('recurring.nextLine', { date: shortDate(rule.nextOn, locale) })
        : t('recurring.ended'),
      t('recurring.recordedLine', { count: rule.recorded }),
      t('recurring.editNote'),
    ].join(' · ')
  }
  if (startOn > today) {
    return t('recurring.nextLine', { date: shortDate(startOn, locale) })
  }
  const next = nextOnOrAfter({ ...repeat, startOn }, addDays(today, 1))
  return next
    ? t('recurring.nextNow', {
        date: shortDate(next, locale),
        first: shortDate(startOn, locale, false),
      })
    : null
}

/**
 * Rule 3's line for the 29th–31st of a month: the next few months that don't have that day use
 * their last day. Null when the start day is in every month.
 * e.g. monthly from `'2026-01-31'` → `'เดือนที่ไม่มีวันที่ 31 จะบันทึกวันสุดท้ายของเดือนแทน: 28 ก.พ. 2026 ·
 * 31 มี.ค. 2026 · …'`; from `'2026-01-15'` → `null`
 */
export const shortMonthLine = (
  repeat: Pick<RepeatValues, 'frequency' | 'interval'>,
  startOn: string,
  t: Translate,
  locale: string
): string | null => {
  const day = Number(startOn.slice(8, 10))
  if (repeat.frequency !== 'month' || day < 29) {
    return null
  }
  const schedule: RecurringSchedule = { ...repeat, startOn, endOn: null, endCount: null }
  const dates = occurrencesBetween(schedule, startOn, '9999-12-31', 5)
    .slice(1)
    .map((value) => shortDate(value, locale))
  return t('recurring.shortMonth', { day, dates: dates.join(' · ') })
}

/**
 * The last one, for an end by count.
 * e.g. monthly from `'2026-01-31'`, `endCount: 3` → `'ครั้งสุดท้าย 31 มี.ค. 2026'`; no end → `null`
 */
export const lastLine = (
  schedule: RecurringSchedule,
  t: Translate,
  locale: string
): string | null => {
  if (schedule.endCount === null) {
    return null
  }
  const last = lastOccurrence(schedule)
  return last ? t('recurring.lastOne', { date: shortDate(last, locale) }) : null
}

/**
 * A rule's title in a list: its category, "โอนเงิน" (or "กสิกร → ออมทรัพย์" with `full`), or a
 * debt's repayment (debt rule 13).
 * e.g. a transaction rule → its category `'ค่าเช่า'`; a transfer → `'โอนเงิน'`, with `full` →
 * `'โอนเงิน กสิกร → ออมทรัพย์'`; a borrowed debt's rule for แม่ → `'คืนเงิน · แม่'`
 */
export const ruleTitle = (item: RuleItem, t: Translate, full = false): string => {
  switch (item.rule.kind) {
    case 'transfer':
      return full
        ? t('recurring.transferTitle', { from: item.walletName, to: item.toWalletName })
        : t('transfers.title')
    case 'debt':
      return `${t(`debts.entry.${item.debtDirection ?? 'borrowed'}.repayment`)} · ${item.title}`
    default:
      return item.title
  }
}
