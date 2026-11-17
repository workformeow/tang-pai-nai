import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import th from '@/core/i18n/th.json'
import type { LocalDatabase } from '@/core/offline'
import type { ReportService } from '@/core/report'
import type { TransactionService } from '@/core/transaction'
import { setUpReports } from '@/features/reports/report-testing'
import { ReportCurrenciesPage } from './report-currencies-page'

describe('ReportCurrenciesPage', () => {
  let fixture: ComponentFixture<ReportCurrenciesPage>
  let db: LocalDatabase
  let reports: ReportService
  let transactions: TransactionService
  let setup: Awaited<ReturnType<typeof setUpReports>>

  const element = () => fixture.nativeElement as HTMLElement
  const rows = () =>
    [...element().querySelectorAll('li')].map((row) => row.textContent.replace(/\s+/g, ' ').trim())
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }

  beforeEach(async () => {
    setup = await setUpReports()
    ;({ db, reports, transactions } = setup)
    setup.wallet('usd', { currencyCode: 'USD', sortOrder: 3, initialBalance: 20000 })
    setup.transaction('2026-10-10', 'food', 1250, { walletId: 'usd' })
    TestBed.tick()
    fixture = TestBed.createComponent(ReportCurrenciesPage)
    await settle()
  })

  afterEach(() => {
    fixture.destroy()
    db.close()
  })

  it('lists every currency in wallet order: flag, income · expense, net, wallets and end balance (P1)', () => {
    expect(element().textContent).toContain(th.reports.overviewScope)
    expect(rows()).toEqual([
      expect.stringMatching(
        /^THB .*\+50,000\.00 .*-1,450\.00.*\+฿48,550\.00 2 กระเป๋า ยอดสุดท้าย ฿57,450\.00$/
      ),
      expect.stringMatching(/^USD .*0\.00 .*-12\.50.*-\$12\.50 1 กระเป๋า ยอดสุดท้าย \$187\.50$/),
    ])
    expect(element().querySelectorAll('li app-currency-flag')).toHaveLength(2)
    // Rows are not links: ‹ is the way back.
    expect(element().querySelector('li a, li button')).toBeNull()
  })

  it('counts every wallet whatever the wallet switcher chose', async () => {
    transactions.selectWallet('card')
    await settle()
    expect(rows()[0]).toContain('+฿48,550.00')
  })

  it('shares the Reports period: chips and swipe move it, and an empty period says so', async () => {
    reports.tab.set(-3)
    await settle()
    expect(rows()).toEqual([])
    expect(element().textContent).toContain(th.reports.overviewEmpty)
    reports.tab.set(-1)
    await settle()
    expect(rows()).toHaveLength(2)
  })
})
