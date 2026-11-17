/** A titled group of the currency picker (`currencyGroups.<key>`). */
export interface CurrencyGroup {
  key: string
  codes: readonly string[]
}

/**
 * docs/features/currency.md rule 9: the picker's continents, in `sortOrder` order. Display only,
 * so it lives here, not in the API's `currencies` table.
 */
export const CURRENCY_GROUPS: readonly CurrencyGroup[] = [
  {
    key: 'asia',
    codes: [
      'THB',
      'JPY',
      'KRW',
      'CNY',
      'HKD',
      'MOP',
      'TWD',
      'SGD',
      'MYR',
      'VND',
      'LAK',
      'KHR',
      'IDR',
      'PHP',
      'MMK',
      'INR',
    ],
  },
  { key: 'middleEast', codes: ['AED'] },
  { key: 'europe', codes: ['EUR', 'GBP', 'CHF', 'TRY'] },
  { key: 'americas', codes: ['USD', 'CAD'] },
  { key: 'oceania', codes: ['AUD', 'NZD'] },
]

/**
 * Currency → the `flag-icons` file in `public/flags/` (a region code; EUR = the EU flag). Only
 * these files ship; a code missing here gets a plain badge.
 */
export const CURRENCY_FLAGS: Readonly<Record<string, string>> = {
  THB: 'th',
  JPY: 'jp',
  KRW: 'kr',
  CNY: 'cn',
  HKD: 'hk',
  MOP: 'mo',
  TWD: 'tw',
  SGD: 'sg',
  MYR: 'my',
  VND: 'vn',
  LAK: 'la',
  KHR: 'kh',
  IDR: 'id',
  PHP: 'ph',
  MMK: 'mm',
  INR: 'in',
  AED: 'ae',
  EUR: 'eu',
  GBP: 'gb',
  CHF: 'ch',
  TRY: 'tr',
  USD: 'us',
  CAD: 'ca',
  AUD: 'au',
  NZD: 'nz',
}

/** The flag's URL: `round` = the square file (drawn as a circle), `rect` = 4:3. */
export const currencyFlagUrl = (code: string, shape: 'round' | 'rect'): string | null => {
  const flag = CURRENCY_FLAGS[code]
  return flag ? `/flags/${shape === 'round' ? '1x1' : '4x3'}/${flag}.svg` : null
}
