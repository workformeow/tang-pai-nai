import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { BookService } from '@/core/book'
import th from '@/core/i18n/th.json'
import { OfflineService, SyncService } from '@/core/offline'
import { WalletService } from '@/core/wallet'
import { DemoLoader } from './demo-loader'

// docs/features/demo.md rule 8: each line ticks when its step really ends.
describe('DemoLoader', () => {
  const offline = { isOpen: signal(false) }
  const book = { current: signal<{ id: string } | null>(null), firstPull: signal(true) }
  const wallet = { hasWallet: signal(false) }
  const sync = {
    pulledRows: signal(0),
    isSyncing: signal(true),
    sync: vi.fn(async () => Promise.resolve()),
  }

  const render = (failed = false) => {
    TestBed.configureTestingModule({
      imports: [
        DemoLoader,
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: OfflineService, useValue: offline },
        { provide: BookService, useValue: book },
        { provide: WalletService, useValue: wallet },
        { provide: SyncService, useValue: sync },
      ],
    })
    const fixture = TestBed.createComponent(DemoLoader)
    fixture.componentRef.setInput('failed', failed)
    fixture.detectChanges()
    return fixture
  }
  /** Each line as "done" / "waiting" / "running" / "failed" plus its text. */
  const lines = (element: HTMLElement) =>
    [...element.querySelectorAll('li')].map((li) => {
      const state = li.querySelector('hlm-spinner')
        ? 'running'
        : li.textContent.includes(th.demo.stepDone)
          ? 'done'
          : li.textContent.includes(th.demo.stepWaiting)
            ? 'waiting'
            : 'failed'
      return state
    })

  beforeEach(() => {
    offline.isOpen.set(false)
    book.current.set(null)
    book.firstPull.set(true)
    wallet.hasWallet.set(false)
    sync.pulledRows.set(0)
    sync.isSyncing.set(true)
    sync.sync.mockClear()
  })

  it('ticks the account first, then each step as it ends', () => {
    const fixture = render()
    const element = fixture.nativeElement as HTMLElement
    expect(lines(element)).toEqual(['done', 'running', 'waiting', 'waiting'])

    offline.isOpen.set(true)
    fixture.detectChanges()
    expect(lines(element)).toEqual(['done', 'done', 'running', 'waiting'])

    book.current.set({ id: 'b1' })
    wallet.hasWallet.set(true)
    sync.pulledRows.set(444)
    fixture.detectChanges()
    expect(lines(element)).toEqual(['done', 'done', 'done', 'running'])
    expect(element.textContent).toContain(th.demo.stepRows.replace('{{count}}', '444'))

    book.firstPull.set(false)
    fixture.detectChanges()
    expect(lines(element)).toEqual(['done', 'done', 'done', 'done'])
  })

  it('marks the step that failed and pulls again on ลองใหม่', () => {
    offline.isOpen.set(true)
    sync.isSyncing.set(false)
    book.firstPull.set(false)
    const fixture = render(true)
    const element = fixture.nativeElement as HTMLElement

    expect(lines(element)).toEqual(['done', 'done', 'failed', 'waiting'])
    expect(element.querySelector('[role="alert"]')?.textContent).toContain(th.demo.loadFailed)
    element.querySelector('button')?.click()
    expect(sync.sync).toHaveBeenCalledOnce()
  })
})
