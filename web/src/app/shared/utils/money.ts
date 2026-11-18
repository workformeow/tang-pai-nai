// Money on the device (ROADMAP → Money & data): amounts are integers in the currency's minor
// unit. Converting typed text and formatting go through strings, never floats.

/** Integers up to this many digits are exact as a JS number (< 2⁵³). */
const SAFE_DIGITS = 15

export type ParsedAmount = { ok: true; minor: number } | { ok: false; error: 'format' | 'decimals' }

/**
 * Typed major-unit text (`1,500.50`, `1500`, `.5`) to a non-negative amount in minor units. Commas
 * and spaces are grouping; one `.` is the decimal point, with at most `minorUnit` digits after it.
 * An empty text is 0.
 *
 * e.g. `parseMajor('1,500.50', 2)` → `{ ok: true, minor: 150050 }`,
 * `parseMajor('', 2)` → `{ ok: true, minor: 0 }`,
 * `parseMajor('1.555', 2)` → `{ ok: false, error: 'decimals' }`,
 * `parseMajor('12a', 2)` → `{ ok: false, error: 'format' }`
 */
export const parseMajor = (text: string, minorUnit: number): ParsedAmount => {
  const plain = text.replace(/[\s,]/g, '')
  if (plain === '') {
    return { ok: true, minor: 0 }
  }
  const match = /^(\d*)(?:\.(\d*))?$/.exec(plain)
  if (!match || (match[1] === '' && !match[2])) {
    return { ok: false, error: 'format' }
  }
  const [, whole, fraction = ''] = match
  if (fraction.length > minorUnit) {
    return { ok: false, error: 'decimals' }
  }
  const digits = `${whole}${fraction.padEnd(minorUnit, '0')}`.replace(/^0+(?=\d)/, '')
  if (digits.length > SAFE_DIGITS + 1) {
    return { ok: false, error: 'format' }
  }
  return { ok: true, minor: Number(digits) }
}

/**
 * A minor amount's size as major text for an input, grouped with commas (which `parseMajor`
 * reads back). e.g. `toMajorText(1825075, 2)` → `'18,250.75'`, `toMajorText(150000, 2)` → `'1,500'`
 */
export const toMajorText = (minor: number, minorUnit: number): string => {
  const digits = String(Math.abs(Math.trunc(minor))).padStart(minorUnit + 1, '0')
  const whole = minorUnit === 0 ? digits : digits.slice(0, -minorUnit)
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  const fraction = minorUnit === 0 ? '' : digits.slice(-minorUnit)
  return fraction === '' || /^0+$/.test(fraction) ? grouped : `${grouped}.${fraction}`
}

/**
 * A minor amount as an amount field's text: plain digits (no `,`), blank for nothing.
 * e.g. `amountText(1825075, 2)` → `'18250.75'`, `amountText(0, 2)` → `''`
 */
export const amountText = (minor: number, minorUnit: number): string =>
  minor > 0 ? toMajorText(minor, minorUnit).replace(/,/g, '') : ''

/**
 * A signed minor amount as an exact decimal string (for `Intl.NumberFormat` and CSV, no
 * grouping). e.g. `toDecimalString(-5, 2)` → `'-0.05'`, `toDecimalString(1500, 0)` → `'1500'`
 */
export const toDecimalString = (minor: number, minorUnit: number): string => {
  const digits = String(Math.abs(Math.trunc(minor))).padStart(minorUnit + 1, '0')
  const sign = minor < 0 ? '-' : ''
  return minorUnit === 0
    ? `${sign}${digits}`
    : `${sign}${digits.slice(0, -minorUnit)}.${digits.slice(-minorUnit)}`
}

/**
 * A minor amount with its currency symbol, in the UI language's format (DESIGN.md §5); `signed`
 * adds `+` to anything above zero.
 * e.g. `formatMoney(150050, 'THB', 2, 'th-TH')` → `'฿1,500.50'`,
 * `formatMoney(150050, 'THB', 2, 'th-TH', true)` → `'+฿1,500.50'`,
 * `formatMoney(1500, 'JPY', 0, 'th-TH')` → `'¥1,500'`
 */
export const formatMoney = (
  minor: number,
  currencyCode: string,
  minorUnit: number,
  locale: string,
  signed = false
): string =>
  new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currencyCode,
    currencyDisplay: 'narrowSymbol',
    signDisplay: signed ? 'exceptZero' : 'auto',
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
    // An exact decimal string (Intl.NumberFormat v3, every current browser); TS's lib only
    // types numbers.
  }).format(toDecimalString(minor, minorUnit) as unknown as number)

/**
 * A signed minor amount without its currency symbol (the transaction list, Money Lover style);
 * `signed` adds `+` to anything above zero.
 * e.g. `formatAmount(-6500, 2, 'th-TH')` → `'-65.00'`,
 * `formatAmount(4500000, 2, 'th-TH', true)` → `'+45,000.00'`
 */
export const formatAmount = (
  minor: number,
  minorUnit: number,
  locale: string,
  signed = false
): string =>
  new Intl.NumberFormat(locale, {
    minimumFractionDigits: minorUnit,
    maximumFractionDigits: minorUnit,
    signDisplay: signed ? 'exceptZero' : 'auto',
  }).format(toDecimalString(minor, minorUnit) as unknown as number)
