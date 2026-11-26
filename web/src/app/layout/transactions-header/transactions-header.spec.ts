import { computed, signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { Router } from '@angular/router'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { BookService } from '@/core/book'
import th from '@/core/i18n/th.json'
import { SyncService } from '@/core/offline'
import type { SyncStatus } from '@/core/offline'
import { ReportService } from '@/core/report'
import {
  ActivityService,
  PeriodService,
  TransactionService,
  TransferService,
} from '@/core/transaction'
import type { ActivityScope, PeriodUnit, TransferSheetState } from '@/core/transaction'
import { TransactionsHeader } from './transactions-header'

describe('TransactionsHeader', () => {
  let fixture: ComponentFixture<TransactionsHeader>
  const unit = signal<PeriodUnit>('month')
  const customSheet = signal(false)
  const transferSheet = signal<TransferSheetState | null>(null)
  const activityScope = signal<ActivityScope | null>(null)
  const transactions = { viewWallet: signal(null), walletSheet: signal(false) }
  /** The period both tabs share. */
  const period = { customSheet, unit, selectUnit: (next: PeriodUnit) => unit.set(next) }

  const manyCurrencies = signal(false)
  const reports = { manyCurrencies }

  const element = () => fixture.nativeElement as HTMLElement
  const items = () =>
    [...element().querySelectorAll('[role^="menuitem"]')].map((item) => item.textContent.trim())
  const item = (text: string) =>
    [...element().querySelectorAll<HTMLElement>('[role^="menuitem"]')].find((el) =>
      el.textContent.trim().startsWith(text)
    )
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }
  const menuButton = () =>
    element().querySelector<HTMLElement>(`button[aria-label="${th.transfers.menu}"]`)

  beforeEach(async () => {
    unit.set('month')
    manyCurrencies.set(false)
    customSheet.set(false)
    transferSheet.set(null)
    activityScope.set(null)
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: TransactionService, useValue: transactions },
        { provide: ActivityService, useValue: { scope: activityScope } },
        { provide: ReportService, useValue: reports },
        { provide: PeriodService, useValue: period },
        {
          provide: TransferService,
          useValue: { open: (state: TransferSheetState) => transferSheet.set(state) },
        },
        {
          provide: BookService,
          useValue: {
            current: signal(null),
            isShared: signal(false),
            switchSheet: signal(false),
            rejectedItems: computed(() => []),
          },
        },
        {
          provide: SyncService,
          useValue: { status: signal<SyncStatus>('synced'), pendingCount: signal(0) },
        },
      ],
    })
    fixture = TestBed.createComponent(TransactionsHeader)
    await settle()
  })

  afterEach(() => fixture.destroy())

  it('opens a two-level menu: โอนเงิน and ดูตาม with the current unit (owner’s choice B)', async () => {
    menuButton()?.click()
    await settle()
    expect(items()).toHaveLength(5)
    expect(item(th.transfers.open)).toBeDefined()
    expect(item(th.debts.menu)).toBeDefined()
    expect(item(th.events.menu)).toBeDefined()
    expect(item(th.recurring.menu)).toBeDefined()
    expect(item(th.transactions.viewBy)?.textContent).toContain(th.transactions.unit.month)
  })

  it('turns into the units on ดูตาม, goes back on ‹, and stays open in between', async () => {
    menuButton()?.click()
    await settle()
    item(th.transactions.viewBy)?.click()
    await settle()
    expect(items().slice(1)).toEqual(Object.values(th.transactions.unit))
    item(th.transactions.viewBy)?.click() // the ‹ back item reads "ดูตาม" too
    await settle()
    expect(items()).toHaveLength(5)
  })

  it('chooses a unit and closes, or opens the custom range sheet', async () => {
    menuButton()?.click()
    await settle()
    item(th.transactions.viewBy)?.click()
    await settle()
    item(th.transactions.unit.year)?.click()
    await settle()
    expect(unit()).toBe('year')
    expect(items()).toEqual([])
    menuButton()?.click()
    await settle()
    item(th.transactions.viewBy)?.click()
    await settle()
    item(th.transactions.unit.custom)?.click()
    expect(customSheet()).toBe(true)
  })

  it('opens the transfer sheet from the menu', async () => {
    menuButton()?.click()
    await settle()
    item(th.transfers.open)?.click()
    await settle()
    expect(transferSheet()).toEqual({ mode: 'create' })
    expect(items()).toEqual([])
  })

  it('opens Account › รายการซ้ำ from the menu (recurring.md Q5)', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    menuButton()?.click()
    await settle()
    item(th.recurring.menu)?.click()
    await settle()
    expect(navigate).toHaveBeenCalledWith('/account/recurring')
    expect(items()).toEqual([])
  })

  it('lists กิจกรรม after รายการซ้ำ only while the book has activity, and opens it', async () => {
    menuButton()?.click()
    await settle()
    expect(item(th.activity.menu)).toBeUndefined()
    activityScope.set({ walletIds: ['w1'], ended: false, expiresAt: null })
    await settle()
    const names = items()
    expect(names.indexOf(th.activity.menu)).toBe(names.indexOf(th.recurring.menu) + 1)
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    item(th.activity.menu)?.click()
    await settle()
    expect(navigate).toHaveBeenCalledWith('/transactions/activity')
  })

  it('shows the days left in the last week of an ended share (shared-activity rule 7)', async () => {
    activityScope.set({ walletIds: ['w1'], ended: true, expiresAt: Date.now() + 20 * 86400000 })
    menuButton()?.click()
    await settle()
    expect(item(th.activity.menu)?.textContent.trim()).toBe(th.activity.menu)
    activityScope.set({ walletIds: ['w1'], ended: true, expiresAt: Date.now() + 4.5 * 86400000 })
    await settle()
    expect(item(th.activity.menu)?.textContent).toContain('เหลือ 5 วัน')
    activityScope.set({ walletIds: ['w1'], ended: true, expiresAt: Date.now() + 1000 })
    await settle()
    expect(item(th.activity.menu)?.textContent).toContain(th.activity.lastDay)
  })

  it('heads the Reports tab with only ดูตาม, every unit of the period both tabs share (report.md Q2)', async () => {
    fixture.componentRef.setInput('view', 'reports')
    await settle()
    menuButton()?.click()
    await settle()
    expect(items()).toHaveLength(1)
    expect(item(th.transfers.open)).toBeUndefined()
    item(th.transactions.viewBy)?.click()
    await settle()
    expect(items().slice(1)).toEqual(Object.values(th.transactions.unit))
    item(th.transactions.unit.quarter)?.click()
    await settle()
    expect(unit()).toBe('quarter')
    menuButton()?.click()
    await settle()
    item(th.transactions.viewBy)?.click()
    await settle()
    item(th.transactions.unit.custom)?.click()
    expect(customSheet()).toBe(true)
  })

  it('opens ภาพรวม from the Reports menu only when the book holds more than one currency (#24)', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    fixture.componentRef.setInput('view', 'reports')
    await settle()
    menuButton()?.click()
    await settle()
    expect(item(th.reports.overviewTitle)).toBeUndefined()
    menuButton()?.click()
    manyCurrencies.set(true)
    await settle()
    menuButton()?.click()
    await settle()
    expect(items()[0]).toBe(th.reports.overviewTitle)
    item(th.reports.overviewTitle)?.click()
    await settle()
    expect(navigate).toHaveBeenCalledWith('/reports/currencies')
    expect(items()).toHaveLength(0)
  })

  it('never shows ภาพรวม on the Transactions tab (#24)', async () => {
    manyCurrencies.set(true)
    menuButton()?.click()
    await settle()
    expect(item(th.reports.overviewTitle)).toBeUndefined()
  })
})
