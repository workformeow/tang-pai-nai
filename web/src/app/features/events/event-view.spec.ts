import type { EventMoney, TripEvent } from '@/core/event'
import th from '@/core/i18n/th.json'
import { counted, eventDates, expenseLines } from './event-view'

// The e.g. lines in event-view.ts.

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
const event = (startOn: string, endOn: string | null) => ({ startOn, endOn }) as TripEvent

describe('doc examples (event-view.ts)', () => {
  it('match the e.g. lines', () => {
    expect(eventDates(event('2026-11-07', '2026-11-12'), t, locale)).toBe('7–12 พ.ย. 2026')
    expect(eventDates(event('2026-10-01', null), t, locale)).toBe('ตั้งแต่ 1 ต.ค. 2026')
    expect(expenseLines([], locale)).toEqual(['฿0.00'])
    expect(
      expenseLines(
        [
          { currencyCode: 'THB', minorUnit: 2, expense: 150050 },
          { currencyCode: 'JPY', minorUnit: 0, expense: 19930 },
        ] as EventMoney[],
        locale
      )
    ).toEqual(['฿1,500.50', '¥19,930'])
    expect(counted(t, 'rows', 3)).toBe('3 รายการ')
    expect(counted(t, 'rows', 1)).toBe('1 รายการ')
  })
})
