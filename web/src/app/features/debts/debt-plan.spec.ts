import { evenInstalment, toPlanValues } from './debt-plan'

// The e.g. lines in debt-plan.ts.

describe('doc examples (debt-plan.ts)', () => {
  it('match the e.g. lines', () => {
    const plan = {
      count: 3,
      amount: '333.34',
      startOn: '2026-12-18',
      confirm: false,
      walletId: 'cash',
    }
    expect(toPlanValues(plan, 2)).toEqual({
      repeat: { frequency: 'month', interval: 1, endOn: null, endCount: 3, confirm: false },
      startOn: '2026-12-18',
      amount: 33334,
      walletId: 'cash',
    })
    expect(toPlanValues({ ...plan, count: 0 }, 2)).toBeNull()
    expect(evenInstalment(100000, 3, 2)).toBe('333.34')
    expect(evenInstalment(10000, 4, 0)).toBe('2500')
  })
})
