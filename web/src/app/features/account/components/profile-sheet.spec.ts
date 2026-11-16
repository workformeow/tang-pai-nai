import { signal } from '@angular/core'
import { TestBed } from '@angular/core/testing'
import type { ComponentFixture } from '@angular/core/testing'
import { TranslocoTestingModule } from '@jsverse/transloco'
import { toastState } from '@spartan-ng/brain/sonner'
import { AuthService, AuthStore } from '@/core/auth'
import type { AuthUser } from '@/core/auth'
import th from '@/core/i18n/th.json'
import { NetworkStatusService } from '@/core/network'
import { ProfileSheet } from './profile-sheet'

describe('ProfileSheet', () => {
  let fixture: ComponentFixture<ProfileSheet>
  const online = signal(true)
  const reachable = signal(true)
  const updateProfile = vi.fn(async (_name: string) => Promise.resolve())

  const body = () => document.body
  const sheet = () => body().querySelector('hlm-drawer-content')
  const nameInput = () => sheet()?.querySelector('input') as HTMLInputElement
  const saveButton = () =>
    [...(sheet()?.querySelectorAll('button') ?? [])].find(
      (b) => b.textContent.trim() === th.profile.save
    ) as HTMLButtonElement
  const settle = async () => {
    fixture.detectChanges()
    await fixture.whenStable()
    fixture.detectChanges()
  }
  const open = async () => {
    fixture.componentInstance.open.set(true)
    await settle()
  }
  const type = (value: string) => {
    nameInput().value = value
    nameInput().dispatchEvent(new Event('input'))
    fixture.detectChanges()
  }
  const submit = async () => {
    sheet()?.querySelector('form')?.dispatchEvent(new Event('submit'))
    await settle()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    toastState.dismiss()
    online.set(true)
    reachable.set(true)
    TestBed.configureTestingModule({
      imports: [
        TranslocoTestingModule.forRoot({
          langs: { th },
          translocoConfig: { availableLangs: ['th'], defaultLang: 'th' },
          preloadLangs: true,
        }),
      ],
      providers: [
        { provide: AuthService, useValue: { updateProfile } },
        {
          provide: NetworkStatusService,
          useValue: { isOnline: online, serverReachable: reachable },
        },
      ],
    })
    TestBed.inject(AuthStore).user.set({
      displayName: 'somchai.j',
      email: 'somchai.j@example.com',
    } as AuthUser)
    fixture = TestBed.createComponent(ProfileSheet)
    fixture.detectChanges()
  })

  afterEach(() => {
    toastState.dismiss()
    body()
      .querySelectorAll('hlm-drawer-content')
      .forEach((el) => el.remove())
  })

  it('starts from the current name and counts its characters', async () => {
    await open()
    expect(nameInput().value).toBe('somchai.j')
    expect(sheet()?.textContent).toContain(`${th.profile.hint} · 9/50`)
  })

  it('saves the trimmed name, closes and says so', async () => {
    await open()
    type('  สมชาย ใจดี  ')
    await submit()
    expect(updateProfile).toHaveBeenCalledWith('สมชาย ใจดี')
    expect(fixture.componentInstance.open()).toBe(false)
    expect(toastState.toasts().map((t) => t.title)).toContain(th.profile.saved)
  })

  it('refuses a blank name without calling the server', async () => {
    await open()
    type('   ')
    await submit()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(sheet()?.textContent).toContain(th.profile.nameRequired)
  })

  it('just closes when the name did not change', async () => {
    await open()
    await submit()
    expect(updateProfile).not.toHaveBeenCalled()
    expect(fixture.componentInstance.open()).toBe(false)
  })

  it('needs the network: says so and keeps save off while offline or the server is down', async () => {
    online.set(false)
    await open()
    expect(sheet()?.textContent).toContain(th.profile.needsOnline)
    expect(saveButton().disabled).toBe(true)

    online.set(true)
    reachable.set(false)
    await settle()
    expect(saveButton().disabled).toBe(true)
  })

  it('stays open with a message when saving fails', async () => {
    updateProfile.mockRejectedValueOnce(new Error('boom'))
    await open()
    type('สมชาย')
    await submit()
    expect(fixture.componentInstance.open()).toBe(true)
    expect(sheet()?.textContent).toContain(th.profile.saveFailed)
  })
})
