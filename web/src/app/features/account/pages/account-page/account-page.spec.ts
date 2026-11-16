import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { AuthService, AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import { BookService } from '@/core/book'
import th from '@/core/i18n/th.json'
import { provideNoLive } from '@/core/live/live-testing'
import { OfflineService, SyncService } from '@/core/offline'
import { DeviceStorageService } from '@/core/pwa'
import { PALETTES, ThemeService } from '@/core/theme'
import { TransactionService } from '@/core/transaction'
import { AccountPage } from './account-page'

describe('AccountPage', () => {
  let fixture: ComponentFixture<AccountPage>
  const authService = {
    loadMe: vi.fn(async () => Promise.resolve()),
    signOut: vi.fn(async () => Promise.resolve()),
  }
  const offlineService = {
    wipe: vi.fn(async () => Promise.resolve()),
    changes: signal(0),
    sharedActive: signal(false),
  }
  const syncService = {
    flush: vi.fn(async () => Promise.resolve(0)),
    serverTables: signal<readonly string[]>([]),
  }

  const page = () => fixture.nativeElement as HTMLElement
  const button = (label: string) =>
    [...page().querySelectorAll('button')].find((b) => b.textContent.trim() === label)
  /** The sign-out sheet renders into `document.body` (a drawer). */
  const sheet = () => document.body.querySelector('hlm-drawer-content')
  const sheetButton = (label: string) =>
    [...(sheet()?.querySelectorAll('button') ?? [])].find((b) => b.textContent.trim() === label)
  const settle = async () => {
    await fixture.whenStable()
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    syncService.serverTables.set([])
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideNoLive(),
        provideRouter([]),
        { provide: AuthService, useValue: authService },
        { provide: OfflineService, useValue: offlineService },
        { provide: SyncService, useValue: syncService },
        { provide: TransactionService, useValue: { addPeople: vi.fn() } },
        {
          provide: BookService,
          useValue: {
            current: signal({ id: 'p1', name: 'ส่วนตัว' }),
            currentId: signal('p1'),
            isShared: signal(false),
            shared: signal(null),
            books: signal([{}, {}]),
            ruleCount: () => 2,
          },
        },
        {
          provide: DeviceStorageService,
          useValue: { isInstalled: signal(false), isPersisted: signal(null) },
        },
        {
          provide: ThemeService,
          useValue: {
            preference: signal('system'),
            palette: signal(PALETTES[0]),
            setPreference: vi.fn(),
            setPalette: vi.fn(),
          },
        },
      ],
    })
    vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true)
    fixture = TestBed.createComponent(AccountPage)
    fixture.detectChanges()
  })

  it('links the books page and names the current book', () => {
    TestBed.inject(AuthStore).user.set({ displayName: 'mom', email: 'm@example.com' } as AuthUser)
    fixture.detectChanges()
    const link = page().querySelector('a[href="/account/books"]')
    expect(link?.textContent).toContain(th.account.books)
    expect(link?.textContent).toContain('ใช้อยู่: ส่วนตัว · ทั้งหมด 2')
  })

  it('groups rows that each open a page, with a line on what is there (A1)', () => {
    const headings = [...page().querySelectorAll('h2')].map((h) => h.textContent.trim())
    expect(headings).toEqual([
      th.account.group.data,
      th.account.group.security,
      th.account.group.settings,
      th.account.group.about,
    ])
    const links = [...page().querySelectorAll('a')].map((a) => a.getAttribute('href'))
    expect(links).toEqual([
      '/account/books',
      '/account/categories',
      '/account/sharing',
      '/account/recurring',
      '/account/export',
      '/account/security',
      '/account/appearance',
      '/account/install',
      '/account/device',
      '/account/privacy',
    ])
    const text = page().textContent
    expect(text).toContain('ของสมุด ส่วนตัว')
    // Recurring (#12): how many rules the book holds.
    expect(text).toContain('2 รายการใน ส่วนตัว')
    // Debts and events are data, not settings (owner, 2026-11): reached from their tabs.
    expect(text).not.toContain(th.debts.menu)
    expect(text).not.toContain(th.events.menu)
    expect(text).toContain('TH · ตามระบบ · Midnight Gold')
    // Install (install.md): not installed yet.
    expect(text).toContain(th.account.installHintNo)
    expect(text).toContain('เปิดในเบราว์เซอร์ · ไม่รองรับการเก็บถาวร')
  })

  /** Opens the sheet from the page's button. */
  const openSheet = async () => {
    button(th.account.signOut)?.click()
    await settle()
  }
  /** Opens the sheet, then taps its own "ออกจากระบบ". */
  const confirmSignOut = async () => {
    await openSheet()
    sheetButton(th.account.signOut)?.click()
    await settle()
  }

  afterEach(() => {
    document.body.querySelectorAll('hlm-drawer-content').forEach((el) => el.remove())
  })

  it('asks in a sheet before signing out, and can cancel', async () => {
    await openSheet()
    expect(sheet()?.textContent).toContain(th.account.signOutConfirmText)
    expect(syncService.flush).not.toHaveBeenCalled()
    sheetButton(th.account.cancel)?.click()
    await settle()
    expect(authService.signOut).not.toHaveBeenCalled()
  })

  it('once confirmed, pushes first, then signs out and wipes (rule 7)', async () => {
    await confirmSignOut()
    expect(syncService.flush).toHaveBeenCalledOnce()
    expect(authService.signOut).toHaveBeenCalledOnce()
    expect(offlineService.wipe).toHaveBeenCalledOnce()
  })

  it('warns in the sheet before losing ops that could not be pushed; cancel resets it', async () => {
    syncService.flush.mockResolvedValue(2)
    await confirmSignOut()
    expect(sheet()?.textContent).toContain('ยังมี 2 รายการที่ยังไม่ได้ sync')
    expect(authService.signOut).not.toHaveBeenCalled()
    sheetButton(th.account.cancel)?.click()
    await settle()
    await openSheet()
    expect(sheet()?.textContent).toContain(th.account.signOutConfirmText)
    expect(sheet()?.textContent).not.toContain('ยังมี 2 รายการ')
  })

  it('signs out anyway once the loss is confirmed', async () => {
    syncService.flush.mockResolvedValue(1)
    await confirmSignOut()
    sheetButton(th.account.signOutUnsyncedConfirm)?.click()
    await settle()
    expect(authService.signOut).toHaveBeenCalledOnce()
    expect(offlineService.wipe).toHaveBeenCalledOnce()
  })
})
