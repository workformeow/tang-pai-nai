import { NgTemplateOutlet } from '@angular/common'
import { Component, inject, input, linkedSignal, output } from '@angular/core'
import { takeUntilDestroyed } from '@angular/core/rxjs-interop'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmSpinner } from '@spartan-ng/helm/spinner'
import type { UiMessage } from '@/core/auth'
import type {
  CurrentPasswordFormGroup,
  ReauthCodeFormGroup,
  ReauthMethod,
} from '@/features/account/account-form.type'
import { FORM_IMPORTS, OtpField, PasswordField, withMessage } from '@/shared/components/form'

const CODE_LENGTH = 6

/**
 * "Confirm it's you" (auth spec rule 13), shown in place when the API answers `REAUTH_REQUIRED`:
 * the current password, or a code mailed to the user's own email. Presentational: the page sends
 * the requests and passes their state back in.
 */
@Component({
  selector: 'app-reauth-step',
  imports: [
    FORM_IMPORTS,
    NgTemplateOutlet,
    TranslocoPipe,
    PasswordField,
    OtpField,
    HlmButton,
    HlmSpinner,
  ],
  templateUrl: './reauth-step.html',
})
export class ReauthStep {
  private nnfb = inject(NonNullableFormBuilder)

  email = input.required<string>()
  hasPassword = input.required<boolean>()
  method = input.required<ReauthMethod>()
  codeSent = input(false)
  secondsLeft = input(0)
  isProcessing = input(false)
  error = input<UiMessage | null>(null)
  /**
   * The last server answer, until the user edits the field: from then on only the field's own
   * message (if any) shows, never both at once.
   */
  protected shownError = linkedSignal(() => this.error())

  passwordSubmitted = output<string>()
  codeSubmitted = output<string>()
  sendCode = output()
  methodChange = output<ReauthMethod>()
  cancelled = output()

  passwordForm: CurrentPasswordFormGroup = this.nnfb.group({
    currentPassword: ['', withMessage(Validators.required, 'auth.passwordRequired')],
  })

  codeForm: ReauthCodeFormGroup = this.nnfb.group({
    code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
  })

  constructor() {
    this.passwordForm.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.shownError.set(null))
    // The last digit (typed, pasted or auto-filled) submits, as on the sign-in code screen.
    this.codeForm.valueChanges.pipe(takeUntilDestroyed()).subscribe(({ code }) => {
      this.shownError.set(null)
      if (code?.length === CODE_LENGTH) {
        this.submitCode()
      }
    })
  }

  protected submitPassword(): void {
    if (this.passwordForm.invalid || this.isProcessing()) {
      return
    }
    this.passwordSubmitted.emit(this.passwordForm.getRawValue().currentPassword)
  }

  protected submitCode(): void {
    if (this.codeForm.invalid || this.isProcessing()) {
      return
    }
    this.codeSubmitted.emit(this.codeForm.getRawValue().code)
    this.codeForm.reset({ code: '' }, { emitEvent: false })
  }
}
