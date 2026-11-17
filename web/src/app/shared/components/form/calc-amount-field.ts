import { Component, computed, inject, input, output } from '@angular/core'
import { toObservable, toSignal } from '@angular/core/rxjs-interop'
import type { FormControl } from '@angular/forms'
import { map, startWith, switchMap } from 'rxjs'
import { TranslocoService } from '@jsverse/transloco'
import { CurrencyFlag } from '@/shared/components/currency-flag'
import { groupDigits } from '@/shared/utils'
import { firstErrorMessage } from './field-error'

/**
 * The transaction form's amount row (transaction.md → Web screens): the currency code and the
 * amount typed on `app-calc-keypad`, in large figures grouped in thousands for display. The
 * control holds the plain text (`8500`); the form reads it with `parseMajor`. Tapping the row
 * asks for the keypad (`activate`); the phone keyboard never opens.
 */
@Component({
  selector: 'app-calc-amount-field',
  imports: [CurrencyFlag],
  host: { class: 'block' },
  templateUrl: './calc-amount-field.html',
})
export class CalcAmountField {
  private transloco = inject(TranslocoService)

  control = input.required<FormControl<string>>()
  label = input.required<string>()
  currencyCode = input.required<string>()
  locale = input('th-TH')
  /** The keypad is open for this row. */
  active = input(false)
  activate = output()

  /** The control's value and touched state, followed through every control event. */
  private state = toSignal(
    toObservable(this.control).pipe(
      switchMap((control) =>
        control.events.pipe(
          startWith(null),
          map(() => ({ value: control.value, touched: control.touched }))
        )
      )
    ),
    { initialValue: { value: '', touched: false } }
  )
  private value = computed(() => this.state().value)
  /** The amount grouped in thousands (`8,500`); the control keeps `8500`. */
  protected shown = computed(() => groupDigits(this.value(), this.locale()) || '0')
  protected error = computed(() =>
    this.state().touched
      ? firstErrorMessage(this.control().errors, (key, params) =>
          this.transloco.translate(key, params)
        )
      : ''
  )
}
