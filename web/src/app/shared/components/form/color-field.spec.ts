import { Component, inject } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { NonNullableFormBuilder } from '@angular/forms'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { USER_COLORS } from '@/shared/components/icon-badge'
import { ColorField } from './color-field'

@Component({
  imports: [ColorField],
  template: `<app-color-field [control]="control" label="Colour" [colors]="colors" />`,
})
class Host {
  control = inject(NonNullableFormBuilder).control<string>(USER_COLORS[0])
  colors = USER_COLORS
}

/** jsdom reports an inline colour as rgb. e.g. `hex('rgb(20, 83, 45)')` → `'#14532d'` */
const hex = (rgb: string): string =>
  '#' + (rgb.match(/\d+/g) ?? []).map((part) => Number(part).toString(16).padStart(2, '0')).join('')

describe('ColorField', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({ langs: {}, translocoConfig: { defaultLang: 'th' } }),
      ],
    })
  })

  const setup = async (value: string) => {
    const fixture = TestBed.createComponent(Host)
    const host = fixture.componentInstance
    host.control.setValue(value)
    await fixture.whenStable()
    const root = fixture.nativeElement as HTMLElement
    const tones = () =>
      [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')].filter(
        (input) => !input.closest('[role="radiogroup"]')
      )
    const shades = () => [
      ...root.querySelectorAll<HTMLInputElement>('[role="radiogroup"] input[type="radio"]'),
    ]
    const swatchOf = (input: HTMLInputElement) => input.closest('label')!
    const shadeColors = () => shades().map((input) => hex(swatchOf(input).style.backgroundColor))
    return { fixture, host, tones, shades, swatchOf, shadeColors }
  }

  it('shows the ten tones and the chosen tone’s shades', async () => {
    const { tones, shades, shadeColors } = await setup('#15803d')
    expect(tones()).toHaveLength(10)
    expect(tones()[3].checked).toBe(true)
    expect(shadeColors()).toEqual(['#4d7c0f', '#15803d', '#047857', '#14532d'])
    expect(shades()[1].checked).toBe(true)
  })

  it('picks a shade, and the tone shows it with the check', async () => {
    const { fixture, host, tones, shades, swatchOf } = await setup('#15803d')
    shades()[3].click()
    await fixture.whenStable()
    expect(host.control.value).toBe('#14532d')
    expect(tones()[3].checked).toBe(true)
    expect(hex(swatchOf(tones()[3]).style.backgroundColor)).toBe('#14532d')
    expect(swatchOf(tones()[3]).querySelector('ng-icon')).not.toBeNull()
  })

  it('picks another tone’s own colour and swaps the shades', async () => {
    const { fixture, host, tones, shadeColors } = await setup('#14532d')
    tones()[0].click()
    await fixture.whenStable()
    expect(host.control.value).toBe('#2563eb')
    expect(host.control.dirty).toBe(true)
    expect(shadeColors()).toContain('#1e3a8a')
  })

  it('shows no tone and no shades for a colour outside the palette', async () => {
    const { tones, shades } = await setup('#123456')
    expect(tones().some((input) => input.checked)).toBe(false)
    expect(shades()).toHaveLength(0)
  })
})
