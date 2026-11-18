import { Component, computed, DestroyRef, inject, signal, viewChild } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import { Router } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronLeft, lucideMail } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import { AuthService, formatThaiMobile, safeReturnUrl, authErrorMessage } from '@/core/auth'
import type { UiMessage } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { AuthFlowStore } from '@/features/auth/auth-flow.store'
import type { CodeFormGroup } from '@/features/auth/auth-form.type'
import { BotCheck } from '@/features/auth/components/bot-check'
import { FORM_IMPORTS, OtpField, withMessage } from '@/shared/components/form'

const CODE_LENGTH = 6

@Component({
  selector: 'app-enter-code-page',
  imports: [FORM_IMPORTS, TranslocoPipe, NgIcon, OtpField, HlmButton, HlmSpinner, BotCheck],
  providers: [provideIcons({ lucideChevronLeft, lucideMail })],
  templateUrl: './enter-code-page.html',
})
export class EnterCodePage {
  private nnfb = inject(NonNullableFormBuilder)
  private router = inject(Router)
  private authService = inject(AuthService)
  private authFlowStore = inject(AuthFlowStore)
  private languageService = inject(LanguageService)
  private botCheck = viewChild.required(BotCheck)

  protected email = computed(() => this.authFlowStore.pending().email)
  /** Set when the code went by SMS (4.4b) instead of email. */
  protected phone = computed(() => this.authFlowStore.pending().phone)
  protected formattedPhone = computed(() => formatThaiMobile(this.phone()))
  private now = signal(Date.now())
  protected secondsLeft = computed(() =>
    Math.max(0, Math.ceil((this.authFlowStore.pending().resendAt - this.now()) / 1000))
  )

  isProcessing = signal(false)
  protected isResending = signal(false)
  protected resent = signal(false)
  protected error = signal<UiMessage | null>(null)

  // One message for an empty and an unfinished code alike.
  form: CodeFormGroup = this.nnfb.group({
    code: [
      '',
      [
        withMessage(Validators.required, 'auth.codeIncomplete'),
        withMessage(Validators.pattern(/^\d{6}$/), 'auth.codeIncomplete'),
      ],
    ],
  })

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 1000)
    inject(DestroyRef).onDestroy(() => clearInterval(timer))

    // The last digit (typed, pasted or auto-filled from the mail suggestion) submits. The form's
    // own valueChanges, not the control's: the form's validity is only updated after the control
    // emits.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ code }) => {
      if (code?.length === CODE_LENGTH) {
        void this.onSubmit()
      }
    })
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isProcessing()) {
      return
    }
    this.isProcessing.set(true)
    this.error.set(null)
    this.resent.set(false)
    try {
      const { code } = this.form.getRawValue()
      if (this.phone()) {
        await this.authService.verifyPhone(this.phone(), code)
      } else {
        await this.authService.verifyCode(this.email(), code)
      }
      const returnUrl = safeReturnUrl(this.authFlowStore.pending().returnUrl)
      this.authFlowStore.clear()
      await this.router.navigateByUrl(returnUrl, { replaceUrl: true })
    } catch (error) {
      this.error.set(authErrorMessage(toApiError(error), 'auth.verifyFailed'))
      this.form.controls.code.reset('', { emitEvent: false })
    } finally {
      this.isProcessing.set(false)
    }
  }

  protected async resend(): Promise<void> {
    this.isResending.set(true)
    this.error.set(null)
    this.resent.set(false)
    try {
      const botToken = await this.botCheck().token()
      if (this.phone()) {
        await this.authService.startPhone(this.phone(), botToken)
      } else {
        await this.authService.startEmail(
          this.email(),
          this.languageService.language().id,
          botToken
        )
      }
      this.authFlowStore.resent()
      this.form.controls.code.reset('', { emitEvent: false })
      this.resent.set(true)
    } catch (error) {
      const apiError = toApiError(error)
      if (apiError.retryAfterSeconds) {
        this.authFlowStore.waitUntil(Date.now() + apiError.retryAfterSeconds * 1000)
      }
      this.error.set(authErrorMessage(apiError, 'auth.sendFailed'))
    } finally {
      this.botCheck().reset()
      this.isResending.set(false)
    }
  }

  /** The sign-in page's email tab, keeping where the user was headed. */
  protected async useEmail(): Promise<void> {
    const { returnUrl } = this.authFlowStore.pending()
    await this.router.navigate(['/auth/sign-in'], {
      queryParams: { returnUrl: returnUrl === '/' ? null : returnUrl },
    })
  }

  protected async back(): Promise<void> {
    const { returnUrl } = this.authFlowStore.pending()
    await this.router.navigate(['/auth/sign-in'], {
      queryParams: {
        returnUrl: returnUrl === '/' ? null : returnUrl,
        with: this.phone() ? 'phone' : null,
      },
    })
  }
}
