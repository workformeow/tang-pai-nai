import { parseMajor } from './money'

// The amount keypad's number (transaction.md → Web screens): major-unit digits typed one key at a
// time, read with `parseMajor`. The keypad has no operator keys (owner's choice, 2026-11: it read
// as a calculator and took the form's space), so the amount is always a plain number.

export type CalcKey =
  '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '000' | '.' | 'C' | '⌫'

/** Digits a typed number may hold before its decimal point (10¹⁵ fits). */
const WHOLE_DIGITS = 16

/**
 * `amount` after pressing `key`; keys that would make it malformed change nothing.
 * e.g. `pressKey('12', '000', 2)` → `'12000'`, `pressKey('0', '5', 2)` → `'5'`,
 * `pressKey('', '.', 2)` → `'0.'`, `pressKey('1.57', '9', 2)` → `'1.57'` (no third decimal)
 */
export const pressKey = (amount: string, key: CalcKey, minorUnit: number): string => {
  if (key === 'C') {
    return ''
  }
  if (key === '⌫') {
    return amount.slice(0, -1)
  }
  if (key === '.') {
    if (minorUnit === 0 || amount.includes('.')) {
      return amount
    }
    return `${amount === '' ? '0' : amount}.`
  }
  const [whole, fraction] = amount.split('.') as [string, string?]
  if (fraction !== undefined) {
    const room = minorUnit - fraction.length
    return room <= 0 ? amount : `${amount}${key.slice(0, room)}`
  }
  if (whole === '0') {
    // No leading zeros: "0" then "5" is "5", "0" then "000" stays "0".
    return key === '000' || key === '0' ? amount : key
  }
  if (whole === '' && key === '000') {
    return '0'
  }
  if (whole.length + key.length > WHOLE_DIGITS) {
    return amount
  }
  return `${amount}${key}`
}

/**
 * The amount as the amount row shows it: the whole part grouped in thousands the locale's way
 * (`1200.5` → `1,200.5`), the decimals as typed. Display only: the control keeps `1200.5`
 * (owner, after #12). e.g. `groupDigits('1234567.5', 'th-TH')` → `'1,234,567.5'`
 */
export const groupDigits = (amount: string, locale: string): string => {
  const group =
    new Intl.NumberFormat(locale).formatToParts(1000).find((part) => part.type === 'group')
      ?.value ?? ','
  const [whole, fraction] = amount.split('.') as [string, string?]
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, group)
  return fraction === undefined ? grouped : `${grouped}.${fraction}`
}

/**
 * `amount` after a quick amount (`major`, a whole number of major units; 8.2): it adds, like
 * counting notes, and the amount shows the total at once (`500` → `600`). An amount that can't be
 * read, or a total past `WHOLE_DIGITS`, is left as it was.
 * e.g. `addQuickAmount('500', 100, 2)` → `'600'`, `addQuickAmount('12.5', 20, 2)` → `'32.5'`
 */
export const addQuickAmount = (amount: string, major: number, minorUnit: number): string => {
  const current = parseMajor(amount, minorUnit)
  if (!current.ok) {
    return amount
  }
  const scale = 10n ** BigInt(minorUnit)
  const total = BigInt(current.minor) + BigInt(major) * scale
  const whole = total / scale
  if (whole.toString().length > WHOLE_DIGITS) {
    return amount
  }
  const fraction = (total % scale).toString().padStart(minorUnit, '0').replace(/0+$/, '')
  return fraction === '' ? whole.toString() : `${whole}.${fraction}`
}

/**
 * Keys a hardware keyboard may type into the on-screen keypad (digits map to themselves): the
 * keypad's own keys only.
 */
export const CALC_KEYBOARD: Readonly<Partial<Record<string, CalcKey | '='>>> = {
  '.': '.',
  ',': '.',
  Backspace: '⌫',
  Delete: 'C',
  Escape: '=',
  Enter: '=',
}
