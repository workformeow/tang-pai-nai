import { NgOptimizedImage } from '@angular/common'
import { Component, computed, effect, inject, signal } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder } from '@angular/forms'
import { ActivatedRoute, Router, RouterLink } from '@angular/router'
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronRight, lucideDownload, lucidePlay } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { AuthService, AuthStore, PHONE_FEATURE, safeReturnUrl } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { OfflineService } from '@/core/offline'
import { DeviceStorageService } from '@/core/pwa'
import { AuthFlowStore } from '@/features/auth/auth-flow.store'
import { EmailSignIn } from '@/features/auth/components/email-sign-in'
import { PasswordSignIn } from '@/features/auth/components/password-sign-in'
import { PhoneSignIn } from '@/features/auth/components/phone-sign-in'
import { GoogleLogo } from '@/shared/components/brand'
import { SegmentedField } from '@/shared/components/form'

type SignInMethod = 'email' | 'password' | 'phone'
const METHODS: readonly SignInMethod[] = ['email', 'password', 'phone']

/**
 * The one sign-in page: email code, password and phone as tabs (`?with=password|phone`, so back
 * and reload keep the tab), Google under "or". Each tab's form is its own component; this page
 * only lays them out.
 */
@Component({
  selector: 'app-sign-in-page',
  imports: [
    TranslocoPipe,
    NgOptimizedImage,
    RouterLink,
    NgIcon,
    HlmButton,
    HlmSpinner,
    GoogleLogo,
    SegmentedField,
    EmailSignIn,
    PasswordSignIn,
    PhoneSignIn,
  ],
  providers: [provideIcons({ lucideChevronRight, lucideDownload, lucidePlay })],
  // Coming back from Google with the browser's back button restores this page as it was left.
  host: { '(window:pageshow)': 'isLeaving.set(false)' },
  templateUrl: './sign-in-page.html',
})
export class SignInPage {
  private nnfb = inject(NonNullableFormBuilder)
  private router = inject(Router)
  private route = inject(ActivatedRoute)
  private transloco = inject(TranslocoService)
  private authService = inject(AuthService)
  private authStore = inject(AuthStore)
  private authFlowStore = inject(AuthFlowStore)
  private languageService = inject(LanguageService)
  protected networkStatusService = inject(NetworkStatusService)
  private offlineService = inject(OfflineService)
  protected deviceStorageService = inject(DeviceStorageService)

  protected returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'))

  /** Hidden until the API says Google sign-in is on (it's off without its env, rule 14). */
  /**
   * Whose data this device holds while nobody is signed in (an expired session): signing in as
   * them keeps it, another account wipes it (offline-sync rule 7).
   */
  protected localOwner = computed(() => this.offlineService.meta()?.displayName ?? null)
  protected googleEnabled = signal(false)
  /** Privacy rule 2: the API is a test copy (staging). */
  protected testVersion = signal(false)
  /** Demo rule 2: the ทดลองใช้ Demo button, while the API has the demo on. */
  protected demoEnabled = signal(false)
  /** Demo rule 14: the demo this device held ran out (said once). */
  protected demoExpired = this.authService.takeDemoExpired()
  /** Back from deleting the account (privacy rule 11). */
  protected deleted = this.route.snapshot.queryParamMap.get('deleted') === '1'
  /** Off until phone sign-in is finished (`PHONE_FEATURE`). */
  private phoneFeature = inject(PHONE_FEATURE)
  /** The phone tab shows once the API says it can send SMS (4.4b, rule 21). */
  protected phoneEnabled = signal(false)
  private providersKnown = signal(false)
  /** The browser is on its way to Google. */
  protected isLeaving = signal(false)

  /** Typed on the email or password tab, kept when switching between them. */
  protected email = signal(
    // An invitation mail links here with `?email=` (sharing.md rule 4): only a prefill.
    this.authFlowStore.pending().email || (this.route.snapshot.queryParamMap.get('email') ?? '')
  )

  protected methodControl = this.nnfb.control<string>(
    this.toMethod(this.route.snapshot.queryParamMap.get('with'))
  )
  private method = toSignal(this.methodControl.valueChanges, {
    initialValue: this.methodControl.value,
  })
  /** `?with=phone` while SMS turns out to be off falls back to the email tab. */
  protected shownMethod = computed(() => {
    const method = this.toMethod(this.method())
    return method === 'phone' && this.providersKnown() && !this.phoneEnabled() ? 'email' : method
  })
  protected methodOptions = computed(() => {
    this.languageService.language()
    const shown = this.shownMethod()
    return METHODS.filter(
      (method) => method !== 'phone' || this.phoneEnabled() || shown === 'phone'
    ).map((method) => ({
      value: method,
      label: this.transloco.translate(`auth.methods.${method}`),
    }))
  })

  constructor() {
    void this.offlineService.ready()
    // Asked again once back online, in case the page opened offline.
    effect(() => {
      if (this.networkStatusService.isOnline()) {
        void this.authService.providers().then((providers) => {
          this.googleEnabled.set(providers.google)
          this.testVersion.set(providers.testVersion)
          this.demoEnabled.set(providers.demo)
          this.phoneEnabled.set(this.phoneFeature && providers.phone)
          this.providersKnown.set(true)
        })
      }
    })
    // Opened offline: once the network is back, retry the silent refresh and walk straight in.
    effect(() => {
      if (this.networkStatusService.isOnline() && this.authStore.status() === 'unreachable') {
        void this.authService.restore().then(async (status) => {
          if (status === 'signedIn') {
            await this.router.navigateByUrl(this.returnUrl, { replaceUrl: true })
          }
        })
      }
    })
    // The tab lives in the URL, replacing the entry, so back leaves the page as before.
    this.methodControl.valueChanges.pipe(takeUntilDestroyed()).subscribe((value) => {
      const method = this.toMethod(value)
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { with: method === 'email' ? null : method },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      })
    })
  }

  protected continueWithGoogle(): void {
    this.isLeaving.set(true)
    this.authService.startGoogle(this.returnUrl, this.languageService.language().id)
  }

  private toMethod(value: string | null): SignInMethod {
    const method = METHODS.find((item) => item === value) ?? 'email'
    return method === 'phone' && !this.phoneFeature ? 'email' : method
  }
}
