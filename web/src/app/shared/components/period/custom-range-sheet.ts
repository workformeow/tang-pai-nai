import { Component, effect, inject, input, model, output, untracked } from '@angular/core'
import { NonNullableFormBuilder, Validators } from '@angular/forms'
import type { AbstractControl, ValidationErrors } from '@angular/forms'
import { TranslocoPipe } from '@jsverse/transloco'
import { HlmButton } from '@spartan-ng/helm/button'
import { HlmDrawerImports } from '@spartan-ng/helm/drawer'
import { FORM_IMPORTS, InputField } from '@/shared/components/form'
import { SheetFrame } from '@/shared/components/sheet'
import { addMonths, toDay } from '@/shared/utils'

/** A range of calendar days (`YYYY-MM-DD`); null = open. */
export interface DaySpan {
  from: string | null
  to: string | null
}

/**
 * "ดูตาม › กำหนดเอง": two dates, from ≤ to (transaction.md → Web screens). The Transactions and
 * Reports tabs each have their own (`range` in, `applied` out).
 */
@Component({
  selector: 'app-custom-range-sheet',
  imports: [FORM_IMPORTS, TranslocoPipe, HlmButton, HlmDrawerImports, InputField, SheetFrame],
  templateUrl: './custom-range-sheet.html',
})
export class CustomRangeSheet {
  private nnfb = inject(NonNullableFormBuilder)

  open = model(false)
  /** The range chosen before, if any (the form starts on this month otherwise). */
  range = input<DaySpan>({ from: null, to: null })
  applied = output<DaySpan>()

  protected form = this.nnfb.group(
    {
      from: ['', Validators.required],
      to: ['', Validators.required],
    },
    {
      validators: (group: AbstractControl): ValidationErrors | null => {
        const { from, to } = group.value as { from?: string; to?: string }
        return from && to && from > to ? { order: true } : null
      },
    }
  )

  constructor() {
    // Each opening starts from the range in use.
    effect(() => {
      if (this.open()) {
        untracked(() => {
          const { from, to } = this.range()
          this.form.reset({
            from: from ?? `${toDay().slice(0, 8)}01`,
            to: to ?? addMonths(toDay(), 0),
          })
        })
      }
    })
  }

  protected apply(): void {
    if (this.form.invalid) {
      return
    }
    const { from, to } = this.form.getRawValue()
    this.applied.emit({ from, to })
    this.open.set(false)
  }
}
