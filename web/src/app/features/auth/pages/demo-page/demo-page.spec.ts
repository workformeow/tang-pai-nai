import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { Component } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { provideRouter, Router } from '@angular/router'
import { TranslocoTestingModule } from '@jsverse/transloco'
import th from '@/core/i18n/th.json'
import { DemoPage } from './demo-page'

@Component({ template: '' })
class Blank {}

const envelope = (data?: unknown) => ({ message: 'ok', timestamp: '', data })

const providers = (demo: boolean) => ({
  google: false,
  phone: false,
  botCheckSiteKey: null,
  testVersion: false,
  demo,
})

const demoSession = {
  accessToken: 'access-1',
  expiresIn: 600,
  user: {
    id: 'u1',
    email: 'demo-1@demo.invalid',
    displayName: 'ผู้ทดลองใช้',
    avatarUrl: null,
    timezone: 'Asia/Bangkok',
    isDemo: true,
    createdAt: '2026-11-17T05:00:00.000Z',
    hasPassword: false,
    phone: null,
    identities: [],
  },
}

// docs/features/demo.md rule 3: the page the resume links to.
describe('DemoPage', () => {
  let fixture: ComponentFixture<DemoPage>
  let http: HttpTestingController

  const page = () => fixture.nativeElement as HTMLElement
  const startButton = () =>
    [...page().querySelectorAll('button')].find((button) =>
      button.textContent.includes(th.demo.start)
    )
  const settle = async () => {
    await new Promise((resolve) => setTimeout(resolve))
    await fixture.whenStable()
    fixture.detectChanges()
  }

  const open = async (demo: boolean) => {
    fixture = TestBed.createComponent(DemoPage)
    fixture.detectChanges()
    http.expectOne('/api/auth/providers').flush(envelope(providers(demo)))
    await settle()
  }

  beforeEach(async () => {
    localStorage.clear()
    await TestBed.configureTestingModule({
      imports: [
        DemoPage,
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th', 'en'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '**', component: Blank }]),
      ],
    }).compileComponents()
    http = TestBed.inject(HttpTestingController)
  })

  afterEach(() => http.verify())

  it('says what the app and the demo are, and what is off, before anything is made', async () => {
    await open(true)

    const text = page().textContent
    expect(text).toContain(th.demo.intro)
    expect(text).toContain(th.demo.holdsWallets)
    expect(text).toContain(th.demo.deletedIn24h)
    expect(text).toContain(th.demo.offList)
    // Opening the page creates nothing: only the providers were asked.
    http.expectNone('/api/auth/demo')
  })

  it('starts the demo in the app’s language, then goes straight to Transactions', async () => {
    await open(true)

    startButton()?.click()
    await settle()
    const request = http.expectOne('/api/auth/demo')
    expect(request.request.body).toEqual({ lang: 'th' })
    request.flush(envelope(demoSession))
    await settle()

    expect(TestBed.inject(Router).url).toBe('/transactions')
  })

  it('shows how long to wait when the IP has started too many (rule 5)', async () => {
    await open(true)

    startButton()?.click()
    await settle()
    http
      .expectOne('/api/auth/demo')
      .flush(
        { message: 'slow down', code: 'RATE_LIMITED' },
        { status: 429, statusText: 'Too Many', headers: { 'Retry-After': '1800' } }
      )
    await settle()

    expect(page().querySelector('[role="alert"]')?.textContent).toContain('30')
    expect(TestBed.inject(Router).url).toBe('/')
  })

  it('says the demo is off and offers no button while DEMO_ENABLED is off (rule 1)', async () => {
    await open(false)

    expect(page().textContent).toContain(th.demo.disabled)
    expect(startButton()).toBeUndefined()
  })
})
