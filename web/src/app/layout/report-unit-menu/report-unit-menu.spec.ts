import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import th from '@/core/i18n/th.json'
import { PeriodService } from '@/core/transaction'
import type { PeriodUnit } from '@/core/transaction'
import { ReportUnitMenu } from './report-unit-menu'

describe('ReportUnitMenu', () => {
  let fixture: ComponentFixture<ReportUnitMenu>
  const unit = signal<PeriodUnit>('month')
  const customSheet = signal(false)
  const period = { unit, customSheet, selectUnit: (next: PeriodUnit) => unit.set(next) }

  const element = () => fixture.nativeElement as HTMLElement
  const button = () => element().querySelector<HTMLElement>('button[aria-haspopup="menu"]')
  const items = () => [...element().querySelectorAll<HTMLElement>('[role="menuitemradio"]')]
  const item = (text: string) => items().find((el) => el.textContent.trim() === text)
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }

  beforeEach(async () => {
    unit.set('month')
    customSheet.set(false)
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [{ provide: PeriodService, useValue: period }],
    })
    fixture = TestBed.createComponent(ReportUnitMenu)
    await settle()
  })

  it("shows the shared period's unit and changes it from the menu (#24)", async () => {
    expect(button()?.textContent).toContain(th.transactions.unit.month)
    expect(button()?.getAttribute('aria-label')).toBe(
      `${th.transactions.viewBy} ${th.transactions.unit.month}`
    )
    button()?.click()
    await settle()
    expect(button()?.getAttribute('aria-expanded')).toBe('true')
    expect(items().map((el) => el.textContent.trim())).toEqual(Object.values(th.transactions.unit))
    expect(item(th.transactions.unit.month)?.getAttribute('aria-checked')).toBe('true')
    item(th.transactions.unit.year)?.click()
    await settle()
    expect(unit()).toBe('year')
    expect(items()).toHaveLength(0)
    expect(button()?.textContent).toContain(th.transactions.unit.year)
  })

  it('opens the custom range sheet for กำหนดเอง, keeping the unit until a range is applied', async () => {
    button()?.click()
    await settle()
    item(th.transactions.unit.custom)?.click()
    await settle()
    expect(customSheet()).toBe(true)
    expect(unit()).toBe('month')
  })

  it('closes on a tap outside', async () => {
    button()?.click()
    await settle()
    document.body.click()
    await settle()
    expect(items()).toHaveLength(0)
  })
})
