import { Component, input, viewChild } from '@angular/core'
import { ReactiveFormsModule } from '@angular/forms'
import type { FormControl } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { NgIcon, provideIcons } from '@ng-icons/core'
import { lucideMinus, lucidePlus } from '@ng-icons/lucide'
import { BrnField } from '@spartan-ng/brain/field'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmFieldImports } from '@spartan-ng/helm/field'
import { HlmInput } from '@spartan-ng/helm/input'
import { fieldErrorMessage } from './field-error'

let nextId = 0

/**
 * A money amount typed in the currency's major unit (`inputmode="decimal"`), with a +/− button on
 * its left that flips the sign, because phone decimal keypads have no minus key (wallet rule 5).
 * The label is for screen readers; project the currency after the input (`amountSuffix`).
 * The text stays a string; the form converts it to minor units (`@/shared/utils` → `parseMajor`).
 */
@Component({
  selector: 'app-amount-field',
  imports: [ReactiveFormsModule, TranslocoPipe, NgIcon, HlmButton, HlmFieldImports, HlmInput],
  providers: [provideIcons({ lucideMinus, lucidePlus })],
  templateUrl: './amount-field.html',
})
export class AmountField {
  control = input.required<FormControl<string>>()
  /** True when the amount is below zero. */
  negative = input.required<FormControl<boolean>>()
  label = input.required<string>()
  placeholder = input('0')

  protected inputId = `amount-field-${nextId++}`
  private field = viewChild.required(BrnField)
  protected error = fieldErrorMessage(this.field)

  protected flip(): void {
    const negative = this.negative()
    negative.setValue(!negative.value)
    negative.markAsDirty()
  }
}
