import { Component, input, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { BrnField } from '@spartan-ng/brain/field'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmInput } from '@spartan-ng/helm/input'
import { fieldErrorMessage } from './field-error'

type InputType = 'text' | 'email' | 'tel' | 'url' | 'search' | 'date'
type InputMode = 'text' | 'email' | 'tel' | 'url' | 'search' | 'numeric' | 'decimal'

@Component({
  selector: 'app-input-field',
  imports: [ReactiveFormsModule, HlmFieldImports, HlmInput],
  templateUrl: './input-field.html',
})
export class InputField {
  control = input.required<FormControl<string>>()
  label = input.required<string>()
  type = input<InputType>('text')
  placeholder = input('')
  hint = input('')
  autocomplete = input<string | null>(null)
  inputmode = input<InputMode | null>(null)

  private field = viewChild.required(BrnField)
  protected error = fieldErrorMessage(this.field)
}
