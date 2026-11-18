import { Location, NgTemplateOutlet } from '@angular/common'
import {
  afterNextRender,
  Component,
  computed,
  ElementRef,
  inject,
  Injector,
  signal,
} from '@angular/core'
import { ActivatedRoute, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucideKeyRound,
  lucideLockKeyhole,
  lucidePhone,
  lucideMonitor,
  lucideSmartphone,
  lucideTablet,
  lucideTrash2,
} from '@ng-icons/lucide'
import { toast } from '@spartan-ng/brain/sonner'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import {
  authErrorMessage,
  AuthService,
  AuthStore,
  formatThaiMobile,
  PHONE_FEATURE,
} from '@/core/auth'
import type { AuthDeviceSession, GoogleLinkFailure, UiMessage } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { OfflineService } from '@/core/offline'
import { NavHistory } from '@/core/routing'
import { ReauthStep } from '@/features/account/components/reauth-step'
import { deviceRow } from '@/features/account/device-label'
import { ReauthFlow } from '@/features/account/reauth-flow'
import { GoogleLogo } from '@/shared/components/brand'

/** What waits for "confirm it's you" (auth spec rules 29–30). */
type GoogleAction = 'link' | 'unlink'

/** What the user is asked to confirm before it happens (none of these can be undone). */
type Confirming = { kind: 'unlink' } | { kind: 'revoke'; id: string } | { kind: 'revokeOthers' }

const LINK_FAILURES: Record<GoogleLinkFailure, string> = {
  google_in_use: 'security.googleInUse',
  already_linked: 'security.googleAlreadyLinked',
  disabled: 'auth.userDisabled',
  rate_limited: 'auth.googleRateLimited',
  failed: 'security.googleLinkFailed',
}

const isLinkFailure = (value: string): value is GoogleLinkFailure =>
  Object.hasOwn(LINK_FAILURES, value)

/**
 * Account › Security (auth spec rules 28–30, 4.4a): the ways to sign in (password, Google) and
 * the signed-in devices, both online only, and this device's optional PIN (offline-sync rules 2
 * and 4), which works offline too.
 */
@Component({
  selector: 'app-security-page',
  imports: [
    NgTemplateOutlet,
    TranslocoPipe,
    RouterLink,
    NgIcon,
    HlmButton,
    HlmSpinner,
    GoogleLogo,
    ReauthStep,
  ],
  providers: [
    provideIcons({
      lucideChevronLeft,
      lucideChevronRight,
      lucideKeyRound,
      lucideLockKeyhole,
      lucidePhone,
      lucideMonitor,
      lucideSmartphone,
      lucideTablet,
      lucideTrash2,
    }),
    ReauthFlow,
  ],
  templateUrl: './security-page.html',
})
export class SecurityPage {
  private navHistory = inject(NavHistory)
  private location = inject(Location)
  private host = inject<ElementRef<HTMLElement>>(ElementRef)
  private injector = inject(Injector)
  private transloco = inject(TranslocoService)
  private authService = inject(AuthService)
  private languageService = inject(LanguageService)
  protected authStore = inject(AuthStore)
  protected networkStatusService = inject(NetworkStatusService)
  protected offlineService = inject(OfflineService)
  protected reauth = inject(ReauthFlow<GoogleAction>)

  /** Demo rule 9: the credential rows show, turned off, with "ใช้ไม่ได้ในโหมด Demo". */
  protected isDemo = computed(() => this.authStore.user()?.isDemo === true)

  // ── Ways to sign in: password, phone, Google (rules 29–30) ─────────────────

  /** Off until the phone feature is finished (`PHONE_FEATURE`): no phone row at all. */
  protected phoneFeature = inject(PHONE_FEATURE)
  protected phoneEnabled = signal(false)
  protected phone = computed(() => {
    const phone = this.authStore.user()?.phone
    return phone ? formatThaiMobile(phone) : null
  })
  protected googleEnabled = signal(false)
  // Google is the only provider, linked at most once per user (rule 29).
  protected google = computed(() => this.authStore.user()?.identities.at(0) ?? null)
  protected googleError = signal<UiMessage | null>(null)

  // ── Signed-in devices (rule 28) ────────────────────────────────────────────

  private sessions = signal<AuthDeviceSession[] | null>(null)
  protected devicesError = signal<UiMessage | null>(null)
  /** The rows; null while they load. */
  protected devices = computed(() => {
    const sessions = this.sessions()
    const locale = this.languageService.locale()
    const now = Date.now()
    return sessions ? sessions.map((session) => deviceRow(session, locale, now)) : null
  })
  protected otherCount = computed(
    () => this.sessions()?.filter((session) => !session.current).length ?? 0
  )

  // ── One question and one action at a time, across the page ─────────────────

  protected confirming = signal<Confirming | null>(null)
  /** The action in flight, for its spinner; every button waits while one runs. */
  protected busyWith = signal<GoogleAction | 'revoke' | 'revokeOthers' | null>(null)
  protected isBusy = computed(() => this.busyWith() !== null || this.reauth.isBusy())

  constructor() {
    const params = inject(ActivatedRoute).snapshot.queryParamMap
    const linked = params.get('linked') === 'google'
    const error = params.get('error')
    if (linked || error) {
      // A reload must not replay the outcome of the Google round trip.
      this.location.replaceState('/account/security')
    }
    if (linked) {
      toast.success(this.transloco.translate('security.googleLinked'))
    }
    if (error) {
      this.googleError.set({
        key: isLinkFailure(error) ? LINK_FAILURES[error] : 'security.googleLinkFailed',
      })
    }

    // Fresh profile (identities may have just changed); offline, the one in memory stays.
    this.authService.loadMe().catch(() => undefined)
    void this.authService.providers().then((providers) => {
      this.googleEnabled.set(providers.google)
      this.phoneEnabled.set(this.phoneFeature && providers.phone)
    })
    void this.loadDevices()
  }

  // ── Template actions: asking first ─────────────────────────────────────────

  protected ask(confirming: Confirming): void {
    this.googleError.set(null)
    this.devicesError.set(null)
    this.confirming.set(confirming)
    // The question opens under its row and may land behind the tab bar (hence `scroll-mb-24`):
    // bring its buttons up.
    afterNextRender(
      () => {
        this.host.nativeElement
          .querySelector('[data-confirm]')
          ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      },
      { injector: this.injector }
    )
  }

  protected isConfirmingRevoke(id: string): boolean {
    const confirming = this.confirming()
    return confirming?.kind === 'revoke' && confirming.id === id
  }

  // ── Template actions: Google ───────────────────────────────────────────────

  /** Link or unlink; on `REAUTH_REQUIRED` the confirm step shows and sends it again (rule 13). */
  protected async runGoogle(action: GoogleAction, currentPassword?: string): Promise<void> {
    this.busyWith.set(action)
    this.googleError.set(null)
    this.reauth.clearError()
    const lang = this.languageService.language().id
    try {
      if (action === 'link') {
        // On success the browser leaves for Google; the spinner stays until it does.
        await this.authService.linkGoogle(lang, currentPassword)
        return
      }
      await this.authService.unlinkGoogle(lang, currentPassword)
      this.reauth.close()
      this.confirming.set(null)
      toast.success(this.transloco.translate('security.unlinked'))
    } catch (error) {
      const apiError = toApiError(error)
      if (!this.reauth.refused(action, apiError, this.authStore.user()?.hasPassword ?? false)) {
        this.confirming.set(null)
        const fallback = action === 'link' ? 'security.googleLinkFailed' : 'security.unlinkFailed'
        this.googleError.set(authErrorMessage(apiError, fallback))
      }
    }
    this.busyWith.set(null)
  }

  protected async confirmWithCode(action: GoogleAction, code: string): Promise<void> {
    if (await this.reauth.verifyCode(code)) {
      await this.runGoogle(action)
    }
  }

  protected cancelGoogle(): void {
    this.reauth.close()
    this.confirming.set(null)
  }

  // ── Template actions: devices ──────────────────────────────────────────────

  protected async loadDevices(): Promise<void> {
    this.devicesError.set(null)
    try {
      this.sessions.set(await this.authService.sessions())
    } catch (error) {
      this.devicesError.set(authErrorMessage(toApiError(error), 'security.devicesFailed'))
    }
  }

  protected async revoke(id: string): Promise<void> {
    this.busyWith.set('revoke')
    this.devicesError.set(null)
    try {
      await this.authService.revokeSession(id)
      this.confirming.set(null)
      toast.success(this.transloco.translate('security.signedOutDevice'))
    } catch (error) {
      const apiError = toApiError(error)
      // Already gone (it signed out or expired meanwhile): the reload below shows that.
      if (apiError.status !== 404) {
        this.devicesError.set(authErrorMessage(apiError, 'security.signOutFailed'))
      }
      this.confirming.set(null)
    }
    await this.loadDevices()
    this.busyWith.set(null)
  }

  protected async revokeOthers(): Promise<void> {
    this.busyWith.set('revokeOthers')
    this.devicesError.set(null)
    try {
      const count = await this.authService.revokeOtherSessions()
      this.confirming.set(null)
      toast.success(this.transloco.translate('security.signedOutOthers', { count }))
    } catch (error) {
      this.devicesError.set(authErrorMessage(toApiError(error), 'security.signOutFailed'))
      this.confirming.set(null)
    }
    await this.loadDevices()
    this.busyWith.set(null)
  }

  /** Back where it was opened from, else up (NavHistory). */
  protected back(): void {
    this.navHistory.back()
  }
}
