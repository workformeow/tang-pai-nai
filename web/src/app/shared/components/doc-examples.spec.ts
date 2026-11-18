import type { AbstractControl } from '@angular/forms'
import th from '@/core/i18n/th.json'
import { currencyFlagUrl } from './currency-flag/currency-flags'
import { amountValidator } from './form/amount-keypad'
import { firstErrorMessage } from './form/field-error'
import { glyphColor, userColor } from './icon-badge/user-colors'

// The e.g. lines in field-error.ts, amount-keypad.ts, user-colors.ts and currency-flags.ts.

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

describe('doc examples (shared components)', () => {
  it('firstErrorMessage', () => {
    expect(firstErrorMessage({ required: true }, t)).toBe('กรุณากรอกข้อมูลนี้')
    expect(firstErrorMessage({ nameTaken: 'wallets.nameTaken' }, t)).toBe(
      'สมุดนี้มีกระเป๋าเงินชื่อนี้แล้ว'
    )
    expect(firstErrorMessage({ maxlength: { requiredLength: 50, actualLength: 51 } }, t)).toBe(
      'ต้องไม่เกิน 50 ตัวอักษร'
    )
    expect(firstErrorMessage(null, t)).toBe('')
  })

  it('amountValidator', () => {
    const validate = amountValidator('walletId', () => 2, 10 ** 15)
    const control = (value: string) =>
      ({ value, parent: { get: () => ({ value: 'cash' }) } }) as unknown as AbstractControl
    expect(validate(control('120'))).toBeNull()
    expect(validate(control(''))).toEqual({ amountRequired: 'transactions.amountRequired' })
    expect(validate(control('1.234'))).toEqual({ amountFormat: 'transactions.amountFormat' })
  })

  it('userColor, glyphColor, currencyFlagUrl', () => {
    expect(userColor('#EA580C')).toBe('#c2410c')
    expect(userColor('#2563eb')).toBe('#2563eb')
    expect(glyphColor('#2563eb')).toBe('#ffffff')
    expect(glyphColor('#facc15')).toBe('#000000')
    expect(glyphColor('blue')).toBe('#ffffff')
    expect(currencyFlagUrl('THB', 'round')).toBe('/flags/1x1/th.svg')
    expect(currencyFlagUrl('JPY', 'rect')).toBe('/flags/4x3/jp.svg')
    expect(currencyFlagUrl('XXX', 'round')).toBeNull()
  })
})
