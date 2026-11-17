import { TestBed } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import th from '@/core/i18n/th.json'
import { DemoBanner } from './demo-banner'

const HOUR = 3_600_000

const user = (overrides: Partial<AuthUser>): AuthUser => ({
  id: 'u1',
  email: 'demo-1@demo.invalid',
  displayName: 'ผู้ทดลองใช้',
  avatarUrl: null,
  timezone: 'Asia/Bangkok',
  isDemo: true,
  createdAt: new Date().toISOString(),
  hasPassword: false,
  phone: null,
  identities: [],
  ...overrides,
})

// docs/features/demo.md rule 10 and Q2.
describe('DemoBanner', () => {
  const render = (signedIn: AuthUser) => {
    TestBed.configureTestingModule({
      imports: [
        DemoBanner,
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
    })
    TestBed.inject(AuthStore).user.set(signedIn)
    const fixture = TestBed.createComponent(DemoBanner)
    fixture.detectChanges()
    return fixture.nativeElement as HTMLElement
  }

  it('says how many hours are left, counted from when the demo was made', () => {
    const created = new Date(Date.now() - 1.5 * HOUR).toISOString()

    expect(render(user({ createdAt: created })).textContent).toContain(
      th.demo.banner.replace('{{count}}', '23')
    )
  })

  it('never says less than 1 hour while the demo is still there', () => {
    const created = new Date(Date.now() - 30 * HOUR).toISOString()

    expect(render(user({ createdAt: created })).textContent).toContain(
      th.demo.banner.replace('{{count}}', '1')
    )
  })

  it('shows nothing for an account that is not a demo', () => {
    expect(render(user({ isDemo: false })).textContent.trim()).toBe('')
  })

  it('has no button to close it (Q2)', () => {
    expect(render(user({})).querySelector('button')).toBeNull()
  })
})
