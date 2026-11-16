import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { BookService } from '@/core/book'
import th from '@/core/i18n/th.json'
import { NetworkStatusService } from '@/core/network'
import { SharingService } from '@/core/sharing'
import { TransactionService } from '@/core/transaction'
import type { ActivityItem, ActivityScope } from '@/core/transaction'
import { WalletService } from '@/core/wallet'
import { toDay } from '@/shared/utils'
import { ActivityPage } from './activity-page'

describe('ActivityPage', () => {
  let fixture: ComponentFixture<ActivityPage>
  const DAY = 86_400_000
  const now = Date.now()
  const scope = signal<ActivityScope | null>({ walletIds: ['cash'], ended: false, expiresAt: null })
  const lines = signal<ActivityItem[]>([])
  const people = signal<ReadonlyMap<string, string>>(new Map([['m1', 'แม่']]))
  const open = vi.fn()
  const loadOwner = vi.fn(async () => Promise.resolve({}))

  const item = (id: string, extra: Partial<ActivityItem> = {}): ActivityItem => ({
    id,
    bookId: 'p1',
    walletId: 'cash',
    categoryId: 'food',
    amount: 32000,
    occurredOn: toDay(),
    note: '',
    excludeFromReport: false,
    recurringId: null,
    debtId: null,
    eventId: null,
    addedBy: null,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    changeSeq: 1,
    kind: 'transaction',
    type: 'expense',
    categoryName: 'อาหาร',
    categoryIcon: '',
    categoryColor: '',
    walletName: 'กองกลาง',
    currencyCode: 'THB',
    eventName: null,
    action: 'added',
    actor: 'm1',
    ...extra,
  })

  const page = () => fixture.nativeElement as HTMLElement
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }

  beforeEach(async () => {
    vi.clearAllMocks()
    scope.set({ walletIds: ['cash'], ended: false, expiresAt: null })
    lines.set([])
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        {
          provide: TransactionService,
          useValue: {
            activityScope: scope,
            activity: () => lines(),
            people,
            today: signal(toDay()),
            open,
          },
        },
        { provide: WalletService, useValue: { minorUnit: () => 2 } },
        {
          provide: BookService,
          useValue: { currentId: signal('p1'), isShared: signal(false) },
        },
        { provide: SharingService, useValue: { loadOwner } },
        { provide: NetworkStatusService, useValue: { isOnline: signal(true) } },
      ],
    })
    fixture = TestBed.createComponent(ActivityPage)
    await settle()
  })

  it('says so when nothing changed in 90 days', () => {
    expect(page().textContent).toContain(th.activity.intro)
    expect(page().textContent).toContain(th.activity.empty)
  })

  it('reads the members once for their names (rules 1, 5)', () => {
    expect(loadOwner).toHaveBeenCalledOnce()
    expect(loadOwner).toHaveBeenCalledWith('p1')
  })

  it('lists who did what by day, "คุณ" for me and "อดีตสมาชิก" for someone gone (rules 3–5)', async () => {
    lines.set([
      item('a', { note: 'ข้าวซอย' }),
      item('b', { action: 'edited', actor: null, updatedAt: now - 1 }),
      item('c', { action: 'edited', actor: 'gone', updatedAt: now - DAY - 1 }),
    ])
    await settle()
    const days = [...page().querySelectorAll('section')]
    expect(days).toHaveLength(2)
    expect(days[0].querySelector('h2')?.textContent).toContain(th.activity.today)
    expect(days[1].querySelector('h2')?.textContent).toContain(th.activity.yesterday)
    const text = page().textContent
    expect(text).toContain(`แม่ ${th.activity.added} · อาหาร`)
    expect(text).toContain('ข้าวซอย · กองกลาง')
    expect(text).toContain(`${th.activity.you} ${th.activity.edited}`)
    expect(text).toContain(`${th.sharing.member} ${th.activity.edited}`)
    expect(text).toContain('-320.00')
  })

  it('opens a live row, and draws a deleted one struck through and not as a button (rule 10)', async () => {
    lines.set([item('live'), item('gone', { action: 'deleted', deletedAt: now })])
    await settle()
    const buttons = page().querySelectorAll('section li button')
    expect(buttons).toHaveLength(1)
    ;(buttons[0] as HTMLElement).click()
    expect(open).toHaveBeenCalledWith({ mode: 'edit', id: 'live' })
    expect(page().querySelector('.line-through')?.textContent).toContain('-320.00')
  })

  it('says until when an ended share shows, with the days left in its last week', async () => {
    expect(page().textContent).not.toContain(th.activity.ended)
    scope.set({ walletIds: ['cash'], ended: true, expiresAt: now + 30 * DAY })
    await settle()
    expect(page().textContent).toContain(th.activity.ended)
    expect(page().textContent).not.toContain('เหลือ')
    scope.set({ walletIds: ['cash'], ended: true, expiresAt: now + 4.5 * DAY })
    await settle()
    expect(page().textContent).toContain('(เหลือ 5 วัน)')
  })
})
