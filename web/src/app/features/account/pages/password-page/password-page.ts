import { Component, computed, inject, signal } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronLeft } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import { authErrorMessage, AuthService, AuthStore, passwordPolicyValidator } from '@/core/auth'
import type { UiMessage } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { NavHistory } from '@/core/routing'
import type { NewPasswordFormGroup } from '@/features/account/account-form.type'
import { ReauthStep } from '@/features/account/components/reauth-step'
import { ReauthFlow } from '@/features/account/reauth-flow'
import { FORM_IMPORTS, PasswordField, withMessage } from '@/shared/components/form'

/** What waits for "confirm it's you" before it's sent again. */
type PendingAction = { kind: 'set'; newPassword: string } | { kind: 'remove' }

const matchesNewPassword: ValidatorFn = (control) => {
  const newPassword: unknown = control.parent?.get('newPassword')?.value
  return control.value && control.value !== newPassword
    ? { passwordMismatch: 'account.passwordMismatch' }
    : null
}

/**
 * Set, change or remove the optional password (auth spec rules 11 and 13). A `403
 * REAUTH_REQUIRED` swaps the form for the confirm step, then the same action is sent again.
 */
@Component({
  selector: 'app-password-page',
  imports: [FORM_IMPORTS, TranslocoPipe, NgIcon, PasswordField, ReauthStep, HlmButton, HlmSpinner],
  providers: [provideIcons({ lucideChevronLeft }), ReauthFlow],
  templateUrl: './password-page.html',
})
export class PasswordPage {
  private nnfb = inject(NonNullableFormBuilder)
  private navHistory = inject(NavHistory)
  private authService = inject(AuthService)
  private authStore = inject(AuthStore)
  private languageService = inject(LanguageService)
  protected networkStatusService = inject(NetworkStatusService)
  protected reauth = inject(ReauthFlow<PendingAction>)

  protected email = computed(() => this.authStore.user()?.email ?? '')
  protected hasPassword = computed(() => this.authStore.user()?.hasPassword ?? false)

  isProcessing = signal(false)
  protected error = signal<UiMessage | null>(null)
  protected done = signal<string | null>(null)
  protected confirmingRemove = signal(false)

  form: NewPasswordFormGroup = this.nnfb.group({
    newPassword: [
      '',
      [
        withMessage(Validators.required, 'auth.passwordRequired'),
        passwordPolicyValidator(() => this.email()),
      ],
    ],
    confirmPassword: [
      '',
      [withMessage(Validators.required, 'auth.passwordRequired'), matchesNewPassword],
    ],
  })

  constructor() {
    this.form.controls.newPassword.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.form.controls.confirmPassword.updateValueAndValidity())
    // A server error describes the last submit; editing the form leaves only field messages.
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.error.set(null))
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || this.isProcessing()) {
      return
    }
    await this.run({ kind: 'set', newPassword: this.form.getRawValue().newPassword })
  }

  protected async remove(): Promise<void> {
    await this.run({ kind: 'remove' })
  }

  protected async confirmWithPassword(action: PendingAction, currentPassword: string) {
    await this.run(action, currentPassword)
  }

  protected async confirmWithCode(action: PendingAction, code: string): Promise<void> {
    if (await this.reauth.verifyCode(code)) {
      await this.run(action)
    }
  }

  /** Back where it was opened from, else up (NavHistory). */
  protected back(): void {
    this.navHistory.back()
  }

  /** Sends the action; on `REAUTH_REQUIRED` keeps it pending until the user confirms. */
  private async run(action: PendingAction, currentPassword?: string): Promise<void> {
    this.isProcessing.set(true)
    this.error.set(null)
    this.reauth.clearError()
    this.done.set(null)
    const lang = this.languageService.language().id
    try {
      if (action.kind === 'set') {
        const hadPassword = this.hasPassword()
        await this.authService.setPassword(action.newPassword, lang, currentPassword)
        this.form.reset({ newPassword: '', confirmPassword: '' })
        this.done.set(hadPassword ? 'account.passwordChanged' : 'account.passwordSaved')
      } else {
        await this.authService.removePassword(lang, currentPassword)
        this.done.set('account.passwordRemoved')
      }
      this.reauth.close()
      this.confirmingRemove.set(false)
    } catch (error) {
      this.handleError(action, toApiError(error))
    } finally {
      this.isProcessing.set(false)
    }
  }

  private handleError(action: PendingAction, apiError: ReturnType<typeof toApiError>): void {
    if (!this.reauth.refused(action, apiError, this.hasPassword())) {
      this.error.set(authErrorMessage(apiError, 'account.passwordSaveFailed'))
    }
  }
}
