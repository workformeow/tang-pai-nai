import { TestBed } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import th from '@/core/i18n/th.json'
import { MoneySummaryCard } from './money-summary'
import { MoneySummaryTable } from './money-summary-table'
import type { MoneySummaryLine } from './money-summary'
import type { MoneySummaryRow } from './money-summary-table'

describe('MoneySummaryCard', () => {
  const render = (line: MoneySummaryLine) => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
    })
    const fixture = TestBed.createComponent(MoneySummaryCard)
    fixture.componentRef.setInput('line', line)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }
  const line: MoneySummaryLine = {
    income: '+15,000.00',
    hasIncome: true,
    expense: '-13,577.00',
    net: '+1,423.00',
    transfer: null,
    debt: null,
  }

  it('puts income left and expense right-aligned, net under a line', () => {
    const element = render(line)
    const [income, expense] = element.querySelectorAll('section > div')
    expect(income.textContent).toContain('+15,000.00')
    expect(income.querySelector('.text-income')).not.toBeNull()
    expect(expense.className).toContain('items-end')
    expect(expense.textContent).toContain('-13,577.00')
    expect(element.textContent).toContain(th.transactions.net)
    expect(element.textContent).not.toContain(th.transfers.summaryLine)
  })

  it('adds the transfer and debt lines only when they are set', () => {
    const element = render({ ...line, hasIncome: false, transfer: '-2,000.00', debt: '+300.00' })
    expect(element.querySelector('.text-income')).toBeNull()
    expect(element.textContent).toContain(th.transfers.summaryLine)
    expect(element.textContent).toContain('-2,000.00')
    expect(element.textContent).toContain(th.debts.summaryLine)
  })

  it('shows how the expense was paid under the income, the card chip in its colour', () => {
    const plain = render(line)
    expect(plain.textContent).not.toContain(th.transactions.spendCash)
    TestBed.resetTestingModule()
    const element = render({
      ...line,
      split: { own: '-2,577.00', card: '-11,000.00', cardColor: '#2563eb' },
    })
    const split = element.querySelector('.grid-cols-\\[auto_auto_auto\\]')
    expect(split?.textContent).toContain(th.transactions.spendCash)
    expect(split?.textContent).toContain('-2,577.00')
    expect(split?.textContent).toContain(th.transactions.spendCard)
    expect(split?.textContent).toContain('-11,000.00')
    const chip = split?.querySelector<HTMLElement>('[style*="background-color"]')
    expect(chip?.style.backgroundColor).toBe('rgb(37, 99, 235)')
  })
})

describe('MoneySummaryTable', () => {
  it('lists every currency in one row each, with its flag and figures', () => {
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
    })
    const fixture = TestBed.createComponent(MoneySummaryTable)
    const row = (currencyCode: string, net: string, hasIncome: boolean): MoneySummaryRow => ({
      currencyCode,
      income: hasIncome ? '+60,000' : '0.00',
      hasIncome,
      expense: '-12,300',
      net,
      transfer: null,
      debt: null,
    })
    fixture.componentRef.setInput('lines', [
      row('THB', '-12,300.00', false),
      row('JPY', '+47,700', true),
    ])
    fixture.detectChanges()
    const element = fixture.nativeElement as HTMLElement
    const rows = [...element.querySelectorAll('tbody tr')]
    expect(rows.map((tr) => tr.querySelector('th')?.textContent.trim())).toEqual(['THB', 'JPY'])
    expect(rows[1].querySelector('app-currency-flag')).not.toBeNull()
    expect(rows[1].textContent).toContain('+47,700')
    expect(rows[0].querySelector('.text-income')).toBeNull()
    expect(rows[1].querySelector('.text-income')).not.toBeNull()
  })
})
