import th from '@/core/i18n/th.json'
import { activityDaysLeft, activityLeftText, latestAction } from './activity'
import { closedRange, periodLabel, periodRange, periodTabs, sameRange } from './period'
import type { Transaction } from './transaction.type'

// The e.g. lines in period.ts and activity.ts, checked as written.

const today = '2026-11-18'
const none = { from: null, to: null }

describe('doc examples (period.ts)', () => {
  it('match the e.g. lines', () => {
    expect(periodRange('month', 0, today, none)).toEqual({ from: '2026-11-01', to: '2026-11-30' })
    expect(periodRange('week', -1, today, none)).toEqual({ from: '2026-11-09', to: '2026-11-15' })
    expect(periodRange('month', 'future', today, none)).toEqual({ from: '2026-12-01', to: null })
    expect(periodRange('all', 0, today, none)).toEqual({ from: null, to: null })
    expect(periodTabs('month', today, '2026-08-03')).toEqual([-3, -2, -1, 0, 'future'])
    expect(periodTabs('year', today, null)).toEqual([-1, 0])
    expect(periodLabel('month', 0, today, none)).toEqual({ key: 'transactions.period.monthThis' })
    expect(periodLabel('month', -2, today, none)).toEqual({ text: '09/2026' })
    expect(periodLabel('quarter', -2, today, none)).toEqual({ text: 'Q2 2026' })
    expect(periodLabel('week', -2, today, none)).toEqual({ text: '02/11 – 08/11/2026' })
    expect(periodLabel('custom', 0, today, { from: '2026-11-01', to: null })).toEqual({
      text: '01/11/2026 – …',
    })
    const now = '2026-11-26'
    expect(closedRange(none, now, '2026-08-03', '2026-12-05')).toEqual({
      from: '2026-08-03',
      to: '2026-12-05',
    })
    expect(closedRange({ from: '2026-12-01', to: null }, now, '2026-08-03', null)).toEqual({
      from: '2026-12-01',
      to: '2026-12-31',
    })
    expect(closedRange(none, now, null, null)).toEqual({ from: '2026-11-26', to: '2026-11-26' })
    expect(sameRange(none, none)).toBe(true)
  })
})

describe('doc examples (activity.ts)', () => {
  const row = (fields: Partial<Transaction>) =>
    ({
      addedBy: null,
      updatedBy: null,
      createdAt: 0,
      updatedAt: 0,
      deletedAt: null,
      ...fields,
    }) as Transaction
  const t = (key: string, params: Record<string, unknown> = {}) =>
    (key === 'activity.lastDay' ? th.activity.lastDay : th.activity.daysLeft).replace(
      '{{count}}',
      String(params['count'])
    )

  it('match the e.g. lines', () => {
    expect(latestAction(row({ addedBy: 'm1', updatedBy: 'm1' }), 'u1', 'u1')).toEqual({
      action: 'added',
      actor: 'm1',
    })
    expect(
      latestAction(row({ addedBy: 'm1', updatedBy: 'u1', updatedAt: 120_000 }), 'u1', 'u1')
    ).toEqual({ action: 'edited', actor: null })
    expect(latestAction(row({ updatedBy: 'm1', updatedAt: 5, deletedAt: 5 }), 'u1', 'u1')).toEqual({
      action: 'deleted',
      actor: 'm1',
    })
    expect(activityDaysLeft(1000 + 4.5 * 86_400_000, 1000)).toBe(5)
    expect(activityDaysLeft(2000, 1000)).toBe(1)
    expect(activityDaysLeft(null)).toBeNull()
    expect(activityLeftText(5, t)).toBe('เหลือ 5 วัน')
    expect(activityLeftText(1, t)).toBe('วันนี้วันสุดท้าย')
  })
})
