import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { signal } from '@angular/core'
import type { DebugElement } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { By } from '@angular/platform-browser'
import { provideRouter, Router } from '@angular/router'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import th from '@/core/i18n/th.json'
import { OfflineService, SyncService } from '@/core/offline'
import type { OutboxOp } from '@/core/offline'
import { ReauthStep } from '@/features/account/components/reauth-step'
import { DeletePage } from './delete-page'

const EMAIL = 'friend@example.com'

const user: AuthUser = {
  id: 'u1',
  email: EMAIL,
  displayName: 'friend',
  avatarUrl: null,
  timezone: 'Asia/Bangkok',
  hasPassword: false,
  identities: [],
  phone: null,
}

const envelope = (data?: unknown) => ({ message: 'ok', timestamp: '', data })

describe('DeletePage (privacy.md rules 5–11)', () => {
  let fixture: ComponentFixture<DeletePage>
  let http: HttpTestingController
  const wipe = vi.fn(async () => Promise.resolve())
  const sync = { pendingCount: signal(0), rejected: signal<OutboxOp[]>([]) }

  const host = () => fixture.nativeElement as HTMLElement
  const text = () => host().textContent
  const button = () => host().querySelector<HTMLButtonElement>('button[type=submit]')
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve))
    await fixture.whenStable()
    fixture.detectChanges()
  }
  const reauthStep = () =>
    (fixture.debugElement.query(By.directive(ReauthStep)) as DebugElement | null) !== null
  const type = async (email: string) => {
    fixture.componentInstance.form.controls.email.setValue(email)
    await settle()
  }
  const submit = async () => {
    host().querySelector('form')?.dispatchEvent(new Event('submit'))
    await settle()
  }

  /** Opens the page and answers its summary read. */
  const open = async (sharedWith = 0) => {
    TestBed.inject(AuthStore).setSession({ accessToken: 'token', expiresIn: 600, user })
    fixture = TestBed.createComponent(DeletePage)
    await settle()
    http.expectOne('/api/auth/account/deletion').flush(envelope({ sharedWith }))
    await settle()
  }

  beforeEach(async () => {
    wipe.mockClear()
    sync.pendingCount.set(0)
    await TestBed.configureTestingModule({
      imports: [
        DeletePage,
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th', 'en'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: OfflineService, useValue: { wipe } },
        { provide: SyncService, useValue: sync },
      ],
    }).compileComponents()
    http = TestBed.inject(HttpTestingController)
  })

  afterEach(() => http.verify())

  it('says what goes before anything can be pressed: people shared with and unsent changes', async () => {
    sync.pendingCount.set(3)
    await open(2)
    expect(text()).toContain(th.deleteAccount.whatGoes)
    expect(text()).toContain(th.deleteAccount.noUndo)
    expect(text()).toContain('กระเป๋าที่แชร์อยู่กับ 2 คนจะหายไปจากพวกเขาด้วย')
    expect(text()).toContain('มี 3 รายการที่ยังไม่ได้ sync จะหายไปด้วย')
  })

  it('keeps the button off until the typed email is the account’s, in any case', async () => {
    await open()
    expect(button()?.disabled).toBe(true)
    await type('someone@example.com')
    fixture.componentInstance.form.controls.email.markAsTouched() // left the field
    await settle()
    expect(button()?.disabled).toBe(true)
    expect(text()).toContain(th.deleteAccount.emailMismatch)
    await type(` ${EMAIL.toUpperCase()} `)
    expect(button()?.disabled).toBe(false)
  })

  it('deletes, wipes this device and lands on sign-in saying so', async () => {
    await open()
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
    await type(EMAIL)
    await submit()

    const req = http.expectOne('/api/auth/account')
    expect(req.request.method).toBe('DELETE')
    expect(req.request.body).toEqual({ email: EMAIL, lang: 'th' })
    req.flush(envelope())
    await settle()

    expect(wipe).toHaveBeenCalledOnce()
    expect(TestBed.inject(AuthStore).user()).toBeNull()
    expect(navigate).toHaveBeenCalledWith(['/auth/sign-in'], {
      queryParams: { deleted: 1 },
      replaceUrl: true,
    })
  })

  it('asks to confirm it is you on REAUTH_REQUIRED, then sends the same request again', async () => {
    await open()
    vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true)
    await type(EMAIL)
    await submit()
    http
      .expectOne('/api/auth/account')
      .flush(
        { message: 'REAUTH_REQUIRED', code: 'REAUTH_REQUIRED' },
        { status: 403, statusText: 'Forbidden' }
      )
    await settle()
    expect(reauthStep()).toBe(true)
    expect(wipe).not.toHaveBeenCalled()

    // A step-up code proves it, and the deletion goes again.
    fixture.debugElement
      .query(By.directive(ReauthStep))
      .triggerEventHandler('codeSubmitted', '123456')
    await settle()
    http.expectOne('/api/auth/reauth/verify').flush(envelope())
    await settle()
    http.expectOne('/api/auth/account').flush(envelope())
    await settle()
    expect(wipe).toHaveBeenCalledOnce()
  })

  it('shows the server’s refusal and keeps the device as it was', async () => {
    await open()
    await type(EMAIL)
    await submit()
    http
      .expectOne('/api/auth/account')
      .flush(
        { message: 'mismatch', code: 'ACCOUNT_EMAIL_MISMATCH' },
        { status: 422, statusText: 'Unprocessable' }
      )
    await settle()
    expect(text()).toContain(th.deleteAccount.emailMismatch)
    expect(wipe).not.toHaveBeenCalled()
  })
})
