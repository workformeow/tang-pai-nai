import th from '@/core/i18n/th.json'
import {
  describeEnd,
  describeRepeat,
  describeRepeatHint,
  describeRest,
  lastLine,
  ruleTitle,
  shortDate,
  shortMonthLine,
} from './describe'
import { occurrenceId } from './occurrence-id'
import {
  indexOnOrAfter,
  isPastEnd,
  lastOccurrence,
  nextOnOrAfter,
  occurrenceOn,
  occurrencesBetween,
} from './schedule'
import type { RuleItem } from './recurring.type'

// The e.g. lines in describe.ts, schedule.ts and occurrence-id.ts, checked as written.

const t = (key: string, params: Record<string, unknown> = {}): string => {
  let value: unknown = th
  for (const part of key.split('.')) {
    value = (value as Record<string, unknown> | undefined)?.[part]
  }
  return (typeof value === 'string' ? value : key).replace(
    /\{\{\s*(\w+)\s*\}\}/g,
    (_, name: string) => String(params[name])
  )
}
const locale = 'th-TH-u-ca-gregory'
const monthly = {
  frequency: 'month' as const,
  interval: 1,
  startOn: '2026-01-31',
  endOn: null,
  endCount: null,
}
const end3 = { ...monthly, endCount: 3 }
const repeat = {
  frequency: 'month' as const,
  interval: 1,
  endOn: null,
  endCount: null,
  confirm: false,
}

describe('doc examples (describe.ts)', () => {
  it('match the e.g. lines', () => {
    expect(shortDate('2026-11-25', locale)).toBe('25 พ.ย. 2026')
    expect(shortDate('2026-11-25', 'en-GB', false)).toBe('25 Nov')
    expect(describeRepeat({ frequency: 'month', interval: 1 }, '2026-11-25', t, locale)).toBe(
      'ทุกเดือน วันที่ 25'
    )
    expect(describeRepeat({ frequency: 'week', interval: 2 }, '2026-11-20', t, locale)).toBe(
      'ทุก 2 สัปดาห์ วันศุกร์'
    )
    expect(describeRepeat({ frequency: 'year', interval: 1 }, '2026-11-25', t, locale)).toBe(
      'ทุกปี 25 พ.ย.'
    )
    expect(describeEnd({ endOn: null, endCount: null }, t, locale)).toBe('ไม่สิ้นสุด')
    expect(describeEnd({ endOn: '2027-12-31', endCount: null }, t, locale)).toBe('ถึง 31 ธ.ค. 2027')
    expect(describeEnd({ endOn: null, endCount: 12 }, t, locale)).toBe('12 ครั้ง')
    expect(describeRest(repeat, t, locale)).toBe('ไม่สิ้นสุด · บันทึกให้อัตโนมัติ')
    expect(describeRest({ ...repeat, endCount: 12, confirm: true }, t, locale)).toBe(
      '12 ครั้ง · ถามก่อนบันทึก'
    )
    expect(describeRepeatHint(repeat, '2026-11-25', '2026-11-18', null, t, locale)).toBe(
      'ครั้งถัดไป 25 พ.ย. 2026'
    )
    expect(describeRepeatHint(repeat, '2026-11-01', '2026-11-18', null, t, locale)).toBe(
      'ครั้งถัดไป 1 ธ.ค. 2026 · งวด 1 พ.ย. บันทึกตอนนี้'
    )
    expect(
      describeRepeatHint(
        repeat,
        '2026-11-01',
        '2026-11-18',
        { nextOn: '2026-12-01', recorded: 3 },
        t,
        locale
      )
    ).toMatch(/^ครั้งถัดไป 1 ธ.ค. 2026 · บันทึกแล้ว 3 ครั้ง · /)
    expect(shortMonthLine({ frequency: 'month', interval: 1 }, '2026-01-31', t, locale)).toMatch(
      /^เดือนที่ไม่มีวันที่ 31 จะบันทึกวันสุดท้ายของเดือนแทน: 28 ก.พ. 2026 · 31 มี.ค. 2026 · /
    )
    expect(shortMonthLine({ frequency: 'month', interval: 1 }, '2026-01-15', t, locale)).toBeNull()
    expect(lastLine(end3, t, locale)).toBe('ครั้งสุดท้าย 31 มี.ค. 2026')
    expect(lastLine(monthly, t, locale)).toBeNull()
    const item = (kind: string, title = 'ค่าเช่า') =>
      ({
        rule: { kind },
        title,
        walletName: 'กสิกร',
        toWalletName: 'ออมทรัพย์',
        debtDirection: 'borrowed',
      }) as unknown as RuleItem
    expect(ruleTitle(item('transaction'), t)).toBe('ค่าเช่า')
    expect(ruleTitle(item('transfer'), t)).toBe('โอนเงิน')
    expect(ruleTitle(item('transfer'), t, true)).toBe('โอนเงิน กสิกร → ออมทรัพย์')
    expect(ruleTitle(item('debt', 'แม่'), t)).toBe('คืนเงิน · แม่')
  })
})

describe('doc examples (schedule.ts, occurrence-id.ts)', () => {
  it('match the e.g. lines', () => {
    expect(occurrenceOn(monthly, 1)).toBe('2026-02-28')
    expect(occurrenceOn(monthly, 2)).toBe('2026-03-31')
    expect(indexOnOrAfter(monthly, '2026-03-01')).toBe(2)
    expect(isPastEnd(end3, 2)).toBe(false)
    expect(isPastEnd(end3, 3)).toBe(true)
    expect(nextOnOrAfter(monthly, '2026-02-15')).toBe('2026-02-28')
    expect(nextOnOrAfter(end3, '2026-04-01')).toBeNull()
    expect(lastOccurrence(end3)).toBe('2026-03-31')
    expect(lastOccurrence(monthly)).toBeNull()
    expect(occurrencesBetween(monthly, '2026-01-01', '2026-04-30', 10)).toEqual([
      '2026-01-31',
      '2026-02-28',
      '2026-03-31',
      '2026-04-30',
    ])
    expect(occurrencesBetween(monthly, '2026-01-01', '2026-12-31', 2)).toEqual([
      '2026-01-31',
      '2026-02-28',
    ])
    expect(occurrenceId('0190a1b2-0000-7000-8000-000000000001', '2026-11-25')).toBe(
      'd8e14289-aa08-8e77-9eba-70ad2dee81ef'
    )
  })
})
