import { describe, expect, it } from 'vitest'
import { validateWallet } from './wallet.schema'

const valid = {
  id: '0199a000-0000-7000-8000-000000000101',
  bookId: '0199a000-0000-7000-8000-000000000001',
  name: '  เงินสด ',
  currencyCode: 'THB',
  initialBalance: -150050,
  icon: 'tpnBankColumns',
  color: '#16a34a',
  excludeFromTotal: false,
  isArchived: false,
  sortOrder: 0,
  createdAt: 1000,
  updatedAt: 1000,
}

describe('validateWallet', () => {
  it('accepts a wallet, trims the name and defaults deletedAt to null', () => {
    expect(validateWallet(valid)).toEqual({
      ok: true,
      row: {
        ...valid,
        name: 'เงินสด',
        isCreditCard: false,
        hiddenCategoryIds: [],
        deletedAt: null,
      },
    })
  })

  it('keeps hiddenCategoryIds as sent, any ids of the right shape (category rule 13)', () => {
    const ids = ['0199a000-0000-7000-8000-000000000201', '0199a000-0000-7000-8000-000000000202']
    const result = validateWallet({ ...valid, hiddenCategoryIds: ids })
    expect(result.ok && result.row['hiddenCategoryIds']).toEqual(ids)
    const many = Array.from(
      { length: 200 },
      (_, i) => `0199a000-0000-7000-8000-${String(i).padStart(12, '0')}`
    )
    expect(validateWallet({ ...valid, hiddenCategoryIds: many }).ok).toBe(true)
  })

  it('ignores server columns a device sends', () => {
    const result = validateWallet({ ...valid, changeSeq: 99, updatedBy: 'x', userId: 'y' })
    expect(result.ok && Object.keys(result.row).sort()).toEqual([
      'bookId',
      'color',
      'createdAt',
      'currencyCode',
      'deletedAt',
      'excludeFromTotal',
      'hiddenCategoryIds',
      'icon',
      'id',
      'initialBalance',
      'isArchived',
      'isCreditCard',
      'name',
      'sortOrder',
      'updatedAt',
    ])
  })

  it('accepts the limits: a 50-character name, ±10¹⁵ minor units, a lucide icon, a tombstone, a card', () => {
    for (const change of [
      { name: 'x'.repeat(50) },
      { initialBalance: 1_000_000_000_000_000 },
      { initialBalance: -1_000_000_000_000_000 },
      { icon: 'lucideWallet' },
      { deletedAt: 2000 },
      { isCreditCard: true, excludeFromTotal: true },
    ]) {
      expect(validateWallet({ ...valid, ...change }).ok).toBe(true)
    }
  })

  it.each([
    ['an empty name', { name: '   ' }, 'Name is required'],
    ['a name over 50 characters', { name: 'x'.repeat(51) }, 'Name must be at most 50'],
    ['a book id that is not a UUID', { bookId: 'abc' }, 'Invalid bookId format'],
    ['a lowercase currency', { currencyCode: 'thb' }, 'Invalid currencyCode format'],
    ['a fractional balance', { initialBalance: 1.5 }, 'Initial balance must be of type integer'],
    ['a balance over 10¹⁵', { initialBalance: 1_000_000_000_000_001 }, 'Invalid initialBalance'],
    ['a balance under -10¹⁵', { initialBalance: -1_000_000_000_000_001 }, 'Invalid initialBalance'],
    ['an icon of another library', { icon: 'faWallet' }, 'Invalid icon format'],
    ['an icon name over 40 characters', { icon: `tpn${'A'.repeat(38)}` }, 'Invalid icon format'],
    ['an uppercase colour', { color: '#16A34A' }, 'Invalid color format'],
    ['a flag that is not a boolean', { excludeFromTotal: 'yes' }, 'Exclude from total must be'],
    ['a missing archive flag', { isArchived: undefined }, 'Is archived must be of type boolean'],
    ['a negative sort order', { sortOrder: -1 }, 'Invalid sortOrder format'],
    ['an id that is not a UUID', { id: 'abc' }, 'Invalid id format'],
    ['a credit-card flag that is not a boolean', { isCreditCard: 1 }, 'Is credit card must be'],
    [
      'a credit card counted in the total (credit-card rule 1)',
      { isCreditCard: true, excludeFromTotal: false },
      'A credit card must be excluded from the total',
    ],
    ['hidden ids that are not UUIDs', { hiddenCategoryIds: ['abc'] }, 'Invalid hiddenCategoryIds'],
    ['hidden ids that are not an array', { hiddenCategoryIds: 'x' }, 'Invalid hiddenCategoryIds'],
    ['null hidden ids', { hiddenCategoryIds: null }, 'Invalid hiddenCategoryIds'],
    [
      'more than 200 hidden ids',
      {
        hiddenCategoryIds: Array.from(
          { length: 201 },
          (_, i) => `0199a000-0000-7000-8000-${String(i).padStart(12, '0')}`
        ),
      },
      'Invalid hiddenCategoryIds',
    ],
  ])('refuses %s', (_name, change, message) => {
    const result = validateWallet({ ...valid, ...change })
    expect(result.ok).toBe(false)
    expect(!result.ok && result.message).toContain(message)
  })
})
