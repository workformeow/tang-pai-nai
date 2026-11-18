import { Component, computed, effect, inject, signal, untracked } from '@angular/core'
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import type { ValidatorFn } from '@angular/forms'
import { Router, RouterLink } from '@angular/router'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideChevronLeft, lucideTriangleAlert } from '@ng-icons/lucide'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import { toApiError } from '@/core/api'
import type { ApiError } from '@/core/api'
import { authErrorMessage, AuthService, AuthStore, SIGN_IN_URL } from '@/core/auth'
import type { UiMessage } from '@/core/auth'
import { LanguageService } from '@/core/i18n'
import { NetworkStatusService } from '@/core/network'
import { OfflineService, SyncService } from '@/core/offline'
import { NavHistory } from '@/core/routing'
import type { DeleteAccountFormGroup } from '@/features/account/account-form.type'
import { ReauthStep } from '@/features/account/components/reauth-step'
import { ReauthFlow } from '@/features/account/reauth-flow'
import { FORM_IMPORTS, InputField, withMessage } from '@/shared/components/form'

/** The deletion waits for "confirm it's you" with nothing else to remember. */
type PendingAction = 'delete'

const normalize = (email: string) => email.trim().toLowerCase()

/**
 * Account › ความปลอดภัย › ลบบัญชี (privacy.md rules 4–11): what goes, then three confirmations
 * (recent auth, the typed email, the button). Deleting is at once; this device is wiped after.
 */
@Component({
  selector: 'app-delete-page',
  imports: [
    FORM_IMPORTS,
    TranslocoPipe,
    RouterLink,
    NgIcon,
    InputField,
    ReauthStep,
    HlmButton,
    HlmSpinner,
  ],
  providers: [provideIcons({ lucideChevronLeft, lucideTriangleAlert }), ReauthFlow],
  templateUrl: './delete-page.html',
})
export class DeletePage {
  private nnfb = inject(NonNullableFormBuilder)
  private router = inject(Router)
  private navHistory = inject(NavHistory)
  private authService = inject(AuthService)
  private authStore = inject(AuthStore)
  private languageService = inject(LanguageService)
  private offlineService = inject(OfflineService)
  private syncService = inject(SyncService)
  protected networkStatusService = inject(NetworkStatusService)
  protected reauth = inject(ReauthFlow<PendingAction>)

  protected email = computed(() => this.authStore.user()?.email ?? '')
  protected hasPassword = computed(() => this.authStore.user()?.hasPassword ?? false)
  /** Privacy rule 10: people whose shared view goes too. */
  protected sharedWith = signal(0)
  /** Privacy rule 5: changes that never reached the server go with the device's copy. */
  protected unsynced = computed(
    () => this.syncService.pendingCount() + this.syncService.rejected().length
  )

  isProcessing = signal(false)
  protected error = signal<UiMessage | null>(null)

  private matchesAccount: ValidatorFn = (control) =>
    typeof control.value === 'string' &&
    control.value.trim() !== '' &&
    normalize(control.value) !== normalize(this.email())
      ? { emailMismatch: 'deleteAccount.emailMismatch' }
      : null

  form: DeleteAccountFormGroup = this.nnfb.group({
    email: [
      '',
      [withMessage(Validators.required, 'deleteAccount.emailRequired'), this.matchesAccount],
    ],
  })

  private typed = toSignal(this.form.controls.email.valueChanges, { initialValue: '' })
  /** Privacy rule 6: the button stays off until the typed email is the account's. */
  protected matches = computed(
    () => this.email() !== '' && normalize(this.typed()) === normalize(this.email())
  )

  constructor() {
    effect(() => {
      if (this.networkStatusService.isOnline()) {
        untracked(() => {
          void this.authService
            .deletionSummary()
            .then((summary) => this.sharedWith.set(summary.sharedWith))
            .catch(() => undefined)
        })
      }
    })
    this.form.valueChanges.pipe(takeUntilDestroyed()).subscribe(() => this.error.set(null))
  }

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid || !this.matches() || this.isProcessing()) {
      return
    }
    await this.run()
  }

  protected async confirmWithCode(code: string): Promise<void> {
    if (await this.reauth.verifyCode(code)) {
      await this.run()
    }
  }

  protected back(): void {
    this.navHistory.back()
  }

  /** Deletes; on `REAUTH_REQUIRED` keeps it pending until the user confirms (rule 6). */
  protected async run(currentPassword?: string): Promise<void> {
    this.isProcessing.set(true)
    this.error.set(null)
    this.reauth.clearError()
    try {
      await this.authService.deleteAccount(
        this.form.getRawValue().email,
        this.languageService.language().id,
        currentPassword
      )
    } catch (error) {
      this.handleError(toApiError(error))
      this.isProcessing.set(false)
      return
    }
    this.reauth.close()
    // Rule 11: nothing of the account stays on this device; the outbox goes unsent.
    await this.offlineService.wipe().catch(() => undefined)
    await this.router.navigate([SIGN_IN_URL], { queryParams: { deleted: 1 }, replaceUrl: true })
  }

  private handleError(apiError: ApiError): void {
    if (!this.reauth.refused('delete', apiError, this.hasPassword())) {
      this.error.set(authErrorMessage(apiError, 'deleteAccount.failed'))
    }
  }
}
