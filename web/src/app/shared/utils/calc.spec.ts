import { addQuickAmount, groupDigits, pressKey } from './calc'
import type { CalcKey } from './calc'

const type = (keys: CalcKey[], minorUnit = 2) =>
  keys.reduce((amount, key) => pressKey(amount, key, minorUnit), '')

describe('pressKey', () => {
  it('builds numbers without leading zeros, one point and the currency digits after it', () => {
    expect(type(['0', '0', '5'])).toBe('5')
    expect(type(['.', '5'])).toBe('0.5')
    expect(type(['1', '.', '2', '3', '4'])).toBe('1.23')
    expect(type(['1', '.', '.', '5'])).toBe('1.5')
    expect(type(['1', '.', '5'], 0)).toBe('15')
    expect(type(['000'])).toBe('0')
    expect(type(['1', '000', '000'])).toBe('1000000')
  })

  it('removes the last key, or clears', () => {
    expect(type(['1', '2', '⌫'])).toBe('1')
    expect(type(['1', '.', '⌫'])).toBe('1')
    expect(type(['1', '2', 'C'])).toBe('')
  })

  it('stops a number at 16 digits before the point', () => {
    const keys = Array.from({ length: 18 }, () => '9' as const)
    expect(type(keys)).toHaveLength(16)
  })
})

describe('groupDigits', () => {
  it('groups the whole part in thousands, leaving the decimals as typed', () => {
    expect(groupDigits('8500', 'th-TH-u-ca-gregory')).toBe('8,500')
    expect(groupDigits('1234567.12345', 'en-GB')).toBe('1,234,567.12345')
    expect(groupDigits('1200.', 'en-GB')).toBe('1,200.')
    expect(groupDigits('0.0005', 'en-GB')).toBe('0.0005')
    expect(groupDigits('', 'en-GB')).toBe('')
  })
})

describe('addQuickAmount', () => {
  it('takes the amount when empty or "0"', () => {
    expect(addQuickAmount('', 500, 2)).toBe('500')
    expect(addQuickAmount('0', 100, 2)).toBe('100')
  })

  it('adds to the amount and shows the total, like counting notes', () => {
    expect(addQuickAmount('500', 100, 2)).toBe('600')
    expect(addQuickAmount(addQuickAmount('', 500, 2), 1000, 2)).toBe('1500')
    expect(addQuickAmount('12.', 20, 2)).toBe('32')
    expect(addQuickAmount('12.5', 20, 2)).toBe('32.5')
    expect(addQuickAmount('0.05', 1, 2)).toBe('1.05')
    expect(addQuickAmount('7', 20, 0)).toBe('27')
  })

  it('leaves an amount it cannot add to as it was', () => {
    expect(addQuickAmount('9999999999999999', 1, 2)).toBe('9999999999999999')
  })
})
