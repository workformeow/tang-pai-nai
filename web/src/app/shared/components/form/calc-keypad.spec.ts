import { Component, signal } from '@angular/core'
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

@Component({
  imports: [CalcKeypad],
  template: `
    <form>
      <div><div class="anchor"></div></div>
      <div class="footer"><app-calc-keypad [fitBelow]="fitBelow()" /></div>
    </form>
  `,
})
class FitHost {
  fitBelow = signal<string | null>('.anchor')
}

describe('CalcKeypad fitBelow', () => {
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

  const rect = (top: number, bottom: number) => ({ top, bottom }) as DOMRect

  /** jsdom has no layout: the footer starts at 100, the keypad's box ends 700 below it (800). */
  const render = async (anchorBottom: number, fitBelow: string | null = '.anchor') => {
    const fixture = TestBed.createComponent(FitHost)
    fixture.componentInstance.fitBelow.set(fitBelow)
    const root = fixture.nativeElement as HTMLElement
    const footer = root.querySelector<HTMLElement>('.footer')!
    const keypad = root.querySelector<HTMLElement>('app-calc-keypad')!
    footer.getBoundingClientRect = () => rect(100, 900)
    root.querySelector<HTMLElement>('.anchor')!.getBoundingClientRect = () =>
      rect(anchorBottom - 56, anchorBottom)
    Object.defineProperty(keypad, 'offsetParent', { get: () => footer })
    Object.defineProperty(keypad, 'offsetTop', { get: () => 400 })
    Object.defineProperty(keypad, 'offsetHeight', { get: () => 300 })
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
    return keypad
  }

  it('grows up to 12px under the anchor row', async () => {
    expect((await render(500)).style.height).toBe('288px')
  })

  it('stops at 460px on a tall screen', async () => {
    expect((await render(100)).style.height).toBe('460px')
  })

  it('keeps its natural size without an anchor', async () => {
    expect((await render(500, null)).style.height).toBe('')
  })
})
