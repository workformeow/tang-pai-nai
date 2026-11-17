import { Component, computed, DestroyRef, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronLeft } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import {
  authErrorMessage,
  AuthService,
  AuthStore,
  formatThaiMobile,
  normalizeThaiMobile,
  thaiMobileValidator,
} from '@/core/auth'
import type { UiMessage } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { NavHistory } from '@/core/routing'
import type { PhoneCodeFormGroup, PhoneNumberFormGroup } from '@/features/account/account-form.type'
import { ReauthStep } from '@/features/account/components/reauth-step'
import { ReauthFlow } from '@/features/account/reauth-flow'
import { FORM_IMPORTS, InputField, OtpField, withMessage } from '@/shared/components/form'

/** What waits for "confirm it's you" before it's sent again (auth spec rules 13 and 25). */
type PendingAction = { kind: 'send'; phone: string } | { kind: 'remove' }

const CODE_LENGTH = 6
const RESEND_COOLDOWN_MS = 60_000

/**
 * Add, change or remove the mobile number used for SMS sign-in (auth spec rule 25, 4.4b). A new
 * number gets an SMS code first and is saved only once that code is confirmed; the saved number
 * keeps working until then. Online only.
 */
@Component({
  selector: 'app-phone-page',
  imports: [
    FORM_IMPORTS,
    TranslocoPipe,
    NgIcon,
    InputField,
    OtpField,
    ReauthStep,
    HlmButton,
    HlmSpinner,
  ],
  providers: [provideIcons({ lucideChevronLeft }), ReauthFlow],
  templateUrl: './phone-page.html',
})
export class PhonePage {
  private nnfb = inject(NonNullableFormBuilder)
  private navHistory = inject(NavHistory)
  private authService = inject(AuthService)
  private authStore = inject(AuthStore)
  private languageService = inject(LanguageService)
  protected networkStatusService = inject(NetworkStatusService)
  protected reauth = inject(ReauthFlow<PendingAction>)

  protected email = computed(() => this.authStore.user()?.email ?? '')
  protected hasPassword = computed(() => this.authStore.user()?.hasPassword ?? false)
  private phone = computed(() => this.authStore.user()?.phone ?? null)
  protected savedPhone = computed(() => {
    const phone = this.phone()
    return phone ? formatThaiMobile(phone) : null
  })
  /** `null` until the API has answered; adding a number needs SMS (rule 21). */
  protected phoneEnabled = signal<boolean | null>(null)

  isProcessing = signal(false)
  protected error = signal<UiMessage | null>(null)
  protected removeError = signal<UiMessage | null>(null)
  protected done = signal<string | null>(null)
  protected confirmingRemove = signal(false)
  /** The number (E.164) the last code went to; the code step shows while it's set. */
  protected codeSentTo = signal<string | null>(null)

  private resendAt = signal(0)
  private now = signal(Date.now())
  protected secondsLeft = computed(() =>
    Math.max(0, Math.ceil((this.resendAt() - this.now()) / 1000))
  )

  /** Typing the saved number again would only cost an SMS (rule 25). */
  private notSavedNumber: ValidatorFn = (control) => {
    const value: unknown = control.value
    const phone = typeof value === 'string' ? normalizeThaiMobile(value) : null
    return phone && phone === this.phone() ? { unchanged: 'phone.unchanged' } : null
  }

  numberForm: PhoneNumberFormGroup = this.nnfb.group({
    phone: [
      '',
      [
        withMessage(Validators.required, 'auth.phoneRequired'),
        thaiMobileValidator,
        this.notSavedNumber,
      ],
    ],
  })

  codeForm: PhoneCodeFormGroup = this.nnfb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  })

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))

    // A server error describes the last submit; editing the form leaves only field messages.
    this.numberForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.error.set(null))
    // The last digit (typed, pasted or auto-filled from the SMS) submits.
    this.codeForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ code }) => {
      this.error.set(null)
      if (code?.length === CODE_LENGTH) {
        void this.confirm()
      }
    })

    // Fresh profile (the number may have changed on another device); offline, memory stays.
    this.authService.loadMe().catch(() => undefined)
    void this.authService.providers().then((providers) => {
      this.phoneEnabled.set(providers.phone)
    })
  }

  protected format(phone: string): string {
    return formatThaiMobile(phone)
  }

  protected async sendCode(): Promise<void> {
    const phone = normalizeThaiMobile(this.numberForm.getRawValue().phone)
    if (this.numberForm.invalid || !phone || this.isProcessing()) {
      return
    }
    // Shown the Thai way, whatever was typed.
    this.numberForm.controls.phone.setValue(formatThaiMobile(phone), { emitEvent: false })
    await this.run({ kind: 'send', phone })
  }

  protected askRemove(): void {
    this.done.set(null)
    this.removeError.set(null)
    this.confirmingRemove.set(true)
  }

  protected async confirmWithCode(action: PendingAction, code: string): Promise<void> {
    if (await this.reauth.verifyCode(code)) {
      await this.run(action)
    }
  }

  protected useOtherNumber(): void {
    this.codeSentTo.set(null)
    this.error.set(null)
    this.codeForm.reset({ code: '' }, { emitEvent: false })
  }

  /** The SMS code saves the number (no recent auth: the code was sent only after it). */
  protected async confirm(): Promise<void> {
    if (this.codeForm.invalid || this.isProcessing()) {
      return
    }
    const hadPhone = this.phone() !== null
    this.isProcessing.set(true)
    this.error.set(null)
    try {
      await this.authService.confirmPhone(
        this.codeForm.getRawValue().code,
        this.languageService.language().id
      )
      this.codeSentTo.set(null)
      this.numberForm.reset({ phone: '' })
      this.done.set(hadPhone ? 'phone.changed' : 'phone.added')
    } catch (error) {
      const apiError = toApiError(error)
      this.error.set(authErrorMessage(apiError, 'phone.saveFailed'))
      // The code is used up (or the number taken): start again from the number.
      if (apiError.code === 'PHONE_IN_USE') {
        this.codeSentTo.set(null)
      }
    } finally {
      this.codeForm.reset({ code: '' }, { emitEvent: false })
      this.isProcessing.set(false)
    }
  }

  /** Sends the action; on `REAUTH_REQUIRED` keeps it pending until the user confirms. */
  protected async run(action: PendingAction, currentPassword?: string): Promise<void> {
    this.isProcessing.set(true)
    this.error.set(null)
    this.removeError.set(null)
    this.reauth.clearError()
    this.done.set(null)
    try {
      if (action.kind === 'send') {
        await this.authService.changePhone(action.phone, currentPassword)
        // The last code input may have marked the control touched as it left the page.
        this.codeForm.reset({ code: '' }, { emitEvent: false })
        this.codeSentTo.set(action.phone)
        this.now.set(Date.now())
        this.resendAt.set(this.now() + RESEND_COOLDOWN_MS)
      } else {
        await this.authService.removePhone(this.languageService.language().id, currentPassword)
        this.confirmingRemove.set(false)
        this.done.set('phone.removed')
      }
      this.reauth.close()
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.retryAfterSeconds) {
        this.resendAt.set(Date.now() + apiError.retryAfterSeconds * 1000)
      }
      if (!this.reauth.refused(action, apiError, this.hasPassword())) {
        const message = authErrorMessage(
          apiError,
          action.kind === 'send' ? 'auth.sendFailed' : 'phone.saveFailed'
        )
        if (action.kind === 'remove') {
          this.removeError.set(message)
        } else {
          this.error.set(message)
        }
      }
    } finally {
      this.isProcessing.set(false)
    }
  }

  /** Back where it was opened from, else up (NavHistory). */
  protected back(): void {
    this.navHistory.back()
  }
}
