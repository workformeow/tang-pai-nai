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
  template: `
    <div class="flex flex-col gap-6 p-4">
      <button
        hlmBtn
        variant="ghost"
        type="button"
        class="tpn-hit -ms-1 h-9 gap-1 self-start tpn-glass rounded-full ps-2 pe-3.5"
        (click)="back()"
      >
        <ng-icon name="lucideChevronLeft" size="18" aria-hidden="true" />
        {{ 'title.security' | transloco }}
      </button>

      <section
        class="flex flex-col gap-3 rounded-xl bg-destructive/10 p-4 text-sm"
        aria-labelledby="delete-what"
      >
        <h2
          id="delete-what"
          class="flex items-center gap-2 text-base font-semibold text-destructive"
        >
          <ng-icon name="lucideTriangleAlert" size="20" aria-hidden="true" />
          {{ 'deleteAccount.heading' | transloco }}
        </h2>
        <p>{{ 'deleteAccount.whatGoes' | transloco }}</p>
        <p class="font-medium">{{ 'deleteAccount.noUndo' | transloco }}</p>
        @if (sharedWith() > 0) {
          <p>{{ 'deleteAccount.shared' | transloco: { count: sharedWith() } }}</p>
        }
        @if (unsynced() > 0) {
          <p>{{ 'deleteAccount.unsynced' | transloco: { count: unsynced() } }}</p>
        }
      </section>

      <p class="text-sm text-muted-foreground">
        {{ 'deleteAccount.exportFirst' | transloco }}
        <a routerLink="/account/export" class="text-foreground underline underline-offset-4">
          {{ 'account.export' | transloco }}
        </a>
      </p>

      @if (!networkStatusService.isOnline()) {
        <p role="status" class="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {{ 'deleteAccount.offline' | transloco }}
        </p>
      }

      @if (reauth.pending(); as action) {
        <app-reauth-step
          [email]="email()"
          [hasPassword]="hasPassword()"
          [method]="reauth.method()"
          [codeSent]="reauth.codeSent()"
          [secondsLeft]="reauth.secondsLeft()"
          [isProcessing]="isProcessing() || reauth.isBusy()"
          [error]="reauth.error()"
          (passwordSubmitted)="run($event)"
          (sendCode)="reauth.sendCode()"
          (codeSubmitted)="confirmWithCode($event)"
          (methodChange)="reauth.switchMethod($event)"
          (cancelled)="reauth.close()"
        />
      } @else {
        <form [formGroup]="form" class="flex flex-col gap-4" (ngSubmit)="onSubmit()">
          <app-input-field
            [control]="form.controls.email"
            type="email"
            autocomplete="off"
            inputmode="email"
            [label]="'deleteAccount.typeEmail' | transloco: { email: email() }"
          />
          @if (error(); as message) {
            <p role="alert" class="-mt-2 text-sm text-destructive">
              {{ message.key | transloco: message.params }}
            </p>
          }
          <button
            hlmBtn
            variant="destructive"
            type="submit"
            class="h-11 w-full text-base"
            [disabled]="!matches() || isProcessing() || !networkStatusService.isOnline()"
          >
            @if (isProcessing()) {
              <hlm-spinner [aria-label]="'deleteAccount.deleting' | transloco" />
            }
            {{ 'deleteAccount.confirm' | transloco }}
          </button>
        </form>
      }
    </div>
  `,
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
