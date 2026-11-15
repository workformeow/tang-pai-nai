import { provideHttpClient } from '@angular/common/http'
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import th from '@/core/i18n/th.json'
import { PrivacyPage } from './privacy-page'

const envelope = (data?: unknown) => ({ message: 'ok', timestamp: '', data })

describe('PrivacyPage (privacy.md rules 1–2)', () => {
  let fixture: ComponentFixture<PrivacyPage>
  let http: HttpTestingController

  const text = () => (fixture.nativeElement as HTMLElement).textContent
  const open = async (testVersion: boolean) => {
    fixture = TestBed.createComponent(PrivacyPage)
    fixture.detectChanges()
    http
      .expectOne('/api/auth/providers')
      .flush(envelope({ google: false, phone: false, botCheckSiteKey: null, testVersion }))
    await new Promise((resolve) => setTimeout(resolve))
    fixture.detectChanges()
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        PrivacyPage,
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents()
    http = TestBed.inject(HttpTestingController)
  })

  afterEach(() => http.verify())

  it('says what is kept, where, who sees it and how to delete it', async () => {
    await open(false)
    for (const key of ['kept', 'where', 'who', 'delete'] as const) {
      expect(text()).toContain(th.privacy.heading[key])
    }
    expect(text()).toContain(th.privacy.who2)
    expect(text()).not.toContain(th.privacy.testVersion)
  })

  it('says it is a test version while the API is one', async () => {
    await open(true)
    expect(text()).toContain(th.privacy.testVersion)
  })
})
