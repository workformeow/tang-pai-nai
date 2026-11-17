import { Component, input, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { BrnField } from '@spartan-ng/brain/field'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmNativeSelectImports } from '@spartan-ng/helm/native-select'
import type { SelectOption } from '@/shared/types'
import { fieldErrorMessage } from './field-error'

/**
 * Native `<select>`: on phones it opens the OS picker, which beats any custom dropdown for a
 * short list. Use a bottom-sheet picker for long or rich lists (e.g. categories with icons).
 */
@Component({
  selector: 'app-select-field',
  imports: [ReactiveFormsModule, HlmFieldImports, HlmNativeSelectImports],
  templateUrl: './select-field.html',
})
export class SelectField<T extends string = string> {
  control = input.required<FormControl<T | ''>>()
  label = input.required<string>()
  options = input.required<readonly SelectOption<T>[]>()
  placeholder = input('')
  hint = input('')

  private field = viewChild.required(BrnField)
  protected error = fieldErrorMessage(this.field)
}
