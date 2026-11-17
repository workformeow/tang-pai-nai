import { signal } from '@angular/core'
import type { FormControl, ValidatorFn } from '@angular/forms'
import { addQuickAmount, amountText, CALC_KEYBOARD, evaluate, pressKey } from '@/shared/utils'
import type { CalcKey } from '@/shared/utils'

/**
 * The amount row's calculator keypad (8.2), for a sheet whose amount is an expression
 * (`120+65`): the keys, the quick amounts, a hardware keyboard, and when it shows. The sheet
 * renders `app-calc-amount-field` and `app-calc-keypad` and wires them here:
 *
 * ```ts
 * protected keypad = new AmountKeypad(this.form.controls.amount, () => this.minorUnit())
 * ```
 */
export class AmountKeypad {
  /** The keypad is showing. */
  open = signal(false)

  constructor(
    private control: FormControl<string>,
    private minorUnit: () => number
  ) {}

  /** A key of the keypad; "=" settles the expression and hides it. */
  press(key: CalcKey | '='): void {
    if (key === '=') {
      this.close()
      return
    }
    this.control.setValue(pressKey(this.control.value, key, this.minorUnit()))
    this.control.markAsDirty()
  }

  /** A quick amount adds to the expression, like counting notes (8.2). */
  addQuick(major: number): void {
    this.control.setValue(addQuickAmount(this.control.value, major, this.minorUnit()))
    this.control.markAsDirty()
  }

  /** "=": the expression becomes its result (`120+65` → `185`). */
  settle(): void {
    const result = evaluate(this.control.value, this.minorUnit())
    if (result.ok && result.minor > 0 && /[+\-×÷]/.test(this.control.value)) {
      this.control.setValue(amountText(result.minor, this.minorUnit()))
    }
  }

  /** The expression settles and the keypad hides (another row, "=", "✓"). */
  close(): void {
    this.settle()
    this.open.set(false)
  }

  /**
   * The keypad shows only while the amount row is in use (owner, 8.2): a tap on, or focus moving
   * to, any other control of the form closes it. Taps on blank space leave it open. Bind it to the
   * form's `(pointerdown)` and `(focusin)`.
   */
  leave(event: Event): void {
    const target = event.target
    if (
      !this.open() ||
      !(target instanceof Element) ||
      target.closest('app-calc-amount-field') ||
      !target.closest('button, input, label, textarea, select, [role="switch"]')
    ) {
      return
    }
    this.close()
  }

  /** A hardware keyboard types into the open keypad too, while the form's view shows. */
  onKey(event: KeyboardEvent, formShowing: boolean): void {
    if (!this.open() || !formShowing || event.target instanceof HTMLInputElement) {
      return
    }
    const key = /^\d$/.test(event.key) ? (event.key as CalcKey) : CALC_KEYBOARD[event.key]
    if (key) {
      event.preventDefault()
      event.stopPropagation()
      this.press(key)
    }
  }
}

/**
 * Rule 3 of transactions and transfers: the expression works out to 1 … `max` minor units, in the
 * minor unit of the wallet named by the sibling control `walletControl`.
 */
export const amountValidator =
  (walletControl: string, minorUnitOf: (walletId: string) => number, max: number): ValidatorFn =>
  (control) => {
    if (typeof control.value !== 'string') {
      return null
    }
    // The form isn't built yet on the first run, so the wallet comes from the sibling control.
    const walletId: unknown = control.parent?.get(walletControl)?.value
    const result = evaluate(
      control.value,
      minorUnitOf(typeof walletId === 'string' ? walletId : '')
    )
    if (!result.ok) {
      return { amountFormat: 'transactions.amountFormat' }
    }
    if (result.minor <= 0) {
      return { amountRequired: 'transactions.amountRequired' }
    }
    return result.minor > max ? { amountTooBig: 'transactions.amountTooBig' } : null
  }
