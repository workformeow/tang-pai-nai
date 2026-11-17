import { TestBed } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import th from '@/core/i18n/th.json'
import { CalcKeypad } from './calc-keypad'

describe('CalcKeypad', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
    })
  })

  const render = (inputs: Record<string, unknown>) => {
    const fixture = TestBed.createComponent(CalcKeypad)
    for (const [name, value] of Object.entries(inputs)) {
      fixture.componentRef.setInput(name, value)
    }
    fixture.detectChanges()
    const host = fixture.nativeElement as HTMLElement
    const point = host.querySelector<HTMLButtonElement>(`button[aria-label="${th.keypad.point}"]`)
    return { host, point }
  }

  it('turns the "." key off for a currency without decimals (currency rule 7)', () => {
    expect(render({ minorUnit: 2 }).point?.disabled).toBe(false)
    expect(render({ minorUnit: 0 }).point?.disabled).toBe(true)
  })

  it('shows the quick amounts it is given, none hides the row', () => {
    const label = `[aria-label="${th.keypad.quickLabel}"]`
    expect(
      render({ quickAmounts: [20, 50] }).host.querySelectorAll(`${label} button`)
    ).toHaveLength(2)
    expect(render({ quickAmounts: [] }).host.querySelector(label)).toBeNull()
  })
})
