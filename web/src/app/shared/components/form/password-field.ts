import { Component, input, signal, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideEye, lucideEyeOff } from '@ng-icons/lucide'
import { BrnField } from '@spartan-ng/brain/field'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmInput } from '@spartan-ng/helm/input'
import { fieldErrorMessage } from './field-error'

@Component({
  selector: 'app-password-field',
  imports: [TranslocoPipe, ReactiveFormsModule, HlmFieldImports, HlmInput, NgIcon],
  providers: [provideIcons({ lucideEye, lucideEyeOff })],
  templateUrl: './password-field.html',
})
export class PasswordField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  hint = input('')
  autocomplete = input<'current-password' | 'new-password'>('current-password')

  protected visible = signal(false)

  private field = viewChild.required(BrnField)
  protected error = fieldErrorMessage(this.field)

  protected toggleVisible(): void {
    this.visible.update((visible) => !visible)
  }
}
