import { Component, input, output, signal, viewChild } from '@angular/core'
import { TranslocoPipe } from '@jsverse/transloco'
import { PinPad } from './pin-pad'

/**
 * Choosing a PIN: type it, then type it again (offline-sync rule 1). Emits `chosen` once both
 * match; a mismatch starts over with one error line.
 */
@Component({
  selector: 'app-pin-setup',
  imports: [TranslocoPipe, PinPad],
  host: { class: 'flex flex-col items-center gap-6' },
  templateUrl: './pin-setup.html',
})
export class PinSetup {
  isProcessing = input(false)
  /** Translation key of the first step's heading. */
  newHeading = input('pin.newHeading')
  chosen = output<string>()

  private pad = viewChild.required(PinPad)
  protected first = signal<string | null>(null)
  protected mismatch = signal(false)

  /** Back to the first entry (e.g. after the parent failed to save). */
  reset(): void {
    this.first.set(null)
    this.pad().clear()
  }

  protected onCompleted(pin: string): void {
    const first = this.first()
    this.pad().clear()
    if (first === null) {
      this.first.set(pin)
      this.mismatch.set(false)
      return
    }
    if (first !== pin) {
      this.first.set(null)
      this.mismatch.set(true)
      return
    }
    this.chosen.emit(pin)
  }
}
