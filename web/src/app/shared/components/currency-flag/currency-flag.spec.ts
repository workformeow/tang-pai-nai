import { TestBed } from '@angular/core/testing'
import { CurrencyFlag } from './currency-flag'
import { CURRENCY_FLAGS, CURRENCY_GROUPS, currencyFlagUrl } from './currency-flags'

describe('currency flags', () => {
  it('maps every grouped currency to a flag, once (currency.md rule 9)', () => {
    const codes = CURRENCY_GROUPS.flatMap((group) => group.codes)
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toHaveLength(25)
    expect(Object.keys(CURRENCY_FLAGS).sort()).toEqual([...codes].sort())
  })

  it('serves the square file for round and 4:3 for rect; none for an unmapped code', () => {
    expect(currencyFlagUrl('EUR', 'round')).toBe('/flags/1x1/eu.svg')
    expect(currencyFlagUrl('USD', 'rect')).toBe('/flags/4x3/us.svg')
    expect(currencyFlagUrl('XAU', 'rect')).toBeNull()
  })
})

describe('CurrencyFlag', () => {
  const render = (code: string, shape: 'round' | 'rect') => {
    const fixture = TestBed.createComponent(CurrencyFlag)
    fixture.componentRef.setInput('code', code)
    fixture.componentRef.setInput('shape', shape)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('draws a decorative image of the flag in its shape', () => {
    const host = render('JPY', 'round')
    expect(host.getAttribute('aria-hidden')).toBe('true')
    expect(host.classList).toContain('rounded-full')
    expect(host.querySelector('img')?.getAttribute('src')).toBe('/flags/1x1/jp.svg')
    expect(host.querySelector('img')?.getAttribute('alt')).toBe('')
  })

  it('draws a plain shape for a code without a flag', () => {
    const host = render('XAU', 'rect')
    expect(host.querySelector('img')).toBeNull()
    expect(host.classList).toContain('rounded-sm')
  })
})
