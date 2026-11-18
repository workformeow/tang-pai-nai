import type { Occurrence } from '@/core/recurring'
import type { EntryItem } from '@/core/transaction'
import { addDayTotals, addUpcoming, entrySign, groupByDay } from './day-groups'
import type { DayContext } from './day-groups'

const tx = (id: string, occurredOn: string, amount: number, type: 'expense' | 'income') =>
  ({
    kind: 'transaction',
    id,
    occurredOn,
    amount,
    type,
    currencyCode: 'THB',
    walletId: 'cash',
  }) as unknown as EntryItem

const transfer = (id: string, occurredOn: string, side: 'in' | 'out') =>
  ({
    kind: 'transfer',
    id,
    occurredOn,
    side,
    amount: 500,
    currencyCode: 'THB',
    walletId: 'cash',
  }) as unknown as EntryItem

const context: DayContext = {
  locale: 'en-GB',
  today: '2026-11-18',
  t: (key) => key,
  money: (minor, code) => `${code} ${minor}`,
  walletOf: (id) => ({ icon: 'wallet', color: '#000', name: id }),
}
const about = () => ({ pending: false, touchedBy: null })

describe('entrySign', () => {
  it('signs a transaction by its type and a transfer by its side', () => {
    expect(entrySign(tx('a', '2026-11-18', 100, 'expense'))).toBe(-100)
    expect(entrySign(tx('a', '2026-11-18', 100, 'income'))).toBe(100)
    expect(entrySign(transfer('t', '2026-11-18', 'in'))).toBe(500)
    expect(entrySign(transfer('t', '2026-11-18', 'out'))).toBe(-500)
  })
})

describe('groupByDay', () => {
  it('makes one card per day, today and yesterday by name, a transfer side its own key', () => {
    const groups = groupByDay(
      [
        tx('a', '2026-11-18', 100, 'expense'),
        transfer('t', '2026-11-18', 'out'),
        tx('b', '2026-11-17', 50, 'income'),
        tx('c', '2026-11-10', 20, 'expense'),
      ],
      context,
      about
    )
    expect(groups.map((group) => [group.day, group.title])).toEqual([
      ['2026-11-18', 'transactions.today'],
      ['2026-11-17', 'transactions.yesterday'],
      ['2026-11-10', 'Tuesday'],
    ])
    expect(groups[0].rows.map((row) => [row.key, row.amount, row.positive])).toEqual([
      ['a', 'THB -100', false],
      ['t:out', 'THB -500', false],
    ])
    expect(groups[0].number).toBe('18')
    expect(groups[0].subtitle).toBe('November 2026')
  })
})

describe('addDayTotals', () => {
  it('totals income − expense of every row of a day, even past the drawn page', () => {
    const all = [
      tx('a', '2026-11-18', 100, 'expense'),
      transfer('t', '2026-11-18', 'out'),
      tx('b', '2026-11-18', 30, 'income'),
      tx('c', '2026-11-17', 20, 'expense'),
    ]
    const groups = groupByDay(all.slice(0, 1), context, about)
    addDayTotals(groups, all, context.money)
    expect(groups.map((group) => group.total)).toEqual(['THB -70'])
  })
})

describe('addUpcoming', () => {
  const occurrence = (on: string, kind: 'transaction' | 'transfer', walletId = 'cash') =>
    ({
      on,
      id: `r:${on}`,
      item: {
        rule: {
          kind,
          walletId,
          toWalletId: kind === 'transfer' ? 'bank' : null,
          amount: 300,
          note: 'rent',
        },
        sign: -1,
        title: 'Rent',
        walletName: 'cash',
        toWalletName: 'bank',
        currencyCode: 'THB',
      },
    }) as unknown as Occurrence

  it('adds rules to come into the cards, new days too, newest first', () => {
    const groups = groupByDay([tx('a', '2026-11-20', 100, 'expense')], context, about)
    const out = addUpcoming(
      groups,
      [occurrence('2026-11-20', 'transaction'), occurrence('2026-11-25', 'transaction')],
      ['cash'],
      context
    )
    expect(out.map((group) => [group.day, group.rows.length, group.upcoming.length])).toEqual([
      ['2026-11-25', 0, 1],
      ['2026-11-20', 1, 1],
    ])
    expect(out[0].upcoming[0]).toMatchObject({
      amount: 'THB -300',
      positive: false,
      sub: 'rent · recurring.notRecorded',
    })
  })

  it('shows a transfer as money in when only the wallet it goes to is in view', () => {
    const out = addUpcoming([], [occurrence('2026-11-25', 'transfer')], ['bank'], context)
    expect(out[0].upcoming[0]).toMatchObject({
      amount: 'THB 300',
      positive: true,
      sub: 'cash → bank · recurring.notRecorded',
      wallet: { name: 'bank' },
    })
  })
})
