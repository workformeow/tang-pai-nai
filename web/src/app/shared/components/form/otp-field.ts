import { Component, computed, input, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { BrnField } from '@spartan-ng/brain/field'
import { BrnInputOtp } from '@spartan-ng/brain/input-otp'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmInputOtpImports } from '@spartan-ng/helm/input-otp'
import { fieldErrorMessage } from './field-error'

/** One-time code (sign-in email code). `autocomplete="one-time-code"` lets the phone auto-fill it. */
@Component({
  selector: 'app-otp-field',
  imports: [ReactiveFormsModule, HlmFieldImports, BrnInputOtp, HlmInputOtpImports],
  templateUrl: './otp-field.html',
})
export class OtpField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  length = input(6)
  /** Keeps the label for screen readers only, where the heading already says what to type. */
  hideLabel = input(false)

  protected slots = computed(() => Array.from({ length: this.length() }))

  private field = viewChild.required(BrnField)
  protected error = fieldErrorMessage(this.field)
}
