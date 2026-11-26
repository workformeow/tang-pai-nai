import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { provideRouter } from '@angular/router'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import th from '@/core/i18n/th.json'
import { NetworkStatusService } from '@/core/network'
import { findOp, OfflineService, putRow, SyncService } from '@/core/offline'
import type { LocalDatabase } from '@/core/offline'
import { openTestDatabase } from '@/core/offline/testing-db'
import { PeriodService, TransactionService, TransferService } from '@/core/transaction'
import { addDays, toDay } from '@/shared/utils'
import { TransactionsPage } from './transactions-page'

describe('TransactionsPage', () => {
  let fixture: ComponentFixture<TransactionsPage>
  let db: LocalDatabase
  let transactions: TransactionService
  const changes = signal(0)
  const today = toDay()
  const base = { createdAt: 1, updatedAt: 1, deletedAt: null, changeSeq: 5, updatedBy: 'u1' }

  const offline = {
    isOpen: signal(true),
    sharedActive: signal(false),
    leaveShared: () => undefined,
    isTrusted: signal(true),
    meta: signal(null),
    changes,
    db: () => db,
    write: <T>(work: (database: LocalDatabase) => T): T => {
      const result = db.transaction(work)
      changes.update((n) => n + 1)
      return result
    },
  }
  const sync = {
    canSync: signal(false),
    isSyncing: signal(false),
    rounds: signal(0),
    lastSyncedAt: signal<number | null>(1),
    rejectedOp: (opId: string) => findOp(db, opId),
  }
  const element = () => fixture.nativeElement as HTMLElement
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }
  const put = (table: string, row: object) => {
    putRow(db, table, { ...base, ...row })
    changes.update((n) => n + 1)
  }
  const transaction = (id: string, extra: object = {}) =>
    put('transactions', {
      id,
      bookId: 'p1',
      walletId: 'cash',
      categoryId: 'food',
      amount: 6500,
      occurredOn: today,
      note: '',
      excludeFromReport: false,
      ...extra,
    })
  const rows = () => [...element().querySelectorAll('section ul > li')]

  beforeEach(async () => {
    db = await openTestDatabase()
    localStorage.clear()
    put('books', { id: 'p1', name: 'Home', icon: 'lucideHouse', color: '#16a34a', sortOrder: 0 })
    putRow(db, 'currencies', {
      code: 'THB',
      minorUnit: 2,
      isActive: true,
      sortOrder: 0,
      createdAt: 1,
      updatedAt: 1,
      changeSeq: 1,
    })
    for (const [id, sortOrder] of [
      ['cash', 0],
      ['card', 1],
    ] as const) {
      put('wallets', {
        id,
        bookId: 'p1',
        name: id,
        currencyCode: 'THB',
        initialBalance: 100000,
        icon: 'lucideWallet',
        color: '#16a34a',
        excludeFromTotal: false,
        isArchived: false,
        sortOrder,
      })
    }
    put('categories', {
      id: 'food',
      bookId: 'p1',
      type: 'expense',
      parentId: null,
      name: 'Food',
      icon: 'lucideShapes',
      color: '#475569',
      isArchived: false,
      sortOrder: 0,
    })
    put('categories', {
      id: 'pay',
      bookId: 'p1',
      type: 'income',
      parentId: null,
      name: 'Pay',
      icon: 'lucideShapes',
      color: '#475569',
      isArchived: false,
      sortOrder: 0,
    })
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OfflineService, useValue: offline },
        { provide: SyncService, useValue: sync },
        {
          provide: NetworkStatusService,
          useValue: { isOnline: signal(true), serverReachable: signal(true) },
        },
      ],
    })
    TestBed.inject(AuthStore).user.set({ id: 'u1' } as AuthUser)
    transactions = TestBed.inject(TransactionService)
    fixture = TestBed.createComponent(TransactionsPage)
    await settle()
  })

  afterEach(() => {
    fixture.destroy()
    db.close()
  })

  it("groups this month's rows by day with the day's net, the summary and the total", async () => {
    transaction('a', { note: 'ลาเต้เย็น' })
    transaction('b', { amount: 4500000, categoryId: 'pay', walletId: 'card' })
    if (today.slice(8) !== '01') {
      transaction('c', { occurredOn: addDays(today, -1), amount: 1000 })
    }
    transaction('older', { occurredOn: addDays(`${today.slice(0, 8)}01`, -1) })
    await settle()
    const cards = [...element().querySelectorAll('section[aria-label]')].filter((s) =>
      s.querySelector('ul')
    )
    expect(cards[0].textContent).toContain(th.transactions.today)
    expect(cards[0].textContent).toContain('+44,935.00')
    expect(element().textContent).not.toContain('older')
    expect(element().textContent).toContain('฿')
    expect(rows()[0].textContent).toContain('Pay')
  })

  it('shows who else touched a row last, named once the members are read (shared-activity rule 6)', async () => {
    transaction('a', { note: 'ก๋วยเตี๋ยว', addedBy: 'm1', updatedBy: 'm1' })
    transaction('b', { note: 'mine', updatedBy: 'u1' })
    // Added by me, edited by the member two minutes later.
    transaction('c', { note: 'ชาไทย', updatedBy: 'm1', createdAt: 1, updatedAt: 120_001 })
    // Added by the member, then edited by me: the add still shows.
    transaction('d', {
      note: 'โจ๊ก',
      addedBy: 'm1',
      updatedBy: 'u1',
      createdAt: 1,
      updatedAt: 120_001,
    })
    await settle()
    const row = (note: string) => rows().find((li) => li.textContent.includes(note))
    expect(row('ก๋วยเตี๋ยว')?.textContent).toContain(`เพิ่มโดย ${th.sharing.member}`)
    expect(row('mine')?.textContent).not.toContain('โดย')
    expect(row('ชาไทย')?.textContent).toContain(`แก้ไขโดย ${th.sharing.member}`)
    expect(row('โจ๊ก')?.textContent).toContain(`เพิ่มโดย ${th.sharing.member}`)
    // Sharing rule 15: the owner's members, read online once.
    TestBed.inject(HttpTestingController)
      .expectOne('/api/sharing/books/p1')
      .flush({
        message: 'ok',
        timestamp: '',
        data: {
          members: [
            {
              userId: 'm1',
              displayName: 'แม่',
              email: 'm@x',
              role: 'editor',
              walletIds: [],
              addedAt: 1,
            },
          ],
          invites: [],
          unsharedWalletIds: [],
        },
      })
    await new Promise((resolve) => setTimeout(resolve))
    await settle()
    expect(row('ก๋วยเตี๋ยว')?.textContent).toContain('เพิ่มโดย แม่')
    expect(row('ชาไทย')?.textContent).toContain('แก้ไขโดย แม่')
  })

  it('shows the wallet badge and only the note on "ทุกกระเป๋า", no badge for one wallet', async () => {
    transaction('a', { note: 'ลาเต้เย็น' })
    await settle()
    const row = rows()[0]
    expect(row.querySelectorAll('app-icon-badge')).toHaveLength(2)
    expect(row.textContent).toContain('ลาเต้เย็น')
    expect(row.querySelector('.sr-only')?.textContent.trim()).toBe('cash')
    transactions.selectWallet('cash')
    await settle()
    expect(rows()[0].querySelectorAll('app-icon-badge')).toHaveLength(1)
  })

  it('draws a long period 100 rows at a time', async () => {
    for (let i = 0; i < 150; i++) {
      transaction(`t${String(i).padStart(3, '0')}`, { createdAt: i })
    }
    TestBed.inject(PeriodService).selectUnit('all')
    await settle()
    expect(rows()).toHaveLength(100)
    expect(element().querySelector('div.h-px')).not.toBeNull()
  })

  it('says when the period is empty and offers to add', () => {
    expect(element().textContent).toContain(th.transactions.emptyHeading)
    const add = [...element().querySelectorAll('button')].find(
      (b) => b.textContent.trim() === th.transactions.add
    )
    add?.click()
    expect(transactions.sheet()).toEqual({ mode: 'create' })
  })

  it('shows a transfer as two rows, out (red −) before in (green +), outside the day net (Q5)', async () => {
    transaction('a', { amount: 6000 })
    put('transfers', {
      id: 'r1',
      bookId: 'p1',
      fromWalletId: 'card',
      toWalletId: 'cash',
      amount: 100000,
      occurredOn: today,
      note: 'ATM',
      createdAt: 9,
    })
    await settle()
    const [out, into, food] = rows()
    expect(out.textContent).toContain(th.transfers.toWallet.replace('{{name}}', 'cash'))
    expect(out.textContent).toContain('-1,000.00')
    expect(out.querySelector('.text-expense')).not.toBeNull()
    expect(into.textContent).toContain(th.transfers.fromWallet.replace('{{name}}', 'card'))
    expect(into.textContent).toContain('+1,000.00')
    expect(into.querySelector('.text-income')).not.toBeNull()
    expect(food.textContent).toContain('Food')
    // The day's net and the summary are the expense only; both wallets in view, no "โอน" line.
    const card = element().querySelectorAll('section[aria-label]')[1]
    expect(card.querySelector(':scope > div > span:last-child')?.textContent.trim()).toBe('-60.00')
    const summary = element().querySelector(`section[aria-label="${th.transactions.summary}"]`)
    expect(summary?.textContent).not.toContain(th.transfers.summaryLine)
    // Either row opens the whole transfer.
    into.querySelector('button')?.click()
    expect(TestBed.inject(TransferService).sheet()).toEqual({ mode: 'edit', id: 'r1' })
  })

  it("shows one wallet's side only, with the transfer net as its own summary line", async () => {
    put('transfers', {
      id: 'r1',
      bookId: 'p1',
      fromWalletId: 'card',
      toWalletId: 'cash',
      amount: 100000,
      occurredOn: today,
      note: '',
    })
    transactions.selectWallet('cash')
    await settle()
    expect(rows()).toHaveLength(1)
    expect(rows()[0].textContent).toContain('+1,000.00')
    const summary = element().querySelector(`section[aria-label="${th.transactions.summary}"]`)
    expect(summary?.textContent).toContain(th.transfers.summaryLine)
    expect(summary?.textContent).toContain('+1,000.00')
  })

  it('shows what a card in view owes, with "ชำระบัตร" opening its pay sheet (credit-card rule 7)', async () => {
    const visa = {
      bookId: 'p1',
      name: 'Visa',
      currencyCode: 'THB',
      icon: 'lucideCreditCard',
      color: '#16a34a',
      isCreditCard: true,
      excludeFromTotal: true,
      isArchived: false,
      sortOrder: 2,
    }
    put('wallets', { ...visa, id: 'visa', initialBalance: -840000 })
    transactions.selectWallet('visa')
    await settle()
    const header = element().querySelector('div')?.textContent ?? ''
    expect(header).toContain(th.wallets.owed)
    expect(header).toContain('8,400.00')
    expect(element().textContent).toContain('ยอดค้าง ฿8,400.00')
    const pay = [...element().querySelectorAll('button')].find(
      (b) => b.textContent.trim() === th.transfers.payHeading
    )
    pay?.click()
    expect(TestBed.inject(TransferService).sheet()).toEqual({ mode: 'create', pay: 'visa' })
    // Paid off: no banner; a plain wallet never has one.
    put('wallets', { ...visa, id: 'visa', initialBalance: 0 })
    await settle()
    expect(element().textContent).not.toContain('ยอดค้าง')
    transactions.selectWallet('cash')
    await settle()
    expect(element().textContent).not.toContain('ยอดค้าง')
  })

  describe('cash / transfer vs credit card (owner 2026-11)', () => {
    const summaryCard = () =>
      element().querySelector(`section[aria-label="${th.transactions.summary}"]`)
    const cardMarks = (row: Element) =>
      row.querySelectorAll(`[role="img"][aria-label="${th.wallets.creditCard}"]`)

    beforeEach(() => {
      put('wallets', {
        id: 'visa',
        bookId: 'p1',
        name: 'Visa',
        currencyCode: 'THB',
        initialBalance: 0,
        icon: 'lucideCreditCard',
        color: '#2563eb',
        isCreditCard: true,
        excludeFromTotal: true,
        isArchived: false,
        sortOrder: 2,
      })
    })

    it('marks card rows before the amount and splits the expense, on "ทุกกระเป๋า" only', async () => {
      transaction('a', { note: 'cash row', amount: 45000 })
      transaction('b', { note: 'card row', amount: 500000, walletId: 'visa' })
      await settle()
      const byNote = (note: string) => rows().find((row) => row.textContent.includes(note))!
      expect(cardMarks(byNote('card row'))).toHaveLength(1)
      expect(cardMarks(byNote('cash row'))).toHaveLength(0)
      const summary = summaryCard()?.textContent ?? ''
      expect(summary).toContain(th.transactions.spendCash)
      expect(summary).toContain('-450.00')
      expect(summary).toContain(th.transactions.spendCard)
      expect(summary).toContain('-5,000.00')

      transactions.selectWallet('visa')
      await settle()
      expect(cardMarks(rows()[0])).toHaveLength(0)
      expect(summaryCard()?.textContent).not.toContain(th.transactions.spendCash)
    })

    it('leaves the split out when only one kind was spent', async () => {
      transaction('a', { amount: 45000 })
      await settle()
      expect(summaryCard()?.textContent).not.toContain(th.transactions.spendCash)
    })
  })

  describe('the summary with several currencies (owner 2026-11)', () => {
    const tableRows = () =>
      [...element().querySelectorAll('app-money-summary-table tbody tr')].map((tr) =>
        tr.textContent.replace(/s+/g, ' ').trim()
      )

    beforeEach(() => {
      putRow(db, 'currencies', {
        code: 'JPY',
        minorUnit: 0,
        isActive: true,
        sortOrder: 1,
        createdAt: 1,
        updatedAt: 1,
        changeSeq: 1,
      })
      put('wallets', {
        id: 'yen',
        bookId: 'p1',
        name: 'yen',
        currencyCode: 'JPY',
        initialBalance: 0,
        icon: 'lucideWallet',
        color: '#16a34a',
        excludeFromTotal: false,
        isArchived: false,
        sortOrder: 2,
      })
    })

    it('shows one row per currency in a table, with no chips that look like a list filter', async () => {
      transaction('a', { amount: 6500 })
      transaction('b', { amount: 1200, walletId: 'yen' })
      await settle()
      expect(element().querySelector('app-money-summary-card')).toBeNull()
      expect(tableRows()).toEqual(['THB 0.00-65.00-65.00', 'JPY 0-1,200-1,200'])
      // Only the period chips: nothing over the summary to tap.
      expect(element().querySelector(`[aria-label="${th.wallets.currency}"]`)).toBeNull()
      // The list keeps every row, as before.
      expect(rows()).toHaveLength(2)
    })

    it('keeps the card with one currency in view', async () => {
      transaction('a', { amount: 6500 })
      transaction('b', { amount: 1200, walletId: 'yen' })
      transactions.selectWallet('cash')
      await settle()
      expect(element().querySelector('app-money-summary-table')).toBeNull()
      expect(element().querySelectorAll('app-money-summary-card')).toHaveLength(1)
    })
  })

  describe('recurring (docs/features/recurring.md)', () => {
    const rule = (id: string, extra: object = {}) =>
      put('recurring_rules', {
        id,
        bookId: 'p1',
        kind: 'transaction',
        walletId: 'cash',
        categoryId: 'food',
        toWalletId: null,
        amount: 18000,
        note: 'water',
        excludeFromReport: false,
        startOn: '2026-11-05',
        frequency: 'month',
        interval: 1,
        endOn: null,
        endCount: null,
        confirm: true,
        nextOn: '2026-11-05',
        isPaused: false,
        ...extra,
      })

    beforeEach(() => {
      transactions.today.set('2026-11-08')
    })

    it('shows a card for the due ask-first ones, opening the due sheet (rule 10)', async () => {
      rule('r1')
      await settle()
      const card = [...element().querySelectorAll('button')].find((b) =>
        b.textContent.includes('ถึงกำหนด 1 รายการ')
      )
      expect(card?.textContent).toContain('Food 5 พ.ย.')
      card?.click()
      await settle()
      await fixture.whenStable()
      expect(document.body.textContent).toContain(th.recurring.dueHeading)
    })

    it('lists the ones to come in "อนาคต", faded and not counted, and marks recorded ones (rules 11, 17)', async () => {
      rule('r1', { confirm: false, nextOn: '2026-12-05' })
      transaction('t1', { occurredOn: '2026-11-05', recurringId: 'r1' })
      await settle()
      expect(rows()[0].querySelector('ng-icon[name="lucideRepeat"]')).not.toBeNull()
      TestBed.inject(PeriodService).select('future')
      await settle()
      const text = element().textContent
      expect(text).toContain(th.recurring.notRecorded)
      expect(rows().map((row) => row.textContent.includes('Food'))).toEqual([true, true, true])
      // Nothing to come is counted: no summary card for "อนาคต" without stored rows.
      expect(
        element().querySelector('section[aria-label="' + th.transactions.summary + '"]')
      ).toBeNull()
    })
  })
})
