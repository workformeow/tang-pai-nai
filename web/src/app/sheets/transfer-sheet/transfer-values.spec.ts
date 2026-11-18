import { MONTHLY } from '@/core/recurring'
import { toRuleValues } from './transfer-values'

describe('toRuleValues (transfer)', () => {
  it('makes a transfer rule: from wallet, to wallet, no category, never excluded', () => {
    expect(
      toRuleValues(MONTHLY, {
        fromWalletId: 'bank',
        toWalletId: 'savings',
        amount: 500000,
        occurredOn: '2026-12-25',
        note: '',
      })
    ).toEqual({
      ...MONTHLY,
      kind: 'transfer',
      walletId: 'bank',
      categoryId: null,
      toWalletId: 'savings',
      amount: 500000,
      note: '',
      excludeFromReport: false,
      startOn: '2026-12-25',
    })
  })
})
