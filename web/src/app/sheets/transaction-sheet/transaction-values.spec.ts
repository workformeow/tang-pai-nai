import { MONTHLY } from '@/core/recurring'
import { toRuleValues } from './transaction-values'

describe('toRuleValues (transaction)', () => {
  it('makes a transaction rule from the sheet values and the schedule, started on the date', () => {
    expect(
      toRuleValues(MONTHLY, {
        walletId: 'cash',
        categoryId: 'rent',
        amount: 750000,
        occurredOn: '2026-12-01',
        note: 'ค่าห้อง',
        excludeFromReport: false,
        debtId: null,
        eventId: 'trip',
      })
    ).toEqual({
      ...MONTHLY,
      kind: 'transaction',
      walletId: 'cash',
      categoryId: 'rent',
      toWalletId: null,
      amount: 750000,
      note: 'ค่าห้อง',
      excludeFromReport: false,
      debtId: null,
      startOn: '2026-12-01',
    })
  })
})
